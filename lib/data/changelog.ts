export type ChangelogEntry = {
  version: string;
  date: string;
  items: string[];
};

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "v0.2.0",
    date: "2026-03-22",
    items: [
      "Disziplinbasierte Registrierung inkl. Teamchef-Autoübernahme",
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
