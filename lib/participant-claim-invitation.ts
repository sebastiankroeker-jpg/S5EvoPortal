import type { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";

import { normalizeEmail } from "@/lib/current-user";
import { sendParticipantClaimEmail } from "@/lib/mail/participant-claim";
import { resolveRegistrationNotificationEmail } from "@/lib/mail/team-registration";
import { recordParticipantClaimAuditEvent } from "@/lib/participant-claim-audit";
import { prisma } from "@/lib/prisma";
import { buildParticipantClaimUrl, createRegistrationClaimToken } from "@/lib/registration-claim";

type ClaimTokenExpiryMode = "FIXED_DAYS" | "REGISTRATION_DEADLINE" | "COMPETITION_END";

type ParticipantClaimCompetitionConfig = {
  name: string;
  year: number;
  registrationNotificationEmail?: string | null;
  registrationDeadline?: Date | null;
  date?: Date | null;
  dateEnd?: Date | null;
  claimTokenExpiryMode?: ClaimTokenExpiryMode | null;
  claimTokenTtlDays?: number | null;
  tenant?: {
    name: string;
    contactEmail?: string | null;
  } | null;
};

type ParticipantClaimTeamConfig = {
  id: string;
  name: string;
};

type ParticipantClaimParticipantConfig = {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  userId?: string | null;
};

type CreateParticipantClaimInvitationInput = {
  request: NextRequest;
  participant: ParticipantClaimParticipantConfig;
  team: ParticipantClaimTeamConfig;
  competition: ParticipantClaimCompetitionConfig;
  actorUserId?: string | null;
  sessionEmail?: string | null;
  previousEmail?: string | null;
  prismaClient?: Prisma.TransactionClient;
};

type ParticipantClaimTokenStatusInput = {
  claimedAt?: Date | string | null;
  revokedAt?: Date | string | null;
  expiresAt?: Date | string | null;
} | null;

function isExpired(value?: Date | string | null) {
  if (!value) return false;
  return new Date(value).getTime() < Date.now();
}

export function getParticipantClaimTokenStatus(token?: ParticipantClaimTokenStatusInput) {
  if (!token) return "none";
  if (token.revokedAt) return "revoked";
  if (token.claimedAt) return "claimed";
  if (isExpired(token.expiresAt)) return "expired";
  return "active";
}

export function getParticipantEmailInvitationStatus(input: {
  email?: string | null;
  participantUserId?: string | null;
  token?: ParticipantClaimTokenStatusInput;
}) {
  if (input.participantUserId) return "linked";
  if (!normalizeEmail(input.email)) return "missing_email";
  return getParticipantClaimTokenStatus(input.token);
}

export function shouldInviteParticipantClaim(input: {
  previousEmail?: string | null;
  nextEmail?: string | null;
  participantUserId?: string | null;
}) {
  const nextEmail = normalizeEmail(input.nextEmail);
  if (!nextEmail || input.participantUserId) return false;

  return normalizeEmail(input.previousEmail) !== nextEmail;
}

export async function createParticipantClaimInvitation({
  request,
  participant,
  team,
  competition,
  actorUserId,
  sessionEmail,
  previousEmail,
  prismaClient = prisma,
}: CreateParticipantClaimInvitationInput) {
  const participantEmail = normalizeEmail(participant.email);
  if (!participantEmail || participant.userId) {
    return { status: "skipped" as const, reason: !participantEmail ? "missing_email" : "participant_already_linked" };
  }

  const claimToken = createRegistrationClaimToken({
    mode: competition.claimTokenExpiryMode || "COMPETITION_END",
    ttlDays: competition.claimTokenTtlDays || null,
    registrationDeadline: competition.registrationDeadline || null,
    competitionEnd: competition.dateEnd || competition.date || null,
    maxExpiresAt: null,
  });

  await prismaClient.participantClaimToken.updateMany({
    where: {
      participantId: participant.id,
      claimedAt: null,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });

  const createdToken = await prismaClient.participantClaimToken.create({
    data: {
      participantId: participant.id,
      tokenHash: claimToken.tokenHash,
      suggestedEmail: participantEmail,
      suggestedName: `${participant.firstName} ${participant.lastName}`.trim() || null,
      expiresAt: claimToken.expiresAt,
    },
  });

  await recordParticipantClaimAuditEvent({
    request,
    eventType: "CLAIM_CREATE",
    outcome: "SUCCESS",
    reason: previousEmail ? "participant_email_changed" : "participant_email_added",
    tokenId: createdToken.id,
    participantId: participant.id,
    teamId: team.id,
    userId: actorUserId || null,
    sessionEmail: sessionEmail || null,
  });

  const orgReplyTo = resolveRegistrationNotificationEmail(competition)[0] || competition.tenant?.contactEmail || null;
  const mailResult = await sendParticipantClaimEmail({
    participantName: `${participant.firstName} ${participant.lastName}`.trim(),
    participantEmail,
    teamName: team.name,
    competitionName: competition.name,
    competitionYear: competition.year,
    claimUrl: buildParticipantClaimUrl(claimToken.rawToken),
    orgReplyTo,
  });

  return { status: mailResult.status, tokenId: createdToken.id, email: participantEmail, expiresAt: createdToken.expiresAt };
}
