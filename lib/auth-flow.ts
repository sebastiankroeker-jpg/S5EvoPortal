import { getCsrfToken } from "next-auth/react";

const PENDING_AUTH_CALLBACK_KEY = "s5evo.pendingAuthCallback";
const AUTHENTIK_REGISTRATION_FLOW_PATH = "/if/flow/s5-evo-registration/";
const PENDING_AUTH_MAX_AGE_MS = 15 * 60 * 1000;

type PendingAuthCallbackRecord = {
  callbackUrl: string;
  intent: "login" | "registration";
  createdAt: number;
};

export function normalizeCallbackUrl(value?: string | null) {
  if (!value) return "/";
  if (!value.startsWith("/")) return "/";
  if (value.startsWith("//")) return "/";
  return value;
}

export function storePendingAuthCallback(
  value?: string | null,
  intent: "login" | "registration" = "login",
) {
  if (typeof window === "undefined") return;
  const normalized = normalizeCallbackUrl(value);
  const record: PendingAuthCallbackRecord = {
    callbackUrl: normalized,
    intent,
    createdAt: Date.now(),
  };
  window.sessionStorage.setItem(PENDING_AUTH_CALLBACK_KEY, JSON.stringify(record));
}

export function readPendingAuthCallback() {
  const record = readPendingAuthContext();
  return record?.callbackUrl ?? null;
}

export function readPendingAuthContext() {
  if (typeof window === "undefined") return null;
  const rawValue = window.sessionStorage.getItem(PENDING_AUTH_CALLBACK_KEY);
  if (!rawValue) return null;

  try {
    const parsed = JSON.parse(rawValue) as PendingAuthCallbackRecord;
    if (typeof parsed?.callbackUrl !== "string" || typeof parsed?.createdAt !== "number") {
      throw new Error("invalid_pending_auth_record");
    }

    if (Date.now() - parsed.createdAt > PENDING_AUTH_MAX_AGE_MS) {
      clearPendingAuthCallback();
      return null;
    }

    return {
      callbackUrl: normalizeCallbackUrl(parsed.callbackUrl),
      intent: parsed.intent === "registration" ? "registration" : "login",
      createdAt: parsed.createdAt,
    };
  } catch {
    // Backward compatibility for older plain-string values.
    return {
      callbackUrl: normalizeCallbackUrl(rawValue),
      intent: "login",
      createdAt: Date.now(),
    };
  }
}

export function clearPendingAuthCallback() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(PENDING_AUTH_CALLBACK_KEY);
}

type AuthorizationParams = Record<string, string>;

async function prepareAuthentikAuthorizationUrl(
  callbackUrl: string,
  authorizationParams: AuthorizationParams = {},
) {
  const csrfToken = await getCsrfToken();
  const response = await fetch("/api/auth/signin/authentik", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      csrfToken: csrfToken ?? "",
      callbackUrl,
      json: "true",
      ...authorizationParams,
    }),
  });

  if (!response.ok) {
    throw new Error("authentik_prepare_failed");
  }

  const data = (await response.json()) as { url?: string };
  if (!data.url) {
    throw new Error("authentik_url_missing");
  }

  return new URL(data.url);
}

export async function startPortalLogin(callbackUrl?: string | null) {
  const normalizedCallbackUrl = normalizeCallbackUrl(callbackUrl);
  storePendingAuthCallback(normalizedCallbackUrl, "login");

  const authorizationUrl = await prepareAuthentikAuthorizationUrl(normalizedCallbackUrl, {
    prompt: "login",
    max_age: "0",
  });

  window.location.href = authorizationUrl.toString();
}

export async function startPortalRegistration(callbackUrl?: string | null) {
  const normalizedCallbackUrl = normalizeCallbackUrl(callbackUrl);
  storePendingAuthCallback(normalizedCallbackUrl, "registration");

  const authorizationUrl = await prepareAuthentikAuthorizationUrl(normalizedCallbackUrl);
  const nextPath = `${authorizationUrl.pathname}${authorizationUrl.search}`;
  const registrationUrl = new URL(AUTHENTIK_REGISTRATION_FLOW_PATH, authorizationUrl.origin);
  registrationUrl.searchParams.set("next", nextPath);

  window.location.href = registrationUrl.toString();
}
