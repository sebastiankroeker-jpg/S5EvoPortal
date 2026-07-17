import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { getTenantRoleFlagsForUserId, requireTenantRoles } from "@/lib/server-permissions";
import { buildDeletedUserIdentity } from "@/lib/user-deletion";

async function resolveScopedTenantId(userId: string, fallbackTenantId: string, competitionId: string | null) {
  if (!competitionId) return { tenantId: fallbackTenantId };

  const competition = await prisma.competition.findUnique({
    where: { id: competitionId },
    select: { tenantId: true },
  });

  if (!competition) {
    return { error: NextResponse.json({ error: "Wettkampf nicht gefunden" }, { status: 404 }) };
  }

  const roleFlags = await getTenantRoleFlagsForUserId(userId, competition.tenantId);
  if (!roleFlags.isAdmin) {
    return { error: NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 }) };
  }

  return { tenantId: competition.tenantId };
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const auth = await requireTenantRoles(session, ["ADMIN"]);
  if ("error" in auth) return auth.error;
  const url = new URL(request.url);
  const scopedTenant = await resolveScopedTenantId(auth.user.id, auth.tenantId, url.searchParams.get("competitionId"));
  if ("error" in scopedTenant) return scopedTenant.error;
  const scopedTenantId = scopedTenant.tenantId;

  const { id } = await params;
  if (id === auth.user.id) {
    return NextResponse.json({ error: "Du kannst deinen eigenen Benutzer hier nicht löschen" }, { status: 400 });
  }

  const targetUser = await prisma.user.findUnique({
    where: { id },
    include: {
      tenantRoles: true,
      ownedTeams: {
        include: {
          competition: {
            select: { tenantId: true },
          },
        },
      },
    },
  });

  if (!targetUser || targetUser.deletedAt) {
    return NextResponse.json({ error: "User nicht gefunden" }, { status: 404 });
  }

  const tenantScopedRoles = targetUser.tenantRoles.filter((role) => role.tenantId === scopedTenantId);
  if (tenantScopedRoles.length === 0) {
    return NextResponse.json({ error: "User gehört nicht zu deinem Tenant" }, { status: 404 });
  }

  const hasForeignTenantRoles = targetUser.tenantRoles.some((role) => role.tenantId !== scopedTenantId);
  const hasForeignOwnedTeams = targetUser.ownedTeams.some((team) => team.competition.tenantId !== scopedTenantId && !team.deletedAt);

  if (hasForeignTenantRoles || hasForeignOwnedTeams) {
    return NextResponse.json(
      { error: "User ist noch anderen Tenants zugeordnet und kann nicht tenant-lokal geloescht werden" },
      { status: 409 },
    );
  }

  const hadAdminRole = tenantScopedRoles.some((role) => role.role === "ADMIN");
  if (hadAdminRole) {
    const activeAdminCount = await prisma.tenantRole.count({
      where: {
        tenantId: scopedTenantId,
        role: "ADMIN",
      },
    });

    if (activeAdminCount <= 1) {
      return NextResponse.json({ error: "Der letzte Admin kann nicht gelöscht werden" }, { status: 400 });
    }
  }

  const now = new Date();
  const teamIds = targetUser.ownedTeams
    .filter((team) => team.competition.tenantId === scopedTenantId)
    .map((team) => team.id);
  const { archivedEmail, archivedAuthentikSub } = buildDeletedUserIdentity(targetUser.email, targetUser.id, now);

  await prisma.$transaction([
    prisma.participant.updateMany({
      where: { teamId: { in: teamIds } },
      data: { deletedAt: now },
    }),
    prisma.team.updateMany({
      where: { id: { in: teamIds } },
      data: { deletedAt: now },
    }),
    prisma.tenantRole.deleteMany({
      where: { userId: id, tenantId: scopedTenantId },
    }),
    prisma.user.update({
      where: { id },
      data: {
        deletedAt: now,
        email: archivedEmail,
        authentikSub: archivedAuthentikSub,
      },
    }),
  ]);

  return NextResponse.json({
    success: true,
    message: "Benutzer wurde deaktiviert, Anmeldedaten archiviert und zugehörige Teams wurden ausgeblendet",
  });
}
