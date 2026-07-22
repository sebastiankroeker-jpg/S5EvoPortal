import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Prisma } from "@prisma/client";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { requireTenantRoles } from "@/lib/server-permissions";

export const dynamic = "force-dynamic";

const RESULT_PURPOSES = ["PROD_TEST"] as const;

function parsePurpose(value: unknown) {
  if (typeof value !== "string") return null;
  return RESULT_PURPOSES.includes(value as (typeof RESULT_PURPOSES)[number])
    ? value as (typeof RESULT_PURPOSES)[number]
    : null;
}

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function formatElapsedMs(value: number | null) {
  if (value === null) return null;
  const minutes = Math.floor(value / 60000);
  const seconds = Math.floor((value % 60000) / 1000);
  const millis = value % 1000;
  return `${minutes}:${seconds.toString().padStart(2, "0")}.${millis.toString().padStart(3, "0")}`;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const competitionId = typeof body.competitionId === "string" ? body.competitionId : null;
    const timekeepingSessionId = typeof body.sessionId === "string" ? body.sessionId : null;
    const purpose = parsePurpose(body.purpose);
    const label = typeof body.label === "string" && body.label.trim() ? body.label.trim() : null;

    if (!competitionId || !timekeepingSessionId || !purpose) {
      return NextResponse.json({ error: "competitionId, sessionId und purpose sind erforderlich." }, { status: 400 });
    }

    const competition = await prisma.competition.findUnique({
      where: { id: competitionId },
      select: { id: true, tenantId: true, name: true, year: true },
    });
    if (!competition) {
      return NextResponse.json({ error: "Wettkampf nicht gefunden." }, { status: 404 });
    }

    const auth = await requireTenantRoles(session, ["ADMIN"], {
      tenantId: competition.tenantId,
      fallbackToFirstMatchingTenant: false,
    });
    if ("error" in auth) return auth.error;

    const timekeepingSession = await prisma.timekeepingSession.findFirst({
      where: {
        id: timekeepingSessionId,
        tenantId: auth.tenantId,
        competitionId,
      },
      include: {
        events: {
          where: { eventType: "FINISH" },
          orderBy: { recordedAt: "asc" },
        },
      },
    });

    if (!timekeepingSession) {
      return NextResponse.json({ error: "Zeitnahme-Session nicht gefunden." }, { status: 404 });
    }

    if (timekeepingSession.events.length === 0) {
      return NextResponse.json({ error: "Diese Zeitnahme-Session enthaelt keine Zieleinlauf-Events." }, { status: 400 });
    }

    const rowKeys = timekeepingSession.events.map((event) => `timekeeping:${event.id}`);
    const existingRows = await prisma.resultRawRecord.findMany({
      where: {
        tenantId: auth.tenantId,
        competitionId,
        rowKey: { in: rowKeys },
      },
      select: { rowKey: true },
    });
    const importedRowKeys = new Set(existingRows.map((row) => row.rowKey));
    const newEvents = timekeepingSession.events.filter((event) => !importedRowKeys.has(`timekeeping:${event.id}`));

    if (newEvents.length === 0) {
      return NextResponse.json({
        error: "Alle Zieleinlauf-Events dieser Session sind bereits in Ergebnis-Paketen enthalten.",
        counts: {
          finishEvents: timekeepingSession.events.length,
          importedFinishEvents: existingRows.length,
          newFinishEvents: 0,
        },
      }, { status: 409 });
    }

    const withoutStartNumber = newEvents.filter((event) => !event.startNumber?.trim()).length;
    const withoutElapsed = newEvents.filter((event) => event.netElapsedMs === null && event.rawElapsedMs === null).length;
    const warningCount = withoutStartNumber + withoutElapsed;
    const defaultLabel = `Zeitnahme ${timekeepingSession.disciplineCode} ${timekeepingSession.startBlockName}`;

    const result = await prisma.$transaction(async (tx) => {
      const batch = await tx.resultDataBatch.create({
        data: {
          tenantId: auth.tenantId,
          competitionId,
          createdById: auth.user.id,
          source: "TIMEKEEPING_SYNC",
          purpose,
          status: "STAGED",
          label: label || defaultLabel,
          externalRef: `timekeeping-session:${timekeepingSession.id}`,
          sourceVersion: timekeepingSession.updatedAt.toISOString(),
          payload: jsonValue({
            type: "TIMEKEEPING_SESSION_IMPORT",
            timekeepingSessionId: timekeepingSession.id,
            deviceId: timekeepingSession.deviceId,
            disciplineCode: timekeepingSession.disciplineCode,
            startBlockName: timekeepingSession.startBlockName,
            status: timekeepingSession.status,
            importedAt: new Date().toISOString(),
          }),
          summary: jsonValue({
            disciplineCode: timekeepingSession.disciplineCode,
            startBlockName: timekeepingSession.startBlockName,
            timekeepingSessionId: timekeepingSession.id,
            finishEvents: timekeepingSession.events.length,
            importedRecords: newEvents.length,
            skippedDuplicates: timekeepingSession.events.length - newEvents.length,
            withStartNumber: newEvents.length - withoutStartNumber,
            withoutStartNumber,
            withoutElapsed,
          }),
          validationSummary: jsonValue({
            status: warningCount > 0 ? "WARNING" : "PENDING",
            warnings: warningCount,
            missingStartNumber: withoutStartNumber,
            missingElapsed: withoutElapsed,
            duplicatesSkipped: timekeepingSession.events.length - newEvents.length,
          }),
        },
      });

      await tx.resultRawRecord.createMany({
        data: newEvents.map((event) => {
          const elapsedMs = event.netElapsedMs ?? event.rawElapsedMs;
          const validationMessages = [
            ...(!event.startNumber?.trim() ? ["missing_start_number"] : []),
            ...(elapsedMs === null ? ["missing_elapsed"] : []),
          ];

          return {
            batchId: batch.id,
            tenantId: auth.tenantId,
            competitionId,
            rowKey: `timekeeping:${event.id}`,
            disciplineCode: timekeepingSession.disciplineCode,
            startNumber: event.startNumber,
            rawValue: elapsedMs,
            rawValueText: formatElapsedMs(elapsedMs),
            recordedAt: event.recordedAt,
            payload: jsonValue({
              source: "TIMEKEEPING_SYNC",
              timekeepingSessionId: timekeepingSession.id,
              timekeepingEventId: event.id,
              clientEventId: event.clientEventId,
              eventType: event.eventType,
              capturedAt: event.capturedAt,
              rawElapsedMs: event.rawElapsedMs,
              netElapsedMs: event.netElapsedMs,
              note: event.note,
              payload: event.payload,
            }),
            validationStatus: validationMessages.length > 0 ? "WARNING" : "PENDING",
            validationMessages: jsonValue(validationMessages),
          };
        }),
      });

      await tx.auditEvent.create({
        data: {
          tenantId: auth.tenantId,
          competitionId,
          actorId: auth.user.id,
          action: "RESULT_TIMEKEEPING_SESSION_STAGED",
          scopeType: "result-staging",
          scopeId: batch.id,
          entityType: "ResultDataBatch",
          entityId: batch.id,
          afterData: jsonValue({
            batchId: batch.id,
            timekeepingSessionId: timekeepingSession.id,
            purpose,
            importedRecords: newEvents.length,
            skippedDuplicates: timekeepingSession.events.length - newEvents.length,
            warningCount,
          }),
        },
      });

      return {
        batchId: batch.id,
        label: batch.label,
        counts: {
          finishEvents: timekeepingSession.events.length,
          importedRecords: newEvents.length,
          skippedDuplicates: timekeepingSession.events.length - newEvents.length,
          missingStartNumber: withoutStartNumber,
          missingElapsed: withoutElapsed,
          warnings: warningCount,
        },
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to import timekeeping session into result staging:", error);
    return NextResponse.json({ error: "Zeitnahme-Session konnte nicht ins Ergebnis-Staging uebernommen werden." }, { status: 500 });
  }
}
