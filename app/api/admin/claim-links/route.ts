import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { buildParticipantClaimUrl, buildRegistrationClaimUrl, createRegistrationClaimToken } from "@/lib/registration-claim";
import { recordParticipantClaimAuditEvent } from "@/lib/participant-claim-audit";
import { recordClaimAuditEvent } from "@/lib/registration-claim-audit";
import { requireTenantRoles } from "@/lib/server-permissions";

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
      owner: { select: { email: true, name: true } },
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
    },
    orderBy: [
      { team: { updatedAt: "desc" } },
      { lastName: "asc" },
      { firstName: "asc" },
    ],
  });

  const teamItems = teams.map((team) => {
    const latestToken = team.registrationClaimTokens[0] ?? null;
    return {
      itemType: "team" as const,
      itemId: team.id,
      teamId: team.id,
      teamName: team.name,
      category: team.classificationCode || "–",
      contactEmail: team.contactEmail || team.owner?.email || "",
      contactName: team.contactName || team.owner?.name || "",
      ownerEmail: team.owner?.email || "",
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
    return {
      itemType: "participant" as const,
      itemId: participant.id,
      teamId: participant.team.id,
      teamName: participant.team.name,
      category: participant.team.classificationCode || "–",
      contactEmail: participant.email || "",
      contactName: `${participant.firstName} ${participant.lastName}`.trim(),
      ownerEmail: "",
      participantId: participant.id,
      participantName: `${participant.firstName} ${participant.lastName}`.trim(),
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
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminAccess();
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => ({}));
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
