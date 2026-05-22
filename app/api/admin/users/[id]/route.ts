import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { requireTenantRoles } from "@/lib/server-permissions";
import { buildDeletedUserIdentity } from "@/lib/user-deletion";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const auth = await requireTenantRoles(session, ["ADMIN"]);
  if ("error" in auth) return auth.error;

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

  const tenantScopedRoles = targetUser.tenantRoles.filter((role) => role.tenantId === auth.tenantId);
  if (tenantScopedRoles.length === 0) {
    return NextResponse.json({ error: "User gehört nicht zu deinem Tenant" }, { status: 404 });
  }

  const hasForeignTenantRoles = targetUser.tenantRoles.some((role) => role.tenantId !== auth.tenantId);
  const hasForeignOwnedTeams = targetUser.ownedTeams.some((team) => team.competition.tenantId !== auth.tenantId && !team.deletedAt);

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
        tenantId: auth.tenantId,
        role: "ADMIN",
      },
    });

    if (activeAdminCount <= 1) {
      return NextResponse.json({ error: "Der letzte Admin kann nicht gelöscht werden" }, { status: 400 });
    }
  }

  const now = new Date();
  const teamIds = targetUser.ownedTeams
    .filter((team) => team.competition.tenantId === auth.tenantId)
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
      where: { userId: id, tenantId: auth.tenantId },
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
