import { NextRequest, NextResponse } from "next/server";

const AUTHENTIK_SESSION_END_URL = "https://auth.s5evo.de/if/session-end/";

function normalizeLogoutCallbackUrl(value?: string | null) {
  if (!value) return "/";
  if (!value.startsWith("/")) return "/";
  if (value.startsWith("//")) return "/";
  return value;
}

export async function GET(request: NextRequest) {
  const callbackUrl = normalizeLogoutCallbackUrl(
    request.nextUrl.searchParams.get("callbackUrl"),
  );
  const postLogoutRedirectUri = new URL(callbackUrl, request.nextUrl.origin);
  const sessionEndUrl = new URL(AUTHENTIK_SESSION_END_URL);
  const redirectTarget = postLogoutRedirectUri.toString();

  // auth.s5evo.de has historically accepted redirect_uri here; newer
  // authentik installs commonly use next for flow redirects. Supplying both
  // keeps the logout redirect stable across upgrades.
  sessionEndUrl.searchParams.set("redirect_uri", redirectTarget);
  sessionEndUrl.searchParams.set("next", redirectTarget);

  return NextResponse.json({ url: sessionEndUrl.toString() });
}
