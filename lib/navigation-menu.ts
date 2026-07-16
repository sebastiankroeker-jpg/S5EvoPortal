import type { Permission, Role } from "@/lib/permissions";

export interface NavigationMenuItem {
  id:
    | "home"
    | "orga"
    | "registration"
    | "my-teams"
    | "live"
    | "profile"
    | "messages"
    | "all-teams"
    | "sportlerboerse-mtc"
    | "sportlerboerse-dashboard"
    | "participants"
    | "changes"
    | "claim-links"
    | "orga-links"
    | "administration"
    | "admin-competition"
    | "admin-results"
    | "admin-users"
    | "admin-audits"
    | "admin-archive"
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
    id: "messages",
    label: "Nachrichten",
    keywords: ["nachrichten", "postfach", "brief", "mail", "message", "support", "admin kontaktieren"],
    icon: "✉️",
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
    id: "sportlerboerse-dashboard",
    label: "Sportler-Börse Dashboard",
    keywords: ["sportlerbörse", "sportlerboerse", "börse", "boerse", "einzelmeldung", "vermittlung", "marketplace"],
    icon: "🧩",
    permission: "team.view.all",
    requiresAuth: true,
  },
  {
    id: "sportlerboerse-mtc",
    label: "Unvollständige Mannschaft",
    keywords: ["mtc", "unvollständige mannschaft", "unvollstaendige mannschaft", "mannschaft unvollständig", "matching", "entwurf"],
    icon: "🧩",
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
    keywords: ["aenderungen", "freigaben", "approval", "antraege", "queue", "review", "pruefung"],
    icon: "📝",
    permission: "team.view.all",
    requiresAuth: true,
  },
  {
    id: "claim-links",
    label: "Claim-Links",
    keywords: ["claim", "claim links", "uebernahmelinks", "support links", "uebernahme", "tokens", "token"],
    icon: "🔐",
    permission: "team.view.all",
    requiresAuth: true,
  },
  {
    id: "orga-links",
    label: "Orga-Links",
    keywords: ["orga links", "links", "sammlung", "referenz", "architektur", "infrastruktur", "toolbox"],
    icon: "🗂️",
    requiresAuth: true,
  },
  {
    id: "administration",
    label: "Administration",
    keywords: ["admin", "einstellungen", "konfiguration", "config", "verwaltung"],
    icon: "🏢",
    permission: "config.edit",
    requiresAuth: true,
  },
  {
    id: "admin-competition",
    label: "Admin: Tenant & Wettkampf",
    keywords: ["tenant", "mandant", "wettkampf", "competition", "reset", "dry run", "orga mails", "konfiguration wettkampf"],
    icon: "🏆",
    permission: "config.edit",
    requiresAuth: true,
  },
  {
    id: "admin-results",
    label: "Admin: Ergebnisdaten",
    keywords: ["ergebnisdaten", "ergebnisse", "result staging", "resultate", "raw packages", "drafts", "publikation", "zeitnahme import"],
    icon: "📊",
    permission: "config.edit",
    requiresAuth: true,
  },
  {
    id: "admin-users",
    label: "Admin: Benutzer",
    keywords: ["user", "users", "benutzer", "rollen", "rechte", "rollenverwaltung", "nutzer"],
    icon: "👥",
    permission: "config.edit",
    requiresAuth: true,
  },
  {
    id: "admin-audits",
    label: "Admin: Audits",
    keywords: ["audit", "audits", "logs", "mail log", "mail protokoll", "claim auffaelligkeiten", "betrieb"],
    icon: "🧾",
    permission: "config.edit",
    requiresAuth: true,
  },
  {
    id: "admin-archive",
    label: "Admin: Archiv",
    keywords: ["archiv", "restore", "wiederherstellen", "geloescht", "gelöschte teams", "papierkorb"],
    icon: "♻️",
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
  "messages",
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
      if (item.id === "orga-links" && !(can("team.view.all") || can("results.edit"))) return false;
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
