import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { requireCompetitionTenantRoles } from "@/lib/server-permissions";

export const dynamic = "force-dynamic";

const TIMEKEEPING_DISCIPLINES = ["RUN", "ROAD", "MTB"] as const;

function parseDiscipline(value: string | null) {
  if (!value?.trim() || value === "all") return null;
  return TIMEKEEPING_DISCIPLINES.includes(value.trim() as (typeof TIMEKEEPING_DISCIPLINES)[number])
    ? value.trim() as (typeof TIMEKEEPING_DISCIPLINES)[number]
    : undefined;
}

async function resolveCompetition(tenantId: string, competitionId: string | null) {
  if (competitionId) {
    return prisma.competition.findFirst({
      where: { id: competitionId, tenantId },
      select: { id: true, name: true, year: true, status: true },
    });
  }

  return prisma.competition.findFirst({
    where: { tenantId },
    orderBy: { year: "desc" },
    select: { id: true, name: true, year: true, status: true },
  });
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const competitionId = request.nextUrl.searchParams.get("competitionId");
    const auth = await requireCompetitionTenantRoles(session, ["ADMIN", "MODERATOR"], competitionId);
    if ("error" in auth) return auth.error;

    const competition = await resolveCompetition(auth.tenantId, competitionId);
    if (!competition) {
      return NextResponse.json({ error: "Kein Wettkampf gefunden." }, { status: 404 });
    }

    const disciplineCode = parseDiscipline(request.nextUrl.searchParams.get("disciplineCode"));
    if (disciplineCode === undefined) {
      return NextResponse.json({ error: "Ungueltige Disziplin." }, { status: 400 });
    }

    const sessions = await prisma.timekeepingSession.findMany({
      where: {
        tenantId: auth.tenantId,
        competitionId: competition.id,
        ...(disciplineCode ? { disciplineCode } : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        events: {
          where: { eventType: "FINISH" },
          orderBy: { recordedAt: "asc" },
          select: {
            id: true,
            startNumber: true,
            recordedAt: true,
            rawElapsedMs: true,
            netElapsedMs: true,
          },
        },
      },
    });

    const finishEventIds = sessions.flatMap((timekeepingSession) => (
      timekeepingSession.events.map((event) => `timekeeping:${event.id}`)
    ));
    const existingRows = finishEventIds.length
      ? await prisma.resultRawRecord.findMany({
          where: {
            tenantId: auth.tenantId,
            competitionId: competition.id,
            rowKey: { in: finishEventIds },
          },
          select: { rowKey: true },
        })
      : [];
    const importedRowKeys = new Set(existingRows.map((row) => row.rowKey));

    return NextResponse.json({
      competition,
      sessions: sessions.map((timekeepingSession) => {
        const finishEvents = timekeepingSession.events;
        const importedFinishEvents = finishEvents.filter((event) => importedRowKeys.has(`timekeeping:${event.id}`)).length;
        const finishWithoutStartNumber = finishEvents.filter((event) => !event.startNumber?.trim()).length;
        const withElapsed = finishEvents.filter((event) => event.netElapsedMs !== null || event.rawElapsedMs !== null).length;

        return {
          id: timekeepingSession.id,
          deviceId: timekeepingSession.deviceId,
          disciplineCode: timekeepingSession.disciplineCode,
          startBlockName: timekeepingSession.startBlockName,
          status: timekeepingSession.status,
          firstStartNumber: timekeepingSession.firstStartNumber,
          startIntervalSeconds: timekeepingSession.startIntervalSeconds,
          manualStartedAt: timekeepingSession.manualStartedAt,
          createdAt: timekeepingSession.createdAt,
          updatedAt: timekeepingSession.updatedAt,
          createdBy: timekeepingSession.createdBy,
          counts: {
            finishEvents: finishEvents.length,
            finishWithStartNumber: finishEvents.length - finishWithoutStartNumber,
            finishWithoutStartNumber,
            withElapsed,
            importedFinishEvents,
            newFinishEvents: finishEvents.length - importedFinishEvents,
          },
        };
      }),
    });
  } catch (error) {
    console.error("Failed to load timekeeping sessions for result staging:", error);
    return NextResponse.json({ error: "Zeitnahme-Sessions konnten nicht geladen werden." }, { status: 500 });
  }
}
