# CR: Legacy Running Result Import

Status: Draft
Date: 2026-07-20
Type: feature
Risk: medium
Owner: S5Evo

## Context

Kurz vor dem Wettkampf fehlt der Import von Ergebnisdaten aus der Legacy-Access-Auswertung. Sebastian hat die Lauf-Ergebnis-CSV aus dem Vorjahr nur fuer Konzeptions- und Testzwecke bereitgestellt. Fachliche Entscheidungen aus der Analyse:

- Header steht in Zeile 6, Daten ab Zeile 7, Trennzeichen `;`.
- Matching erfolgt ausschliesslich ueber Startnummer und Disziplin.
- `AuZeit` ist die relevante Laufzeit.
- `AuPunkte`/`AuPlatzKlasse` sind Klassenpunkte/-platz.
- `AuPunkteDamenGes`/`AuPunkteHerrenGes` und `AuPlatzGesamt` gelten nur fuer Damen/Herren-Gesamtwertungen, nicht fuer Schueler/Jugend.
- `88:88:88.00` ist ein manuell gesetzter Sonderwert, vermutlich "nicht im Ziel"; Legacy-Punkte/-Platz bleiben erhalten, Zeit wird nicht als gueltige Zeit normalisiert.

## Scope

- In scope:
  - Legacy-Laufen-CSV parsen und in Result-Staging normalisieren.
  - Dry-run/Preview ohne DB-Schreibzugriff.
  - Optionales Staging als `ResultDataBatch(source=LEGACY_IMPORT)` mit `ResultRawRecord` und `ResultDraft`.
  - Startnummer+Disziplin-Matching auf Team/Teilnehmer.
  - UI-Upload auf der Ergebnisdaten-Seite fuer Admin-Dry-run und bewusstes Staging.
  - Sensible Rohdaten nur im Staging-Payload, keine technischen Logs mit CSV-Inhalten.
- Out of scope:
  - Publikation in offizielle `DisciplineResult`.
  - Recalc der Legacy-Punkte/Platzierungen.
  - Rad/Stock/Bank/MTB-Import.
  - DB-Migration.
  - Production Deploy.

## Affected Flows

- User/API/admin flows touched: neue Admin-API fuer Legacy-Lauf-Ergebnisimport ins Result-Staging.
- Data model impact: keine Schemaaenderung; nutzt bestehende `ResultDataBatch`, `ResultRawRecord`, `ResultDraft`.
- Auth/permission impact: ADMIN-only, competition-scoped via `requireCompetitionTenantRoles`.
- Sensitive data impact: Startnummern, Legacy-Teilnehmer-IDs und Ergebnisdaten werden verarbeitet; keine Namen in der gelieferten Lauf-Datei.
- Offline/cache/export/log/mail impact: keine Offline-Caches, Exporte oder Mails; keine CSV-Inhalte in Logs.
- Production/deploy impact: keiner in diesem CR, solange nicht separat deployed wird.

## Privacy / Security Review

- Sensitive fields touched: Startnummer, Legacy-Teilnehmer-ID, Ergebniszeit, Punkte, Platzierungen, Klassen-ID; keine Namen/E-Mails/Telefonnummern in der Lauf-Datei.
- Purpose / data minimization: Import benoetigt Startnummer, Disziplin, Zeit, Punkte, Rang und Legacy-Diagnosefelder; Legacy-IDs bleiben nur im Raw-Payload.
- Visibility by role/user/API/UI: neue Route ADMIN-only fuer den ausgewaehlten Wettkampf.
- Persistence locations: bei `dryRun:false` DB-Persistenz in Result-Staging-Tabellen; keine Browser-Persistenz.
- Offline/cache behavior, TTL/invalidation/logout clearing: nicht betroffen.
- Logs/mails/exports/screenshots exposure: keine Rohdaten in technischen Logs oder Smoke-Ausgaben; Audit enthaelt nur Batch-Metadaten und Zaehler.
- Negative checks for unauthorized access or payload leakage: Route nutzt NextAuth + competition-scoped Admin-Guard.
- Authenticated smoke plan or explicit gap: lokale Auth-Smokes nicht moeglich ohne Session-Cookies; statische und Unit-Checks decken Parser und Guard-Marker ab.
- Residual risk: echtes Encoding/File-Upload-Verhalten muss spaeter mit UI bzw. echter Datei im Browser validiert werden.

