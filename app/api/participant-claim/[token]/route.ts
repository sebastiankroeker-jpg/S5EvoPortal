import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { normalizeEmail, resolveCurrentUser } from "@/lib/current-user";
import {
  assessParticipantClaimRequestRisk,
  logSuspiciousParticipantClaimPattern,
  maskParticipantClaimEmail,
  recordParticipantClaimAuditEvent,
} from "@/lib/participant-claim-audit";
import { prisma } from "@/lib/prisma";
import { hashRegistrationClaimToken } from "@/lib/registration-claim";

function isExpired(expiresAt: Date) {
  return expiresAt.getTime() < Date.now();
}

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  return response;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const session = await getServerSession(authOptions);
  const sessionEmail = session?.user?.email || null;
  const normalizedSessionEmail = normalizeEmail(sessionEmail);
  const { user: currentUser } = await resolveCurrentUser(session, { createIfMissing: true });
  const { token } = await params;
  const tokenHash = hashRegistrationClaimToken(token);

  const claim = await prisma.participantClaimToken.findUnique({
    where: { tokenHash },
    include: {
      participant: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          userId: true,
          team: {
            select: {
              id: true,
              name: true,
              competition: {
                select: {
                  id: true,
                  name: true,
                  year: true,
                  tenant: {
                    select: {
                      claimLinksEnabled: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
      claimedByUser: { select: { id: true, email: true, name: true } },
    },
  });

  const risk = await assessParticipantClaimRequestRisk({ request, tokenId: claim?.id });
  if (risk.suspicious) {
    logSuspiciousParticipantClaimPattern({
      reasons: risk.reasons,
      tokenId: claim?.id,
      participantId: claim?.participant.id,
      teamId: claim?.participant.team.id,
      sessionEmail,
    });
  }

  if (!claim || claim.revokedAt) {
    await recordParticipantClaimAuditEvent({
      request,
      eventType: "CLAIM_VIEW",
      outcome: "FAIL",
      reason: !claim ? "not_found" : "revoked",
      suspicious: risk.suspicious,
      sessionEmail,
    });
    return jsonNoStore({ error: "Link nicht gefunden oder widerrufen" }, { status: 404 });
  }

  if (isExpired(claim.expiresAt)) {
    await recordParticipantClaimAuditEvent({
      request,
      eventType: "CLAIM_VIEW",
      outcome: "FAIL",
      reason: "expired",
      suspicious: risk.suspicious,
      tokenId: claim.id,
      participantId: claim.participant.id,
      teamId: claim.participant.team.id,
      sessionEmail,
    });
    return jsonNoStore({ error: "Link ist abgelaufen" }, { status: 410 });
  }

  const normalizedSuggestedEmail = normalizeEmail(claim.suggestedEmail);
  const normalizedClaimedByEmail = normalizeEmail(claim.claimedByUser?.email);
  const emailMatches = !!normalizedSessionEmail && normalizedSessionEmail === normalizedSuggestedEmail;
  const alreadyClaimedBySessionUser =
    (!!currentUser && claim.claimedByUser?.id === currentUser.id) ||
    (!!normalizedSessionEmail && normalizedClaimedByEmail === normalizedSessionEmail) ||
    (!!currentUser && claim.participant.userId === currentUser.id);

  await recordParticipantClaimAuditEvent({
    request,
    eventType: "CLAIM_VIEW",
    outcome: "SUCCESS",
    reason: risk.reasons.join(",") || undefined,
    suspicious: risk.suspicious,
    tokenId: claim.id,
    participantId: claim.participant.id,
    teamId: claim.participant.team.id,
    sessionEmail,
    userId: alreadyClaimedBySessionUser ? currentUser?.id || null : null,
  });

  return jsonNoStore({
    claim: {
      participantId: claim.participant.id,
      participantName: `${claim.participant.firstName} ${claim.participant.lastName}`.trim(),
      teamId: claim.participant.team.id,
      teamName: claim.participant.team.name,
      competitionName: claim.participant.team.competition.name,
      competitionYear: claim.participant.team.competition.year,
      maskedSuggestedEmail: maskParticipantClaimEmail(claim.suggestedEmail),
      claimedAt: claim.claimedAt,
      expiresAt: claim.expiresAt,
    },
    session: {
      authenticated: !!sessionEmail,
      email: sessionEmail,
      name: session?.user?.name || null,
    },
    state: {
      emailMatches,
      alreadyClaimedBySessionUser,
      requiresLogin: !sessionEmail,
      alreadyClaimedByOtherUser:
        (!!claim.claimedByUser && normalizedClaimedByEmail !== normalizedSessionEmail) ||
        (!!claim.participant.userId && claim.participant.userId !== currentUser?.id),
      suspicious: risk.suspicious,
    },
    settings: {
      claimLinksEnabled: claim.participant.team.competition.tenant.claimLinksEnabled,
    },
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const session = await getServerSession(authOptions);
  const sessionEmail = session?.user?.email || null;
  const normalizedSessionEmail = normalizeEmail(sessionEmail);
  const sessionUserName = session?.user?.name || null;
  const sessionUserImage = session?.user?.image || null;
  const sessionAuthentikSub =
    typeof (session?.user as { id?: unknown } | undefined)?.id === "string"
      ? ((session?.user as { id?: string }).id ?? null)
      : null;
  const { token } = await params;
  const tokenHash = hashRegistrationClaimToken(token);

  const claim = await prisma.participantClaimToken.findUnique({
    where: { tokenHash },
    include: {
      participant: {
        select: {
          id: true,
          email: true,
          userId: true,
          team: {
            select: {
              id: true,
              competition: {
                select: {
                  tenantId: true,
                  tenant: {
                    select: {
                      claimLinksEnabled: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
      claimedByUser: { select: { id: true, email: true } },
    },
  });

  const risk = await assessParticipantClaimRequestRisk({ request, tokenId: claim?.id });
  if (risk.suspicious) {
    logSuspiciousParticipantClaimPattern({
      reasons: risk.reasons,
      tokenId: claim?.id,
      participantId: claim?.participant.id,
      teamId: claim?.participant.team.id,
      sessionEmail,
    });
  }

  if (risk.blocked) {
    await recordParticipantClaimAuditEvent({
      request,
      eventType: "CLAIM_SUBMIT",
      outcome: "BLOCKED",
      reason: risk.reasons.join(","),
      suspicious: true,
      tokenId: claim?.id,
      participantId: claim?.participant.id,
      teamId: claim?.participant.team.id,
      sessionEmail,
    });
    return jsonNoStore({ error: "Zu viele fehlgeschlagene Versuche. Bitte später erneut probieren." }, { status: 429 });
  }

  if (!sessionEmail) {
    await recordParticipantClaimAuditEvent({
      request,
      eventType: "CLAIM_SUBMIT",
      outcome: "FAIL",
      reason: "unauthenticated",
      suspicious: risk.suspicious,
      tokenId: claim?.id,
      participantId: claim?.participant.id,
      teamId: claim?.participant.team.id,
    });
    return jsonNoStore({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  if (!claim || claim.revokedAt) {
    await recordParticipantClaimAuditEvent({
      request,
      eventType: "CLAIM_SUBMIT",
      outcome: "FAIL",
      reason: !claim ? "not_found" : "revoked",
      suspicious: risk.suspicious,
      sessionEmail,
    });
    return jsonNoStore({ error: "Link nicht gefunden oder widerrufen" }, { status: 404 });
  }

  if (isExpired(claim.expiresAt)) {
    await recordParticipantClaimAuditEvent({
      request,
      eventType: "CLAIM_SUBMIT",
      outcome: "FAIL",
      reason: "expired",
      suspicious: risk.suspicious,
      tokenId: claim.id,
      participantId: claim.participant.id,
      teamId: claim.participant.team.id,
      sessionEmail,
    });
    return jsonNoStore({ error: "Link ist abgelaufen" }, { status: 410 });
  }

  if (!claim.participant.team.competition.tenant.claimLinksEnabled) {
    await recordParticipantClaimAuditEvent({
      request,
      eventType: "CLAIM_SUBMIT",
      outcome: "BLOCKED",
      reason: "claim_links_disabled",
      suspicious: false,
      tokenId: claim.id,
      participantId: claim.participant.id,
      teamId: claim.participant.team.id,
      sessionEmail,
    });
    return jsonNoStore({ error: "Die Einlösung von Claim-Links ist aktuell deaktiviert" }, { status: 423 });
  }

  const normalizedSuggestedEmail = normalizeEmail(claim.suggestedEmail);
  const normalizedClaimedByEmail = normalizeEmail(claim.claimedByUser?.email);

  if (normalizedSuggestedEmail !== normalizedSessionEmail) {
    await recordParticipantClaimAuditEvent({
      request,
      eventType: "CLAIM_SUBMIT",
      outcome: "FAIL",
      reason: "email_mismatch",
      suspicious: true,
      tokenId: claim.id,
      participantId: claim.participant.id,
      teamId: claim.participant.team.id,
      sessionEmail,
    });
    return jsonNoStore({ error: "Dieser Link gehört zu einer anderen E-Mail-Adresse" }, { status: 403 });
  }

  const resolved = await resolveCurrentUser(session, { createIfMissing: true });
  const user =
    resolved.user ||
    (await prisma.user.create({
      data: {
        email: normalizedSessionEmail!,
        name: sessionUserName || claim.suggestedName || null,
        image: sessionUserImage || null,
        authentikSub: sessionAuthentikSub,
      },
    }));

  if (claim.claimedByUser && normalizedClaimedByEmail !== normalizedSessionEmail) {
    await recordParticipantClaimAuditEvent({
      request,
      eventType: "CLAIM_SUBMIT",
      outcome: "FAIL",
      reason: "claimed_by_other_user",
      suspicious: true,
      tokenId: claim.id,
      participantId: claim.participant.id,
      teamId: claim.participant.team.id,
      sessionEmail,
      userId: user.id,
    });
    return jsonNoStore({ error: "Link wurde bereits von einem anderen Account eingelöst" }, { status: 409 });
  }

  if (claim.participant.userId && claim.participant.userId !== user.id) {
    await recordParticipantClaimAuditEvent({
      request,
      eventType: "CLAIM_SUBMIT",
      outcome: "FAIL",
      reason: "participant_already_linked_to_other_user",
      suspicious: true,
      tokenId: claim.id,
      participantId: claim.participant.id,
      teamId: claim.participant.team.id,
      sessionEmail,
      userId: user.id,
    });
    return jsonNoStore({ error: "Dieser Teilnehmer ist bereits mit einem anderen Account verknüpft" }, { status: 409 });
  }

  await prisma.$transaction([
    prisma.participant.update({
      where: { id: claim.participant.id },
      data: {
        userId: user.id,
        email: normalizedSessionEmail,
      },
    }),
    prisma.participantClaimToken.update({
      where: { id: claim.id },
      data: {
        claimedAt: claim.claimedAt || new Date(),
        claimedByUserId: user.id,
      },
    }),
    prisma.tenantRole.upsert({
      where: {
        userId_tenantId_role: {
          userId: user.id,
          tenantId: claim.participant.team.competition.tenantId,
          role: "TEILNEHMER",
        },
      },
      update: {},
      create: {
        userId: user.id,
        tenantId: claim.participant.team.competition.tenantId,
        role: "TEILNEHMER",
      },
    }),
  ]);

  await recordParticipantClaimAuditEvent({
    request,
    eventType: "CLAIM_SUBMIT",
    outcome: "SUCCESS",
    reason: risk.reasons.join(",") || undefined,
    suspicious: risk.suspicious,
    tokenId: claim.id,
    participantId: claim.participant.id,
    teamId: claim.participant.team.id,
    sessionEmail,
    userId: user.id,
  });

  return jsonNoStore({ success: true, participantId: claim.participant.id, teamId: claim.participant.team.id });
}
