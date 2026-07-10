# SESSION_HANDOFF

Stand: 2026-07-10 12:50 UTC

## Read First: Scope-Guard / Domaenenkanon

- S5Evo bildet den konkret definierten Vereins-/Wettkampf-Scope ab, nicht "moderner Fuenfkampf" allgemein.
- Gueltige Disziplin-Codes im aktuellen System sind ausschliesslich: `RUN`, `BENCH`, `STOCK`, `ROAD`, `MTB`.
- Keine extern abgeleiteten Sportarten oder olympischen/modernen Fuenfkampf-Disziplinen vorschlagen, insbesondere nicht Fechten, Schiessen oder Reiten.
- Wenn Disziplinen im UI oder in Anforderungen erwaehnt werden, muessen sie aus Systemdaten/Config oder dieser Kanonliste kommen.
- Bei unklarer Fachlichkeit generische Begriffe nutzen: Disziplin, Station, Wertung, Teilnehmer.
- Abkuerzung: `MD` = Mannschafts-Dashboard.
- Mannschaft = Team im Wettkampf; Startnummer = `Team.startNumber` / `team_startnummer`, nicht Teilnehmer-Startnummer.
- Klasse ist eine eigene Team-Eigenschaft und kein Bestandteil des Mannschaftsnamens.

## Kurzfazit

- `portal.s5evo.de` ist stabil und produktiv auf dem aktuellen Stand.
- MD-Listen-Spalten und MD Control Strip Cleanup sind deployed.
- MD-Mobile-Screenshot zeigte Schnellfilter-Popover-Clipping; lokaler Hotfix ist umgesetzt, TypeScript/Build sind gruen und Deploy-Freigabe ist offen.
- Live-Route sortiert Klassen in Teams, Startlisten und Ergebnissen einheitlich: SA, SB, J, DA, DB, HA, HB, HC.
- Startnummern wurden erfolgreich von Teilnehmer-Ebene auf Mannschaft-Ebene umgestellt.
- Umstellung wurde kontrolliert in sicherer Reihenfolge durchgezogen: Code -> Deploy -> DB-Migration -> Smoke.
- App-Commit `82f23fc Improve MD list controls` wurde nach `origin/main` gepusht und produktiv deployed.

## Aktueller Git-Stand

- Aktiver Branch: `main`
- App-Deploy-Commit: `82f23fc Improve MD list controls`
- Lokaler uncommitted Hotfix:
  - `app/components/dashboard.tsx`
  - `docs/cr/2026-07-10-md-mobile-quickfilter-hotfix.md`
  - `SESSION_HANDOFF.md`
  - Checks: `npx tsc --noEmit` gruen, `npm run build` gruen, `git diff --check` gruen.
- Letzte relevante Commits:
  - `82f23fc` Improve MD list controls
  - `36efa09` Add saved dashboard layouts
  - `9343a54` Require contact phone for marketplace registrations
  - `01d7418` Sort live classes consistently
  - `8f546e8` Move start numbers from participants to teams

## Produktivstand / Deployments

- Aktueller Production Deploy:
  - Deployment: `dpl_CK4L1aEchd3iDCN6WFeprXNkNgBW`
  - URL: `https://s5-evo-portal-cecs2zc88-sebastiankroeker-2781s-projects.vercel.app`
  - Alias: `https://portal.s5evo.de`
  - Status: `READY`
- Post-Deploy Smoke:
  - `npm run smoke:public` gruen
  - `/`, `/login`, `/anmeldung`, `/aenderungen`: 200
  - `/api/competition`: 200
  - `/api/results`: 200
  - `/api/teams` ohne Session: 401 (erwartet)
  - `/api/admin/pending-changes` ohne Session: 401 (erwartet)
  - `/sportlerboerse`: 200
  - `/sportlerboerse/mtc`: 200
  - `/api/dashboard-layouts` ohne Session: 401 (erwartet)
  - `/api/admin/teams-export` ohne Session: 401 (erwartet)
- Startnummern-Import-Route:
  - `GET /api/admin/start-numbers/import`: 405 (erwartet)
  - `POST /api/admin/start-numbers/import` ohne Session: 401 (erwartet)

## Was umgesetzt wurde (Live-Klassensortierung)

