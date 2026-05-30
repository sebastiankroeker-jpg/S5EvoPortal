import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { normalizeCompetitionTeamAccessConfig } from "@/lib/team-access-config";

export async function GET(request: NextRequest) {
  try {
    const competitionId = request.nextUrl.searchParams.get("id");
    const competitionSelect = {
      id: true,
      name: true,
      year: true,
      status: true,
      date: true,
      dateEnd: true,
      registrationDeadline: true,
      teamOwnerFilterVisibleForTeamchef: true,
      participantsCanViewAllTeams: true,
      spectatorsCanViewAllTeams: true,
      shirtOrderDeadline: true,
      maxTeams: true,
      teamSize: true,
      location: true,
    } as const;

    const competition = competitionId
      ? await prisma.competition.findUnique({
          where: { id: competitionId },
          select: competitionSelect,
        })
      : await prisma.competition.findFirst({
          where: { status: "OPEN" },
          orderBy: [{ year: "desc" }, { createdAt: "desc" }],
          select: competitionSelect,
        }) ??
        await prisma.competition.findFirst({
          orderBy: [{ year: "desc" }, { createdAt: "desc" }],
          select: competitionSelect,
        });

    if (!competition) {
      return NextResponse.json({ error: "No competition found" }, { status: 404 });
    }

    const teamCount = await prisma.team.count({
      where: {
        competitionId: competition.id,
        deletedAt: null,
      },
    });

    return NextResponse.json({
      competition: {
        ...competition,
        ...normalizeCompetitionTeamAccessConfig(competition),
        teamCount,
      },
    });
  } catch (error) {
    console.error("Failed to load public competition:", error);
    return NextResponse.json({ error: "Failed to load competition" }, { status: 500 });
  }
}
