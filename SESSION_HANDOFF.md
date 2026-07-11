# SESSION_HANDOFF

Stand: 2026-07-11 12:15 UTC

## Aktueller Nachtrag: User Dashboard Filter And Sort Follow-Up

- App-Commit `fe7cd2c Add user dashboard filters and sorting` ist auf `origin/main` gepusht und produktiv deployed.
- Production Deploy: `dpl_H83dicV1PDv6xfp1c9ZgDt351Kmg`
- Deployment URL: `https://s5-evo-portal-kmuz04wtn-sebastiankroeker-2781s-projects.vercel.app`
- Alias: `https://portal.s5evo.de`
- CR: `docs/cr/2026-07-11-user-dashboard-filter-and-sort-followup.md`
- Geaendert:
  - Benutzer-Stats `Admins`, `Moderatoren`, `Teamchef:innen` und `Online` sind jetzt als Filter klickbar.
  - Filterpanel enthaelt jetzt Mail-Status `mit E-Mail` / `ohne E-Mail`.
  - Filterpanel enthaelt jetzt Portal-Verknuepfungsstatus `Verknüpft`, `Konto ohne Link`, `Einladung offen`, `Placeholder`, `Klärfall`.
  - Ergebnisliste kann jetzt nach `Zuletzt aktiv zuerst`, `Name A-Z`, `Neueste Registrierung` und `Meiste Teams zuerst` sortiert werden.
- Checks:
  - `pnpm exec eslint app/components/user-management.tsx` gruen
  - `npx tsc --noEmit` gruen
  - `git diff --check` gruen
  - `npm run build` gruen
  - `npm run smoke:public` gegen Production-Alias gruen
  - `/admin`: 200

## Aktueller Nachtrag: Reusable Dashboard Control Strip

- App-Commit `851fb59 Add reusable dashboard control strip` ist auf `origin/main` gepusht und produktiv deployed.
- Production Deploy: `dpl_AQ213NzUxueW2wd7tUbW6FWaiftf`
- Deployment URL: `https://s5-evo-portal-ero9di4ob-sebastiankroeker-2781s-projects.vercel.app`
- Alias: `https://portal.s5evo.de`
- CR: `docs/cr/2026-07-11-reusable-dashboard-control-strip.md`
- Geaendert:
  - neue Shared-UI-Bausteine fuer Suche, Stats, Toolbar, Toolbar-Buttons und aufklappbare Panels
  - Teilnehmer-Dashboard nutzt jetzt dasselbe `Suche -> Stats -> Toolbar -> Panels`-Muster wie das Mannschafts-Dashboard
  - Aenderungs-Dashboard nutzt jetzt denselben Control-Strip mit klickbaren Status-/Update-Pillen
  - Benutzer-Dashboard ist strukturell auf denselben Strip gehoben und hat jetzt konsistente Suche, Stats, Toolbar und Filterpanel
  - Panel-Icons sind nur im offenen Zustand aktiv eingefaerbt; geschlossene Panels zeigen Aktivitaet ueber Badge/Count
- Checks:
  - `pnpm exec eslint app/components/dashboard-controls.tsx app/components/participant-list.tsx app/components/approval-queue.tsx app/components/user-management.tsx` mit 2 bestehenden Hook-Warnungen, keine neuen Errors
  - `npx tsc --noEmit` gruen
  - `git diff --check` gruen
  - `npm run build` gruen
  - `npm run smoke:public` gegen Production-Alias gruen
  - `/admin`: 200
  - `/teilnehmer`: 200
  - `/aenderungen`: 200

## Aktueller Nachtrag: MD Stats Row And Filter Icon State

- App-Commit `df99bc1 Fix dashboard stats row and filter icon state` ist auf `origin/main` gepusht und produktiv deployed.
- Production Deploy: `dpl_9NiKXJytAWZDantdkKDiun3Myarc`
- Deployment URL: `https://s5-evo-portal-ec3r4whu1-sebastiankroeker-2781s-projects.vercel.app`
- Alias: `https://portal.s5evo.de`
- CR: `docs/cr/2026-07-11-md-stats-row-and-filter-icon-state.md`
- Geaendert:
  - Trefferstatistik steht jetzt als eigene Zeile direkt unter dem Suchfeld und oberhalb der Panel-Icons.
  - Filter-Icon nutzt im zugeklappten Zustand wieder das geschlossene Farbschema.
  - Aktive Filter bleiben bei geschlossenem Panel weiter ueber den Counter-Badge sichtbar.
