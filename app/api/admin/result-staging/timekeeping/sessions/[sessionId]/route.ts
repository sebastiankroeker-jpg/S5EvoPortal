import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { requireCompetitionTenantRoles } from "@/lib/server-permissions";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId } = await params;
    const competitionId = request.nextUrl.searchParams.get("competitionId");
    if (!competitionId) {
      return NextResponse.json({ error: "competitionId fehlt." }, { status: 400 });
    }

    const session = await getServerSession(authOptions);
    const auth = await requireCompetitionTenantRoles(session, ["ADMIN"], competitionId);
    if ("error" in auth) return auth.error;

    const timekeepingSession = await prisma.timekeepingSession.findFirst({
      where: {
        id: sessionId,
        tenantId: auth.tenantId,
        competitionId,
      },
      include: {
        events: {
          select: { id: true },
        },
      },
    });

    if (!timekeepingSession) {
      return NextResponse.json({ error: "Zeitnahme-Datenpaket nicht gefunden." }, { status: 404 });
    }

    const rowKeys = timekeepingSession.events.map((event) => `timekeeping:${event.id}`);
    const importedRows = rowKeys.length
      ? await prisma.resultRawRecord.count({
          where: {
            tenantId: auth.tenantId,
            competitionId,
            rowKey: { in: rowKeys },
          },
        })
      : 0;

    await prisma.$transaction(async (tx) => {
      await tx.timekeepingSession.delete({
        where: { id: timekeepingSession.id },
      });

      await tx.auditEvent.create({
        data: {
          tenantId: auth.tenantId,
          competitionId,
          actorId: auth.user.id,
          action: "TIMEKEEPING_SESSION_DELETED",
          scopeType: "TIMEKEEPING_SESSION",
          scopeId: timekeepingSession.id,
          entityType: "TimekeepingSession",
          entityId: timekeepingSession.id,
          beforeData: {
            deviceId: timekeepingSession.deviceId,
            deviceName: timekeepingSession.deviceName,
            disciplineCode: timekeepingSession.disciplineCode,
            startBlockName: timekeepingSession.startBlockName,
            eventCount: timekeepingSession.events.length,
            importedRows,
          },
        },
      });
    });

    return NextResponse.json({
      success: true,
      deleted: {
        sessionId: timekeepingSession.id,
        events: timekeepingSession.events.length,
        importedRows,
      },
    });
  } catch (error) {
    console.error("Failed to delete timekeeping session:", error);
    return NextResponse.json({ error: "Zeitnahme-Datenpaket konnte nicht gelöscht werden." }, { status: 500 });
  }
}
