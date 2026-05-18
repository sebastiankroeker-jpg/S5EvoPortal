import { signOut } from "next-auth/react";
import { clearPendingAuthCallback, normalizeCallbackUrl } from "@/lib/auth-flow";

const FEDERATED_LOGOUT_PATH = "/api/auth/federated-logout";

/**
 * Beendet sowohl die lokale Portal-Session als auch die SSO-Session beim Login-Dienst.
 * Sonst meldet der Browser beim nächsten Login durch das bestehende SSO-Cookie sofort
 * wieder denselben Account an.
 */
export async function fullSignOut(callbackUrl?: string | null) {
  const normalizedCallbackUrl = normalizeCallbackUrl(callbackUrl);
  clearPendingAuthCallback();
  const federatedLogoutUrl = new URL(FEDERATED_LOGOUT_PATH, window.location.origin);
  federatedLogoutUrl.searchParams.set("callbackUrl", normalizedCallbackUrl);
  let logoutRedirectUrl = normalizedCallbackUrl;

  try {
    const response = await fetch(federatedLogoutUrl.toString(), {
      method: "GET",
      credentials: "include",
    });
    if (response.ok) {
      const data = (await response.json()) as { url?: string };
      if (data.url) {
        logoutRedirectUrl = data.url;
      }
    }
  } catch {
    // Fall back to the local callback if the IdP logout URL could not be prepared.
  }

  try {
    await signOut({ redirect: false, callbackUrl: normalizedCallbackUrl });
  } finally {
    window.location.replace(logoutRedirectUrl);
  }
}
