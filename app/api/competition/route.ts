import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { resolveCurrentUser } from "@/lib/current-user";
import { resolveCompetitionClassifications, toPublicCompetitionClassifications } from "@/lib/competition-classifications";
import { normalizeCompetitionTeamAccessConfig } from "@/lib/team-access-config";
import { canViewerReadCompetition, resolvePortalVisibility, resolveRegistrationVisibility } from "@/lib/competition-visibility";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
};

export async function GET(request: NextRequest) {
  try {
    const competitionId = request.nextUrl.searchParams.get("id");
    const competitionSelect = {
      id: true,
      tenantId: true,
      name: true,
      year: true,
      status: true,
      portalVisibility: true,
      registrationVisibility: true,
      date: true,
      dateEnd: true,
      registrationDeadline: true,
      teamOwnerFilterVisibleForTeamchef: true,
      participantsCanViewAllTeams: true,
      spectatorsCanViewAllTeams: true,
      hideForeignTeams: true,
      liveTeamsVisibility: true,
      liveStartlistsVisibility: true,
      liveResultsVisibility: true,
      marketplaceGlobalVisibility: true,
      shirtOrderDeadline: true,
      maxTeams: true,
      teamSize: true,
      location: true,
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
      tenant: {
        select: {
          publicPortalRegistrationEnabled: true,
        },
      },
    } satisfies Prisma.CompetitionSelect;

    const competition = competitionId
      ? await prisma.competition.findUnique({
          where: { id: competitionId },
          select: competitionSelect,
        })
      : await prisma.competition.findFirst({
          where: { status: "RUNNING" },
          orderBy: [{ year: "desc" }, { createdAt: "desc" }],
          select: competitionSelect,
        }) ??
        await prisma.competition.findFirst({
          where: { status: "CLOSED" },
          orderBy: [{ year: "desc" }, { createdAt: "desc" }],
          select: competitionSelect,
        }) ??
        await prisma.competition.findFirst({
          where: { status: { not: "DRAFT" } },
          orderBy: [{ year: "desc" }, { createdAt: "desc" }],
          select: competitionSelect,
        });

    if (!competition) {
      return NextResponse.json({ error: "No competition found" }, { status: 404, headers: NO_STORE_HEADERS });
    }

    const session = await getServerSession(authOptions);
    const authenticated = Boolean(session?.user?.email);
    const { user } = authenticated
      ? await resolveCurrentUser(session, { createIfMissing: false })
      : { user: null };
    const [adminRole, operationalRole, ownTeam] = user
      ? await Promise.all([
          prisma.tenantRole.findFirst({ where: { userId: user.id, tenantId: competition.tenantId, role: "ADMIN" }, select: { id: true } }),
          prisma.competitionRole.findFirst({
            where: { userId: user.id, competitionId: competition.id, role: { in: ["MODERATOR", "ZEITNAHME"] } },
            select: { id: true },
          }),
          prisma.team.findFirst({
            where: {
              competitionId: competition.id,
              deletedAt: null,
              OR: [
                { ownerId: user.id }, { teamChiefId: user.id },
                { memberRoles: { some: { userId: user.id, revokedAt: null } } },
                { participants: { some: { userId: user.id, deletedAt: null } } },
              ],
            },
            select: { id: true },
          }),
        ])
      : [null, null, null] as const;

    if (!canViewerReadCompetition(competition, {
      authenticated,
      isAdmin: Boolean(adminRole),
      hasOperationalAssignment: Boolean(operationalRole),
      hasOwnRelationship: Boolean(ownTeam),
    })) {
      // Do not provide an oracle for private competition IDs.
      return NextResponse.json({ error: "Competition not found" }, { status: 404, headers: NO_STORE_HEADERS });
    }

    const teamCount = await prisma.team.count({
      where: {
        competitionId: competition.id,
        deletedAt: null,
        registrationMode: "TEAM",
      },
    });

    return NextResponse.json(
      {
        competition: {
          ...competition,
          portalVisibility: resolvePortalVisibility(competition),
          registrationVisibility: resolveRegistrationVisibility(competition),
          classifications: toPublicCompetitionClassifications(
            resolveCompetitionClassifications(competition.classifications),
            competition.year,
          ),
          ...normalizeCompetitionTeamAccessConfig(competition),
          teamCount: competition.hideForeignTeams ? null : teamCount,
        },
      },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    console.error("Failed to load public competition:", error);
    return NextResponse.json({ error: "Failed to load competition" }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
