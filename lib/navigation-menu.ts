import type { Permission, Role } from "@/lib/permissions";

export interface NavigationMenuItem {
  id:
    | "home"
    | "orga"
    | "registration"
    | "my-teams"
    | "live"
    | "profile"
    | "all-teams"
    | "participants"
    | "changes"
    | "claim-links"
    | "administration"
    | "architecture"
    | "infrastructure"
    | "changelog"
    | "sign-out";
  label: string;
  keywords: string[];
  icon: string;
  permission?: Permission;
  requiresAuth?: boolean;
  roles?: Role[];
}

const NAVIGATION_MENU_ITEMS: NavigationMenuItem[] = [
  {
    id: "home",
    label: "Home",
    keywords: ["home", "start", "hauptseite"],
    icon: "🏠",
  },
  {
    id: "orga",
    label: "Orga",
    keywords: ["orga", "orga-bereich", "wettkampfleitung", "support"],
    icon: "⚙️",
    requiresAuth: true,
  },
  {
    id: "registration",
    label: "Mannschaft anmelden",
    keywords: ["anmeldung", "registrierung", "team anmelden", "mannschaft"],
    icon: "📋",
  },
  {
    id: "my-teams",
    label: "Meine Mannschaften",
    keywords: ["teams", "mannschaften", "dashboard", "meine teams", "meine mannschaften", "übersicht"],
    icon: "📊",
    permission: "team.view.own",
    requiresAuth: true,
  },
  {
    id: "live",
    label: "Live",
    keywords: ["live", "ergebnisse", "resultate", "punkte"],
    icon: "🏆",
  },
  {
    id: "profile",
    label: "Profil",
    keywords: ["profil", "konto", "account", "benutzername"],
    icon: "👤",
    requiresAuth: true,
  },
  {
    id: "all-teams",
    label: "Alle Mannschaften",
    keywords: ["alle teams", "alle mannschaften", "admin teams", "admin mannschaften"],
    icon: "👥",
    permission: "team.view.all",
    requiresAuth: true,
  },
  {
    id: "participants",
    label: "Teilnehmerübersicht",
    keywords: ["teilnehmer", "teilnehmeruebersicht", "teilnehmerliste", "orga teilnehmer"],
    icon: "📋",
    requiresAuth: true,
  },
  {
    id: "changes",
    label: "Aenderungen",
    keywords: ["aenderungen", "freigaben", "approval", "antraege", "queue"],
    icon: "📝",
    permission: "team.view.all",
    requiresAuth: true,
  },
  {
    id: "claim-links",
    label: "Claim-Links",
    keywords: ["claim", "claim links", "uebernahmelinks", "support links"],
    icon: "🔐",
    permission: "team.view.all",
    requiresAuth: true,
  },
  {
    id: "administration",
    label: "Administration",
    keywords: ["admin", "einstellungen", "konfiguration", "config"],
    icon: "🏢",
    permission: "config.edit",
    requiresAuth: true,
  },
  {
    id: "architecture",
    label: "Architektur",
    keywords: ["architektur", "referenz", "technik"],
    icon: "🔗",
    roles: ["ADMIN", "MODERATOR"],
    requiresAuth: true,
  },
  {
    id: "infrastructure",
    label: "Infrastruktur",
    keywords: ["infrastruktur", "system", "sysadmin"],
    icon: "🖥️",
    permission: "config.edit",
    requiresAuth: true,
  },
  {
    id: "changelog",
    label: "Changelog",
    keywords: ["changelog", "version", "historie", "änderungen"],
    icon: "📝",
    requiresAuth: true,
  },
  {
    id: "sign-out",
    label: "Abmelden",
    keywords: ["abmelden", "logout", "ausloggen"],
    icon: "🚪",
    requiresAuth: true,
  },
];

interface MenuFilterArgs {
  authenticated: boolean;
  can: (permission: Permission) => boolean;
  roles: Role[];
  pathname?: string | null;
}

const CLAIM_ROUTE_ITEM_IDS = new Set<NavigationMenuItem["id"]>([
  "home",
  "my-teams",
  "live",
  "profile",
  "sign-out",
]);

export function isClaimNavigationPath(pathname?: string | null) {
  return Boolean(pathname && pathname.startsWith("/claim/"));
}

export function getPermittedNavigationMenuItems({
  authenticated,
  can,
  roles,
  pathname,
}: MenuFilterArgs): NavigationMenuItem[] {
  const claimPath = isClaimNavigationPath(pathname);

  return NAVIGATION_MENU_ITEMS
    .filter((item) => {
      if (claimPath && !CLAIM_ROUTE_ITEM_IDS.has(item.id)) return false;
      if (item.requiresAuth && !authenticated) return false;
      if (item.id === "orga" && !(can("team.view.all") || can("results.edit"))) return false;
      if (item.id === "participants" && !(can("team.view.all") || can("results.edit"))) return false;
      if (item.permission && !can(item.permission)) return false;
      if (item.roles && !roles.some((role) => item.roles?.includes(role))) return false;
      return true;
    })
    .map((item) => {
      if (claimPath && item.id === "my-teams") {
        return {
          ...item,
          label: "Mein Team",
          keywords: [...item.keywords, "mein team"],
          icon: "🏃",
        };
      }

      return item;
    });
}