- Checks:
  - `pnpm exec eslint app/components/dashboard.tsx` gruen
  - `npx tsc --noEmit` gruen
  - `git diff --check` gruen
  - `npm run build` gruen
  - `npm run smoke:public` gegen Production-Alias gruen
  - `/sportlerboerse-dashboard`: 200

## Aktueller Nachtrag: MD Kombinierbare Klassenpillen

- App-Commit `1f58350 Add combinable dashboard class pills` ist auf `origin/main` gepusht und produktiv deployed.
- Production Deploy: `dpl_EccDbuSxTLc5urnfvdu3tqJqMBUH`
- Deployment URL: `https://s5-evo-portal-m01076f2j-sebastiankroeker-2781s-projects.vercel.app`
- Alias: `https://portal.s5evo.de`
- CR: `docs/cr/2026-07-11-md-combinable-class-pills.md`
- Geaendert:
  - Trefferstatistik steht jetzt direkt unter der Such-/Toolbar-Zeile und bleibt auch bei offenem Filterpanel sichtbar.
  - Klassenpillen in Statistik und Filterpanel sind jetzt kombinierbar statt nur einzeln waehlbar.
  - Das alte Klassen-Dropdown im Filterpanel ist entfernt.
  - Gespeicherte Legacy-Filter mit `categoryFilter` werden weiter geladen und auf `categoryFilters` uebernommen.
- Checks:
  - `pnpm exec eslint app/components/dashboard.tsx` gruen
  - `npx tsc --noEmit` gruen
  - `git diff --check` gruen
  - `npm run build` gruen
  - `npm run smoke:public` gegen Production-Alias gruen
  - `/sportlerboerse-dashboard`: 200

## Aktueller Nachtrag: MD List Default And Stats Order

- App-Commit `d524352 Tweak MD list defaults and stats order` ist auf `origin/main` gepusht und produktiv deployed.
- Production Deploy: `dpl_GrR8AGcTBx5eLXUMHN44cgU4WyPV`
- Deployment URL: `https://s5-evo-portal-ihc1jsrnt-sebastiankroeker-2781s-projects.vercel.app`
- Alias: `https://portal.s5evo.de`
- CR: `docs/cr/2026-07-10-md-list-default-and-stats-order.md`
- Geaendert:
  - Default-/Legacy-LocalStorage-Listenlayout entfernt die Sammelspalte `participants`/`Mitglieder`; Zeilen bleiben dadurch niedriger.
  - Die Spalte bleibt manuell ueber das Spaltenpanel waehlbar und gespeicherte Layouts bleiben unveraendert.
  - Trefferstatistik steht jetzt oberhalb der Zeile mit Ansicht/Suche/Filter/Layout-Buttons.
- Checks:
  - `npx tsc --noEmit` gruen
  - `npm run lint` gruen, nur bestehende 11 Warnungen
  - `npm run build` gruen
  - `npm run smoke:public` gegen Production-Alias gruen
  - `/sportlerboerse-dashboard`: 200

## Aktueller Nachtrag: Participant Replacement Flow

- Ersetzen-Flow ist produktiv deployed.
- App-Commit `1902498 Add participant replacement flow`
- Production Deploy: `dpl_2QT5BaiacdLvmpy7z5ydJrRnKjaV`
- Deployment URL: `https://s5-evo-portal-h8lwpzklz-sebastiankroeker-2781s-projects.vercel.app`
- Alias: `https://portal.s5evo.de`
- Neuer CR: `docs/cr/2026-07-10-participant-replacement-flow.md`
- Geaendert:
  - Orga/Admin-Team-Edit hat pro verankertem Teilnehmer die Aktion `Andere Person einsetzen`.
  - Markierte Zeilen werden beim Speichern nicht als Korrektur behandelt, sondern ersetzen die Teilnehmer-Identitaet.
  - API `PUT /api/teams/:id` akzeptiert im Admin-Direktpfad `replaceParticipant: true` pro Teilnehmer.
  - Alte Teilnehmer-ID wird archiviert (`deletedAt`), neue Teilnehmer-ID wird im selben Team/Disziplin-Slot angelegt.
  - Portal-Konto, Historie, Ergebnisse und Audit bleiben bei der alten ID; aktive Team-Manager-Rechte fuer dieses Team werden entzogen.
  - Offene PendingChanges/legacy ChangeRequests der alten ID werden als ueberholt abgelehnt.
  - Team-Manager/Self-Service kann `replaceParticipant` nicht nutzen (403).
