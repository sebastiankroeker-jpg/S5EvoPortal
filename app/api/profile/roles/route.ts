import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { resolveCurrentUser } from '@/lib/current-user';
import { hasDerivedTeamchefScope } from '@/lib/teamchef-role';
import {
  getCompetitionRoleFlagsForUserId,
  getEffectivePermissionsForUserId,
} from '@/lib/server-permissions';

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  Pragma: "no-cache",
};

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ roles: ["ZUSCHAUER"] }, { headers: NO_STORE_HEADERS });
    }

    const { user } = await resolveCurrentUser(session, { createIfMissing: true });
    if (!user) {
      return NextResponse.json({ roles: ["TEILNEHMER"] }, { headers: NO_STORE_HEADERS });
    }

    const competitionId = request.nextUrl.searchParams.get("competitionId")?.trim() || null;
    if (!competitionId) {
      return NextResponse.json(
        { error: "competitionId erforderlich", roles: ["TEILNEHMER"] },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    const competition = await prisma.competition.findUnique({
      where: { id: competitionId },
      select: { id: true, tenantId: true },
    });
    if (!competition) {
      return NextResponse.json(
        { error: "Wettkampf nicht gefunden", roles: ["TEILNEHMER"] },
        { status: 404, headers: NO_STORE_HEADERS },
      );
    }

    const [roleFlags, hasTeamchefScope] = await Promise.all([
      getCompetitionRoleFlagsForUserId(user.id, competition.tenantId, competition.id),
      hasDerivedTeamchefScope(prisma, {
        userId: user.id,
        tenantId: competition.tenantId,
        competitionId: competition.id,
      }),
    ]);

    const roles = roleFlags.roles.filter((role) => role !== "TEAMCHEF") as string[];
    if (hasTeamchefScope && !roles.includes("TEAMCHEF")) {
      roles.push("TEAMCHEF");
    }

    const permissions = await getEffectivePermissionsForUserId(
      user.id,
      competition.tenantId,
      competition.id,
    );
    return NextResponse.json(
      {
        roles: roles.length ? roles : ["TEILNEHMER"],
        permissions,
        tenantId: competition.tenantId,
        competitionId: competition.id,
      },
      { headers: NO_STORE_HEADERS },
    );

  } catch (error) {
    console.error('Roles API error:', error);
    return NextResponse.json({ roles: ["TEILNEHMER"] }, { headers: NO_STORE_HEADERS });
  }
}
