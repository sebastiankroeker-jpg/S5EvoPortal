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

    // Admin-Emails (Bootstrap — später über Authentik-Gruppen lösen)
    const ADMIN_EMAILS = ["sebkroeker@web.de"];
    const isAdmin = ADMIN_EMAILS.includes(session.user.email);

    if (!user || user.tenantRoles.length === 0) {
      // Eingeloggt aber noch keine DB-Rollen → Standard: Teamchef + Teilnehmer
      if (isAdmin) {
        return NextResponse.json({ roles: ["ADMIN", "TEAMCHEF", "TEILNEHMER"] });
      }
      return NextResponse.json({ roles: ["TEAMCHEF", "TEILNEHMER"] });
    }

    // Unique Rollen extrahieren
    const roles = [...new Set(user.tenantRoles.map(tr => tr.role))] as string[];
    
    // Admin-Email immer ADMIN ergänzen
    if (isAdmin && !roles.includes("ADMIN")) {
      roles.push("ADMIN");
    }

    if (!roles.includes("TEAMCHEF")) {
      roles.push("TEAMCHEF");
    }

    return NextResponse.json({ roles });

  } catch (error) {
    console.error('Roles API error:', error);
    return NextResponse.json({ roles: ["TEILNEHMER"] });
  }
}
