import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Role } from "@prisma/client";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { requireCompetitionTenantRoles, requireTenantRoles } from "@/lib/server-permissions";

const EDITABLE_ROLES: Role[] = ["ADMIN", "MODERATOR", "ZEITNAHME", "TEAMCHEF", "TEILNEHMER", "FRIENDS"];
const ADMIN_MANAGE_PERMISSION = "admin.roles.manage";

async function requireRolePermissionAdmin(competitionId?: string | null) {
  const session = await getServerSession(authOptions);
  return competitionId
    ? requireCompetitionTenantRoles(session, ["ADMIN"], competitionId)
    : requireTenantRoles(session, ["ADMIN"]);
}

function serializeMatrix(
  permissions: Array<{ key: string; label: string; category: string; description: string | null; riskLevel: string }>,
  grants: Array<{ role: Role; permission: { key: string } }>,
) {
  const assignments = Object.fromEntries(EDITABLE_ROLES.map((role) => [role, [] as string[]]));
  for (const grant of grants) assignments[grant.role]?.push(grant.permission.key);
  return { permissions, assignments };
}

export async function GET(request: NextRequest) {
  const competitionId = request.nextUrl.searchParams.get("competitionId");
  const auth = await requireRolePermissionAdmin(competitionId);
  if ("error" in auth) return auth.error;

  const [permissions, grants] = await Promise.all([
    prisma.permissionObject.findMany({
      select: { key: true, label: true, category: true, description: true, riskLevel: true },
      orderBy: [{ category: "asc" }, { key: "asc" }],
    }),
    prisma.rolePermission.findMany({
      where: { tenantId: auth.tenantId },
      select: { role: true, permission: { select: { key: true } } },
    }),
  ]);

  return NextResponse.json({ tenantId: auth.tenantId, ...serializeMatrix(permissions, grants) });
}

export async function PUT(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const competitionId = typeof body?.competitionId === "string" ? body.competitionId : null;
  const auth = await requireRolePermissionAdmin(competitionId);
  if ("error" in auth) return auth.error;
  if (!body || typeof body.assignments !== "object" || Array.isArray(body.assignments)) {
    return NextResponse.json({ error: "assignments muss ein Rollenobjekt sein" }, { status: 400 });
  }

  const permissions = await prisma.permissionObject.findMany({ select: { id: true, key: true } });
  const permissionIds = new Map(permissions.map((permission) => [permission.key, permission.id]));
  const rows: Array<{ role: Role; permissionId: string }> = [];

  for (const role of EDITABLE_ROLES) {
    const keys = body.assignments[role] ?? [];
    if (!Array.isArray(keys) || keys.some((key) => typeof key !== "string" || !permissionIds.has(key))) {
      return NextResponse.json({ error: `Ungültige Berechtigungsobjekte für ${role}` }, { status: 400 });
    }
    for (const key of new Set(keys)) rows.push({ role, permissionId: permissionIds.get(key)! });
  }

  if (!rows.some((row) => row.role === "ADMIN" && permissions.find((permission) => permission.id === row.permissionId)?.key === ADMIN_MANAGE_PERMISSION)) {
    return NextResponse.json({ error: "ADMIN muss Rollenverwaltung behalten" }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.rolePermission.deleteMany({ where: { tenantId: auth.tenantId } }),
    ...rows.map((row) => prisma.rolePermission.create({ data: { tenantId: auth.tenantId, ...row } })),
  ]);

  const grants = await prisma.rolePermission.findMany({
    where: { tenantId: auth.tenantId },
    select: { role: true, permission: { select: { key: true } } },
  });
  return NextResponse.json({ tenantId: auth.tenantId, ...serializeMatrix(permissions.map((permission) => ({ ...permission, label: permission.key, category: "", description: null, riskLevel: "MEDIUM" })), grants) });
}
