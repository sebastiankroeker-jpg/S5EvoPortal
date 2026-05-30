import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { resolveCurrentUser } from '@/lib/current-user';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ roles: ["ZUSCHAUER"] });
    }

    const { user } = await resolveCurrentUser(session, { createIfMissing: true });
    if (!user) {
      return NextResponse.json({ roles: ["TEILNEHMER"] });
    }
    const tenantRoles = user
      ? await prisma.tenantRole.findMany({
          where: { userId: user.id },
          select: { role: true },
        })
      : [];
    const activeTeamManagerRole = await prisma.teamMemberRole.findFirst({
      where: {
        userId: user.id,
        role: "TEAM_MANAGER",
        revokedAt: null,
        team: { deletedAt: null },
      },
      select: { id: true },
    });

    if (tenantRoles.length === 0) {
      // Eingeloggt aber noch keine DB-Rollen:
      // Neu-Registrierte bekommen nie automatisch ADMIN,
      // sondern nur die Standardrollen für die Anmeldung.
      const tenant = await prisma.tenant.findFirst({ orderBy: { createdAt: "asc" } });

      if (tenant) {
        await prisma.tenantRole.createMany({
          data: [
            { userId: user.id, tenantId: tenant.id, role: "TEAMCHEF" },
            { userId: user.id, tenantId: tenant.id, role: "TEILNEHMER" },
          ],
          skipDuplicates: true,
        });
      }

      return NextResponse.json({ roles: ["TEAMCHEF", "TEILNEHMER"] });
    }

    // Unique Rollen extrahieren - keine implizite Hochstufung
    const roles = [...new Set(tenantRoles.map(tr => tr.role))] as string[];
    if (activeTeamManagerRole && !roles.includes("TEAMCHEF")) {
      roles.push("TEAMCHEF");
    }

    return NextResponse.json({ roles: roles.length ? roles : ["TEILNEHMER"] });

  } catch (error) {
    console.error('Roles API error:', error);
    return NextResponse.json({ roles: ["TEILNEHMER"] });
  }
}
