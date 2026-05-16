import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const AUTH_END_SESSION_URL = "https://auth.s5evo.de/application/o/s5-evo-portal/end-session/";

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

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const endSessionUrl = new URL(AUTH_END_SESSION_URL);
  endSessionUrl.searchParams.set(
    "post_logout_redirect_uri",
    postLogoutRedirectUri.toString(),
  );

  const idTokenHint =
    token && typeof token.idToken === "string" ? token.idToken : null;
  if (idTokenHint) {
    endSessionUrl.searchParams.set("id_token_hint", idTokenHint);
  }

  return NextResponse.json({ url: endSessionUrl.toString() });
}
