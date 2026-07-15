import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { requireTenantRoles } from "@/lib/server-permissions";

const TIMEKEEPING_ROLES = ["ADMIN", "MODERATOR", "ZEITNAHME"] as const;
const TIMEKEEPING_DISCIPLINES = ["RUN", "ROAD", "MTB"] as const;

function toStartNumberValue(startNumber: string | null) {
  if (!startNumber) return null;
  const parsed = Number.parseInt(startNumber, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(request: NextRequest) {
  const competitionId = request.nextUrl.searchParams.get("competitionId");
  if (!competitionId) {
    return NextResponse.json({ error: "competitionId required" }, { status: 400 });
  }

  const session = await getServerSession(authOptions);
  const competition = await prisma.competition.findUnique({
    where: { id: competitionId },
    select: {
      id: true,
      name: true,
      year: true,
      status: true,
      tenantId: true,
      disciplines: {
        where: { code: { in: [...TIMEKEEPING_DISCIPLINES] } },
        select: { code: true, name: true, sortOrder: true },
        orderBy: { name: "asc" },
      },
    },
  });

  if (!competition) {
    return NextResponse.json({ error: "Competition not found" }, { status: 404 });
  }

  const auth = await requireTenantRoles(session, [...TIMEKEEPING_ROLES], {
    tenantId: competition.tenantId,
    fallbackToFirstMatchingTenant: false,
  });
  if ("error" in auth) return auth.error;

  const teams = await prisma.team.findMany({
    where: {
      competitionId,
      deletedAt: null,
      approved: true,
      startNumber: { not: null },
    },
    select: {
      id: true,
      name: true,
      startNumber: true,
      participants: {
        where: {
          deletedAt: null,
          disciplineCode: { in: [...TIMEKEEPING_DISCIPLINES] },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          disciplineCode: true,
        },
        orderBy: [{ disciplineCode: "asc" }, { lastName: "asc" }, { firstName: "asc" }],
      },
    },
    orderBy: [{ startNumber: "asc" }, { name: "asc" }],
  });

  const starters = teams.flatMap((team) => {
    const startNumberValue = toStartNumberValue(team.startNumber);
    return team.participants.map((participant) => ({
      participantId: participant.id,
      teamId: team.id,
      teamName: team.name,
      startNumber: team.startNumber,
      startNumberValue,
      firstName: participant.firstName,
      lastName: participant.lastName,
      disciplineCode: participant.disciplineCode,
    }));
  });

  const disciplineSummaries = TIMEKEEPING_DISCIPLINES.map((code) => {
    const disciplineStarters = starters
      .filter((starter) => starter.disciplineCode === code)
      .sort((a, b) => {
        const aValue = a.startNumberValue ?? Number.MAX_SAFE_INTEGER;
        const bValue = b.startNumberValue ?? Number.MAX_SAFE_INTEGER;
        return aValue - bValue || String(a.startNumber).localeCompare(String(b.startNumber));
      });
    const firstStartNumber = disciplineStarters.find((starter) => starter.startNumberValue !== null)?.startNumberValue ?? null;

    return {
      code,
      name: competition.disciplines.find((discipline) => discipline.code === code)?.name ?? code,
      defaultStartIntervalSeconds: code === "ROAD" ? 30 : 0,
      defaultBlockCount: code === "ROAD" ? 2 : 1,
      firstStartNumber,
      starters: disciplineStarters,
    };
  });

  return NextResponse.json({
    snapshotVersion: new Date().toISOString(),
    competition: {
      id: competition.id,
      name: competition.name,
      year: competition.year,
      status: competition.status,
    },
    role: auth.roles.includes("ZEITNAHME") ? "ZEITNAHME" : auth.isAdmin ? "ADMIN" : "MODERATOR",
    disciplines: disciplineSummaries,
  });
}
