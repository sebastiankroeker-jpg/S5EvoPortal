import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
  resolveVisibleParticipantName,
  resolveVisibleTeamName,
} from "@/lib/publication-visibility";
import { getScopedRoleFlags } from "@/lib/server-permissions";
import { canRoleViewLiveResults, type TeamScopeRole } from "@/lib/team-access-config";
import {
  rankDiscipline,
  calculateTeamScores,
  compareTeamScores,
  hasEqualTeamScoreRank,
  type DisciplineCode,
  type DisciplineEntry,
  type RankedEntry,
  type TeamScore,
} from "@/lib/domain/scoring";
import { compareClassificationCodes } from "@/lib/domain/classification";
import { normalizeLiveResultDisciplines } from "@/lib/live-results-disciplines";

type ResultSnapshot = Record<string, unknown> | null;

type ClassTeam = Pick<TeamScore, "teamId" | "teamName" | "startNumber" | "classCode">;

type ResultTeamScore = TeamScore & { hasAnyResult?: boolean };
type StockDetails = { stockBwz?: string | null; stockDropped?: number | null; tieBreakers?: number[] };

const OVERALL_RESULT_GROUPS = [
  {
    code: "damen-gesamt",
    name: "Damen Gesamt",
    sourceClassCodes: ["damen-a", "damen-b"],
  },
  {
    code: "herren-gesamt",
    name: "Herren Gesamt",
    sourceClassCodes: ["jungsters", "herren", "masters"],
  },
] as const;

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

function getLegacyStockDetails(snapshot: ResultSnapshot) {
  if (snapshot?.disciplineCode !== "STOCK") return {};
  const legacy = asRecord(snapshot?.legacy);
  const details = asRecord(legacy?.details);
  if (!details) return {};

  return stockDetailsFromLegacyDetails(details);
}

