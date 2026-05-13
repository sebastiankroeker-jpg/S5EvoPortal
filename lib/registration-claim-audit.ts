import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

const FAILED_WINDOW_MINUTES = 15;
const BLOCK_AFTER_FAILED_ATTEMPTS_PER_IP = 8;
const BLOCK_AFTER_FAILED_ATTEMPTS_PER_TOKEN = 4;
const SUSPICIOUS_DISTINCT_TOKENS_PER_IP = 3;

function sinceDate(minutes: number) {
  return new Date(Date.now() - minutes * 60 * 1000);
}

export function getClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const ip = forwardedFor?.split(",")[0]?.trim() || realIp?.trim() || null;
  return ip?.slice(0, 64) || null;
}

export function getUserAgent(request: NextRequest) {
  return request.headers.get("user-agent")?.slice(0, 512) || null;
}

export function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  if (local.length <= 2) return `${local[0] ?? "*"}*@${domain}`;
  return `${local.slice(0, 2)}***@${domain}`;
}

export async function recordClaimAuditEvent(input: {
  request: NextRequest;
  eventType: string;
  outcome?: string;
  reason?: string;
  suspicious?: boolean;
  tokenId?: string | null;
  teamId?: string | null;
  userId?: string | null;
  sessionEmail?: string | null;
}) {
  await prisma.registrationClaimAuditEvent.create({
    data: {
      eventType: input.eventType,
      outcome: input.outcome || null,
      reason: input.reason || null,
      suspicious: input.suspicious || false,
      ipAddress: getClientIp(input.request),
      userAgent: getUserAgent(input.request),
      sessionEmail: input.sessionEmail || null,
      tokenId: input.tokenId || null,
      teamId: input.teamId || null,
      userId: input.userId || null,
    },
  });
}

export async function assessClaimRequestRisk(input: {
  request: NextRequest;
  tokenId?: string | null;
}) {
  const ipAddress = getClientIp(input.request);
  const windowStart = sinceDate(FAILED_WINDOW_MINUTES);

  if (!ipAddress) {
    return {
      suspicious: false,
      blocked: false,
      reasons: [] as string[],
    };
  }

  const recentFailedByIp = await prisma.registrationClaimAuditEvent.findMany({
    where: {
      createdAt: { gte: windowStart },
      ipAddress,
      outcome: { in: ["FAIL", "BLOCKED"] },
    },
    select: { tokenId: true },
  });

  const recentFailedByToken = input.tokenId
    ? await prisma.registrationClaimAuditEvent.count({
        where: {
          createdAt: { gte: windowStart },
          tokenId: input.tokenId,
          outcome: { in: ["FAIL", "BLOCKED"] },
        },
      })
    : 0;

  const distinctTokens = new Set(recentFailedByIp.map((event) => event.tokenId).filter(Boolean)).size;
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

  return {
    suspicious: reasons.length > 0,
    blocked:
      reasons.includes("too_many_failed_attempts_from_ip") ||
      reasons.includes("too_many_failed_attempts_for_token"),
    reasons,
  };
}

export function logSuspiciousClaimPattern(context: { reasons: string[]; tokenId?: string | null; teamId?: string | null; sessionEmail?: string | null; }) {
  console.warn("Suspicious registration claim pattern detected", context);
}
