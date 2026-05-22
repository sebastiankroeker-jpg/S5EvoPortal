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
      _count: { select: { ownedTeams: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const adminCount = users.filter((user) => user.tenantRoles.some((role) => role.role === "ADMIN")).length;

  return NextResponse.json({
    currentUserId: auth.user.id,
    tenantId: auth.tenantId,
    adminCount,
    users: users.map((u) => ({
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
      teamCount: u._count.ownedTeams,
    })),
  });
}
