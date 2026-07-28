import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { resolveCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { normalizeCompetitionTeamAccessConfig } from "@/lib/team-access-config";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  Pragma: "no-cache",
};

// GET all competitions (for admin switcher)
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE_HEADERS });
    }
    const { user } = await resolveCurrentUser(session, { createIfMissing: true });
    if (!user) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403, headers: NO_STORE_HEADERS });
    }

    const [tenantRoles, competitionRoles] = await Promise.all([
      prisma.tenantRole.findMany({
        where: {
          userId: user.id,
          role: { in: ["ADMIN", "MODERATOR", "ZEITNAHME"] },
        },
        select: { tenantId: true },
      }),
      prisma.competitionRole.findMany({
        where: {
          userId: user.id,
          role: { in: ["MODERATOR", "ZEITNAHME"] },
        },
        select: { competitionId: true },
      }),
    ]);
    const tenantIds = [...new Set(tenantRoles.map((role) => role.tenantId))];
    const competitionIds = [...new Set(competitionRoles.map((role) => role.competitionId))];
    if (tenantIds.length === 0 && competitionIds.length === 0) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403, headers: NO_STORE_HEADERS });
    }

    const competitions = await prisma.competition.findMany({
      where: {
        OR: [
          ...(tenantIds.length > 0 ? [{ tenantId: { in: tenantIds } }] : []),
          ...(competitionIds.length > 0 ? [{ id: { in: competitionIds } }] : []),
        ],
      },
      orderBy: [{ year: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        name: true,
        year: true,
        status: true,
        teamOwnerFilterVisibleForTeamchef: true,
        participantsCanViewAllTeams: true,
        spectatorsCanViewAllTeams: true,
        hideForeignTeams: true,
        liveTeamsVisibility: true,
        liveStartlistsVisibility: true,
        liveResultsVisibility: true,
        marketplaceGlobalVisibility: true,
        _count: { select: { teams: true } },
      },
    });

    return NextResponse.json(
      {
        competitions: competitions.map((competition) => ({
          ...competition,
          ...normalizeCompetitionTeamAccessConfig(competition),
        })),
      },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    console.error("Failed to load competitions:", error);
    return NextResponse.json({ error: "Failed to load competitions" }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
