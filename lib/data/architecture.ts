export type PersonaId = "admin" | "teamchef" | "athlete" | "moderator";
export type PersonaFilter = "all" | PersonaId;

export type Persona = {
  id: PersonaId;
  label: string;
  icon: string;
  description: string;
};

export type DiagramNode = {
  id: string;
  label: string;
  description: string;
  kind: "persona" | "service" | "data";
  x: number;
  y: number;
  width: number;
  audience: PersonaFilter[];
};

export type DiagramEdge = {
  from: string;
  to: string;
  label?: string;
  audience: PersonaFilter[];
};

export type DataAsset = {
  id: string;
  title: string;
  description: string;
  purpose: string;
  storage: string;
  retention: string;
  access: Record<PersonaId, string>;
};

export const personas: Persona[] = [
  {
    id: "admin",
    label: "Administrator",
    icon: "⚙️",
    description: "Konfiguriert Wettkämpfe, Rollen und Datenflüsse."
  },
  {
    id: "teamchef",
    label: "Teamchef/Betreuer",
    icon: "🧢",
    description: "Meldet Mannschaften an, pflegt Teilnehmer & Disziplinen."
  },
  {
    id: "athlete",
    label: "Athlet/Zuschauer",
    icon: "🏃",
    description: "Gibt Consent, sieht Ergebnisse & Live-Ticker."
  },
  {
    id: "moderator",
    label: "Moderator",
    icon: "🎤",
    description: "Erfasst Ergebnisse, veröffentlicht Zwischenstände."
  }
];

export const diagramNodes: DiagramNode[] = [
  {
    id: "admin",
    label: "Administrator",
    description: "Konfiguration & Aufsicht",
    kind: "persona",
    x: 80,
    y: 40,
    width: 180,
    audience: ["all", "admin"]
  },
  {
    id: "teamchef",
    label: "Teamchef",
    description: "Mannschaft & Disziplin",
    kind: "persona",
    x: 340,
    y: 40,
    width: 180,
    audience: ["all", "teamchef"]
  },
  {
    id: "athlete",
    label: "Athlet",
    description: "Consent & Self-Service",
    kind: "persona",
    x: 600,
    y: 40,
    width: 180,
    audience: ["all", "athlete"]
  },
  {
    id: "moderator",
    label: "Moderator",
    description: "Live-Ergebnisse",
    kind: "persona",
    x: 860,
    y: 40,
    width: 180,
    audience: ["all", "moderator"]
  },
  {
    id: "authentik",
    label: "Authentik",
    description: "SSO, MFA, Rollen",
    kind: "service",
    x: 200,
    y: 190,
    width: 200,
    audience: ["all", "admin", "teamchef", "athlete", "moderator"]
  },
  {
    id: "portal",
    label: "S5Evo Portal (Next.js)",
    description: "UI, Registrierung, Dashboard",
    kind: "service",
    x: 470,
    y: 190,
    width: 240,
    audience: ["all", "admin", "teamchef", "athlete", "moderator"]
  },
  {
    id: "prisma",
    label: "Prisma API",
    description: "Validierung & Business Logic",
    kind: "service",
    x: 780,
    y: 190,
    width: 200,
    audience: ["all", "admin", "teamchef", "moderator"]
  },
  {
    id: "postgres",
    label: "Postgres",
    description: "Teams, Teilnehmer, Ergebnisse",
    kind: "data",
    x: 280,
    y: 330,
    width: 220,
    audience: ["all", "admin", "teamchef", "moderator"]
  },
  {
    id: "files",
    label: "IONOS Deploy",
    description: "Öffentliches Frontend / Static",
    kind: "data",
    x: 560,
    y: 330,
    width: 220,
    audience: ["all", "admin", "teamchef", "athlete", "moderator"]
  },
  {
    id: "analytics",
    label: "Logs & Audit",
    description: "Zugriffsprotokolle, Fehler",
    kind: "data",
    x: 840,
    y: 330,
    width: 220,
    audience: ["all", "admin"]
  }
];

export const diagramEdges: DiagramEdge[] = [
  { from: "admin", to: "authentik", label: "Rollen & Policies", audience: ["all", "admin"] },
  { from: "teamchef", to: "authentik", label: "Login", audience: ["all", "teamchef"] },
  { from: "athlete", to: "portal", label: "Consent, Ergebnisse", audience: ["all", "athlete"] },
  { from: "moderator", to: "portal", label: "Erfassung", audience: ["all", "moderator"] },
  { from: "authentik", to: "portal", label: "OIDC Token", audience: ["all"] },
  { from: "portal", to: "prisma", label: "API Calls", audience: ["all"] },
  { from: "prisma", to: "postgres", label: "Persistenz", audience: ["all"] },
  { from: "portal", to: "files", label: "Static Assets", audience: ["all"] },
  { from: "prisma", to: "analytics", label: "Audit Logs", audience: ["all", "admin"] }
];

export const dataAssets: DataAsset[] = [
  {
    id: "team-data",
    title: "Team- & Teilnehmerdaten",
    description: "Namen, Jahrgänge, Kontaktdaten, Disziplin-Zuteilung",
    purpose: "Anmeldung, Klassifikation, Ergebnis-Reporting",
    storage: "Postgres (Vercel) + verschlüsselte Backups",
    retention: "Löschung 30 Tage nach Wettkampfabschluss oder auf Anfrage",
    access: {
      admin: "Vollzugriff",
      teamchef: "Bearbeiten eigener Teams",
      athlete: "Lesen eigener Daten",
      moderator: "Lesen für Ergebnis-Erfassung"
    }
  },
  {
    id: "auth-data",
    title: "Login & Rollen",
    description: "Authentik-Accounts, MFA-Status, Gruppen",
    purpose: "Identity & Access Management",
    storage: "Authentik (IONOS VPS)",
    retention: "Solange Account aktiv, danach 7 Tage",
    access: {
      admin: "IAM-Verwaltung",
      teamchef: "Eigener Account",
      athlete: "Eigener Account",
      moderator: "Eigener Account"
    }
  },
  {
    id: "results",
    title: "Ergebnisse & Wertungen",
    description: "Disziplinwerte, Punkte, Gesamtlisten",
    purpose: "Live-Visualisierung & Historie",
    storage: "Postgres + Static Export",
    retention: "Historisch (öffentlich) bis neuer Wettkampf",
    access: {
      admin: "Vollzugriff",
      teamchef: "Lesen",
      athlete: "Lesen",
      moderator: "Schreiben/Veröffentlichen"
    }
  }
];
