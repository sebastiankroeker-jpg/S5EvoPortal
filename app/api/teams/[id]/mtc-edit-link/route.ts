import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { normalizeEmail, resolveCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { buildMtcAnonymousUrl, createRegistrationClaimToken } from "@/lib/registration-claim";
import { getScopedRoleFlags } from "@/lib/server-permissions";
import { resolveTeamAccess } from "@/lib/team-manager-access";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  const userEmail = session?.user?.email;

  if (!userEmail) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const authenticatedUserEmail = userEmail;

  const { id } = await params;
  const team = await prisma.team.findFirst({
    where: { id, deletedAt: null },
    include: {
      competition: {
        select: {
          id: true,
          tenantId: true,
          date: true,
          dateEnd: true,
          registrationDeadline: true,
          claimTokenExpiryMode: true,
          claimTokenTtlDays: true,
          tenant: { select: { claimLinksEnabled: true } },
        },
      },
      owner: { select: { email: true, name: true, authentikSub: true } },
      memberRoles: {
        where: { role: "TEAM_MANAGER", revokedAt: null },
        select: { userId: true, revokedAt: true },
      },
    },
  });

  if (!team) {
    return NextResponse.json({ error: "MTC nicht gefunden." }, { status: 404 });
  }

  if (team.registrationMode !== "MARKETPLACE" || team.marketplaceStatus !== "MATCHING") {
    return NextResponse.json({ error: "Dieser Link ist nur fuer offene MTC-Entwuerfe verfuegbar." }, { status: 409 });
  }

  if (!team.competition.tenant.claimLinksEnabled) {
    return NextResponse.json({ error: "MTC-Bearbeitungslinks sind aktuell deaktiviert." }, { status: 409 });
  }

  const { user } = await resolveCurrentUser(session, { createIfMissing: true });
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const access = await getScopedRoleFlags(authenticatedUserEmail, team.competition.tenantId, session);
  const teamAccess = resolveTeamAccess({
    team,
    user,
    userEmail: authenticatedUserEmail,
    canEditAllTeams: access.canEditAllTeams,
  });
  const isOwner = team.ownerId === user.id;

  if (!teamAccess.canEditTeam && !isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const claimToken = createRegistrationClaimToken({
    mode: team.competition.claimTokenExpiryMode || "COMPETITION_END",
    ttlDays: team.competition.claimTokenTtlDays || null,
    registrationDeadline: team.competition.registrationDeadline || null,
    competitionEnd: team.competition.dateEnd || team.competition.date || null,
    maxExpiresAt: null,
  });
  const suggestedEmail = normalizeEmail(team.contactEmail) || normalizeEmail(team.owner?.email) || authenticatedUserEmail;
  const suggestedName = team.contactName || team.owner?.name || user.name || null;

  await prisma.$transaction(async (tx) => {
    await tx.registrationClaimToken.updateMany({
      where: {
        teamId: team.id,
        revokedAt: null,
        claimedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    await tx.registrationClaimToken.create({
      data: {
        teamId: team.id,
        tokenHash: claimToken.tokenHash,
        suggestedEmail,
        suggestedName,
        expiresAt: claimToken.expiresAt,
      },
    });

    await tx.auditEvent.create({
      data: {
        action: "MTC_OWNER_EDIT_LINK_CREATED",
        scopeType: "TEAM",
        scopeId: team.id,
        entityType: "TEAM",
        entityId: team.id,
        reason: "mtc_owner_edit_shortcut",
        afterData: {
          expiresAt: claimToken.expiresAt.toISOString(),
        },
        meta: {
          sessionEmail: normalizeEmail(authenticatedUserEmail),
          requestPath: new URL(request.url).pathname,
        },
        tenantId: team.competition.tenantId,
        competitionId: team.competition.id,
        actorId: user.id,
      },
    });
  });

  return NextResponse.json({
    mtcAnonymousUrl: buildMtcAnonymousUrl(claimToken.rawToken),
    expiresAt: claimToken.expiresAt.toISOString(),
  });
}