- Checks lokal gruen:
  - `npx tsc --noEmit`
  - `npm run verify:participant-edit-flow`
  - `npm run verify:team-draft`
  - `npm run lint` mit bestehenden 11 Warnungen
  - `npm run build`
- Post-Deploy:
  - `npm run smoke:public` gruen gegen Production-Alias
  - `/sportlerboerse-dashboard`: 200
- Naechster Schritt:
  - UI fachlich mit echtem Team pruefen; spaeter optional Existing-Participant-Picker statt nur neue ID.

## Aktueller Nachtrag: Participant Identity Guardrails

- App-Commit `47015c8 Guard team edit participant identity changes` ist auf `origin/main` gepusht und produktiv deployed.
- Vorheriger App-Commit: `52709c1 Add participant identity guardrails`
- Production Deploy: `dpl_EFnHKkxmnwqDoheBMP3rNfHoAhrT`
- Deployment URL: `https://s5-evo-portal-7m3s4q9mq-sebastiankroeker-2781s-projects.vercel.app`
- Alias: `https://portal.s5evo.de`
- Geaendert:
  - Teilnehmer-Edit zeigt bei verankerten Datensaetzen, dass die Teilnehmer-ID beim Speichern erhalten bleibt.
  - Team-bearbeiten-Dialog zeigt dieselbe Guardrail pro verankertem Teilnehmer und fragt vor dem Speichern bei verdächtigem Personenwechsel nach.
  - Hinweis formuliert die Entscheidung klar: Korrektur hier speichern; andere Person nicht ueberschreiben, sondern Ersetzen-Flow nutzen.
  - Bestehende Aktion heisst nun korrekt `Konto-Verknuepfung loesen` statt `Teilnehmer ersetzen`.
  - Identitaetsfeld-Aenderungen an verankerten Teilnehmern zeigen vor dem Speichern eine Bestaetigung.
- Checks:
  - `npx tsc --noEmit` gruen
  - `npm run verify:participant-edit-flow` gruen
  - `npm run lint` gruen, nur bestehende 11 Warnungen
  - `npm run build` gruen
  - `npm run smoke:public` gegen Production-Alias gruen
  - `/sportlerboerse-dashboard`: 200
- CR: `docs/cr/2026-07-10-participant-identity-guardrails.md`
- Follow-up: echter Ersetzen-Flow mit neuer/anderer Teilnehmer-ID bleibt separate CR.

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
- MD-Listen-Spalten, MD Control Strip Cleanup, Trefferstatistik, mobile volle Icon-Breite, Filter/Sortier-Reset und aktive Toolbar-Kosmetik sind deployed.
- MD-Mobile-Folgefix ist produktiv: Statistik bleibt oberhalb aller Panels, wird nicht mehr im Filter-Panel dupliziert; mobile Tool-Icons nutzen die volle Breite als gleichmaessiges Grid; Stat-Pillen toggeln Klassen-/Gruppenfilter.
- Live-Route sortiert Klassen in Teams, Startlisten und Ergebnissen einheitlich: SA, SB, J, DA, DB, HA, HB, HC.
- Startnummern wurden erfolgreich von Teilnehmer-Ebene auf Mannschaft-Ebene umgestellt.
- Umstellung wurde kontrolliert in sicherer Reihenfolge durchgezogen: Code -> Deploy -> DB-Migration -> Smoke.
- App-Commit `eb1cbff Polish MD class sort and layout badge` wurde nach `origin/main` gepusht und produktiv deployed.
- MD-Follow-up ist produktiv: redundante Statuspillen unter den Trefferstatistik-Pillen sind entfernt, normale Teams zeigen in der Listenansicht unter dem Namen keine `x / 5 Teilnehmer:innen`-Stats mehr, Toolbar-Button-/Counter-Farben sind panel-spezifisch nachgezogen, Listensortierung nach Klasse nutzt die Standard-Reihenfolge SA, SB, J, DA, DB, HA, HB, HC, Layout-Toolbar-Button/Badge sind konsistent.

## Aktueller Git-Stand

- Aktiver Branch: `main`
- App-Deploy-Commit: `eb1cbff Polish MD class sort and layout badge`
- Hotfix-Commits:
  - `ec94981` Fix MD mobile quick filters
  - `a822beb` Add MD hit statistics
  - `529602a` Fix MD mobile toolbar width
  - `9939763` Keep MD hit stats above panels
  - `f4c450b` Fix MD filter reset and stat toggles
  - `13f1953` Polish MD toolbar active states
  - `06e204e` Refine MD toolbar toggle colors
  - `eb1cbff` Polish MD class sort and layout badge
