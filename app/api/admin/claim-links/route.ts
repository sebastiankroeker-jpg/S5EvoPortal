import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { normalizeEmail } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { createParticipantClaimInvitation } from "@/lib/participant-claim-invitation";
import { buildMtcAnonymousUrl, buildParticipantClaimUrl, buildRegistrationClaimUrl, createRegistrationClaimToken } from "@/lib/registration-claim";
import { recordParticipantClaimAuditEvent } from "@/lib/participant-claim-audit";
import { recordClaimAuditEvent } from "@/lib/registration-claim-audit";
import { requireTenantRoles } from "@/lib/server-permissions";
import { syncDerivedTeamchefRole } from "@/lib/teamchef-role";

function isExpired(value?: Date | string | null) {
  if (!value) return false;
  return new Date(value).getTime() < Date.now();
}

function getTokenStatus(token?: {
  claimedAt?: Date | string | null;
  revokedAt?: Date | string | null;
  expiresAt?: Date | string | null;
} | null) {
  if (!token) return "none";
  if (token.revokedAt) return "revoked";
  if (token.claimedAt) return "claimed";
  if (isExpired(token.expiresAt)) return "expired";
  return "active";
}

function isValidEmail(value?: string | null) {
  return Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()));
}

function getRequestMeta(request: NextRequest) {
  return {
    ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
    userAgent: request.headers.get("user-agent") || null,
  };
}

