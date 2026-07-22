import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
  canViewerSeeFullPublication,
  resolveVisibleParticipantName,
  resolveVisibleTeamName,
} from "@/lib/publication-visibility";
import { getScopedRoleFlags } from "@/lib/server-permissions";
import {
  rankDiscipline,
  calculateTeamScores,
  type DisciplineCode,
  type DisciplineEntry,
  type RankedEntry,
  type TeamScore,
} from "@/lib/domain/scoring";
import { compareClassificationCodes } from "@/lib/domain/classification";

type ResultSnapshot = Record<string, unknown> | null;

type ClassTeam = Pick<TeamScore, "teamId" | "teamName" | "startNumber" | "classCode">;

type ResultTeamScore = TeamScore & { hasAnyResult?: boolean };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getClassScoring(snapshot: ResultSnapshot) {
  const scoring = asRecord(snapshot?.classScoring);
  return {
    points: asNumber(scoring?.points),
    rank: asNumber(scoring?.rank),
  };
}

function startNumberSortValue(value: string | null | undefined) {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) ? number : Number.MAX_SAFE_INTEGER;
}

function completeTeamScores(scores: TeamScore[], classTeams: ClassTeam[]): ResultTeamScore[] {
  const scoreByTeamId = new Map(scores.map((score) => [score.teamId, { ...score, hasAnyResult: true } as ResultTeamScore]));

  for (const team of classTeams) {
    if (scoreByTeamId.has(team.teamId)) continue;
    scoreByTeamId.set(team.teamId, {
      ...team,
      disciplinePoints: { RUN: 0, BENCH: 0, STOCK: 0, ROAD: 0, MTB: 0 },
      totalPoints: 0,
      rank: 0,
      hasAnyResult: false,
    });
  }

  const completed = [...scoreByTeamId.values()].sort((left, right) => {
    const pointDiff = right.totalPoints - left.totalPoints;
    if (pointDiff !== 0) return pointDiff;
    return startNumberSortValue(left.startNumber) - startNumberSortValue(right.startNumber);
  });

  for (let index = 0; index < completed.length; index += 1) {
    if (index > 0 && completed[index].totalPoints === completed[index - 1].totalPoints) {
      completed[index].rank = completed[index - 1].rank;
    } else {
      completed[index].rank = index + 1;
    }
  }

  return completed;
}

/**
 * GET /api/results?competitionId=xxx
 *
 * Returns computed rankings per class with discipline breakdowns.
 * Public endpoint (no auth required for publicResults competitions).
 */
