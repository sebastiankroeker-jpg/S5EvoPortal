import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { requireCompetitionTenantRoles } from "@/lib/server-permissions";

type ResetBody = {
  competitionId?: unknown;
  dryRun?: unknown;
  confirmationText?: unknown;
};

function parseString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function expectedConfirmationText(competitionName: string) {
  return `Startnummern loeschen: ${competitionName}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as ResetBody;
    const competitionId = parseString(body.competitionId);
    if (!competitionId) {
      return NextResponse.json({ error: "competitionId fehlt" }, { status: 400 });
    }

    const session = await getServerSession(authOptions);
    const auth = await requireCompetitionTenantRoles(session, ["ADMIN"], competitionId);
    if ("error" in auth) return auth.error;

    const competition = await prisma.competition.findFirst({
      where: { id: competitionId, tenantId: auth.tenantId },
      select: { id: true, name: true, year: true, status: true },
    });
    if (!competition) {
      return NextResponse.json({ error: "Wettkampf nicht gefunden" }, { status: 404 });
    }

    const teams = await prisma.team.findMany({
      where: {
        competitionId,
        deletedAt: null,
        startNumber: { not: null },
      },
      select: {
        id: true,
        name: true,
        startNumber: true,
      },
      orderBy: [{ startNumber: "asc" }, { name: "asc" }],
    });

    const responseBase = {
      ok: true,
      competition,
      count: teams.length,
      expectedConfirmationText: expectedConfirmationText(competition.name),
      preview: teams.slice(0, 20),
    };

    if (body.dryRun !== false) {
      return NextResponse.json({ ...responseBase, dryRun: true });
    }

    if (parseString(body.confirmationText) !== responseBase.expectedConfirmationText) {
      return NextResponse.json({ error: "Bestaetigungstext stimmt nicht ueberein." }, { status: 409 });
    }

    await prisma.$transaction(async (tx) => {
      const deleted = await tx.team.updateMany({
        where: {
          id: { in: teams.map((team) => team.id) },
          competitionId,
          deletedAt: null,
        },
        data: { startNumber: null },
      });

      await tx.auditEvent.create({
        data: {
          action: "TEAM_START_NUMBERS_RESET",
          scopeType: "COMPETITION",
          scopeId: competitionId,
          entityType: "Competition",
          entityId: competitionId,
          reason: "admin_start_number_reset",
          beforeData: {
            count: teams.length,
            teams: teams.map((team) => ({
              teamId: team.id,
              teamName: team.name,
              startNumber: team.startNumber,
            })),
          },
          afterData: { count: deleted.count, startNumber: null },
          meta: { source: "admin_start_numbers_reset" },
          tenantId: auth.tenantId,
          competitionId,
          actorId: auth.user.id,
        },
      });
    });

    return NextResponse.json({
      ...responseBase,
      dryRun: false,
      deleted: teams.length,
    });
  } catch (error) {
    console.error("Start number reset failed:", error);
    return NextResponse.json({ error: "Startnummern-Reset fehlgeschlagen." }, { status: 500 });
  }
}