function stockBwzSortValue(value: string | null | undefined) {
  if (!value) return 0;
  const parsed = Number.parseInt(value.replace(/\D/g, "") || "0", 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function stockDetailsFromLegacyDetails(details: Record<string, unknown>): StockDetails {
  const maskedBwz = typeof details.maskedBwz === "string" ? details.maskedBwz : null;
  const rawBwz = typeof details.bwz === "string" ? details.bwz : maskedBwz;
  const dropped = asNumber(details.dropped);

  return {
    stockBwz: maskedBwz ?? rawBwz ?? null,
    stockDropped: dropped,
    tieBreakers: [stockBwzSortValue(rawBwz), dropped ?? 0],
  };
}

function stockDetailsFromShots(shots: Array<{ value: number; isStrikeout: boolean }>): StockDetails {
  if (shots.length === 0) return {};
  const sortedValues = [...shots].map((shot) => shot.value).sort((left, right) => right - left);
  const droppedShot = shots.find((shot) => shot.isStrikeout) ?? null;
  const dropped = droppedShot?.value ?? sortedValues.at(-1) ?? null;
  const countedValues = shots
    .filter((shot) => !shot.isStrikeout)
    .map((shot) => shot.value)
    .sort((left, right) => right - left);

  return {
    stockBwz: countedValues.length > 0 ? countedValues.join("-") : sortedValues.join("-"),
    stockDropped: dropped,
    tieBreakers: countedValues,
  };
}

function getPublicationStockDetails(snapshot: ResultSnapshot): StockDetails {
  if (snapshot?.disciplineCode !== "STOCK") return {};
  const legacy = asRecord(snapshot?.legacy);
  const details = asRecord(legacy?.details);
  return details ? stockDetailsFromLegacyDetails(details) : {};
}

function emptyDisciplineEntries(): Record<DisciplineCode, DisciplineEntry[]> {
  return {
    RUN: [],
    BENCH: [],
    STOCK: [],
    ROAD: [],
    MTB: [],
  };
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

  const completed = [...scoreByTeamId.values()].sort(compareTeamScores);

  for (let index = 0; index < completed.length; index += 1) {
    if (index > 0 && hasEqualTeamScoreRank(completed[index], completed[index - 1])) {
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
      select: {
        id: true,
        name: true,
        year: true,
        publicResults: true,
        status: true,
        tenantId: true,
        liveResultsVisibility: true,
        liveResultsDisciplines: true,
      },
    });

    if (!competition) {
      return NextResponse.json({ error: "Competition not found" }, { status: 404 });
    }

    const session = await getServerSession(authOptions);
    const access = session?.user?.email
      ? await getScopedRoleFlags(session.user.email, competition.tenantId, session)
      : null;
    const effectiveRole: TeamScopeRole = access?.isAdmin
      ? "ADMIN"
      : access?.isModerator
        ? "MODERATOR"
        : session?.user?.email
          ? "TEILNEHMER"
          : "ZUSCHAUER";
    if (!canRoleViewLiveResults(effectiveRole, competition)) {
      return NextResponse.json({ error: "Results are not published for this access level" }, { status: 403 });
    }

    // Live results are explicitly published via liveResultsVisibility. Once a
    // viewer may access this live surface, team and participant name privacy
    // preferences must not anonymize the scoreboard.
    const canSeeLiveNames = true;
    const canSeeEmptyResultRows = Boolean(access?.isAdmin || access?.isModerator);
    const canSeeStartNumber = Boolean(access?.isAdmin);
    const publishedDisciplines = normalizeLiveResultDisciplines(competition.liveResultsDisciplines);
    const publishedDisciplineSet = new Set<DisciplineCode>(publishedDisciplines);
    if (includeStagingTest && !access?.isAdmin) {
      return NextResponse.json({ error: "Staging test results require admin access" }, { status: 403 });
    }

    // Load all teams with participants and discipline results
    const teams = await prisma.team.findMany({
      where: {
        competitionId,
        deletedAt: null,
        registrationMode: "TEAM",
        classificationCode: { not: "sportlerboerse" },
      },
      include: {
        participants: {
          where: { deletedAt: null },
          include: {
            results: {
              include: {
                discipline: { select: { code: true, name: true } },
                shots: { orderBy: { shotNumber: "asc" } },
              },
            },
          },
        },
      },
    });

    const latestStockPublicationItems = await prisma.resultPublicationItem.findMany({
      where: {
        disciplineCode: "STOCK",
        resultId: { not: null },
        publication: {
          competitionId,
          status: "PUBLISHED",
          revertedAt: null,
        },
      },
      select: {
        resultId: true,
        draft: { select: { proposedResultSnapshot: true } },
        publication: { select: { version: true, publishedAt: true } },
      },
      orderBy: [
        { publication: { version: "desc" } },
        { createdAt: "desc" },
      ],
    });
    const stockDetailsByResultId = new Map<string, StockDetails>();
    for (const item of latestStockPublicationItems) {
      if (!item.resultId || stockDetailsByResultId.has(item.resultId)) continue;
      stockDetailsByResultId.set(item.resultId, getPublicationStockDetails(asRecord(item.draft?.proposedResultSnapshot)));
    }

    // Load classifications for this competition
    const classifications = await prisma.classification.findMany({
      where: { competitionId },
    });

    const visibleTeamById = new Map<string, string>();
    const visibleParticipantById = new Map<string, string>();
    const teamClassCodeById = new Map<string, string>();
    const teamStartNumberById = new Map<string, string | null>();
    const classTeams = new Map<string, ClassTeam[]>();
    const overallGroupBySourceClass: Map<string, typeof OVERALL_RESULT_GROUPS[number]> = new Map(
      OVERALL_RESULT_GROUPS.flatMap((group) =>
        group.sourceClassCodes.map((sourceClassCode) => [sourceClassCode, group] as const),
      ),
    );

    for (const team of teams) {
      const classCode = team.classificationCode || "unclassified";
      visibleTeamById.set(team.id, resolveVisibleTeamName({
        actualTeamName: team.name,
        teamPublicationLevel: team.teamPublicationLevel,
        canSeeFullPublication: canSeeLiveNames,
      }));
      teamClassCodeById.set(team.id, classCode);
      teamStartNumberById.set(team.id, canSeeStartNumber ? team.startNumber : null);
      const classTeam = {
        teamId: team.id,
        teamName: visibleTeamById.get(team.id) ?? "Mannschaft",
        startNumber: teamStartNumberById.get(team.id) ?? null,
        classCode,
      };
      classTeams.set(classCode, [...(classTeams.get(classCode) ?? []), classTeam]);

      const overallGroup = overallGroupBySourceClass.get(classCode);
      if (overallGroup) {
        classTeams.set(overallGroup.code, [
          ...(classTeams.get(overallGroup.code) ?? []),
          { ...classTeam, classCode: overallGroup.code },
        ]);
      }

      for (const participant of team.participants) {
        visibleParticipantById.set(participant.id, resolveVisibleParticipantName({
          actualName: `${participant.firstName} ${participant.lastName}`,
          teamPublicationLevel: team.teamPublicationLevel,
          participantPublicationPreference: participant.participantPublicationPreference,
          canSeeFullPublication: canSeeLiveNames,
        }));
      }
    }

    // Build discipline entries per class
    const classDisciplineEntries = new Map<
      string,
      Record<DisciplineCode, DisciplineEntry[]>
    >();
    const overallDisciplineEntries = new Map(
      OVERALL_RESULT_GROUPS.map((group) => [group.code, emptyDisciplineEntries()] as const),
    );

    for (const team of teams) {
      const classCode = team.classificationCode || "unclassified";
      if (!classDisciplineEntries.has(classCode)) {
        classDisciplineEntries.set(classCode, emptyDisciplineEntries());
      }

      const classEntries = classDisciplineEntries.get(classCode)!;
      const overallGroup = overallGroupBySourceClass.get(classCode);
      const overallEntries = overallGroup ? overallDisciplineEntries.get(overallGroup.code) : null;

      for (const participant of team.participants) {
        for (const result of participant.results) {
          const discCode = result.discipline.code as DisciplineCode;
          if (!classEntries[discCode]) continue;
          if (!publishedDisciplineSet.has(discCode)) continue;
          const stockDetails = discCode === "STOCK"
            ? {
                ...stockDetailsFromShots(result.shots),
                ...(stockDetailsByResultId.get(result.id) ?? {}),
              }
            : {};

          classEntries[discCode].push({
            teamId: team.id,
            teamName: visibleTeamById.get(team.id) ?? "Mannschaft",
            startNumber: teamStartNumberById.get(team.id) ?? null,
            participantId: participant.id,
            participantName: visibleParticipantById.get(participant.id) ?? "Teilnehmer:in",
            rawValue: result.rawValue,
            publishedRank: result.rank,
            publishedPoints: result.points,
            ...stockDetails,
            classCode,
          });

          overallEntries?.[discCode].push({
            teamId: team.id,
            teamName: visibleTeamById.get(team.id) ?? "Mannschaft",
            startNumber: teamStartNumberById.get(team.id) ?? null,
            participantId: participant.id,
            participantName: visibleParticipantById.get(participant.id) ?? "Teilnehmer:in",
            rawValue: result.rawValue,
            publishedRank: result.rank,
            publishedPoints: result.points,
            ...stockDetails,
            classCode: overallGroup?.code ?? classCode,
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
        if (!publishedDisciplineSet.has(disciplineCode)) continue;
        const classCode = teamClassCodeById.get(draft.teamId) ?? "unclassified";
        const classScoring = getClassScoring(asRecord(draft.proposedResultSnapshot));
        if (!draftRankings.has(classCode)) draftRankings.set(classCode, new Map());
        const byDiscipline = draftRankings.get(classCode)!;
        const entries = byDiscipline.get(disciplineCode) ?? [];

        entries.push({
          teamId: draft.teamId,
          teamName: visibleTeamById.get(draft.teamId) ?? "Mannschaft",
          startNumber: draft.startNumber ?? teamStartNumberById.get(draft.teamId) ?? null,
          participantId: draft.participantId,
          participantName: visibleParticipantById.get(draft.participantId) ?? "Teilnehmer:in",
          rawValue: draft.normalizedValue ?? draft.rawValue,
          rawValueText: draft.rawValueText,
          ...getLegacyStockDetails(asRecord(draft.proposedResultSnapshot)),
          classCode,
          rank: classScoring.rank ?? entries.length + 1,
          points: classScoring.points ?? 0,
        } as RankedEntry & { rawValueText?: string | null; stockBwz?: string | null; stockDropped?: number | null });
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
        RUN: publishedDisciplineSet.has("RUN") ? stagingRankings.RUN ?? rankDiscipline(entries.RUN, "RUN") : [],
        BENCH: publishedDisciplineSet.has("BENCH") ? stagingRankings.BENCH ?? rankDiscipline(entries.BENCH, "BENCH") : [],
        STOCK: publishedDisciplineSet.has("STOCK") ? stagingRankings.STOCK ?? rankDiscipline(entries.STOCK, "STOCK") : [],
        ROAD: publishedDisciplineSet.has("ROAD") ? stagingRankings.ROAD ?? rankDiscipline(entries.ROAD, "ROAD") : [],
        MTB: publishedDisciplineSet.has("MTB") ? stagingRankings.MTB ?? rankDiscipline(entries.MTB, "MTB") : [],
      };

      // Calculate team scores
      const calculatedTeamScores = calculateTeamScores(disciplineRankings);
      const teamScores = canSeeEmptyResultRows
        ? completeTeamScores(calculatedTeamScores, classTeams.get(classCode) ?? [])
        : calculatedTeamScores;
      const hasAnyDisciplineEntry = Object.values(disciplineRankings).some((entries) => entries.length > 0);

      if (!canSeeEmptyResultRows && teamScores.length === 0 && !hasAnyDisciplineEntry) {
        continue;
      }

      results.push({
        classCode,
        className: classification?.name || classCode,
        classType: classification?.type || "UNKNOWN",
        teamScores,
        disciplineRankings,
      });
    }

    for (const group of OVERALL_RESULT_GROUPS) {
      const entries = overallDisciplineEntries.get(group.code);
      if (!entries) continue;

      const disciplineRankings: Record<DisciplineCode, ReturnType<typeof rankDiscipline>> = {
        RUN: publishedDisciplineSet.has("RUN") ? rankDiscipline(entries.RUN, "RUN") : [],
        BENCH: publishedDisciplineSet.has("BENCH") ? rankDiscipline(entries.BENCH, "BENCH") : [],
        STOCK: publishedDisciplineSet.has("STOCK") ? rankDiscipline(entries.STOCK, "STOCK") : [],
        ROAD: publishedDisciplineSet.has("ROAD") ? rankDiscipline(entries.ROAD, "ROAD") : [],
        MTB: publishedDisciplineSet.has("MTB") ? rankDiscipline(entries.MTB, "MTB") : [],
      };
      const calculatedTeamScores = calculateTeamScores(disciplineRankings);
      const teamScores = canSeeEmptyResultRows
        ? completeTeamScores(calculatedTeamScores, classTeams.get(group.code) ?? [])
        : calculatedTeamScores;
      const hasAnyDisciplineEntry = Object.values(disciplineRankings).some((entries) => entries.length > 0);

      if (!canSeeEmptyResultRows && teamScores.length === 0 && !hasAnyDisciplineEntry) {
        continue;
      }

      results.push({
        classCode: group.code,
        className: group.name,
        classType: "COMBINED",
        teamScores,
        disciplineRankings,
      });
    }

    // Sort results in official class order and append the gender overall lists.
    const overallOrder: Map<string, number> = new Map(OVERALL_RESULT_GROUPS.map((group, index) => [group.code, index]));
    results.sort((a, b) => {
      const leftOverallOrder = overallOrder.get(a.classCode);
      const rightOverallOrder = overallOrder.get(b.classCode);
      if (leftOverallOrder !== undefined || rightOverallOrder !== undefined) {
        if (leftOverallOrder === undefined) return -1;
        if (rightOverallOrder === undefined) return 1;
        return leftOverallOrder - rightOverallOrder;
      }
      return compareClassificationCodes(a.classCode, b.classCode);
    });
    const visibleResultTeamIds = new Set<string>();
    for (const result of results) {
      for (const team of result.teamScores) {
        visibleResultTeamIds.add(team.teamId);
      }
      for (const entries of Object.values(result.disciplineRankings)) {
        for (const entry of entries) {
          visibleResultTeamIds.add(entry.teamId);
        }
      }
    }

    return NextResponse.json({
      competition: {
        id: competition.id,
        name: competition.name,
        year: competition.year,
        status: competition.status,
        liveResultsDisciplines: publishedDisciplines,
      },
      results,
      totalTeams: canSeeEmptyResultRows ? teams.length : visibleResultTeamIds.size,
      totalClasses: results.length,
    });
  } catch (error) {
    console.error("Failed to compute results:", error);
    return NextResponse.json({ error: "Failed to compute results" }, { status: 500 });
  }
}
