import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import AdminEventMapPage from "@/app/components/admin-event-map-page";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { resolveCurrentUser } from "@/lib/current-user";
import { hasEffectivePermissionForAnyTenant } from "@/lib/server-permissions";

export const metadata: Metadata = {
  title: "Event-Karte | Soier 5Kampf",
  description: "Interaktive Karte fuer Sponsoren, Infrastruktur und Strecken des Soier 5Kampf.",
};

export default async function KartePage() {
  const session = await getServerSession(authOptions);
  const { user } = await resolveCurrentUser(session);
  const canViewMap = user ? await hasEffectivePermissionForAnyTenant(user.id, "portal.map.view") : false;
  if (!canViewMap) redirect("/");

  return <AdminEventMapPage />;
}
