import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { resolveCurrentUser } from '@/lib/current-user';
import { hasDerivedTeamchefScope } from '@/lib/teamchef-role';

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
          select: { role: true, tenantId: true },
        })
      : [];
    const tenantId = tenantRoles[0]?.tenantId ?? (await prisma.tenant.findFirst({ orderBy: { createdAt: "asc" } }))?.id ?? null;
    const hasTeamchefScope = tenantId
      ? await hasDerivedTeamchefScope(prisma, {
          userId: user.id,
          tenantId,
        })
      : false;

    if (tenantRoles.length === 0) {
      // Eingeloggt aber noch keine DB-Rollen:
      // Neu-Registrierte bekommen nie automatisch ADMIN,
      // sondern nur die Standardrollen für die Anmeldung.
      const tenant = await prisma.tenant.findFirst({ orderBy: { createdAt: "asc" } });

      if (tenant) {
        await prisma.tenantRole.createMany({
          data: [
            { userId: user.id, tenantId: tenant.id, role: "TEILNEHMER" },
          ],
          skipDuplicates: true,
        });
      }

      const roles = ["TEILNEHMER"];
      if (hasTeamchefScope) roles.unshift("TEAMCHEF");
      return NextResponse.json({ roles });
    }

    // Unique Rollen extrahieren - keine implizite Hochstufung
    const roles = [...new Set(tenantRoles.map((tr) => tr.role).filter((role) => role !== "TEAMCHEF"))] as string[];
    if (hasTeamchefScope && !roles.includes("TEAMCHEF")) {
      roles.push("TEAMCHEF");
    }

    return NextResponse.json({ roles: roles.length ? roles : ["TEILNEHMER"] });

  } catch (error) {
    console.error('Roles API error:', error);
    return NextResponse.json({ roles: ["TEILNEHMER"] });
  }
}
