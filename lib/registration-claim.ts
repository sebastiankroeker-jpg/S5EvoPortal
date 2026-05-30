import crypto from "crypto";

const CLAIM_TOKEN_BYTES = 32;
const CLAIM_TOKEN_TTL_DAYS = 7;

type ClaimTokenExpiryMode = "FIXED_DAYS" | "REGISTRATION_DEADLINE" | "COMPETITION_END";

function endOfDay(value: Date) {
  const normalized = new Date(value);
  normalized.setHours(23, 59, 59, 999);
  return normalized;
}

function resolveTokenExpiry(options?: {
  mode?: ClaimTokenExpiryMode | null;
  ttlDays?: number | null;
  registrationDeadline?: Date | null;
  competitionEnd?: Date | null;
  maxExpiresAt?: Date | null;
}) {
  const ttlDays =
    typeof options?.ttlDays === "number" && Number.isFinite(options.ttlDays) && options.ttlDays > 0
      ? Math.floor(options.ttlDays)
      : CLAIM_TOKEN_TTL_DAYS;
  const defaultExpiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
  const mode = options?.mode || "FIXED_DAYS";

  let expiresAt = defaultExpiresAt;

  if (mode === "REGISTRATION_DEADLINE" && options?.registrationDeadline) {
    expiresAt = endOfDay(options.registrationDeadline);
  }

  if (mode === "COMPETITION_END" && options?.competitionEnd) {
    expiresAt = endOfDay(options.competitionEnd);
  }

  if (expiresAt.getTime() <= Date.now()) {
    expiresAt = defaultExpiresAt;
  }

  const configuredMax = options?.maxExpiresAt;
  if (configuredMax && configuredMax.getTime() > Date.now() && configuredMax.getTime() < expiresAt.getTime()) {
    expiresAt = configuredMax;
  }

  return expiresAt;
}

export function createRegistrationClaimToken(options?: {
  mode?: ClaimTokenExpiryMode | null;
  ttlDays?: number | null;
  registrationDeadline?: Date | null;
  competitionEnd?: Date | null;
  maxExpiresAt?: Date | null;
}) {
  const rawToken = crypto.randomBytes(CLAIM_TOKEN_BYTES).toString("base64url");
  const tokenHash = hashRegistrationClaimToken(rawToken);
  const expiresAt = resolveTokenExpiry(options);

  return {
    rawToken,
    tokenHash,
    expiresAt,
  };
}

export function hashRegistrationClaimToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function resolvePortalBaseUrl() {
  const baseUrl =
    process.env.NEXTAUTH_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  return baseUrl.startsWith("http") ? baseUrl : `https://${baseUrl}`;
}

export function buildPortalHomeUrl() {
  return resolvePortalBaseUrl().replace(/\/$/, "");
}

export function buildRegistrationClaimUrl(token: string) {
  return `${buildPortalHomeUrl()}/claim/${token}`;
}

export function buildParticipantClaimUrl(token: string) {
  return `${buildPortalHomeUrl()}/participant-claim/${token}`;
}
