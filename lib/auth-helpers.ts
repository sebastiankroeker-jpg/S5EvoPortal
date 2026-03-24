import { signOut } from "next-auth/react";

/**
 * Vollständiger Logout: NextAuth Session + Authentik SSO Session beenden.
 * Ohne das bleibt die Authentik-Session aktiv und der nächste Login
 * gibt automatisch den gleichen Account zurück (SSO).
 */
export async function fullSignOut() {
  // 1. NextAuth Session beenden
  await signOut({ redirect: false });
  
  // 2. Authentik SSO Session beenden + zurück zur App
  const authentikLogoutUrl = "https://auth.s5evo.de/if/session-end/?redirect_uri=" + 
    encodeURIComponent(window.location.origin);
  window.location.href = authentikLogoutUrl;
}
