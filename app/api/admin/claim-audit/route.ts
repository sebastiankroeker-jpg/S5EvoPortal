import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { requireCompetitionTenantRoles } from "@/lib/server-permissions";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const competitionId = url.searchParams.get("competitionId");
  const session = await getServerSession(authOptions);
  const auth = await requireCompetitionTenantRoles(session, ["ADMIN", "MODERATOR"], competitionId);
  if ("error" in auth) return auth.error;

  const suspiciousOnly = url.searchParams.get("suspiciousOnly") === "true";
  const limit = Math.min(Number(url.searchParams.get("limit") || 50), 200);
  const tenantTeams = await prisma.team.findMany({
    where: {
      competition: {
        tenantId: auth.tenantId,
        ...(competitionId ? { id: competitionId } : {}),
      },
    },
    select: { id: true },
  });
  const teamIds = tenantTeams.map((team) => team.id);

  const [registrationEvents, participantEvents] = await Promise.all([
    prisma.registrationClaimAuditEvent.findMany({
      where: {
        ...(suspiciousOnly ? { suspicious: true } : {}),
        teamId: { in: teamIds },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.participantClaimAuditEvent.findMany({
      where: {
        ...(suspiciousOnly ? { suspicious: true } : {}),
        teamId: { in: teamIds },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
  ]);

  const events = [
    ...registrationEvents.map((event) => ({
      ...event,
      scope: "team" as const,
      participantId: null,
    })),
    ...participantEvents.map((event) => ({
      ...event,
      scope: "participant" as const,
    })),
  ]
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    .slice(0, limit);

  return NextResponse.json({ events });
}
