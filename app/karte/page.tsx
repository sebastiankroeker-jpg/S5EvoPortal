import type { Metadata } from "next";
import AdminEventMapPage from "@/app/components/admin-event-map-page";

export const metadata: Metadata = {
  title: "Event-Karte | Soier 5Kampf",
  description: "Interaktive Karte fuer Sponsoren, Infrastruktur und Strecken des Soier 5Kampf.",
};

export default function KartePage() {
  return <AdminEventMapPage />;
}
