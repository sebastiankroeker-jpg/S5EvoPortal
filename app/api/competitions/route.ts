import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { resolveCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { resolveCompetitionClassifications, toPublicCompetitionClassifications } from "@/lib/competition-classifications";
import { normalizeCompetitionTeamAccessConfig } from "@/lib/team-access-config";
import { canViewerReadCompetition, resolvePortalVisibility, resolveRegistrationVisibility } from "@/lib/competition-visibility";

const NO_STORE_HEADERS = { "Cache-Control": "no-store, max-age=0" };

/** Server-side selection source for the competition switcher. */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const authenticated = Boolean(session?.user?.email);
    const { user } = authenticated
      ? await resolveCurrentUser(session, { createIfMissing: false })
      : { user: null };

    const [adminRoles, operationalRoles, linkedTeams] = user
      ? await Promise.all([
          prisma.tenantRole.findMany({ where: { userId: user.id, role: "ADMIN" }, select: { tenantId: true } }),
          prisma.competitionRole.findMany({
            where: { userId: user.id, role: { in: ["MODERATOR", "ZEITNAHME"] } },
            select: { competitionId: true },
          }),
          prisma.team.findMany({
            where: {
              deletedAt: null,
              OR: [
                { ownerId: user.id },
                { teamChiefId: user.id },
                { memberRoles: { some: { userId: user.id, revokedAt: null } } },
                { participants: { some: { userId: user.id, deletedAt: null } } },
              ],
            },
            select: { competitionId: true },
            distinct: ["competitionId"],
          }),
        ])
      : [[], [], []] as const;

    const adminTenantIds = new Set(adminRoles.map((role) => role.tenantId));
    const operationalCompetitionIds = new Set(operationalRoles.map((role) => role.competitionId));
    const ownCompetitionIds = new Set(linkedTeams.map((team) => team.competitionId));
    const competitions = await prisma.competition.findMany({
      orderBy: [{ year: "desc" }, { createdAt: "desc" }],
      select: {
        id: true, name: true, year: true, status: true,
        portalVisibility: true, registrationVisibility: true,
        teamOwnerFilterVisibleForTeamchef: true,
        participantsCanViewAllTeams: true, spectatorsCanViewAllTeams: true,
        hideForeignTeams: true, liveTeamsVisibility: true,
        liveStartlistsVisibility: true, liveResultsVisibility: true,
        marketplaceGlobalVisibility: true,
        classifications: {
          select: {
            code: true, name: true, type: true, minAge: true, maxAge: true,
            genderRestriction: true, sourceClassCodes: true, sortOrder: true, displayEmoji: true,
          },
          orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
        },
        tenantId: true,
        _count: { select: { teams: true } },
      },
    });

    const visible = competitions
      .filter((competition) => canViewerReadCompetition(competition, {
        authenticated,
        isAdmin: adminTenantIds.has(competition.tenantId),
        hasOperationalAssignment: operationalCompetitionIds.has(competition.id),
        hasOwnRelationship: ownCompetitionIds.has(competition.id),
      }))
      .map((competition) => ({
        id: competition.id,
        name: competition.name,
        year: competition.year,
        status: competition.status,
        portalVisibility: resolvePortalVisibility(competition),
        registrationVisibility: resolveRegistrationVisibility(competition),
        teamCount: competition._count.teams,
        ...normalizeCompetitionTeamAccessConfig(competition),
        classifications: toPublicCompetitionClassifications(
          resolveCompetitionClassifications(competition.classifications),
          competition.year,
        ),
      }));

    return NextResponse.json({ competitions: visible }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    console.error("Failed to load visible competitions:", error);
    return NextResponse.json({ error: "Failed to load competitions" }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
