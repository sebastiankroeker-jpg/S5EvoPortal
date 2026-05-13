import { signOut } from "next-auth/react";

/**
 * Portal-Logout: lokale Session beenden und sauber zur Startseite zurück.
 * Ein zusätzlicher IdP-Logout ist hier nicht nötig, weil der Login-Flow
 * ohnehin mit erneuter Anmeldung arbeitet und der bisherige Redirect-Pfad
 * im IdP auf eine NotFound-Seite lief.
 */
export async function fullSignOut() {
  await signOut({ callbackUrl: window.location.origin });
}
