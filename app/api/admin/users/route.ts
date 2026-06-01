import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { requireTenantRoles } from "@/lib/server-permissions";

type TeamScope = {
  id: string;
  name: string;
  relations: string[];
  isOwner: boolean;
  isLegacyTeamChief: boolean;
  isParticipant: boolean;
  isTeamManager: boolean;
};

// GET /api/admin/users — Alle User mit Rollen laden
export async function GET() {
  const session = await getServerSession(authOptions);
  const auth = await requireTenantRoles(session, ["ADMIN"]);
  if ("error" in auth) return auth.error;

  const users = await prisma.user.findMany({
    where: {
      deletedAt: null,
      tenantRoles: {
        some: { tenantId: auth.tenantId },
      },
    },
    include: {
      tenantRoles: {
        where: { tenantId: auth.tenantId },
        include: { tenant: { select: { name: true } } },
      },
      ownedTeams: {
        where: { deletedAt: null },
        select: { id: true, name: true },
      },
      chiefOfTeams: {
        where: { deletedAt: null },
        select: { id: true, name: true },
      },
      linkedParticipants: {
        where: {
          deletedAt: null,
          team: {
            deletedAt: null,
            competition: { tenantId: auth.tenantId },
          },
        },
        select: {
          id: true,
          team: { select: { id: true, name: true } },
        },
      },
      teamMemberRoles: {
        where: {
          role: "TEAM_MANAGER",
          revokedAt: null,
          team: { deletedAt: null },
        },
        select: {
          id: true,
          role: true,
          team: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const adminCount = users.filter((user) => user.tenantRoles.some((role) => role.role === "ADMIN")).length;

  return NextResponse.json({
    currentUserId: auth.user.id,
    tenantId: auth.tenantId,
    adminCount,
    users: users.map((u) => {
      const teamScopes = new Map<string, TeamScope>();

      const upsertTeamScope = (
        team: { id: string; name: string },
        relation: string,
        flags: Partial<Omit<TeamScope, "id" | "name" | "relations">>,
      ) => {
        const existing = teamScopes.get(team.id) ?? {
          id: team.id,
          name: team.name,
          relations: [],
          isOwner: false,
          isLegacyTeamChief: false,
          isParticipant: false,
          isTeamManager: false,
        };
        if (!existing.relations.includes(relation)) {
          existing.relations.push(relation);
        }
        teamScopes.set(team.id, { ...existing, ...flags });
      };

      for (const team of u.ownedTeams) {
        upsertTeamScope(team, "Owner", { isOwner: true, isTeamManager: true });
      }
      for (const team of u.chiefOfTeams) {
        upsertTeamScope(team, "Teamchef:in", { isLegacyTeamChief: true, isTeamManager: true });
      }
      for (const participant of u.linkedParticipants) {
        upsertTeamScope(participant.team, "Teilnehmer:in", { isParticipant: true });
      }
      for (const memberRole of u.teamMemberRoles) {
        upsertTeamScope(memberRole.team, "Team Manager:in", { isTeamManager: true });
      }

      const visibleRoles = u.tenantRoles.filter((tenantRole) => tenantRole.role !== "TEAMCHEF" || teamScopes.size > 0);

      return {
        id: u.id,
        email: u.email,
        name: u.name,
        createdAt: u.createdAt,
        roles: visibleRoles.map((tr) => ({
          id: tr.id,
          role: tr.role,
          tenantId: tr.tenantId,
          tenantName: tr.tenant.name,
        })),
        teamCount: teamScopes.size,
        teamScopes: Array.from(teamScopes.values()),
      };
    }),
  });
}
