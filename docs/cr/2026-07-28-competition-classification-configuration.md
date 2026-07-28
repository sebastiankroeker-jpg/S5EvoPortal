# CR: Wettkampfspezifische Klassenkonfiguration

Status: Feature deployed; 2026 class-data backfill pending separate approval
Date: 2026-07-28
Type: schema + feature
Risk: high
Owner: S5Evo

## Context

Die Clone-Vorschau für 2026 zeigt zutreffend `0 Klassen`, weil der aktive
Wettkampf noch keine `Classification`-Stammdaten besitzt. Die fachlich
wirksame Klassenlogik (Jugendjahrgänge, Damen und Gesamtalter) ist bislang
statisch im Code definiert. Eine reine Pflegeoberfläche für die vorhandene
Tabelle wäre deshalb irreführend: Änderungen hätten die Anmeldung,
Teamänderungen, Ergebnisdarstellung und Zeitnahme nicht zwingend gesteuert.

Sebastian hat entschieden, Klassen künftig pro Wettkampf zu pflegen. Das wird
vor dem Anlegen des 2027-Entwurfs und vor dem Navigation-/IA-CR umgesetzt.

## Scope

- In scope:
  - `Classification` wird die fachlich wirksame, wettkampfspezifische
    Regelquelle für die bestehenden Klassenarten: Jugend nach individuellem
    Alter/Jahrgang, Damen nach Gesamtalter sowie offene Herrenklassen nach
    Gesamtalter.
  - Die heutigen 2026-Regeln werden verlustfrei als acht editierbare
    Klassenzeilen modelliert.
  - Anmeldung, Team-/Teilnehmeränderungen, MTC, Börse, Ergebnisse und
    Zeitnahme erhalten dieselbe Klassenkonfiguration statt voneinander
    abweichender Code-Listen.
  - Der Clone kopiert Klassen inklusive Sortierung und Anzeigeinformation.
  - Admin-Pflege wird pro aktivem Wettkampf abgesichert und darf weder Teams
    noch Personen umklassifizieren, ohne dass dies explizit in einem späteren
    Daten-Gate entschieden wird.
- Out of scope:
  - Kein Anlegen eines 2027-Wettkampfs.
  - Keine automatische Umklassifizierung von Teams oder Ergebnisdaten.
  - Keine 2024-Tenant-Konsolidierung.
  - Keine beliebige Skriptsprache oder frei programmierbare Regeln. Das
    unterstützte Modell bildet die heute verwendeten Regelarten vollständig
    ab; neue Regeltypen sind ein separater Designentscheid.

## Affected Flows

- User/API/admin flows touched: öffentliche Anmeldung, Team- und
  Teilnehmerbearbeitung, Änderungsanträge, MTC, Sportlerbörse, Ergebnisse,
  Zeitnahme, Clone-Vorschau und Admin-Wettkampfverwaltung.
- Data model impact: additive Metadaten auf `Classification`; die vorhandene
  Tabelle bleibt pro Wettbewerb eindeutig nach `code`.
- Auth/permission impact: Lesen der aktiven Wettkampfkonfiguration ist Teil
  der ohnehin öffentlichen Wettkampfangaben; Schreiben bleibt strikt
  `ADMIN`- und `competitionId`-gebunden.
- Sensitive data impact: Geburtstage/-jahre werden weiterhin nur zur
  serverseitigen Berechnung verwendet. Die Klassenkonfiguration enthält keine
  personenbezogenen Daten.
- Offline/cache/export/log/mail impact: keine neuen Geburtsdaten in Cache,
  Export, Mail oder technische Logs. Nur nicht-sensitive Klassenmetadaten
  dürfen im bestehenden Wettkampf-Lesemodell erscheinen.
- Production/deploy impact: additive Migration und ein separater,
  bestätigungspflichtiger Daten-Backfill für 2026 sind erforderlich. Dieser
  lokale CR-Schritt führt beides nicht aus.

## Privacy / Security Review

- Sensitive fields touched: Geburtsjahr/-datum beeinflusst weiterhin die
  Klassenberechnung, wird aber nicht in Klassenstammdaten gespeichert.
- Purpose / data minimization: Berechnung braucht nur das bereits vorhandene
  Geburtsjahr und liefert Klasse/Gesamtalter; keine neue PII-Ausgabe.
- Visibility by role/user/API/UI: Konfiguration ist nicht sensitiv. Bestehende
  Teilnehmerdaten bleiben in ihren bisherigen rollen- und publication-
  gefilterten Serializern.
