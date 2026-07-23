import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { $Enums, Prisma } from "@prisma/client";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { requireTenantRoles } from "@/lib/server-permissions";

export const dynamic = "force-dynamic";

const RESULT_PURPOSES = ["PROD_TEST"] as const;
const DRAFT_DISCIPLINES = ["RUN", "ROAD", "MTB"] as const;

type ValidationMessage = {
  code: string;
  severity: "warning" | "error";
  message?: string;
};

type StarterMatch = {
  teamId: string | null;
  participantId: string | null;
  classCode: string | null;
  messages: ValidationMessage[];
};

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

function formatClock(value: Date | null) {
  if (!value) return null;
  return [
    value.getHours().toString().padStart(2, "0"),
    value.getMinutes().toString().padStart(2, "0"),
    value.getSeconds().toString().padStart(2, "0"),
  ].join(":");
}

function formatRoadCsvBaseTime(value: Date | null) {
  if (!value) return null;
  return String(value.getHours() * 3600 + value.getMinutes() * 60 + value.getSeconds());
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function parsePayloadBaseTime(payload: unknown) {
  const record = asRecord(payload);
  const baseTimeIso = typeof record?.baseTimeIso === "string" ? record.baseTimeIso : null;
  if (!baseTimeIso) return null;
  const date = new Date(baseTimeIso);
  return Number.isNaN(date.getTime()) ? null : date;
}

function draftStatusFor(messages: ValidationMessage[]): $Enums.ResultDraftStatus {
  return messages.some((message) => message.severity === "error") ? "CONFLICT" : "DRAFT";
}

function conflictStatusFor(messages: ValidationMessage[]): $Enums.ResultConflictStatus {
  return messages.some((message) => message.severity === "error") ? "CONFLICT" : "UNCHECKED";
}

function buildTimekeepingDraftSnapshot(input: {
  timekeepingSession: {
    id: string;
    deviceId: string | null;
    deviceName: string | null;
    disciplineCode: $Enums.DisciplineCode;
    startBlockName: string;
    status: string;
  };
  event: {
    id: string;
    clientEventId: string;
    eventType: string;
    startNumber: string | null;
    recordedAt: Date;
    capturedAt: Date;
    rawElapsedMs: number | null;
    netElapsedMs: number | null;
    note: string | null;
    payload: Prisma.JsonValue | null;
  };
  elapsedMs: number | null;
  baseTime: Date | null;
  baseTimeClock: string | null;
  roadCsvBaseTime: string | null;
  validationMessages: ValidationMessage[];
}) {
  const { event, timekeepingSession, elapsedMs, baseTime, baseTimeClock, roadCsvBaseTime, validationMessages } = input;

  return {
    source: "TIMEKEEPING_SYNC",
    disciplineCode: timekeepingSession.disciplineCode,
    startNumber: event.startNumber,
    result: {
      rawValue: elapsedMs,
      rawValueText: formatElapsedMs(elapsedMs),
      status: elapsedMs === null ? "missing_time" : "valid",
    },
    classScoring: {
      points: null,
      rank: null,
    },
    overallGenderScoring: {
      points: null,
      rank: null,
    },
    legacy: {
      sourceRowNumbers: [],
      details: {
        uhrGueltig: elapsedMs === null ? "0" : "1",
        stopzeitUhr1: formatElapsedMs(event.rawElapsedMs),
        stopzeitNetto: formatElapsedMs(event.netElapsedMs),
        zeitBasis: roadCsvBaseTime,
        basiszeit: baseTimeClock,
        fields: {
          Au1Startnr: event.startNumber,
          Au1Disziplin: timekeepingSession.disciplineCode,
          AuZeit: formatElapsedMs(elapsedMs),
          AuZeitNetto: formatElapsedMs(event.netElapsedMs),
          AuZeitBrutto: formatElapsedMs(event.rawElapsedMs),
          AuZeitBasis: roadCsvBaseTime,
          Basiszeit: baseTimeClock,
        },
      },
    },
    timekeeping: {
      timekeepingSessionId: timekeepingSession.id,
      timekeepingEventId: event.id,
      clientEventId: event.clientEventId,
      deviceId: timekeepingSession.deviceId,
      deviceName: timekeepingSession.deviceName,
      eventType: event.eventType,
      startBlockName: timekeepingSession.startBlockName,
      status: timekeepingSession.status,
      recordedAt: event.recordedAt.toISOString(),
      capturedAt: event.capturedAt.toISOString(),
      rawElapsedMs: event.rawElapsedMs,
      netElapsedMs: event.netElapsedMs,
      selectedElapsedMs: elapsedMs,
      baseTimeIso: baseTime?.toISOString() ?? null,
      baseTimeClock,
      roadCsvBaseTime,
      note: event.note,
      validationMessages,
    },
  };
}

async function buildStarterMatches(
  competitionId: string,
  tenantId: string,
  disciplineCode: $Enums.DisciplineCode,
  events: Array<{ id: string; startNumber: string | null }>,
) {
  const startNumbers = [...new Set(events.map((event) => event.startNumber?.trim()).filter((value): value is string => Boolean(value)))];
  const matches = new Map<string, StarterMatch>();

  if (startNumbers.length === 0) {
    for (const event of events) {
      matches.set(event.id, {
        teamId: null,
        participantId: null,
        classCode: null,
        messages: [{ code: "missing_start_number", severity: "error" }],
      });
    }
    return matches;
  }

  const teams = await prisma.team.findMany({
    where: {
      competitionId,
      deletedAt: null,
      startNumber: { in: startNumbers },
      competition: { tenantId },
    },
    select: {
      id: true,
      startNumber: true,
      classificationCode: true,
      participants: {
        where: { deletedAt: null },
        select: { id: true, disciplineCode: true },
      },
    },
  });

  const teamsByStartNumber = new Map<string, typeof teams>();
  for (const team of teams) {
    if (!team.startNumber) continue;
    teamsByStartNumber.set(team.startNumber, [...(teamsByStartNumber.get(team.startNumber) ?? []), team]);
  }

  for (const event of events) {
    const startNumber = event.startNumber?.trim() ?? "";
    if (!startNumber) {
      matches.set(event.id, {
        teamId: null,
        participantId: null,
        classCode: null,
        messages: [{ code: "missing_start_number", severity: "error" }],
      });
      continue;
    }

    const candidates = teamsByStartNumber.get(startNumber) ?? [];
    if (candidates.length === 0) {
      matches.set(event.id, {
        teamId: null,
        participantId: null,
        classCode: null,
        messages: [{ code: "unmatched_start_number", severity: "error" }],
      });
      continue;
    }

    if (candidates.length > 1) {
      matches.set(event.id, {
        teamId: null,
        participantId: null,
        classCode: null,
        messages: [{ code: "ambiguous_start_number", severity: "error" }],
      });
      continue;
    }

    const [team] = candidates;
    const participants = team.participants.filter((participant) => participant.disciplineCode === disciplineCode);
    if (participants.length === 0) {
      matches.set(event.id, {
        teamId: team.id,
        participantId: null,
        classCode: team.classificationCode || null,
        messages: [{ code: "missing_discipline_participant", severity: "error" }],
      });
      continue;
    }

    if (participants.length > 1) {
      matches.set(event.id, {
        teamId: team.id,
        participantId: null,
        classCode: team.classificationCode || null,
        messages: [{ code: "ambiguous_discipline_participant", severity: "error" }],
      });
      continue;
    }

    matches.set(event.id, {
      teamId: team.id,
      participantId: participants[0].id,
      classCode: team.classificationCode || null,
      messages: [],
    });
  }

  return matches;
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

    if (!DRAFT_DISCIPLINES.includes(timekeepingSession.disciplineCode as (typeof DRAFT_DISCIPLINES)[number])) {
      return NextResponse.json({ error: "Diese Zeitnahme-Disziplin kann noch nicht als Draft übernommen werden." }, { status: 400 });
    }

    const starterMatches = await buildStarterMatches(
      competitionId,
      auth.tenantId,
      timekeepingSession.disciplineCode,
      newEvents,
    );
    const sessionBaseTime = timekeepingSession.manualStartedAt;
    const sessionBaseTimeClock = formatClock(sessionBaseTime);
    const sessionRoadCsvBaseTime = formatRoadCsvBaseTime(sessionBaseTime);
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
            deviceName: timekeepingSession.deviceName,
            disciplineCode: timekeepingSession.disciplineCode,
            startBlockName: timekeepingSession.startBlockName,
            baseTimeIso: sessionBaseTime?.toISOString() ?? null,
            baseTimeClock: sessionBaseTimeClock,
            roadCsvBaseTime: sessionRoadCsvBaseTime,
            status: timekeepingSession.status,
            importedAt: new Date().toISOString(),
          }),
          summary: jsonValue({
            disciplineCode: timekeepingSession.disciplineCode,
            startBlockName: timekeepingSession.startBlockName,
            deviceName: timekeepingSession.deviceName,
            timekeepingSessionId: timekeepingSession.id,
            baseTimeIso: sessionBaseTime?.toISOString() ?? null,
            baseTimeClock: sessionBaseTimeClock,
            roadCsvBaseTime: sessionRoadCsvBaseTime,
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
          const eventBaseTime = parsePayloadBaseTime(event.payload) ?? sessionBaseTime;
          const eventBaseTimeClock = formatClock(eventBaseTime);
          const eventRoadCsvBaseTime = formatRoadCsvBaseTime(eventBaseTime);
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
              baseTimeIso: eventBaseTime?.toISOString() ?? null,
              baseTimeClock: eventBaseTimeClock,
              roadCsvBaseTime: eventRoadCsvBaseTime,
              fields: {
                Au1Startnr: event.startNumber,
                Au1Disziplin: timekeepingSession.disciplineCode,
                AuZeit: formatElapsedMs(elapsedMs),
                AuZeitBasis: eventRoadCsvBaseTime,
                Basiszeit: eventBaseTimeClock,
              },
              note: event.note,
              payload: event.payload,
            }),
            validationStatus: validationMessages.length > 0 ? "WARNING" : "PENDING",
            validationMessages: jsonValue(validationMessages),
          };
        }),
      });

      const rawRecordIds = await tx.resultRawRecord.findMany({
        where: {
          batchId: batch.id,
          rowKey: { in: newEvents.map((event) => `timekeeping:${event.id}`) },
        },
        select: { id: true, rowKey: true },
      });
      const rawRecordIdByRowKey = new Map(rawRecordIds.map((record) => [record.rowKey, record.id]));

      await tx.resultDraft.createMany({
        data: newEvents.map((event) => {
          const elapsedMs = event.netElapsedMs ?? event.rawElapsedMs;
          const eventBaseTime = parsePayloadBaseTime(event.payload) ?? sessionBaseTime;
          const eventBaseTimeClock = formatClock(eventBaseTime);
          const eventRoadCsvBaseTime = formatRoadCsvBaseTime(eventBaseTime);
          const validationMessages: ValidationMessage[] = [
            ...(elapsedMs === null ? [{ code: "missing_elapsed", severity: "error" as const }] : []),
            ...(starterMatches.get(event.id)?.messages ?? []),
          ];
          const match = starterMatches.get(event.id);

          return {
            batchId: batch.id,
            sourceRawRecordId: rawRecordIdByRowKey.get(`timekeeping:${event.id}`) ?? null,
            tenantId: auth.tenantId,
            competitionId,
            status: draftStatusFor(validationMessages),
            conflictStatus: conflictStatusFor(validationMessages),
            disciplineCode: timekeepingSession.disciplineCode,
            participantId: match?.participantId ?? null,
            teamId: match?.teamId ?? null,
            startNumber: event.startNumber,
            rawValue: elapsedMs,
            rawValueText: formatElapsedMs(elapsedMs),
            normalizedValue: elapsedMs,
            netElapsedMs: elapsedMs,
            timekeepingEventId: event.id,
            proposedResultSnapshot: jsonValue(buildTimekeepingDraftSnapshot({
              timekeepingSession,
              event,
              elapsedMs,
              baseTime: eventBaseTime,
              baseTimeClock: eventBaseTimeClock,
              roadCsvBaseTime: eventRoadCsvBaseTime,
              validationMessages,
            })),
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
            baseTimeIso: sessionBaseTime?.toISOString() ?? null,
            baseTimeClock: sessionBaseTimeClock,
            roadCsvBaseTime: sessionRoadCsvBaseTime,
            purpose,
            importedRecords: newEvents.length,
            draftsCreated: newEvents.length,
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
          draftsCreated: newEvents.length,
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
