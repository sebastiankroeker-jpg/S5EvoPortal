import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

// GET /api/admin/users — Alle User mit Rollen laden
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  // Nur Admin
  const currentUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { tenantRoles: true },
  });

  const isAdmin = currentUser?.tenantRoles.some(r => r.role === "ADMIN");
  if (!isAdmin) {
    return NextResponse.json({ error: "Nur Admins" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    include: {
      tenantRoles: {
        include: { tenant: { select: { name: true } } },
      },
      _count: { select: { ownedTeams: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
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