export async function GET(request: NextRequest) {
  const competitionId = request.nextUrl.searchParams.get("competitionId");
  const includeStagingTest = request.nextUrl.searchParams.get("includeStagingTest") === "true";

  if (!competitionId) {
    return NextResponse.json({ error: "competitionId required" }, { status: 400 });
  }

  try {
    // Load competition
    const competition = await prisma.competition.findUnique({
      where: { id: competitionId },
      select: { id: true, name: true, year: true, publicResults: true, status: true, tenantId: true },
    });

    if (!competition) {
      return NextResponse.json({ error: "Competition not found" }, { status: 404 });
    }

    const session = await getServerSession(authOptions);
    if (!competition.publicResults) {
      if (!session?.user?.email) {
        return NextResponse.json({ error: "Results are not public" }, { status: 403 });
      }
    }

    const access = session?.user?.email
      ? await getScopedRoleFlags(session.user.email, competition.tenantId, session)
      : null;
    const canSeeFullPublication = canViewerSeeFullPublication({
      isPrivilegedViewer: Boolean(access?.isAdmin || access?.isModerator),
    });
    const canSeeStartNumber = Boolean(access?.isAdmin);
    if (includeStagingTest && !access?.isAdmin) {
      return NextResponse.json({ error: "Staging test results require admin access" }, { status: 403 });
    }

    // Load all teams with participants and discipline results
    const teams = await prisma.team.findMany({
      where: { competitionId, deletedAt: null },
      include: {
        participants: {
          where: { deletedAt: null },
          include: {
            results: {
              include: {
                discipline: { select: { code: true, name: true } },
              },
            },
          },
        },
      },
    });

    // Load classifications for this competition
    const classifications = await prisma.classification.findMany({
      where: { competitionId },
    });

    const visibleTeamById = new Map<string, string>();
    const visibleParticipantById = new Map<string, string>();
    const teamClassCodeById = new Map<string, string>();
    const teamStartNumberById = new Map<string, string | null>();
    const classTeams = new Map<string, ClassTeam[]>();

    for (const team of teams) {
      const classCode = team.classificationCode || "unclassified";
      visibleTeamById.set(team.id, resolveVisibleTeamName({
        actualTeamName: team.name,
        teamPublicationLevel: team.teamPublicationLevel,
        canSeeFullPublication,
      }));
      teamClassCodeById.set(team.id, classCode);
      teamStartNumberById.set(team.id, canSeeStartNumber ? team.startNumber : null);
      classTeams.set(classCode, [
        ...(classTeams.get(classCode) ?? []),
        {
          teamId: team.id,
          teamName: visibleTeamById.get(team.id) ?? "Mannschaft",
          startNumber: teamStartNumberById.get(team.id) ?? null,
          classCode,
        },
      ]);

      for (const participant of team.participants) {
        visibleParticipantById.set(participant.id, resolveVisibleParticipantName({
          actualName: `${participant.firstName} ${participant.lastName}`,
          teamPublicationLevel: team.teamPublicationLevel,
          participantPublicationPreference: participant.participantPublicationPreference,
          canSeeFullPublication,
        }));
      }
    }

    // Build discipline entries per class
    const classDisciplineEntries = new Map<
      string,
      Record<DisciplineCode, DisciplineEntry[]>
    >();

    for (const team of teams) {
      const classCode = team.classificationCode || "unclassified";
      if (!classDisciplineEntries.has(classCode)) {
        classDisciplineEntries.set(classCode, {
          RUN: [],
          BENCH: [],
          STOCK: [],
          ROAD: [],
          MTB: [],
        });
      }

      const classEntries = classDisciplineEntries.get(classCode)!;

      for (const participant of team.participants) {
        for (const result of participant.results) {
          const discCode = result.discipline.code as DisciplineCode;
          if (!classEntries[discCode]) continue;

          classEntries[discCode].push({
            teamId: team.id,
            teamName: visibleTeamById.get(team.id) ?? "Mannschaft",
            startNumber: teamStartNumberById.get(team.id) ?? null,
            participantName: visibleParticipantById.get(participant.id) ?? "Teilnehmer:in",
            rawValue: result.rawValue,
            classCode,
          });
        }
      }
    }

    const stagingDisciplineRankings = new Map<string, Partial<Record<DisciplineCode, RankedEntry[]>>>();
    if (includeStagingTest && access?.isAdmin) {
      const testDrafts = await prisma.resultDraft.findMany({
        where: {
          tenantId: competition.tenantId,
          competitionId,
          status: { notIn: ["REJECTED", "DISCARDED", "PUBLISHED"] },
          batch: {
            purpose: { in: ["PROD_TEST", "DRY_RUN"] },
            status: { notIn: ["DISCARDED", "ERROR", "PUBLISHED"] },
          },
          teamId: { not: null },
          participantId: { not: null },
        },
        orderBy: [
          { disciplineCode: "asc" },
          { createdAt: "desc" },
        ],
      });

      const latestByKey = new Map<string, typeof testDrafts[number]>();
      for (const draft of testDrafts) {
        if (!draft.teamId || !draft.participantId) continue;
        const key = `${draft.disciplineCode}:${draft.teamId}:${draft.participantId}`;
        if (!latestByKey.has(key)) latestByKey.set(key, draft);
      }

      const draftRankings = new Map<string, Map<DisciplineCode, RankedEntry[]>>();
      for (const draft of latestByKey.values()) {
        if (!draft.teamId || !draft.participantId) continue;
        const disciplineCode = draft.disciplineCode as DisciplineCode;
        const classCode = teamClassCodeById.get(draft.teamId) ?? "unclassified";
        const classScoring = getClassScoring(asRecord(draft.proposedResultSnapshot));
        if (!draftRankings.has(classCode)) draftRankings.set(classCode, new Map());
        const byDiscipline = draftRankings.get(classCode)!;
        const entries = byDiscipline.get(disciplineCode) ?? [];

        entries.push({
          teamId: draft.teamId,
          teamName: visibleTeamById.get(draft.teamId) ?? "Mannschaft",
          startNumber: draft.startNumber ?? teamStartNumberById.get(draft.teamId) ?? null,
          participantName: visibleParticipantById.get(draft.participantId) ?? "Teilnehmer:in",
          rawValue: draft.normalizedValue ?? draft.rawValue,
          rawValueText: draft.rawValueText,
          classCode,
          rank: classScoring.rank ?? entries.length + 1,
          points: classScoring.points ?? 0,
        } as RankedEntry & { rawValueText?: string | null });
        byDiscipline.set(disciplineCode, entries);
      }

      for (const [classCode, byDiscipline] of draftRankings) {
        stagingDisciplineRankings.set(classCode, Object.fromEntries(byDiscipline) as Partial<Record<DisciplineCode, RankedEntry[]>>);
      }
    }

    // Compute rankings per class
    const results: {
      classCode: string;
      className: string;
      classType: string;
      teamScores: ResultTeamScore[];
      disciplineRankings: Record<DisciplineCode, ReturnType<typeof rankDiscipline>>;
    }[] = [];

    for (const [classCode, entries] of classDisciplineEntries) {
      const classification = classifications.find((c) => c.code === classCode);

      // Skip combined classifications for now (they aggregate from sub-classes)
      if (classification?.type === "COMBINED") continue;

      const stagingRankings = stagingDisciplineRankings.get(classCode) ?? {};

      // Rank each discipline. In admin test mode, staged draft rankings override the
      // corresponding official discipline so Legacy points/places stay inspectable.
      const disciplineRankings: Record<DisciplineCode, ReturnType<typeof rankDiscipline>> = {
        RUN: stagingRankings.RUN ?? rankDiscipline(entries.RUN, "RUN"),
        BENCH: stagingRankings.BENCH ?? rankDiscipline(entries.BENCH, "BENCH"),
        STOCK: stagingRankings.STOCK ?? rankDiscipline(entries.STOCK, "STOCK"),
        ROAD: stagingRankings.ROAD ?? rankDiscipline(entries.ROAD, "ROAD"),
        MTB: stagingRankings.MTB ?? rankDiscipline(entries.MTB, "MTB"),
      };

      // Calculate team scores
      const teamScores = completeTeamScores(calculateTeamScores(disciplineRankings), classTeams.get(classCode) ?? []);

      results.push({
        classCode,
        className: classification?.name || classCode,
        classType: classification?.type || "UNKNOWN",
        teamScores,
        disciplineRankings,
      });
    }

    // Sort results in the official class order: SA, SB, J, DA, DB, HA, HB, HC.
    results.sort((a, b) => compareClassificationCodes(a.classCode, b.classCode));

    return NextResponse.json({
      competition: {
        id: competition.id,
        name: competition.name,
        year: competition.year,
        status: competition.status,
      },
      results,
      totalTeams: teams.length,
      totalClasses: results.length,
    });
  } catch (error) {
    console.error("Failed to compute results:", error);
    return NextResponse.json({ error: "Failed to compute results" }, { status: 500 });
  }
}
