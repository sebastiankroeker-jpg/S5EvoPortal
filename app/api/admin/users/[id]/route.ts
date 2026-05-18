import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { buildDeletedUserIdentity } from "@/lib/user-deletion";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const currentUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { tenantRoles: true },
  });

  if (!currentUser?.tenantRoles.some((role) => role.role === "ADMIN")) {
    return NextResponse.json({ error: "Nur Admins" }, { status: 403 });
  }

  const { id } = await params;
  if (id === currentUser.id) {
    return NextResponse.json({ error: "Du kannst deinen eigenen Benutzer hier nicht löschen" }, { status: 400 });
  }

  const targetUser = await prisma.user.findUnique({
    where: { id },
    include: {
      tenantRoles: true,
      ownedTeams: { select: { id: true } },
    },
  });

  if (!targetUser || targetUser.deletedAt) {
    return NextResponse.json({ error: "User nicht gefunden" }, { status: 404 });
  }

  const hadAdminRole = targetUser.tenantRoles.some((role) => role.role === "ADMIN");
  if (hadAdminRole) {
    const activeAdminCount = await prisma.user.count({
      where: {
        deletedAt: null,
        tenantRoles: {
          some: { role: "ADMIN" },
        },
      },
    });

    if (activeAdminCount <= 1) {
      return NextResponse.json({ error: "Der letzte Admin kann nicht gelöscht werden" }, { status: 400 });
    }
  }

  const now = new Date();
  const teamIds = targetUser.ownedTeams.map((team) => team.id);
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
      where: { userId: id },
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