- Persistence locations: Klassenregeln in PostgreSQL; kein neues
  `localStorage`, IndexedDB, Audit-Payload oder externes System.
- Offline/cache behavior: keine Änderung der Offline-Payloads mit
  Geburtsdaten; eine etwaige Konfiguration im öffentlichen Wettbewerbspayload
  enthält nur Codes, Labels und Altersgrenzen.
- Logs/mails/exports/screenshots exposure: keine Personen- oder
  Geburtsdatenwerte loggen; Klassen-Codes sind erlaubt.
- Negative checks for unauthorized access or payload leakage: geschützte
  Admin-Schreibroute muss ohne Sitzung 401/403 liefern; öffentliche
  Wettkampfroute darf ausschließlich Regelmetadaten liefern.
- Authenticated smoke plan or explicit gap: vor Release mit Admin eine
  Konfiguration lesen/bearbeiten und mit nicht-admin eine Ablehnung prüfen.
- Residual risk: Ein produktiver Backfill kann die Regelquelle für bestehende
  Teams umstellen. Deshalb getrenntes Daten-Gate sowie 2026-Regression und
  Vorher-/Nachher-Zählung.

## Data / API Design

- Proposed data model: Bestehende `Classification`-Zeilen erhalten
  `sortOrder` und optionales `displayEmoji`. `type`, `minAge`, `maxAge` und
  `genderRestriction` bilden die bewährten Regeln ab:
  `AGE_INDIVIDUAL` für Jugend, `AGE_TEAM` für Gesamtalter und
  `FEMALE_ONLY` für Damen.
- Proposed API shape: der öffentliche Wettkampf-Read liefert ausschließlich
  die geordnete Klassenbeschreibung. Eine gesonderte Admin-Route liest und
  ersetzt die vollständige Konfiguration nur für den durch `competitionId`
  aufgelösten Wettbewerb.
- Backward compatibility: Bis ein Wettbewerb Klassenzeilen besitzt, wird
  exakt die bisherige, wettkampfjahrabhängige 2026-Referenzlogik verwendet.
  Sobald Klassen konfiguriert sind, sind diese autoritativ.
- Migration/data backfill: Schema-Migration ist additiv. Der 2026-Backfill
  wird nicht automatisch durch die Migration ausgeführt und braucht vor
  Produktion eine eigene Freigabe.

## Business Invariants

- `Competition.year` bleibt das Referenzjahr für Alter und Jugendkohorten.
- Jugendklasse: alle fünf Mitglieder müssen in den konfigurierten
  Jugend-Altersbereichen liegen; das älteste Mitglied bestimmt die Klasse.
- Erwachsenklasse: ausschließlich weibliche Teams werden zunächst gegen die
  Damen-Gesamtalterklassen geprüft; alle übrigen Teams gegen die offenen
  Gesamtalterklassen.
- Ein Wettbewerb ohne gespeicherte Klassen nutzt nur bis zum expliziten
  Backfill die historisch identische Fallback-Konfiguration.
- Clone kopiert Klassenregeln, aber niemals Teams, Personen oder Ergebnisse.

## Acceptance Criteria

- Die 2026-Fallback- und gespeicherte 2026-Konfiguration klassifizieren die
  vorhandene Testmatrix identisch.
- 2027 verschiebt Jugendjahrgänge mit dem Wettbewerbjahr, ohne 2026 zu
  verändern.
- Eine geänderte Klassenzeile für einen Wettbewerb wirkt in Servervalidierung
  und Client-Vorschau gleich.
- Zeitnahme und Ergebnisse beziehen Labels/Reihenfolge aus der
  Wettkampfkonfiguration, nicht aus einer separaten statischen Liste.
- Clone-Vorschau zählt gespeicherte Klassen korrekt und Clone kopiert alle
  Klassenmetadaten.

## Implementation Handoff

- Relevant files: `prisma/schema.prisma`, `lib/domain/classification.ts`,
  `lib/competition-clone.ts`, Wettkampf-/Team-/Teilnehmer-/Zeitnahme- und
  Ergebnis-APIs sowie Admin- und Anmeldeoberflächen.
- Current decisions: vorhandene Tabelle wird erweitert statt ein paralleles
  Modell einzuführen; die acht heutigen Klassen bleiben in Codes und Regeln
  reproduzierbar.
