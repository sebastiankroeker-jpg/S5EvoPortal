import { signOut } from "next-auth/react";

const AUTH_END_SESSION_URL = "https://auth.s5evo.de/application/o/s5-evo-portal/end-session/";

/**
 * Beendet sowohl die lokale Portal-Session als auch die SSO-Session beim Login-Dienst.
 * Sonst meldet der Browser beim nächsten Login durch das bestehende SSO-Cookie sofort
 * wieder denselben Account an.
 */
export async function fullSignOut() {
  await signOut({ redirect: false });

  const endSessionUrl = new URL(AUTH_END_SESSION_URL);
  endSessionUrl.searchParams.set("post_logout_redirect_uri", window.location.origin);
  window.location.href = endSessionUrl.toString();
}