- Gemeinsamer Sortierhelper in `lib/domain/classification.ts`.
- Offizielle Reihenfolge: `schueler-a`, `schueler-b`, `jugend`, `damen-a`, `damen-b`, `jungsters`, `herren`, `masters`.
- `app/components/live-screen.tsx`:
  - Teams-Klassengruppen nach offizieller Reihenfolge.
  - Startlisten-Klassen innerhalb jeder Disziplin nach offizieller Reihenfolge.
  - alte ungenutzte Ergebnis-Placeholder-Funktion entfernt, da `ResultsView` aktiv genutzt wird.
- `app/api/results/route.ts`:
  - Ergebnis-Klassen werden API-seitig nach offizieller Reihenfolge sortiert.
- Checks:
  - `npx tsc --noEmit` gruen
  - `npm run build` gruen
  - `npm run smoke:public` gegen `https://portal.s5evo.de` gruen

## Was umgesetzt wurde (Startnummern)

## Phase A/B Vorarbeiten (bereits erledigt)

- `participants.startNumber` wurde initial eingefuehrt (Phase A/B).
- Danach wurde die fachliche Entscheidung getroffen: Startnummer gehoert auf Team-Ebene.

## Umstellung auf Team-Ebene (final)

- Prisma Schema:
  - `Team.startNumber String?` hinzugefuegt
  - `Participant.startNumber` entfernt
- Migration:
  - `prisma/migrations/20260630010500_move_start_number_to_team/migration.sql`
  - migriert vorhandene Teilnehmer-Startnummern deterministisch hoch auf Team (`MIN(startNumber)` je Team)
  - entfernt anschliessend `participants.startNumber` + Index
- API:
  - `POST /api/admin/start-numbers/import` schreibt jetzt auf `teams.startNumber`
  - primaeres CSV-Format: `team_id` + `team_startnummer`
  - Legacy weiter kompatibel:
    - `participant_id` + `startnummer`
    - `tn_XX_id` + `tn_XX_startnummer`
  - Legacy-Werte werden teamweise aufgeloest; Konflikte werden sauber als 400 gemeldet
- Export:
  - CSV enthaelt `team_startnummer`
  - `tn_XX_startnummer` wurde entfernt
  - betrifft Admin-Download und Daily-Orga-Mail-Export

## DB-Operationen

- Migrationen erfolgreich angewendet mit:
  - `npx prisma migrate deploy`
- Zuletzt angewendete Migration:
  - `20260630010500_move_start_number_to_team`

## Wichtige Dateien der letzten Umstellung

- `prisma/schema.prisma`
- `prisma/migrations/20260630010500_move_start_number_to_team/migration.sql`
- `app/api/admin/start-numbers/import/route.ts`
- `lib/team-csv-export.ts`
- `app/api/admin/teams-export/route.ts`
- `lib/mail/daily-orga-export.ts`

## Operative Leitplanken (weiterhin gueltig)

- Keine breiten Sammel-Deploys aus grossen Recovery-Branches.
- Immer kleine isolierte Pakete.
- Bei DB-relevanten Aenderungen:
  1. Schema/Migration bereitstellen
  2. deployen
  3. Migration ausfuehren
  4. Smoke pruefen
- Nach jedem Production Deploy:
  - `npm run smoke:public`
  - API-Route aktiv pruefen (nicht nur `/`)

## Offene / naechste sinnvolle Schritte

1. Optional: Kurze fachliche Abnahme mit echtem Import-CSV (`team_id;team_startnummer`) im Admin-Flow.
2. Optional: Kleine Admin-UI fuer Team-Startnummern (anzeigen/bearbeiten), falls operativ gewuenscht.
3. Optional: Doku fuer externes Zeiterfassungs-/Auswerte-Backend aktualisieren (CSV-Vertrag mit `team_startnummer`).
4. CR-Methodik schrittweise nutzen: Skill `skills/s5evo-change-request/SKILL.md`, Template `docs/cr/_template.md`, erster CR `docs/cr/2026-07-09-marketplace-contact-phone.md`.
5. Layout-CR fuer ALV-artige Layouts im Mannschafts-Dashboard: `docs/cr/2026-07-09-dashboard-saved-layouts.md`. Implementierung ist deployed; Migration und Smoke waren gruen.
6. Neuer UI-Folgepunkt Mannschafts-Dashboard Listenansicht:
   - Startnummer anzeigen.
   - Teilnehmer je Disziplin als eigene Spalte anzeigen.
   - Spalten-Reihenfolge anpassbar machen.
   - Klasse aus der Spalte Mannschaftsname entfernen; Klasse separat als Spalte/Filter fuehren.
   - Filter und Listenoptionen kompakt halten: Suche sichtbar, Filter/Spalten/Export als Icon-Buttons oder Dropdowns.
   - Status 2026-07-10: deployed mit `82f23fc`; TypeScript/Build und Post-Deploy-Smoke gruen.

