import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { requireTenantRoles } from "@/lib/server-permissions";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const auth = await requireTenantRoles(session, ["ADMIN"]);
  if ("error" in auth) return auth.error;

  const competitionId = request.nextUrl.searchParams.get("competitionId");

  try {
    const competitionScope = {
      tenantId: auth.tenantId,
      ...(competitionId ? { id: competitionId } : {}),
    };

    const [teamchefRoles, teamsWithChief, managerRoles, archivedTeams] = await Promise.all([
      prisma.tenantRole.findMany({
        where: {
          tenantId: auth.tenantId,
          role: "TEAMCHEF",
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.team.findMany({
        where: {
          deletedAt: null,
          teamChiefId: { not: null },
          competition: competitionScope,
        },
        select: {
          teamChiefId: true,
        },
      }),
      prisma.teamMemberRole.findMany({
        where: {
          role: "TEAM_MANAGER",
          revokedAt: null,
          team: {
            deletedAt: null,
            competition: competitionScope,
          },
        },
        select: {
          userId: true,
        },
      }),
      prisma.team.findMany({
        where: {
          deletedAt: { not: null },
          competition: competitionScope,
        },
        select: {
          id: true,
          name: true,
          deletedAt: true,
          participants: {
            select: {
              id: true,
              userId: true,
            },
          },
        },
        orderBy: { deletedAt: "desc" },
        take: 50,
      }),
    ]);

    const derivedScopeUserIds = new Set(
      [
        ...teamsWithChief.map((team) => team.teamChiefId).filter((value): value is string => Boolean(value)),
        ...managerRoles.map((role) => role.userId),
      ].filter((value): value is string => Boolean(value)),
    );

    const staleTeamchefRoles = teamchefRoles
      .filter((role) => !derivedScopeUserIds.has(role.userId))
      .map((role) => ({
        roleId: role.id,
        userId: role.user.id,
        email: role.user.email,
        name: role.user.name,
      }));

    const archivedTeamsWithLinkedParticipants = archivedTeams
      .map((team) => ({
        id: team.id,
        name: team.name,
        deletedAt: team.deletedAt,
        linkedParticipantCount: team.participants.filter((participant) => Boolean(participant.userId)).length,
      }))
      .filter((team) => team.linkedParticipantCount > 0);

    return NextResponse.json({
      summary: {
        teamchefRoleCount: teamchefRoles.length,
        staleTeamchefRoleCount: staleTeamchefRoles.length,
        archivedTeamCount: archivedTeams.length,
        archivedTeamsWithLinkedParticipantsCount: archivedTeamsWithLinkedParticipants.length,
      },
      staleTeamchefRoles,
      archivedTeamsWithLinkedParticipants,
    });
  } catch (error) {
    console.error("Failed to load team access audit:", error);
    return NextResponse.json({ error: "Rechte-Audit konnte nicht geladen werden" }, { status: 500 });
  }
}
