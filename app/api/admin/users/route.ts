import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { requireTenantRoles } from "@/lib/server-permissions";

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
      teamMemberRoles: {
        where: {
          role: "TEAM_MANAGER",
          revokedAt: null,
          team: { deletedAt: null },
        },
        select: {
          id: true,
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
      const teamScopes = new Map<string, { id: string; name: string; relation: string }>();

      for (const team of u.ownedTeams) {
        teamScopes.set(team.id, { id: team.id, name: team.name, relation: "Owner" });
      }
      for (const team of u.chiefOfTeams) {
        teamScopes.set(team.id, { id: team.id, name: team.name, relation: "Team Manager:in" });
      }
      for (const memberRole of u.teamMemberRoles) {
        teamScopes.set(memberRole.team.id, {
          id: memberRole.team.id,
          name: memberRole.team.name,
          relation: "Team Manager:in",
        });
      }

      return {
        id: u.id,
        email: u.email,
        name: u.name,
        createdAt: u.createdAt,
        roles: u.tenantRoles.map((tr) => ({
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
