export type ChangelogEntry = {
  version: string;
  date: string;
  items: string[];
};

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "v0.6.0",
    date: "2026-05-31",
    items: [
      "Live-Test-Stand: rollenbasierte Team- und Detailansichten für Admin, Moderator:in, Team Manager:in und Teilnehmer:in geschärft",
      "Datenschutzgrenzen serverseitig nachgezogen: sensible Teilnehmerfelder bleiben Admin-only",
      "Orga- und Moderationslisten als Arbeitsflächen ausgebaut, inklusive interner Hinweise und Druckansicht",
      "Feedback-Kanal geöffnet: angemeldete Rollen können Requests und Fehler direkt im Portal erfassen",
      "Nächster Fokus: Zieleinlauf, Ergebnis-Erfassung und Live-Dashboard als zusammenhängender Wettkampffluss",
    ],
  },
  {
    version: "v0.5.0",
    date: "2026-03-24",
    items: [
      "Bottom Tab Bar Navigation (Mobile-first, 🏠📋🏆🧑‍🤝‍🧑)",
      "Home-Screen mit Wettkampf-Übersicht und Quick-Actions",
      "Hero-Header, Theme-Buttons und redundante Tabs entfernt",
      "Clean Layout: Header + Content + Tab Bar (3 Layer statt 7)",
      "Live-Ergebnisse Placeholder",
      "Role-Switcher nur noch im Admin-Bereich",
    ],
  },
  {
    version: "v0.4.0",
    date: "2026-03-23",
    items: [
      "Command Pill Navigation (Vercel-inspiriert, Mobile-first)",
      "Permission-System mit rollenbasierten Berechtigungen",
      "Role-Switcher zum Testen verschiedener Ansichten",
      "Rollenbasierte UI (Admin, Moderator, Team Manager:in, Teilnehmer, Zuschauer)",
      "Navbar verschlankt, Referenzarchitektur-Link entfernt",
      "Admin-Bereich nur für ADMIN-Rolle zugänglich",
      "Profil-Seite mit Konto-Verwaltung",
    ],
  },
  {
    version: "v0.3.0",
    date: "2026-03-23",
    items: [
      "Admin-Seite für Tenant- und Wettkampf-Parameter (/admin)",
      "Eigene Changelog-Seite (/changelog) mit Versionshistorie",
      "Versionsnummer konsistent in Navbar und Footer (aus lib/version.ts)",
      "Version als Link zur Changelog-Seite",
      "Prisma Migration auf Prisma Postgres (DB-Persistenz aktiv)",
    ],
  },
  {
    version: "v0.2.0",
    date: "2026-03-22",
    items: [
      "Disziplinbasierte Registrierung inkl. Team-Manager-Autoübernahme",
      "2026-Klassifizierung + Besitzer-Filter im Dashboard",
      "Referenzarchitektur-Seite veröffentlicht",
    ],
  },
  {
    version: "v0.1.0",
    date: "2026-03-21",
    items: [
      "ESV-Mode, Sys-Admin-Mode und shadcn/ui Redesign",
      "Prisma-Schema für Teams/Teilnehmer mit Soft-Delete",
      "Auth-Integration über Authentik",
    ],
  },
];
