import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

// PUT /api/admin/users/[id]/roles — Rollen eines Users setzen
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;
  const body = await request.json();
  const { roles } = body; // string[] z.B. ["ADMIN", "TEAMCHEF"]

  if (!Array.isArray(roles)) {
    return NextResponse.json({ error: "roles muss ein Array sein" }, { status: 400 });
  }

  const validRoles = ["ADMIN", "MODERATOR", "TEAMCHEF", "TEILNEHMER"];
  const filteredRoles = roles.filter((r: string) => validRoles.includes(r));

  // User + Default-Tenant finden
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    return NextResponse.json({ error: "User nicht gefunden" }, { status: 404 });
  }

  // Self-protection: Admin kann sich nicht selbst ADMIN entziehen
  if (id === currentUser?.id && !filteredRoles.includes("ADMIN")) {
    return NextResponse.json({ error: "Du kannst dir selbst die Admin-Rolle nicht entziehen" }, { status: 400 });
  }

  // Default-Tenant holen (erster Tenant)
  const tenant = await prisma.tenant.findFirst({ orderBy: { createdAt: "asc" } });
  if (!tenant) {
    return NextResponse.json({ error: "Kein Tenant vorhanden" }, { status: 500 });
  }

  // Bestehende Rollen für diesen Tenant löschen und neue setzen
  await prisma.$transaction([
    prisma.tenantRole.deleteMany({
      where: { userId: id, tenantId: tenant.id },
    }),
    ...filteredRoles.map((role: string) =>
      prisma.tenantRole.create({
        data: {
          userId: id,
          tenantId: tenant.id,
          role: role as any,
        },
      })
    ),
  ]);

  return NextResponse.json({ success: true, roles: filteredRoles });
}