- Non-goals: kein Produktions-Backfill, kein 2027-Draft, keine Migration oder
  Veröffentlichung in diesem Arbeitsabschnitt.
- Required checks: Klassifikationsmatrix 2026/2027, Clone-Guard,
  TypeScript, Prisma-Validierung, ESLint und Production-Build.
- Context read before implementation:
  - `SESSION_HANDOFF.md` top block
  - `docs/cr/2026-07-27-competition-clone-2027-prep.md`
  - `lib/domain/classification.ts`, `prisma/schema.prisma`, Clone-Service,
    Team- und Wettkampf-APIs

## Confirmation Gate

- Gate needed: yes
- Reason: additive Schema-Migration, späterer Produktionsdaten-Backfill und
  produktionswirksame Klassenregeln.
- Approved by: Sebastian, local implementation only
- Approval timestamp: 2026-07-28 UTC

## Implementation Notes

- Files changed:
  - additive schema migration for `Classification.sortOrder` and
    `Classification.displayEmoji`;
  - shared, serializable rule model in `lib/competition-classifications.ts`;
  - classification engine now selects from persisted competition rules and
    falls back only for competitions that have no rows yet;
  - registration, direct team edits, participant recalculation, participant
    edit validation, MTC, marketplace finalization, approval preview,
    results and timekeeping consume the shared rule source;
  - admin class editor and a competition-scoped admin API;
  - clone retains the new metadata; public competition read exposes only
    non-sensitive class configuration.
- Important decisions during implementation:
  - The default configuration contains eight assigning classes and two
    explicit combined result groups. This preserves current 2026 behavior
    while making result aggregates cloneable/configurable.
  - An API write is fail-closed when a competition already has teams. The
    only allowed live-team backfill is an exact copy of the verified legacy
    configuration into a competition that still has zero stored rows.
  - No migration includes `INSERT`s. A production backfill cannot occur as a
    side effect of application deployment.

## Verification

- Local checks:
  - `npm run lint` — passed.
  - `npx tsc --noEmit` — passed.
  - `git diff --check` — passed.
  - `npm run verify:team-draft` — passed; 2026 parity, 2027 cohort shift and
    persisted-boundary override are covered.
  - `npm run verify:competition-classifications` — passed; schema/clone,
    authoritative configured boundary, admin scope marker and timekeeping
    integration are covered.
  - `npm run verify:competition-clone` — passed.
  - `npm run verify:tenant-scope` — passed; all 80 API routes are classified.
- Build:
  - `npm run build` — passed; the new admin classification route is present
    in the production route manifest.
- Sensitive-data negative checks:
  - No participant fields were added to public configuration payloads,
    browser cache, logs or exports by code review and API shape.
- Authenticated role smoke:
  - Pending release. Required after deploy: Admin reads the active 2026
    fallback, performs the separately approved exact backfill, and verifies
    an unauthenticated write is rejected.

## Deploy

- Deployment needed: yes — completed.
- Functional commit: `efe5302 feat: configure classifications per competition`.
- Production migration: `20260728133000_add_competition_classification_metadata`
  applied successfully. It is additive only and contains no data writes.
- Deployment ID: `dpl_9s5s3yYcSW349kjPSsMn8ZR3Uau6`.
- Deployment URL:
  `https://s5-evo-portal-1sg7io8ll-sebastiankroeker-2781s-projects.vercel.app`.
- Production alias: `https://portal.s5evo.de` — READY.
- Deployed at: 2026-07-28 UTC.

## Post-Deploy Smoke

- Public smoke: passed (`/`, `/login`, `/anmeldung`, `/aenderungen`, public
  competition/results API and legacy-domain redirect).
- Protected API smoke: existing Teams/Pending Changes endpoints return 401
  without a session; the new class-admin endpoint returns 401 without a
  session.
- Public configuration shape: `/api/competition` returns the non-sensitive
  ten-rule fallback shape only (code, label/rule metadata); no participant
  data is present.
- Production inventory, aggregate only: 2024 CLOSED has 10 historical class
  rows; 2026 OPEN has 0 rows. The migration did not create or modify either
  set.
- Result: feature is live; no 2026 class data has been backfilled.

## Follow-Ups

- Separate explicit release gate: migration, complete commit/push,
  Vercel production deploy and smoke.
- Separate explicit production-data gate: write the reviewed exact 2026
  class configuration and perform an authenticated registration, timekeeping
  and result regression smoke before any custom 2026 rule change.
