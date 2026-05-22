import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Role } from "@prisma/client";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { requireTenantRoles } from "@/lib/server-permissions";

const VALID_ROLES: Role[] = ["ADMIN", "MODERATOR", "TEAMCHEF", "TEILNEHMER"];

// PUT /api/admin/users/[id]/roles — Rollen eines Users setzen
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const auth = await requireTenantRoles(session, ["ADMIN"]);
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const body = await request.json();
  const { roles } = body; // string[] z.B. ["ADMIN", "TEAMCHEF"]

  if (!Array.isArray(roles)) {
    return NextResponse.json({ error: "roles muss ein Array sein" }, { status: 400 });
  }

  const filteredRoles = roles.filter(
    (role): role is Role => typeof role === "string" && VALID_ROLES.includes(role as Role)
  );

  // User + Default-Tenant finden
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    return NextResponse.json({ error: "User nicht gefunden" }, { status: 404 });
  }

  // Self-protection: Admin kann sich nicht selbst ADMIN entziehen
  if (id === auth.user.id && !filteredRoles.includes("ADMIN")) {
    return NextResponse.json({ error: "Du kannst dir selbst die Admin-Rolle nicht entziehen" }, { status: 400 });
  }

  const currentTenantRoles = await prisma.tenantRole.findMany({
    where: { userId: id, tenantId: auth.tenantId },
    select: { role: true },
  });
  const hadAdminRole = currentTenantRoles.some((tenantRole) => tenantRole.role === "ADMIN");
  const keepsAdminRole = filteredRoles.includes("ADMIN");

  if (hadAdminRole && !keepsAdminRole) {
    const adminCount = await prisma.tenantRole.count({
      where: { tenantId: auth.tenantId, role: "ADMIN" },
    });

    if (adminCount <= 1) {
      return NextResponse.json({ error: "Der letzte Admin kann nicht entfernt werden" }, { status: 400 });
    }
  }

  // Bestehende Rollen für diesen Tenant löschen und neue setzen
  await prisma.$transaction([
    prisma.tenantRole.deleteMany({
      where: { userId: id, tenantId: auth.tenantId },
    }),
    ...filteredRoles.map((role) =>
      prisma.tenantRole.create({
        data: {
          userId: id,
          tenantId: auth.tenantId,
          role,
        },
      })
    ),
  ]);

  return NextResponse.json({ success: true, roles: filteredRoles, tenantId: auth.tenantId });
}
