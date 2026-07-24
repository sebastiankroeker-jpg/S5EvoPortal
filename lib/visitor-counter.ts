export const VISITOR_ROUTE_CONFIG = {
  home: { label: "Home" },
  live: { label: "Live" },
  registration: { label: "Anmeldung" },
  dashboard: { label: "Dashboard" },
  orga: { label: "Orga" },
  changes: { label: "Änderungen" },
  map: { label: "Karte" },
  marketplace: { label: "Sportlerbörse" },
  participant: { label: "Teilnehmer" },
  messages: { label: "Nachrichten" },
  profile: { label: "Profil" },
  claimLinks: { label: "Claim-Links" },
  timekeeping: { label: "Zeitnahme" },
  changelog: { label: "Changelog" },
} as const;

export type VisitorRouteKey = keyof typeof VISITOR_ROUTE_CONFIG;

const VISITOR_ROUTE_KEYS = new Set<string>(Object.keys(VISITOR_ROUTE_CONFIG));

export function normalizeVisitorRouteKey(value: unknown): VisitorRouteKey | null {
  if (typeof value !== "string") return null;
  return VISITOR_ROUTE_KEYS.has(value) ? (value as VisitorRouteKey) : null;
}

function getMainTabRouteKey(hash: string): VisitorRouteKey | null {
  switch (hash.replace(/^#/, "")) {
    case "live":
      return "live";
    case "registration":
      return "registration";
    case "dashboard":
      return "dashboard";
    case "orga":
      return "orga";
    case "home":
    case "":
      return "home";
    default:
      return null;
  }
}

export function resolveVisitorRouteKey(pathname: string, hash = ""): VisitorRouteKey | null {
  if (!pathname || pathname.startsWith("/api") || pathname.startsWith("/admin")) return null;

  if (pathname === "/") {
    return getMainTabRouteKey(hash) ?? "home";
  }

  if (pathname.startsWith("/anmeldung") || pathname.startsWith("/register")) return "registration";
  if (pathname.startsWith("/aenderungen")) return "changes";
  if (pathname.startsWith("/karte")) return "map";
  if (pathname.startsWith("/sportlerboerse")) return "marketplace";
  if (pathname.startsWith("/teilnehmer")) return "participant";
  if (pathname.startsWith("/nachrichten")) return "messages";
  if (pathname.startsWith("/profile")) return "profile";
  if (pathname.startsWith("/claim-links")) return "claimLinks";
  if (pathname.startsWith("/zeitnahme")) return "timekeeping";
  if (pathname.startsWith("/changelog")) return "changelog";

  return null;
}

export function getVisitorRouteLabel(routeKey: VisitorRouteKey): string {
  return VISITOR_ROUTE_CONFIG[routeKey].label;
}
