import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { requireTenantRoles } from "@/lib/server-permissions";
import { normalizeCompetitionTeamAccessConfig } from "@/lib/team-access-config";

// GET all competitions (for admin switcher)
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const auth = await requireTenantRoles(session, ["ADMIN"]);
    if ("error" in auth) return auth.error;

    const competitions = await prisma.competition.findMany({
      where: { tenantId: auth.tenantId },
      orderBy: { year: "desc" },
      include: {
        tenant: { select: { name: true, slug: true } },
        _count: { select: { teams: true } },
      },
    });

    return NextResponse.json({
      competitions: competitions.map((competition) => ({
        ...competition,
        ...normalizeCompetitionTeamAccessConfig(competition),
      })),
    });
  } catch (error) {
    console.error("Failed to load competitions:", error);
    return NextResponse.json({ error: "Failed to load competitions" }, { status: 500 });
  }
}
