import { NextRequest, NextResponse } from "next/server";
import { resolveAuthentikEndSessionEndpoint } from "@/lib/authentik-config";

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
  const sessionEndUrl = new URL(
    resolveAuthentikEndSessionEndpoint(process.env.AUTHENTIK_ISSUER),
  );
  const redirectTarget = postLogoutRedirectUri.toString();

  // Use the OIDC logout parameter and keep legacy aliases for older
  // Authentik setups that still look at flow-style redirects.
  sessionEndUrl.searchParams.set("post_logout_redirect_uri", redirectTarget);
  sessionEndUrl.searchParams.set("redirect_uri", redirectTarget);
  sessionEndUrl.searchParams.set("next", redirectTarget);

  return NextResponse.json({ url: sessionEndUrl.toString() });
}