## Data / API Design

- Proposed data model:
  - `ResultDataBatch`: ein Legacy-Laufen-Paket.
  - `ResultRawRecord`: eine CSV-Zeile mit Originalfeldern.
  - `ResultDraft`: normalisierte Vorschlagszeile mit `RUN`, Startnummer, Team/Participant-Match, Zeit und Proposed Snapshot.
- Proposed API shape:
  - `POST /api/admin/result-staging/legacy-running/import`
  - Body: `{ competitionId, csv, purpose?, label?, delimiter?, headerRow?, dryRun? }`
  - `dryRun` default: `true`; Staging nur mit `dryRun:false`.
- Backward compatibility: additiv.
- Migration/data backfill: keine.

## Open Questions

- None.

## Acceptance Criteria

- CSV mit Header in Zeile 6 wird korrekt erkannt.
- Laufzeiten werden in Millisekunden normalisiert.
- `88:88:88.00` wird nicht als gueltige Zeit geparst, Legacy-Punkte/-Rang bleiben im Snapshot.
- Damen/Herren-Gesamtwertung wird nur fuer Klassen 4/5 bzw. 6/7/8 normalisiert.
- Matching erfolgt ueber Team-Startnummer und RUN-Teilnehmer.
- Route ist ADMIN-only und competition-scoped.
- Dry-run schreibt nichts in die DB.

## Implementation Handoff

- Relevant files:
  - `lib/legacy-running-result-import.ts`
  - `app/api/admin/result-staging/legacy-running/import/route.ts`
  - `app/admin/ergebnisse/page.tsx`
  - `scripts/verify-legacy-running-import.ts`
  - `scripts/verify-tenant-scope.ts`
- Current decisions:
  - Legacy-Punkte/Raenge werden uebernommen, nicht neu berechnet.
  - `Au1TlID` ist nur Raw/Debug, kein Match-Key.
  - `dryRun` ist aus Sicherheitsgruenden Default.
- Open decisions:
  - None.
- Non-goals:
  - Keine UI, keine Publikation, kein Deploy.
- Expected implementation steps:
  - Parser/Normalizer bauen.
  - Route mit Admin-Guard und Dry-run/Staging bauen.
  - Targeted Verify-Script ergaenzen.
  - Checks laufen lassen.
- Required checks:
  - `npm run verify:legacy-running-import`
  - `npm run verify:tenant-scope`
  - targeted ESLint
  - `npx tsc --noEmit --incremental false`
  - `git diff --check`
- Privacy/security checks:
  - Keine CSV-Inhalte in Logs.
  - Keine unauthentifizierte Route.
  - ADMIN-only und tenant-/competition-scoped.
- Risks/assumptions:
  - JSON-Body enthaelt bereits dekodierten Text; echter Browser-Upload braucht spaeter Encoding-Handling im UI.
- Context read before implementation:
  - `SESSION_HANDOFF.md` top block: yes
  - Relevant prior CR(s): `2026-07-15-result-staging-v1.md`, `2026-07-19-legacy-stammdaten-csv.md`
  - Relevant source files: Result-Staging routes, start-number import route, Prisma result models

## Model / Subagent Plan

- Model switch needed: no
- Target model/role: current Codex implementation
- Subagent needed: no
- Subagent role: n/a
- Handoff source: this CR

## Confirmation Gate

- Gate needed: yes
- Reason: sensitive competition result data staged in DB.
- Sensitive-data/production-data reason: result data tied to start numbers and participants.
- Approved by: Sebastian via "Go" in chat
- Approval timestamp: 2026-07-20