## Was umgesetzt wurde (Kontakttelefonnummer)

- MTC/unvollstaendige Mannschaft und Sportlerboerse-Einzelanmeldung verlangen jetzt eine Telefonnummer.
- Technischer Speicherort: bestehendes Feld `Team.contactPhone`; keine Prisma-Migration noetig.
- Normale Mannschaftsanmeldung bleibt ohne Telefonnummer.
- Anonymer MTC-Link zeigt und speichert die Telefonnummer.
- Relevante Checks:
  - `npx tsc --noEmit` gruen
  - `npm run build` gruen
  - `npm run verify:participant-edit-flow` gruen
  - `npm run smoke:public` gegen `https://portal.s5evo.de` gruen

## CR-/Skill-Methodik

- Neuer Skill: `skills/s5evo-change-request/SKILL.md`.
- Neuer Standard: produktrelevante Aenderungen bekommen ein CR-Dokument unter `docs/cr/`.
- Pflicht-Gates vor Modellwechsel, Subagent-Delegation, Production Deploy, DB-Migration, Produktionsdatenmutation und externen Nachrichten.
- Modellwechsel sollen kuenftig ueber explizite `Implementation Handoff`-Bloecke im CR erfolgen, nicht ueber implizites Chat-Gedaechtnis.
- Template/Skill wurden beim Layout-CR erweitert um `Data / API Design`, `Open Questions` und `Model / Subagent Plan`.

## Was deployed wurde (Dashboard-Layouts)

- Neues Prisma-Modell `DashboardLayout` mit `tenantId`, optionaler `competitionId`, Scope `PERSONAL/GLOBAL`, versionierter JSON-Konfiguration und Soft Delete.
- Migration vorbereitet: `prisma/migrations/20260709214500_add_dashboard_layouts/migration.sql`.
- Neue Layout-API:
  - `GET/POST /api/dashboard-layouts`
  - `PATCH/DELETE /api/dashboard-layouts/[id]`
- Mannschafts-Dashboard:
  - Layout-Auswahl, Name, Typ, Neu/Speichern/Loeschen.
  - Persoenliche Layouts fuer berechtigte Nutzer.
  - Globale Layouts nur ADMIN-only schreibbar.
  - Layout speichert Ansicht, sichtbare Spalten, Sortierung und Export-Spalten, aber keine Filter.
- CSV:
  - Bestehender `GET /api/admin/teams-export` bleibt Full Competition Export.
  - Neuer Layout-Export via `POST /api/admin/teams-export` nutzt `layoutId` + gefilterte Team-IDs.
  - Serverseitige Export-Allowlist `TEAM_EXPORT_COLUMN_DEFINITIONS`; keine freien JSON-Datenpfade.
- Lokale Checks:
  - `npx prisma validate` gruen
  - `npx prisma generate` gruen
  - `npx tsc --noEmit` gruen
  - `npm run build` gruen
  - Inline-`tsx` Check fuer Layout-Sanitization und CSV-Allowlist gruen
  - `git diff --check` gruen
- Commit: `36efa09 Add saved dashboard layouts`
- Production Deploy:
  - Deployment-ID: `dpl_EAtRbHGp4vntJ54oT5djDUemUKf8`
  - Vercel-URL: `https://s5-evo-portal-die3r3mq3-sebastiankroeker-2781s-projects.vercel.app`
  - Alias: `https://portal.s5evo.de`
  - Ready-State: `READY`
- Production Migration:
  - `npx prisma migrate deploy` hat `20260709214500_add_dashboard_layouts` erfolgreich angewendet.
- Post-Deploy Smoke:
  - `npm run smoke:public` gruen
  - `/sportlerboerse` 200
  - `/sportlerboerse/mtc` 200
  - `/api/dashboard-layouts` ohne Session 401 erwartet
  - `/api/admin/teams-export` ohne Session 401 erwartet

## Lokale Notizdateien (bewusst untracked)

- `AGENTS.md`
- `HEARTBEAT.md`
- `MEMORY.md`
- `SOUL.md`
