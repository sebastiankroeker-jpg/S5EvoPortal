import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

const FAILED_WINDOW_MINUTES = 15;
const BLOCK_AFTER_FAILED_ATTEMPTS_PER_IP = 6;
const BLOCK_AFTER_FAILED_ATTEMPTS_PER_TOKEN = 3;
const SUSPICIOUS_DISTINCT_TOKENS_PER_IP = 2;
const SUSPICIOUS_CLAIM_VIEWS_PER_IP = 12;
const SUSPICIOUS_CLAIM_VIEWS_PER_TOKEN = 6;
const BLOCK_AFTER_CLAIM_VIEWS_PER_IP = 20;

function sinceDate(minutes: number) {
  return new Date(Date.now() - minutes * 60 * 1000);
}

export function getParticipantClaimClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const ip = forwardedFor?.split(",")[0]?.trim() || realIp?.trim() || null;
  return ip?.slice(0, 64) || null;
}

export function getParticipantClaimUserAgent(request: NextRequest) {
  return request.headers.get("user-agent")?.slice(0, 512) || null;
}

export function maskParticipantClaimEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  if (local.length <= 2) return `${local[0] ?? "*"}*@${domain}`;
  return `${local.slice(0, 2)}***@${domain}`;
}

export async function recordParticipantClaimAuditEvent(input: {
  request: NextRequest;
  eventType: string;
  outcome?: string;
  reason?: string;
  suspicious?: boolean;
  tokenId?: string | null;
  participantId?: string | null;
  teamId?: string | null;
  userId?: string | null;
  sessionEmail?: string | null;
}) {
  await prisma.participantClaimAuditEvent.create({
    data: {
      eventType: input.eventType,
      outcome: input.outcome || null,
      reason: input.reason || null,
      suspicious: input.suspicious || false,
      ipAddress: getParticipantClaimClientIp(input.request),
      userAgent: getParticipantClaimUserAgent(input.request),
      sessionEmail: input.sessionEmail || null,
      tokenId: input.tokenId || null,
      participantId: input.participantId || null,
      teamId: input.teamId || null,
      userId: input.userId || null,
    },
  });
}

export async function assessParticipantClaimRequestRisk(input: {
  request: NextRequest;
  tokenId?: string | null;
}) {
  const ipAddress = getParticipantClaimClientIp(input.request);
  const windowStart = sinceDate(FAILED_WINDOW_MINUTES);

  if (!ipAddress) {
    return {
      suspicious: false,
      blocked: false,
      reasons: [] as string[],
    };
  }

  const recentFailedByIp = await prisma.participantClaimAuditEvent.findMany({
    where: {
      createdAt: { gte: windowStart },
      ipAddress,
      outcome: { in: ["FAIL", "BLOCKED"] },
    },
    select: { tokenId: true },
  });

  const recentViewsByIp = await prisma.participantClaimAuditEvent.findMany({
    where: {
      createdAt: { gte: windowStart },
      ipAddress,
      eventType: "CLAIM_VIEW",
    },
    select: { tokenId: true },
  });

  const recentFailedByToken = input.tokenId
    ? await prisma.participantClaimAuditEvent.count({
        where: {
          createdAt: { gte: windowStart },
          tokenId: input.tokenId,
          outcome: { in: ["FAIL", "BLOCKED"] },
        },
      })
    : 0;

  const recentViewsByToken = input.tokenId
    ? await prisma.participantClaimAuditEvent.count({
        where: {
          createdAt: { gte: windowStart },
          tokenId: input.tokenId,
          eventType: "CLAIM_VIEW",
        },
      })
    : 0;

  const distinctTokens = new Set(recentFailedByIp.map((event) => event.tokenId).filter(Boolean)).size;
  const distinctViewedTokens = new Set(recentViewsByIp.map((event) => event.tokenId).filter(Boolean)).size;
  const reasons: string[] = [];

  if (recentFailedByIp.length >= BLOCK_AFTER_FAILED_ATTEMPTS_PER_IP) {
    reasons.push("too_many_failed_attempts_from_ip");
  }

  if (recentFailedByToken >= BLOCK_AFTER_FAILED_ATTEMPTS_PER_TOKEN) {
    reasons.push("too_many_failed_attempts_for_token");
  }

  if (distinctTokens >= SUSPICIOUS_DISTINCT_TOKENS_PER_IP) {
    reasons.push("multiple_tokens_touched_from_same_ip");
  }

  if (recentViewsByIp.length >= SUSPICIOUS_CLAIM_VIEWS_PER_IP) {
    reasons.push("high_claim_view_volume_from_ip");
  }

  if (recentViewsByToken >= SUSPICIOUS_CLAIM_VIEWS_PER_TOKEN) {
    reasons.push("high_claim_view_volume_for_token");
  }

  return {
    suspicious: reasons.length > 0,
    blocked:
      reasons.includes("too_many_failed_attempts_from_ip") ||
      reasons.includes("too_many_failed_attempts_for_token") ||
      (recentViewsByIp.length >= BLOCK_AFTER_CLAIM_VIEWS_PER_IP && distinctViewedTokens >= 3),
    reasons,
  };
}

export function logSuspiciousParticipantClaimPattern(context: {
  reasons: string[];
  tokenId?: string | null;
  participantId?: string | null;
  teamId?: string | null;
  sessionEmail?: string | null;
}) {
  console.warn("Suspicious participant claim pattern detected", {
    ...context,
    sessionEmail: context.sessionEmail ? maskParticipantClaimEmail(context.sessionEmail) : null,
  });
}