## Implementation Notes

- Files changed:
  - `lib/legacy-running-result-import.ts`
  - `app/api/admin/result-staging/legacy-running/import/route.ts`
  - `scripts/verify-legacy-running-import.ts`
  - `scripts/verify-tenant-scope.ts`
  - `package.json`
- Important decisions during implementation:
  - `dryRun` ist Default; DB-Staging erfordert explizit `dryRun:false`.
  - UI fuehrt immer zuerst einen Dry-run aus und fragt danach per Confirm, bevor ein Paket geschrieben wird.
  - UI-Dateileser versucht UTF-8 und faellt auf `windows-1252` zurueck.
  - `ResultDataBatch.status` wird bei Match-/Parsing-Fehlern auf `ERROR` gesetzt, damit fehlerhafte Pakete nicht wie normale Staging-Pakete wirken.
  - Raw CSV-Felder werden je Zeile im `ResultRawRecord.payload` gehalten; technische Logs/Audit enthalten nur Metadaten und Zaehler.
  - Neue Dateien sind lokal durch bestehende `.git/info/exclude`-Regeln ignoriert; sie wurden trotzdem gebaut und geprueft.

## Verification

- Local checks:
  - `npm run verify:legacy-running-import` gruen.
  - `npm run verify:tenant-scope` gruen.
  - `npx eslint lib/legacy-running-result-import.ts app/api/admin/result-staging/legacy-running/import/route.ts scripts/verify-legacy-running-import.ts scripts/verify-tenant-scope.ts` gruen.
  - Nach UI-Nachzug: `npx eslint app/admin/ergebnisse/page.tsx app/api/admin/result-staging/legacy-running/import/route.ts lib/legacy-running-result-import.ts scripts/verify-legacy-running-import.ts` gruen.
  - `npx tsc --noEmit --incremental false` gruen.
  - `git diff --check` gruen.
- Build:
  - `npm run build` gruen; neue Route `/api/admin/result-staging/legacy-running/import` wird gebaut.
- Targeted verification:
  - Synthetischer CSV-Test prueft Header Zeile 6, Klassen-/Gesamtwertungs-Mapping, `88:88:88.00` als `manual_check`, Legacy-Punkte/-Raenge erhalten.
  - Echte Vorjahresdatei nur aggregiert geprueft: 111 Zeilen, 109 gueltige Zeiten, 2 Sonderzeiten, Klassenzaehlung 1/2/3/4/5/6/7/8 = 9/15/11/12/10/9/36/9, Gesamtwertung DAMEN 22/HERREN 54.
- Sensitive-data negative checks:
  - Route hat ADMIN-only competition-scoped Guard.
  - Verify-Script prueft, dass Route keinen `console.log` enthaelt.
  - Audit-/Response-Design gibt Zaehler und IDs aus, keine CSV-Inhalte in technischen Logs.
- Authenticated role smoke:
  - Gap: kein authentifizierter API-Smoke ohne Session-Cookies/Test-Account.
- Manual smoke:
  - Nicht ausgefuehrt; kein UI in Scope.

## Deploy

- Deployment needed: yes
- Deployment ID: `dpl_6eSK6dAPBgnBgqcYrcGeTiZ7fYBH`
- Deployment URL: `https://s5-evo-portal-1jlbms3d2-sebastiankroeker-2781s-projects.vercel.app`
- Production alias: `https://portal.s5evo.de`
- Deployed at: 2026-07-20 14:17 UTC

## Post-Deploy Smoke

- Routes checked:
  - `npm run smoke:public` against `https://portal.s5evo.de` gruen.
  - `curl -sSI https://portal.s5evo.de/admin/ergebnisse` liefert 200.
- API checks:
  - Unauthenticated `POST /api/admin/result-staging/legacy-running/import` liefert 401.
- Sensitive-data/API leakage checks:
  - Unauthenticated Import-Route gibt nur `{"error":"Unauthorized"}` zurueck, keine Payload-Daten.