async function requireAdminAccess() {
  const session = await getServerSession(authOptions);
  return requireTenantRoles(session, ["ADMIN", "MODERATOR"]);
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminAccess();
  if ("error" in auth) return auth.error;

  const competitionId = request.nextUrl.searchParams.get("competitionId");
  const tenant = await prisma.tenant.findUnique({
    where: { id: auth.tenantId },
    select: { claimLinksEnabled: true },
  });

  const teams = await prisma.team.findMany({
    where: {
      deletedAt: null,
      competition: {
        tenantId: auth.tenantId,
        ...(competitionId ? { id: competitionId } : {}),
      },
    },
    include: {
      owner: { select: { id: true, email: true, name: true, authentikSub: true } },
      registrationClaimTokens: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          claimedByUser: { select: { email: true, name: true } },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const participants = await prisma.participant.findMany({
    where: {
      deletedAt: null,
      team: {
        deletedAt: null,
        competition: {
          tenantId: auth.tenantId,
          ...(competitionId ? { id: competitionId } : {}),
        },
      },
    },
    include: {
      team: {
        select: {
          id: true,
          name: true,
          classificationCode: true,
        },
      },
      claimTokens: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          claimedByUser: { select: { email: true, name: true } },
        },
      },
      user: { select: { id: true, email: true, name: true, authentikSub: true } },
    },
    orderBy: [
      { team: { updatedAt: "desc" } },
      { lastName: "asc" },
      { firstName: "asc" },
    ],
  });

  const emailsForPortalLookup = Array.from(
    new Set(
      [
        ...teams.map((team) => normalizeEmail(team.contactEmail || team.owner?.email)),
        ...participants.map((participant) => normalizeEmail(participant.email)),
      ].filter((email): email is string => Boolean(email)),
    ),
  );
  const portalAccountsByEmail = new Map(
    (
      emailsForPortalLookup.length > 0
        ? await prisma.user.findMany({
            where: {
              deletedAt: null,
              authentikSub: { not: null },
              email: { in: emailsForPortalLookup, mode: "insensitive" },
            },
            select: { id: true, email: true, name: true, authentikSub: true },
          })
        : []
    ).map((user) => [normalizeEmail(user.email), user]),
  );

  const teamItems = teams.map((team) => {
    const latestToken = team.registrationClaimTokens[0] ?? null;
    const contactEmail = team.contactEmail || team.owner?.email || "";
    const portalAccount = portalAccountsByEmail.get(normalizeEmail(contactEmail)) ?? null;
    return {
      itemType: "team" as const,
      itemId: team.id,
      teamId: team.id,
      teamName: team.name,
      category: team.classificationCode || "–",
      registrationMode: team.registrationMode,
      contactEmail,
      contactName: team.contactName || team.owner?.name || "",
      ownerEmail: team.owner?.email || "",
      ownerId: team.ownerId,
      ownerHasPortalAccount: Boolean(team.owner?.authentikSub || portalAccount?.authentikSub),
      portalAccount,
      participantId: null,
      participantName: null,
      token: latestToken
        ? {
            id: latestToken.id,
            status: getTokenStatus(latestToken),
            suggestedEmail: latestToken.suggestedEmail,
            suggestedName: latestToken.suggestedName,
            createdAt: latestToken.createdAt,
            expiresAt: latestToken.expiresAt,
            claimedAt: latestToken.claimedAt,
            revokedAt: latestToken.revokedAt,
            claimedBy: latestToken.claimedByUser,
          }
        : null,
    };
  });

  const participantItems = participants.map((participant) => {
    const latestToken = participant.claimTokens[0] ?? null;
    const portalAccount = portalAccountsByEmail.get(normalizeEmail(participant.email)) ?? null;
    return {
      itemType: "participant" as const,
      itemId: participant.id,
      teamId: participant.team.id,
      teamName: participant.team.name,
      category: participant.team.classificationCode || "–",
      contactEmail: participant.email || "",
      contactName: `${participant.firstName} ${participant.lastName}`.trim(),
      ownerEmail: participant.user?.email || "",
      participantId: participant.id,
      participantName: `${participant.firstName} ${participant.lastName}`.trim(),
      linkedUser: participant.user,
      portalAccount,
      token: latestToken
        ? {
            id: latestToken.id,
            status: getTokenStatus(latestToken),
            suggestedEmail: latestToken.suggestedEmail,
            suggestedName: latestToken.suggestedName,
            createdAt: latestToken.createdAt,
            expiresAt: latestToken.expiresAt,
            claimedAt: latestToken.claimedAt,
            revokedAt: latestToken.revokedAt,
            claimedBy: latestToken.claimedByUser,
          }
        : null,
    };
  });

  return NextResponse.json({
    claimLinksEnabled: tenant?.claimLinksEnabled ?? true,
    items: [...teamItems, ...participantItems],
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminAccess();
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => ({}));
  const teamId = typeof body.teamId === "string" ? body.teamId : null;
  const participantId = typeof body.participantId === "string" ? body.participantId : null;

  if (!teamId && !participantId) {
    return NextResponse.json({ error: "teamId oder participantId fehlt" }, { status: 400 });
  }

  if (participantId) {
    const participant = await prisma.participant.findFirst({
      where: {
        id: participantId,
        deletedAt: null,
        team: {
          deletedAt: null,
          competition: {
            tenantId: auth.tenantId,
          },
        },
      },
      include: {
        team: {
          include: {
            competition: {
              select: {
                date: true,
                dateEnd: true,
                registrationDeadline: true,
                claimTokenExpiryMode: true,
                claimTokenTtlDays: true,
              },
            },
          },
        },
      },
    });

    if (!participant) {
      return NextResponse.json({ error: "Teilnehmer nicht gefunden" }, { status: 404 });
    }

    if (!participant.email) {
      return NextResponse.json({ error: "Für diesen Teilnehmer ist keine Kontakt-E-Mail hinterlegt" }, { status: 400 });
    }

    await prisma.participantClaimToken.updateMany({
      where: {
        participantId,
        revokedAt: null,
        claimedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    const claimToken = createRegistrationClaimToken({
      mode: participant.team.competition.claimTokenExpiryMode,
      ttlDays: participant.team.competition.claimTokenTtlDays,
      registrationDeadline: participant.team.competition.registrationDeadline || null,
      competitionEnd: participant.team.competition.dateEnd || participant.team.competition.date || null,
      maxExpiresAt: null,
    });

    const tokenRecord = await prisma.participantClaimToken.create({
      data: {
        tokenHash: claimToken.tokenHash,
        suggestedEmail: participant.email,
        suggestedName: `${participant.firstName} ${participant.lastName}`.trim(),
        expiresAt: claimToken.expiresAt,
        participantId: participant.id,
      },
    });

    await recordParticipantClaimAuditEvent({
      request,
      eventType: "CLAIM_CREATE",
      outcome: "SUCCESS",
      tokenId: tokenRecord.id,
      participantId: participant.id,
      teamId: participant.teamId,
      userId: auth.user.id,
      sessionEmail: auth.user.email,
    });

    return NextResponse.json({
      success: true,
      tokenType: "participant",
      token: {
        id: tokenRecord.id,
        status: getTokenStatus(tokenRecord),
        suggestedEmail: tokenRecord.suggestedEmail,
        suggestedName: tokenRecord.suggestedName,
        createdAt: tokenRecord.createdAt,
        expiresAt: tokenRecord.expiresAt,
        claimedAt: tokenRecord.claimedAt,
        revokedAt: tokenRecord.revokedAt,
      },
      claimUrl: buildParticipantClaimUrl(claimToken.rawToken),
    });
  }

  const team = await prisma.team.findFirst({
    where: {
      id: teamId,
      deletedAt: null,
      competition: {
        tenantId: auth.tenantId,
      },
    },
    include: {
      owner: { select: { email: true, name: true } },
      competition: {
        select: {
          date: true,
          dateEnd: true,
          registrationDeadline: true,
          claimTokenExpiryMode: true,
          claimTokenTtlDays: true,
        },
      },
    },
  });

  if (!team) {
    return NextResponse.json({ error: "Team nicht gefunden" }, { status: 404 });
  }

  const suggestedEmail = team.contactEmail || team.owner?.email || "";
  if (!suggestedEmail) {
    return NextResponse.json({ error: "Für dieses Team ist keine Kontakt-E-Mail hinterlegt" }, { status: 400 });
  }

  await prisma.registrationClaimToken.updateMany({
    where: {
      teamId,
      revokedAt: null,
      claimedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });

  const claimToken = createRegistrationClaimToken({
    mode: team.competition.claimTokenExpiryMode,
    ttlDays: team.competition.claimTokenTtlDays,
    registrationDeadline: team.competition.registrationDeadline || null,
    competitionEnd: team.competition.dateEnd || team.competition.date || null,
    maxExpiresAt: null,
  });

  const tokenRecord = await prisma.registrationClaimToken.create({
    data: {
      tokenHash: claimToken.tokenHash,
      suggestedEmail,
      suggestedName: team.contactName || team.owner?.name || null,
      expiresAt: claimToken.expiresAt,
      teamId: team.id,
    },
  });

  await recordClaimAuditEvent({
    request,
    eventType: "CLAIM_TOKEN_GENERATED",
    outcome: "SUCCESS",
    tokenId: tokenRecord.id,
    teamId: team.id,
    userId: auth.user.id,
    sessionEmail: auth.user.email,
  });

  return NextResponse.json({
    success: true,
    tokenType: "team",
    token: {
      id: tokenRecord.id,
      status: getTokenStatus(tokenRecord),
      suggestedEmail: tokenRecord.suggestedEmail,
      suggestedName: tokenRecord.suggestedName,
      createdAt: tokenRecord.createdAt,
      expiresAt: tokenRecord.expiresAt,
      claimedAt: tokenRecord.claimedAt,
      revokedAt: tokenRecord.revokedAt,
    },
    claimUrl: buildRegistrationClaimUrl(claimToken.rawToken),
    mtcAnonymousUrl: team.registrationMode === "MARKETPLACE" ? buildMtcAnonymousUrl(claimToken.rawToken) : null,
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminAccess();
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => ({}));
  const requestMeta = getRequestMeta(request);
  if (body.action === "toggleGlobal") {
    const enabled = Boolean(body.enabled);
    const tenant = await prisma.tenant.findUnique({
      where: { id: auth.tenantId },
    });

    if (!tenant) {
      return NextResponse.json({ error: "Tenant nicht gefunden" }, { status: 404 });
    }

    const updatedTenant = await prisma.tenant.update({
      where: { id: tenant.id },
      data: { claimLinksEnabled: enabled },
    });

    return NextResponse.json({
      success: true,
      claimLinksEnabled: updatedTenant.claimLinksEnabled,
    });
  }

  if (body.action === "resetParticipantLink") {
    const participantId = typeof body.participantId === "string" ? body.participantId : null;
    const requestedEmail = typeof body.email === "string" ? normalizeEmail(body.email) : null;
    if (!participantId) {
      return NextResponse.json({ error: "participantId fehlt" }, { status: 400 });
    }
    if (requestedEmail && !isValidEmail(requestedEmail)) {
      return NextResponse.json({ error: "Bitte zuerst eine gültige E-Mail-Adresse hinterlegen" }, { status: 400 });
    }

    const participant = await prisma.participant.findFirst({
      where: {
        id: participantId,
        deletedAt: null,
        team: {
          deletedAt: null,
          competition: {
            tenantId: auth.tenantId,
          },
        },
      },
      include: {
        user: { select: { id: true, email: true, name: true } },
        team: {
          include: {
            competition: {
              select: {
                name: true,
                year: true,
                date: true,
                dateEnd: true,
                registrationDeadline: true,
                registrationNotificationEmail: true,
                claimTokenExpiryMode: true,
                claimTokenTtlDays: true,
                tenant: {
                  select: {
                    name: true,
                    contactEmail: true,
                  },
                },
              },
            },
          },
        },
        claimTokens: {
          where: { revokedAt: null },
          select: { id: true },
        },
      },
    });

    if (!participant) {
      return NextResponse.json({ error: "Teilnehmer nicht gefunden" }, { status: 404 });
    }

    const targetEmail = requestedEmail || normalizeEmail(participant.email);

    if (!targetEmail) {
      return NextResponse.json({ error: "Für diesen Teilnehmer ist keine Kontakt-E-Mail hinterlegt" }, { status: 400 });
    }

    if (!participant.userId) {
      return NextResponse.json({ error: "Teilnehmer ist aktuell mit keinem Portal-Konto verknüpft" }, { status: 400 });
    }

    const revokedAt = new Date();
    const previousUserId = participant.userId;
    const previousUserEmail = participant.user?.email || null;
    const teamChiefMatchesPreviousUser = participant.team.teamChiefId === previousUserId;
    const teamContactMatchesPreviousUser =
      normalizeEmail(participant.team.contactEmail) === normalizeEmail(previousUserEmail) ||
      normalizeEmail(participant.team.contactEmail) === normalizeEmail(participant.email);
    const activeTeamManagerRole = await prisma.teamMemberRole.findFirst({
      where: {
        teamId: participant.teamId,
        userId: previousUserId,
        role: "TEAM_MANAGER",
        revokedAt: null,
      },
      select: {
        id: true,
        userId: true,
        role: true,
        revokedAt: true,
        grantedByUserId: true,
        createdAt: true,
      },
    });

    await prisma.$transaction(async (tx) => {
      await tx.participantClaimToken.updateMany({
        where: {
          participantId,
          revokedAt: null,
        },
        data: {
          revokedAt,
        },
      });
      await tx.participant.update({
        where: { id: participantId },
        data: {
          userId: null,
          ...(targetEmail !== normalizeEmail(participant.email) ? { email: targetEmail } : {}),
        },
      });
      if (teamChiefMatchesPreviousUser || teamContactMatchesPreviousUser) {
        await tx.team.update({
          where: { id: participant.teamId },
          data: {
            ...(teamChiefMatchesPreviousUser ? { teamChiefId: null } : {}),
            ...(teamContactMatchesPreviousUser ? { contactEmail: targetEmail } : {}),
          },
        });
      }
      await tx.teamMemberRole.updateMany({
        where: {
          teamId: participant.teamId,
          userId: previousUserId,
          role: "TEAM_MANAGER",
          revokedAt: null,
        },
        data: {
          revokedAt,
          revokedByUserId: auth.user.id,
          reason: "participant_replaced",
        },
      });
      await syncDerivedTeamchefRole(tx, {
        userId: previousUserId,
        tenantId: auth.tenantId,
      });
    });

    await Promise.all([
      recordParticipantClaimAuditEvent({
        request,
        eventType: "PARTICIPANT_ACCOUNT_UNLINK",
        outcome: "SUCCESS",
        reason: previousUserEmail ? `previous_user:${previousUserId}` : "previous_user_removed",
        participantId: participant.id,
        teamId: participant.teamId,
        userId: auth.user.id,
        sessionEmail: auth.user.email,
      }),
      ...participant.claimTokens.map((token) =>
        recordParticipantClaimAuditEvent({
          request,
          eventType: "CLAIM_REVOKE",
          outcome: "SUCCESS",
          reason: "participant_account_unlinked",
          tokenId: token.id,
          participantId: participant.id,
          teamId: participant.teamId,
          userId: auth.user.id,
          sessionEmail: auth.user.email,
        }),
      ),
      ...(activeTeamManagerRole
        ? [
            prisma.auditEvent.create({
              data: {
                action: "TEAM_MANAGER_REVOKED",
                scopeType: "TEAM",
                scopeId: participant.teamId,
                entityType: "TEAM_MEMBER_ROLE",
                entityId: activeTeamManagerRole.id,
                reason: "participant_replaced",
                beforeData: {
                  id: activeTeamManagerRole.id,
                  userId: activeTeamManagerRole.userId,
                  role: activeTeamManagerRole.role,
                  revokedAt: activeTeamManagerRole.revokedAt?.toISOString() ?? null,
                  grantedByUserId: activeTeamManagerRole.grantedByUserId ?? null,
                  createdAt: activeTeamManagerRole.createdAt?.toISOString() ?? null,
                },
                afterData: {
                  id: activeTeamManagerRole.id,
                  userId: activeTeamManagerRole.userId,
                  role: activeTeamManagerRole.role,
                  revokedAt: revokedAt.toISOString(),
                  revokedByUserId: auth.user.id,
                },
                meta: {
                  ...requestMeta,
                  sessionEmail: auth.user.email,
                  targetUserEmail: previousUserEmail,
                  participantId: participant.id,
                  participantName: `${participant.firstName} ${participant.lastName}`.trim(),
                },
                tenantId: auth.tenantId,
                competitionId: participant.team.competitionId,
                actorId: auth.user.id,
              },
            }),
          ]
        : []),
    ]);

    const participantClaimMail = await createParticipantClaimInvitation({
      request,
      participant: {
        id: participant.id,
        firstName: participant.firstName,
        lastName: participant.lastName,
        email: targetEmail,
        userId: null,
      },
      team: {
        id: participant.team.id,
        name: participant.team.name,
      },
      competition: participant.team.competition,
      actorUserId: auth.user.id,
      sessionEmail: auth.user.email,
      previousEmail: participant.email,
    });

    return NextResponse.json({
      success: true,
      tokenType: "participant",
      previousUser: participant.user,
      participantEmail: targetEmail,
      revokedTeamManagerAccess: Boolean(activeTeamManagerRole),
      clearedLegacyTeamChiefAccess: teamChiefMatchesPreviousUser,
      updatedLegacyContactEmail: teamContactMatchesPreviousUser,
      participantClaimMail,
    });
  }

  const tokenId = typeof body.tokenId === "string" ? body.tokenId : null;
  const tokenType = body.tokenType === "participant" ? "participant" : "team";

  if (!tokenId) {
    return NextResponse.json({ error: "tokenId fehlt" }, { status: 400 });
  }

  if (tokenType === "participant") {
    const token = await prisma.participantClaimToken.findUnique({
      where: { id: tokenId },
      include: {
        participant: {
          include: {
            team: {
              include: {
                competition: {
                  select: { tenantId: true },
                },
              },
            },
          },
        },
      },
    });

    if (!token) {
      return NextResponse.json({ error: "Claim-Link nicht gefunden" }, { status: 404 });
    }

    if (token.participant.team.competition.tenantId !== auth.tenantId) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const updated = await prisma.participantClaimToken.update({
      where: { id: tokenId },
      data: { revokedAt: token.revokedAt || new Date() },
    });

    await recordParticipantClaimAuditEvent({
      request,
      eventType: "CLAIM_REVOKED",
      outcome: "SUCCESS",
      tokenId: updated.id,
      participantId: token.participant.id,
      teamId: token.participant.teamId,
      userId: auth.user.id,
      sessionEmail: auth.user.email,
    });

    return NextResponse.json({
      success: true,
      tokenType,
      token: {
        id: updated.id,
        status: getTokenStatus(updated),
        createdAt: updated.createdAt,
        expiresAt: updated.expiresAt,
        claimedAt: updated.claimedAt,
        revokedAt: updated.revokedAt,
      },
    });
  }

  const token = await prisma.registrationClaimToken.findUnique({
    where: { id: tokenId },
    include: {
      team: {
        include: {
          competition: {
            select: { tenantId: true },
          },
        },
      },
    },
  });

  if (!token) {
    return NextResponse.json({ error: "Claim-Link nicht gefunden" }, { status: 404 });
  }

  if (token.team.competition.tenantId !== auth.tenantId) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const updated = await prisma.registrationClaimToken.update({
    where: { id: tokenId },
    data: { revokedAt: token.revokedAt || new Date() },
  });

  await recordClaimAuditEvent({
    request,
    eventType: "CLAIM_TOKEN_REVOKED",
    outcome: "SUCCESS",
    tokenId: updated.id,
    teamId: token.team.id,
    userId: auth.user.id,
    sessionEmail: auth.user.email,
  });

  return NextResponse.json({
    success: true,
    tokenType,
    token: {
      id: updated.id,
      status: getTokenStatus(updated),
      createdAt: updated.createdAt,
      expiresAt: updated.expiresAt,
      claimedAt: updated.claimedAt,
      revokedAt: updated.revokedAt,
    },
  });
}
