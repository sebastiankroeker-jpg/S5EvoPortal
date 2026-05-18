import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ roles: ["ZUSCHAUER"] });
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        tenantRoles: {
          select: { role: true }
        }
      }
    });

    if (!user || user.tenantRoles.length === 0) {
      // Eingeloggt aber noch keine DB-Rollen:
      // Neu-Registrierte bekommen nie automatisch ADMIN,
      // sondern nur die Standardrollen für die Anmeldung.
      const tenant = await prisma.tenant.findFirst({ orderBy: { createdAt: "asc" } });

      let dbUser = user;
      if (!dbUser) {
        dbUser = await prisma.user.create({
          data: {
            email: session.user.email,
            name: session.user.name || null,
            image: (session.user as any).image || null,
          },
          include: { tenantRoles: true },
        });
      }

      if (tenant) {
        await prisma.tenantRole.createMany({
          data: [
            { userId: dbUser.id, tenantId: tenant.id, role: "TEAMCHEF" },
            { userId: dbUser.id, tenantId: tenant.id, role: "TEILNEHMER" },
          ],
          skipDuplicates: true,
        });
      }

      return NextResponse.json({ roles: ["TEAMCHEF", "TEILNEHMER"] });
    }

    // Unique Rollen extrahieren
    const roles = [...new Set(user.tenantRoles.map(tr => tr.role))] as string[];

    // Jeder mit DB-Rollen bekommt auch TEAMCHEF implizit
    if (!roles.includes("TEAMCHEF")) {
      roles.push("TEAMCHEF");
    }

    return NextResponse.json({ roles });

  } catch (error) {
    console.error('Roles API error:', error);
    return NextResponse.json({ roles: ["TEILNEHMER"] });
  }
}
