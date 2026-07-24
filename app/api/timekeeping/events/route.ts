import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Prisma } from "@prisma/client";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { requireTenantRoles } from "@/lib/server-permissions";

const TIMEKEEPING_ROLES = ["ZEITNAHME"] as const;
const TIMEKEEPING_DISCIPLINES = ["RUN", "ROAD", "MTB"] as const;
const EVENT_TYPES = new Set(["BLOCK_START", "FINISH", "ASSIGN_START_NUMBER", "NOTE"]);

type IncomingEvent = {
  clientEventId?: unknown;
  eventType?: unknown;
  recordedAt?: unknown;
  startNumber?: unknown;
  rawElapsedMs?: unknown;
  netElapsedMs?: unknown;
  note?: unknown;
  payload?: unknown;
};

function parseDate(value: unknown) {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseOptionalInteger(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.round(value);
}

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return value as Prisma.InputJsonValue;
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const competitionId = typeof body.competitionId === "string" ? body.competitionId : null;
  const sessionPayload = body.session && typeof body.session === "object" ? body.session as Record<string, unknown> : null;
  const events = Array.isArray(body.events) ? body.events as IncomingEvent[] : [];

  if (!competitionId || !sessionPayload) {
    return NextResponse.json({ error: "competitionId and session required" }, { status: 400 });
  }

  const competition = await prisma.competition.findUnique({
    where: { id: competitionId },
    select: { id: true, tenantId: true },
  });

  if (!competition) {
    return NextResponse.json({ error: "Competition not found" }, { status: 404 });
  }

  const auth = await requireTenantRoles(session, [...TIMEKEEPING_ROLES], {
    tenantId: competition.tenantId,
    fallbackToFirstMatchingTenant: false,
  });
  if ("error" in auth) return auth.error;

  const disciplineCode = typeof sessionPayload.disciplineCode === "string" ? sessionPayload.disciplineCode : "";
  if (!TIMEKEEPING_DISCIPLINES.includes(disciplineCode as (typeof TIMEKEEPING_DISCIPLINES)[number])) {
    return NextResponse.json({ error: "Unsupported discipline" }, { status: 400 });
  }

  const sessionId = typeof sessionPayload.id === "string" && sessionPayload.id.length > 0
    ? sessionPayload.id
    : undefined;
  const deviceId = typeof sessionPayload.deviceId === "string" && sessionPayload.deviceId.length > 0
    ? sessionPayload.deviceId
    : "unknown-device";
  const deviceName = typeof sessionPayload.deviceName === "string" && sessionPayload.deviceName.trim()
    ? sessionPayload.deviceName.trim()
    : null;
  const startBlockName = typeof sessionPayload.startBlockName === "string" && sessionPayload.startBlockName.trim()
    ? sessionPayload.startBlockName.trim()
    : "Block 1";
  const firstStartNumber = parseOptionalInteger(sessionPayload.firstStartNumber);
  const startIntervalSeconds = parseOptionalInteger(sessionPayload.startIntervalSeconds) ?? (disciplineCode === "ROAD" ? 30 : 0);
  const manualStartedAt = parseDate(sessionPayload.manualStartedAt);

  const validEvents = events.flatMap((event) => {
    const clientEventId = typeof event.clientEventId === "string" && event.clientEventId.length > 0
      ? event.clientEventId
      : null;
    const eventType = typeof event.eventType === "string" && EVENT_TYPES.has(event.eventType)
      ? event.eventType
      : null;
    const recordedAt = parseDate(event.recordedAt);
    if (!clientEventId || !eventType || !recordedAt) return [];

    const startNumber = typeof event.startNumber === "string" && event.startNumber.trim()
      ? event.startNumber.trim()
      : null;

    return [{
      clientEventId,
      eventType,
      recordedAt,
      startNumber,
      rawElapsedMs: parseOptionalInteger(event.rawElapsedMs),
      netElapsedMs: parseOptionalInteger(event.netElapsedMs),
      note: typeof event.note === "string" && event.note.trim() ? event.note.trim() : null,
      payload: toJson(event.payload),
      tenantId: auth.tenantId,
      competitionId,
      actorId: auth.user.id,
    }];
  });

  const result = await prisma.$transaction(async (tx) => {
    const timekeepingSession = sessionId
      ? await tx.timekeepingSession.upsert({
          where: { id: sessionId },
          create: {
            id: sessionId,
            tenantId: auth.tenantId,
            competitionId,
            createdById: auth.user.id,
            deviceId,
            deviceName,
            disciplineCode: disciplineCode as (typeof TIMEKEEPING_DISCIPLINES)[number],
            startBlockName,
            firstStartNumber,
            startIntervalSeconds,
            manualStartedAt,
          },
          update: {
            deviceId,
            deviceName,
            startBlockName,
            firstStartNumber,
            startIntervalSeconds,
            manualStartedAt,
          },
        })
      : await tx.timekeepingSession.create({
          data: {
            tenantId: auth.tenantId,
            competitionId,
            createdById: auth.user.id,
            deviceId,
            deviceName,
            disciplineCode: disciplineCode as (typeof TIMEKEEPING_DISCIPLINES)[number],
            startBlockName,
            firstStartNumber,
            startIntervalSeconds,
            manualStartedAt,
          },
        });

    let accepted = 0;
    for (const event of validEvents) {
      await tx.timekeepingEvent.upsert({
        where: {
          sessionId_clientEventId: {
            sessionId: timekeepingSession.id,
            clientEventId: event.clientEventId,
          },
        },
        create: {
          ...event,
          sessionId: timekeepingSession.id,
        },
        update: {
          eventType: event.eventType,
          recordedAt: event.recordedAt,
          startNumber: event.startNumber,
          rawElapsedMs: event.rawElapsedMs,
          netElapsedMs: event.netElapsedMs,
          note: event.note,
          payload: event.payload,
          actorId: event.actorId,
        },
      });
      accepted += 1;
    }

    if (validEvents.length > 0) {
      await tx.auditEvent.create({
        data: {
          tenantId: auth.tenantId,
          competitionId,
          actorId: auth.user.id,
          action: "TIMEKEEPING_EVENTS_SYNCED",
          scopeType: "TIMEKEEPING_SESSION",
          scopeId: timekeepingSession.id,
          entityType: "TimekeepingEvent",
          entityId: timekeepingSession.id,
          afterData: {
            disciplineCode,
            startBlockName,
            deviceId,
            deviceName,
            received: validEvents.length,
            accepted,
          },
        },
      });
    }

    return {
      sessionId: timekeepingSession.id,
      accepted,
      received: events.length,
      ignored: events.length - validEvents.length,
      syncedAt: new Date().toISOString(),
    };
  });

  return NextResponse.json(result);
}
