import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { resolveCompetitionClassifications } from "@/lib/competition-classifications";
import { prisma } from "@/lib/prisma";
import { requireCompetitionRoles } from "@/lib/server-permissions";

const TIMEKEEPING_ROLES = ["ZEITNAHME"] as const;
const TIMEKEEPING_DISCIPLINES = ["RUN", "ROAD", "MTB"] as const;
const START_NUMBER_SOURCES = ["official", "imported-test"] as const;
type StartNumberSource = (typeof START_NUMBER_SOURCES)[number];
function toStartNumberValue(startNumber: string | null) {
  if (!startNumber) return null;
  const parsed = Number.parseInt(startNumber, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseStartNumberSource(value: string | null): StartNumberSource {
  return START_NUMBER_SOURCES.includes(value as StartNumberSource) ? value as StartNumberSource : "official";
}

export async function GET(request: NextRequest) {
  const competitionId = request.nextUrl.searchParams.get("competitionId");
  const startNumberSource = parseStartNumberSource(request.nextUrl.searchParams.get("startNumberSource"));
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
      classifications: {
        select: {
          code: true,
          name: true,
          type: true,
          minAge: true,
          maxAge: true,
          genderRestriction: true,
          sourceClassCodes: true,
          sortOrder: true,
          displayEmoji: true,
        },
        orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
      },
    },
  });

  if (!competition) {
    return NextResponse.json({ error: "Competition not found" }, { status: 404 });
  }

  const auth = await requireCompetitionRoles(session, [...TIMEKEEPING_ROLES], competitionId);
  if ("error" in auth) return auth.error;
  const classifications = resolveCompetitionClassifications(competition.classifications)
    .filter((classification) => classification.type !== "COMBINED");
  const classificationByCode = new Map(classifications.map((classification) => [classification.code, classification]));

  const teams = await prisma.team.findMany({
    where: {
      competitionId,
      deletedAt: null,
      startNumber: { not: null },
    },
    select: {
      id: true,
      name: true,
      classificationCode: true,
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
      classificationCode: team.classificationCode ?? "unclassified",
      classificationLabel: classificationByCode.get(team.classificationCode ?? "")?.name ?? team.classificationCode ?? "Unklassifiziert",
      startNumber: team.startNumber,
      startNumberValue,
      firstName: participant.firstName,
      lastName: participant.lastName,
      disciplineCode: participant.disciplineCode,
      isTestStartNumber: startNumberSource === "imported-test",
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
      defaultStartIntervalSeconds: 30,
      defaultStartBlocks: [{ name: "Alle Klassen", classificationCodes: classifications.map((classification) => classification.code) }],
      firstStartNumber,
      classifications: classifications.map((classification) => ({
        code: classification.code,
        label: classification.name,
      })),
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
    role: "ZEITNAHME",
    testStartNumbers: {
      enabled: startNumberSource === "imported-test",
      count: teams.length,
    },
    startNumberSource,
    disciplines: disciplineSummaries,
  });
}
