import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { normalizeEmail, resolveCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { hashRegistrationClaimToken } from "@/lib/registration-claim";
import {
  assessClaimRequestRisk,
  logSuspiciousClaimPattern,
  maskEmail,
  recordClaimAuditEvent,
} from "@/lib/registration-claim-audit";

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

  const claim = await prisma.registrationClaimToken.findUnique({
    where: { tokenHash },
    include: {
      team: {
        select: {
          id: true,
          name: true,
          contactEmail: true,
          competition: {
            select: {
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
      claimedByUser: { select: { id: true, email: true, name: true } },
    },
  });

  const risk = await assessClaimRequestRisk({ request, tokenId: claim?.id });
  if (risk.suspicious) {
    logSuspiciousClaimPattern({ reasons: risk.reasons, tokenId: claim?.id, teamId: claim?.team.id, sessionEmail });
  }

  if (!claim || claim.revokedAt) {
    await recordClaimAuditEvent({
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
    await recordClaimAuditEvent({
      request,
      eventType: "CLAIM_VIEW",
      outcome: "FAIL",
      reason: "expired",
      suspicious: risk.suspicious,
      tokenId: claim.id,
      teamId: claim.team.id,
      sessionEmail,
    });
    return jsonNoStore({ error: "Link ist abgelaufen" }, { status: 410 });
  }

  const normalizedSuggestedEmail = normalizeEmail(claim.suggestedEmail);
  const normalizedClaimedByEmail = normalizeEmail(claim.claimedByUser?.email);
  const emailMatches = !!normalizedSessionEmail && normalizedSessionEmail === normalizedSuggestedEmail;
  const alreadyClaimedBySessionUser =
    (!!currentUser && claim.claimedByUser?.id === currentUser.id) ||
    (!!normalizedSessionEmail && normalizedClaimedByEmail === normalizedSessionEmail);

  await recordClaimAuditEvent({
    request,
    eventType: "CLAIM_VIEW",
    outcome: "SUCCESS",
    reason: risk.reasons.join(",") || undefined,
    suspicious: risk.suspicious,
    tokenId: claim.id,
    teamId: claim.team.id,
    sessionEmail,
    userId:
      normalizedClaimedByEmail === normalizedSessionEmail && claim.claimedByUser
        ? claim.claimedByUser.id
        : null,
  });

  return jsonNoStore({
    claim: {
      teamId: claim.team.id,
      teamName: claim.team.name,
      competitionName: claim.team.competition.name,
      competitionYear: claim.team.competition.year,
      maskedSuggestedEmail: maskEmail(claim.suggestedEmail),
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
        !!claim.claimedByUser && normalizedClaimedByEmail !== normalizedSessionEmail,
      suspicious: risk.suspicious,
    },
    settings: {
      claimLinksEnabled: claim.team.competition.tenant.claimLinksEnabled,
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

  const claim = await prisma.registrationClaimToken.findUnique({
    where: { tokenHash },
    include: {
      team: {
        select: {
          id: true,
          contactEmail: true,
          competition: {
            select: {
              tenant: {
                select: {
                  claimLinksEnabled: true,
                },
              },
            },
          },
        },
      },
      claimedByUser: { select: { id: true, email: true } },
    },
  });

  const risk = await assessClaimRequestRisk({ request, tokenId: claim?.id });
  if (risk.suspicious) {
    logSuspiciousClaimPattern({ reasons: risk.reasons, tokenId: claim?.id, teamId: claim?.team.id, sessionEmail });
  }

  if (risk.blocked) {
    await recordClaimAuditEvent({
      request,
      eventType: "CLAIM_SUBMIT",
      outcome: "BLOCKED",
      reason: risk.reasons.join(","),
      suspicious: true,
      tokenId: claim?.id,
      teamId: claim?.team.id,
      sessionEmail,
    });
    return jsonNoStore({ error: "Zu viele fehlgeschlagene Versuche. Bitte später erneut probieren." }, { status: 429 });
  }

  if (!sessionEmail) {
    await recordClaimAuditEvent({
      request,
      eventType: "CLAIM_SUBMIT",
      outcome: "FAIL",
      reason: "unauthenticated",
      suspicious: risk.suspicious,
      tokenId: claim?.id,
      teamId: claim?.team.id,
    });
    return jsonNoStore({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  if (!claim || claim.revokedAt) {
    await recordClaimAuditEvent({
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
    await recordClaimAuditEvent({
      request,
      eventType: "CLAIM_SUBMIT",
      outcome: "FAIL",
      reason: "expired",
      suspicious: risk.suspicious,
      tokenId: claim.id,
      teamId: claim.team.id,
      sessionEmail,
    });
    return jsonNoStore({ error: "Link ist abgelaufen" }, { status: 410 });
  }

  if (!claim.team.competition.tenant.claimLinksEnabled) {
    await recordClaimAuditEvent({
      request,
      eventType: "CLAIM_SUBMIT",
      outcome: "BLOCKED",
      reason: "claim_links_disabled",
      suspicious: false,
      tokenId: claim.id,
      teamId: claim.team.id,
      sessionEmail,
    });
    return jsonNoStore({ error: "Die Einlösung von Claim-Links ist aktuell deaktiviert" }, { status: 423 });
  }

  const normalizedSuggestedEmail = normalizeEmail(claim.suggestedEmail);
  const normalizedClaimedByEmail = normalizeEmail(claim.claimedByUser?.email);

  if (normalizedSuggestedEmail !== normalizedSessionEmail) {
    await recordClaimAuditEvent({
      request,
      eventType: "CLAIM_SUBMIT",
      outcome: "FAIL",
      reason: "email_mismatch",
      suspicious: true,
      tokenId: claim.id,
      teamId: claim.team.id,
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
    await recordClaimAuditEvent({
      request,
      eventType: "CLAIM_SUBMIT",
      outcome: "FAIL",
      reason: "claimed_by_other_user",
      suspicious: true,
      tokenId: claim.id,
      teamId: claim.team.id,
      sessionEmail,
      userId: user.id,
    });
    return jsonNoStore({ error: "Link wurde bereits von einem anderen Account eingelöst" }, { status: 409 });
  }

  await prisma.$transaction([
    prisma.team.update({
      where: { id: claim.team.id },
      data: {
        ownerId: user.id,
        teamChiefId: user.id,
        contactEmail: normalizedSessionEmail,
        contactName: sessionUserName || claim.suggestedName || claim.team.contactEmail || "",
      },
    }),
    prisma.registrationClaimToken.update({
      where: { id: claim.id },
      data: {
        claimedAt: claim.claimedAt || new Date(),
        claimedByUserId: user.id,
      },
    }),
  ]);

  await recordClaimAuditEvent({
    request,
    eventType: "CLAIM_SUBMIT",
    outcome: "SUCCESS",
    reason: risk.reasons.join(",") || undefined,
    suspicious: risk.suspicious,
    tokenId: claim.id,
    teamId: claim.team.id,
    sessionEmail,
    userId: user.id,
  });

  return jsonNoStore({ success: true, teamId: claim.team.id });
}
