import crypto from "crypto";

const CLAIM_TOKEN_BYTES = 32;
const CLAIM_TOKEN_TTL_DAYS = 30;

export function createRegistrationClaimToken(options?: { maxExpiresAt?: Date | null }) {
  const rawToken = crypto.randomBytes(CLAIM_TOKEN_BYTES).toString("base64url");
  const tokenHash = hashRegistrationClaimToken(rawToken);
  const defaultExpiresAt = new Date(Date.now() + CLAIM_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  const configuredMax = options?.maxExpiresAt;
  const expiresAt = configuredMax && configuredMax.getTime() > Date.now() && configuredMax.getTime() < defaultExpiresAt.getTime()
    ? configuredMax
    : defaultExpiresAt;

  return {
    rawToken,
    tokenHash,
    expiresAt,
  };
}

export function hashRegistrationClaimToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function buildRegistrationClaimUrl(token: string) {
  const baseUrl =
    process.env.NEXTAUTH_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  const normalizedBaseUrl = baseUrl.startsWith("http") ? baseUrl : `https://${baseUrl}`;
  return `${normalizedBaseUrl.replace(/\/$/, "")}/claim/${token}`;
}
