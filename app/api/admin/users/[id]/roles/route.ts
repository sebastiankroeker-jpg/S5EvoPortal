import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Role } from "@prisma/client";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { requireCompetitionRoles } from "@/lib/server-permissions";

const VALID_ROLES: Role[] = ["ADMIN", "MODERATOR", "ZEITNAHME", "TEILNEHMER", "FRIENDS"];
const COMPETITION_ROLES: Role[] = ["MODERATOR", "ZEITNAHME"];
const TENANT_ROLES: Role[] = ["ADMIN", "TEILNEHMER", "FRIENDS"];

// PUT /api/admin/users/[id]/roles — Rollen eines Users setzen
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Ungültiger Request" }, { status: 400 });
  }

  const { roles } = body; // string[] z.B. ["ADMIN", "TEILNEHMER"]
  const competitionId = typeof body.competitionId === "string" ? body.competitionId.trim() : "";
  const auth = await requireCompetitionRoles(session, ["ADMIN"], competitionId);
  if ("error" in auth) return auth.error;
  const scopedCompetitionId = auth.competitionId;
  if (!scopedCompetitionId) {
    return NextResponse.json({ error: "competitionId erforderlich" }, { status: 400 });
  }

  if (!Array.isArray(roles)) {
    return NextResponse.json({ error: "roles muss ein Array sein" }, { status: 400 });
  }

  if (!roles.every((role) => typeof role === "string" && VALID_ROLES.includes(role as Role))) {
    return NextResponse.json({ error: "Mindestens eine Rolle ist ungültig" }, { status: 400 });
  }

  const filteredRoles = [...new Set(roles as Role[])];
  const tenantRoles = filteredRoles.filter((role) => TENANT_ROLES.includes(role));
  const competitionRoles = filteredRoles.filter((role) => COMPETITION_ROLES.includes(role));

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
  const keepsAdminRole = tenantRoles.includes("ADMIN");

  if (hadAdminRole && !keepsAdminRole) {
    const adminCount = await prisma.tenantRole.count({
      where: { tenantId: auth.tenantId, role: "ADMIN" },
    });

    if (adminCount <= 1) {
      return NextResponse.json({ error: "Der letzte Admin kann nicht entfernt werden" }, { status: 400 });
    }
  }

  await prisma.$transaction([
    prisma.tenantRole.deleteMany({
      where: {
        userId: id,
        tenantId: auth.tenantId,
        role: { in: VALID_ROLES },
      },
    }),
    ...tenantRoles.map((role) =>
      prisma.tenantRole.create({
        data: {
          userId: id,
          tenantId: auth.tenantId,
          role,
        },
      })
    ),
    prisma.competitionRole.deleteMany({
      where: {
        userId: id,
        competitionId: scopedCompetitionId,
        role: { in: COMPETITION_ROLES },
      },
    }),
    ...competitionRoles.map((role) =>
      prisma.competitionRole.create({
        data: {
          userId: id,
          competitionId: scopedCompetitionId,
          role,
          grantedById: auth.user.id,
        },
      })
    ),
  ]);

  return NextResponse.json({
    success: true,
    roles: filteredRoles,
    tenantId: auth.tenantId,
    competitionId: scopedCompetitionId,
  });
}