- Result: production ready for authenticated admin dry-run.

## Follow-Ups

- UI-Upload fuer Legacy-Ergebnisdaten mit Encoding-Fallback.
- Publikations-/Review-Flow von `ResultDraft` in offizielle Ergebnisse.

## Addendum: Produktionstest-Schutz

- Date: 2026-07-20 14:36 UTC
- Trigger: Sebastian wollte die Teststrategie vor dem Wettkampf absichern:
  echte Startnummern sind fuer Importtests noetig, sollen aber bis zur
  Freigabe nur Admins sehen; Startnummern und Ergebnis-Testdaten muessen
  vor dem Wettkampf wieder loeschbar sein.
- Files changed:
  - `app/api/teams/route.ts`
  - `app/api/admin/start-numbers/reset/route.ts`
  - `app/components/dashboard.tsx`
  - `app/admin/ergebnisse/page.tsx`
  - `scripts/verify-tenant-scope.ts`
- Decisions:
  - `/api/teams` liefert `startNumber` nur noch fuer ADMIN.
  - Startnummern-Reset ist ADMIN-only und competition-scoped.
  - Reset-API ist per Default Preview/Dry-run und verlangt fuer echte
    Ausfuehrung `dryRun:false` plus exakten Confirmation-Text.
  - Ergebnis-Testdaten-Reset nutzt den bestehenden `TEST_DATA` Scope und
    entfernt nur `PROD_TEST`/`DRY_RUN` Staging-Pakete.
  - Offizielle Ergebnisse, Teams und Teilnehmer bleiben unberuehrt.
- Verification:
  - `npm run verify:tenant-scope` gruen.
  - `npx eslint app/api/teams/route.ts app/api/admin/start-numbers/reset/route.ts app/components/dashboard.tsx app/admin/ergebnisse/page.tsx scripts/verify-tenant-scope.ts` gruen.
  - `npx tsc --noEmit --incremental false` gruen.
  - `git diff --check` gruen.
  - `npm run build` gruen.
- Deploy:
  - Deployment ID: `dpl_7KoCreUVknNEPkKqVrdingfphVAK`
  - Deployment URL: `https://s5-evo-portal-pojwbb4rm-sebastiankroeker-2781s-projects.vercel.app`
  - Production alias: `https://portal.s5evo.de`
- Post-deploy smoke:
  - `npm run smoke:public` gruen.
  - `curl -sSI https://portal.s5evo.de` 200.
  - Unauthenticated `POST /api/admin/start-numbers/reset` liefert 401.
  - Unauthenticated `POST /api/admin/result-staging/reset/preview` liefert 401.
- Production data:
  - Keine Startnummern geloescht.
  - Keine Ergebnis-Testdaten geloescht.

## Addendum: Legacy-Laufen Staging Transaction Hotfix

- Date: 2026-07-20 16:08 UTC
- Trigger: Sebastian meldete im Browser
  `Legacy-Lauf-Ergebnisse konnten nicht ins Ergebnis-Staging uebernommen werden.`
  Vercel-Logs zeigten Prisma `P2028` (`Transaction not found`) beim echten
  Staging auf `ResultRawRecord` bzw. `ResultDraft`.
- Root cause:
  - Viele sequentielle `resultRawRecord.create()` und `resultDraft.create()`
    Calls liefen innerhalb der Default-Transaktion zu lange.
- Files changed:
  - `app/api/admin/result-staging/legacy-running/import/route.ts`
- Decisions:
  - Matching/Parsing/Fachlogik bleibt unveraendert.
  - Batch-Erstellung bleibt transaktional.
  - Raw Records werden per `createMany` geschrieben.
  - Raw-Record-IDs werden danach ueber `batchId + rowKey` geladen.
  - Drafts werden per `createMany` geschrieben.
  - Prisma-Transaktion bekommt `timeout: 30_000`.
