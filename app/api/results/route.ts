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
} from "@/lib/domain/scoring";

/**
 * GET /api/results?competitionId=xxx
 *
 * Returns computed rankings per class with discipline breakdowns.
 * Public endpoint (no auth required for publicResults competitions).
 */
export async function GET(request: NextRequest) {
  const competitionId = request.nextUrl.searchParams.get("competitionId");

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

          const visibleTeamName = resolveVisibleTeamName({
            actualTeamName: team.name,
            teamPublicationLevel: team.teamPublicationLevel,
            canSeeFullPublication,
          });
          const visibleParticipantName = resolveVisibleParticipantName({
            actualName: `${participant.firstName} ${participant.lastName}`,
            teamPublicationLevel: team.teamPublicationLevel,
            participantPublicationPreference: participant.participantPublicationPreference,
            canSeeFullPublication,
          });

          classEntries[discCode].push({
            teamId: team.id,
            teamName: visibleTeamName,
            participantName: visibleParticipantName,
            rawValue: result.rawValue,
            classCode,
          });
        }
      }
    }

    // Compute rankings per class
    const results: {
      classCode: string;
      className: string;
      classType: string;
      teamScores: ReturnType<typeof calculateTeamScores>;
      disciplineRankings: Record<DisciplineCode, ReturnType<typeof rankDiscipline>>;
    }[] = [];

    for (const [classCode, entries] of classDisciplineEntries) {
      const classification = classifications.find((c) => c.code === classCode);

      // Skip combined classifications for now (they aggregate from sub-classes)
      if (classification?.type === "COMBINED") continue;

      // Rank each discipline
      const disciplineRankings: Record<DisciplineCode, ReturnType<typeof rankDiscipline>> = {
        RUN: rankDiscipline(entries.RUN, "RUN"),
        BENCH: rankDiscipline(entries.BENCH, "BENCH"),
        STOCK: rankDiscipline(entries.STOCK, "STOCK"),
        ROAD: rankDiscipline(entries.ROAD, "ROAD"),
        MTB: rankDiscipline(entries.MTB, "MTB"),
      };

      // Calculate team scores
      const teamScores = calculateTeamScores(disciplineRankings);

      results.push({
        classCode,
        className: classification?.name || classCode,
        classType: classification?.type || "UNKNOWN",
        teamScores,
        disciplineRankings,
      });
    }

    // Sort results: individual classes first, then team classes
    results.sort((a, b) => {
      const order = { AGE_INDIVIDUAL: 0, AGE_TEAM: 1, UNKNOWN: 2 };
      const aOrder = order[a.classType as keyof typeof order] ?? 2;
      const bOrder = order[b.classType as keyof typeof order] ?? 2;
      return aOrder - bOrder;
    });

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