- Relevante Dateien:
  - `app/components/dashboard.tsx`
  - `docs/cr/2026-07-10-md-mobile-toolbar-width.md`
  - `docs/cr/2026-07-10-md-mobile-quickfilter-hotfix.md`
  - `docs/cr/2026-07-10-md-active-toolbar-cosmetics.md`
  - `SESSION_HANDOFF.md`
  - Inhalt: kompakte Trefferstatistik unter dem MD-Control-Strip mit Gesamt, Damen, Herren und Klassen; Stat-Pillen sind Filter-Toggles; Filter-Reset setzt Filter und Sortierung zurueck; Kachel/Liste und Toolbar-Counter zeigen aktive Zustaende farbig an.
  - Checks: `npx tsc --noEmit` gruen, `npm run build` gruen, `npm run smoke:public` gruen.
- Letzte relevante Commits:
  - `eb1cbff` Polish MD class sort and layout badge
  - `06e204e` Refine MD toolbar toggle colors
  - `13f1953` Polish MD toolbar active states
  - `f4c450b` Fix MD filter reset and stat toggles
  - `9939763` Keep MD hit stats above panels
  - `529602a` Fix MD mobile toolbar width
  - `a822beb` Add MD hit statistics
  - `ec94981` Fix MD mobile quick filters
  - `82f23fc` Improve MD list controls
  - `36efa09` Add saved dashboard layouts
  - `9343a54` Require contact phone for marketplace registrations
  - `01d7418` Sort live classes consistently
  - `8f546e8` Move start numbers from participants to teams
- Lokale uncommitted App-/Doku-Aenderungen:
  - `app/components/dashboard.tsx`
  - `docs/cr/2026-07-10-md-active-toolbar-cosmetics.md`
  - `SESSION_HANDOFF.md`
- Lokale Checks fuer diese uncommitted Aenderungen:
  - `eslint app/components/dashboard.tsx` gruen
  - `npx tsc --noEmit` gruen
  - `npm run lint` gruen, nur bestehende Warnungen
  - `npm run build` gruen
- Nachkorrektur 15:21 UTC:
  - `sortField === "category"` nutzt `compareClassificationCodes` statt alphabetischem Collator.
  - Layout-Button ist primary bei offenem Panel, ausgewaehltem Layout oder Dirty-State.
  - Layout-Badge zeigt `1` fuer ausgewaehltes Layout, `!` fuer ungespeicherte Layout-Aenderungen und `•` wenn das Layout-Panel ohne ausgewaehltes Layout offen ist; Badge-Farbe wechselt wie bei den anderen Toolbar-Panels nach offen/geschlossen.
  - Checks: `eslint app/components/dashboard.tsx` gruen, `npx tsc --noEmit` gruen, `npm run lint` gruen mit bestehenden Warnungen, `npm run build` gruen.
  - Deploy: `dpl_J1U8rthSjLQ8tG2P4Jddsjgithkv`, Alias `https://portal.s5evo.de`, Smoke gruen.
- Nachkorrektur 14:41 UTC:
  - Filter-Button nutzt wieder die direkte Regel `filtersOpen || activeFilterCount > 0`.
  - `activeFilterCount` zaehlt keine reinen Schnellfilter-Excludes mehr.
  - Toolbar-Counter wechseln zwischen geschlossenem hellen Badge und geoeffnetem Primary-Badge.
  - Checks: `eslint app/components/dashboard.tsx` gruen, `npx tsc --noEmit` gruen, `npm run lint` gruen mit bestehenden Warnungen, `npm run build` gruen.
  - Deploy: `dpl_E7aJRq6hMD9HzvbtFvVjEXMNAKXW`, Alias `https://portal.s5evo.de`, Smoke gruen.

## Produktivstand / Deployments

- Aktueller Production Deploy:
  - Deployment: `dpl_J1U8rthSjLQ8tG2P4Jddsjgithkv`
  - URL: `https://s5-evo-portal-7sh5rcngt-sebastiankroeker-2781s-projects.vercel.app`
  - Alias: `https://portal.s5evo.de`
  - Status: `READY`
- Post-Deploy Smoke:
  - `npm run smoke:public` gruen
  - `/`, `/login`, `/anmeldung`, `/aenderungen`, `/sportlerboerse-dashboard`: 200
  - `/api/competition`: 200
  - `/api/results?competitionId=cmn3a1piz0002l104372yx9yt`: 200
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