- Verification:
  - `npm run verify:legacy-running-import` gruen.
  - `npm run verify:tenant-scope` gruen.
  - `npx eslint app/api/admin/result-staging/legacy-running/import/route.ts lib/legacy-running-result-import.ts` gruen.
  - `npx tsc --noEmit --incremental false` gruen.
  - `git diff --check` gruen.
  - `npm run build` gruen.
- Deploy:
  - Deployment ID: `dpl_4E9u5BK8SeMzT1fFdKEa1B4FcMDi`
  - Deployment URL: `https://s5-evo-portal-k8d79yx4a-sebastiankroeker-2781s-projects.vercel.app`
  - Production alias: `https://portal.s5evo.de`
- Post-deploy smoke:
  - `npm run smoke:public` gruen.
  - Unauthenticated `POST /api/admin/result-staging/legacy-running/import`
    liefert 401.
  - Vercel logs der letzten 5 Minuten ohne neue `legacy-running` Fehler.
- Production data:
  - Keine Datenmutation durch den Agenten.

## Addendum: Admin-Testmodus Live-Ergebnisanzeige

- Date: 2026-07-20 16:53 UTC
- Trigger:
  - Das Paket `Legacy Laufen CSV 2026-07-20` wurde von Sebastian erfolgreich
    als Produktionstest gestaged.
  - Die Live-Ergebnisanzeige sollte mit gestagten Drafts geprueft werden, ohne
    offizielle Ergebnisse zu schreiben oder Testdaten oeffentlich sichtbar zu
    machen.
- Files changed:
  - `app/api/results/route.ts`
  - `app/components/results-view.tsx`
  - `lib/domain/scoring.ts`
- Decisions:
  - `/api/results` bekommt einen expliziten Admin-Testparameter
    `includeStagingTest=true`.
  - Der Parameter ist ADMIN-only; ohne ADMIN-Session liefert die API 403.
  - Ohne Parameter bleibt der normale Ergebnisabruf unveraendert.
  - Public/normal angemeldete Nutzer bekommen keine Staging-Drafts und weiterhin
    keine Startnummern.
  - Gestagte Drafts aus `ResultDataBatch.purpose in PROD_TEST/DRY_RUN`
    ueberschreiben in der Anzeige nur die betroffene Disziplin.
  - Legacy-Klassenpunkte und Legacy-Klassenplatz aus
    `proposedResultSnapshot.classScoring` werden uebernommen, nicht neu
    berechnet.
  - Die Haupttabelle bleibt kompakt, die Einzeldisziplinen sind die
    Pruefansicht.
  - Einzeldisziplin-Detailspalten:
    `Platz`, `Start Nr`, `Name`, `Mannschaft`, `Klasse`, `Zeit`.
- Reset / cleanup:
  - Testdaten bleiben loeschbar ueber `/admin/ergebnisse` -> Tab `Pakete` ->
    `Testdaten loeschen`.
  - Reset entfernt nur Staging-Pakete/Drafts mit `PROD_TEST`/`DRY_RUN`.
  - Offizielle `DisciplineResult` und publizierte Ergebnisse werden dadurch
    nicht geloescht.
- Verification:
  - `npx eslint app/api/results/route.ts app/components/results-view.tsx lib/domain/scoring.ts` gruen.
  - `npx tsc --noEmit --incremental false` gruen.
  - `npm run verify:tenant-scope` gruen.
  - `git diff --check` gruen.
  - `npm run build` gruen.
- Deploy:
  - Deployment ID: `dpl_L69nTBC1RRn1T2TREF4kJ9ambYki`
  - Deployment URL: `https://s5-evo-portal-5o5exj6qt-sebastiankroeker-2781s-projects.vercel.app`
  - Production alias: `https://portal.s5evo.de`
- Post-deploy smoke:
  - `npm run smoke:public` gruen.
  - `curl -sSI https://portal.s5evo.de` liefert 200.
  - Unauthenticated
    `/api/results?competitionId=<active>&includeStagingTest=true` liefert 403.
- Production data:
  - Keine Produktionsdaten-Mutation durch den Agenten.
