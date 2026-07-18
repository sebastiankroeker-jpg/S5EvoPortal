# CR: CSV Export Tenant Scope And Round Logo

Status: Deployed
Date: 2026-07-17
Type: hotfix
Risk: high
Owner: S5Evo

## Context

Sebastian meldete per Screenshot, dass im Header noch nicht das offizielle kreisrunde 5Kampf-Logo verwendet wird und der Admin-Button `Jetzt CSV senden` mit `Wettkampf nicht gefunden` fehlschlägt.

Der CSV-Fehler passt zum bekannten Multi-Tenant-Fallback-Risiko: Die UI sendet den aktiven `competitionId`, der Server autorisiert aber zuerst über `requireTenantRoles()` mit implizitem erstem Tenant und filtert den CSV-Export danach mit diesem Fallback-`tenantId`.

## Scope

- In scope:
  - Header, Sidebar und Home-Logo auf das kreisrunde offizielle 5Kampf-Mark stellen.
  - Manuellen Orga-CSV-Mailversand nach Tenant des übergebenen `competitionId` autorisieren.
  - Admin-CSV-Download/Layout-Export nach Tenant des übergebenen `competitionId` autorisieren.
  - Statischen Verify-Guard für CSV-Export-Competition-Scope ergänzen.
- Out of scope:
  - Keine Änderung an Export-Inhalt oder Empfängern.
  - Keine DB-Migration.
  - Kein Mailversand während Agent-Tests.
  - Kein Production-Deploy ohne separates Go.

## Affected Flows

- User/API/admin flows touched:
  - Top Header Branding
  - Desktop Sidebar Branding
  - Home Branding
  - Admin CSV-Mailversand `/api/admin/daily-orga-export`
  - Admin CSV-Download/Layout-Export `/api/admin/teams-export`
- Data model impact: keiner.
- Auth/permission impact: ja, Export-APIs prüfen bei `competitionId` gegen den Tenant des ausgewählten Wettkampfs.
- Sensitive data impact: ja, CSV enthält Mannschafts-/Manager-/Teilnehmerdaten.
- Offline/cache/export/log/mail impact: Export/Mail betroffen, aber Inhalt/Empfänger unverändert.
- Production/deploy impact: Deployment erforderlich nach Freigabe.

## Privacy / Security Review

- Sensitive fields touched: Teamnamen, Manager-Name, Manager-E-Mail, Manager-Telefon, Teilnehmernamen, Geburtsjahr, Geschlecht, Disziplin, Teamnotizen, Owner-E-Mail.
- Purpose / data minimization: keine neuen Felder; der Fix stellt nur sicher, dass der bestehende Export für den explizit ausgewählten Wettkampf autorisiert wird.
- Visibility by role/user/API/UI: nur Admin/Moderator des ausgewählten Wettkampf-Tenants.
- Persistence locations: keine neue Persistenz; CSV wird weiterhin als Mail-Anhang bzw. Download erzeugt.
- Offline/cache behavior, TTL/invalidation/logout clearing: keine Änderung.
- Logs/mails/exports/screenshots exposure: keine neuen technischen Logs; Exportinhalt bleibt bestehender Orga-CSV-Inhalt.
- Negative checks for unauthorized access or payload leakage: ohne Session müssen Export-APIs 401 bleiben; falscher Tenant darf nicht durch Fallback autorisieren.
- Authenticated smoke plan or explicit gap: Agent hat keine Admin-Session; echter Mailversand bleibt Sebastian/manueller Smoke nach Deploy.
- Residual risk: tatsächlicher Resend-Mailversand wird lokal nicht ausgelöst.

## Data / API Design

- Proposed data model: keine Änderung.
- Proposed API shape: unverändert, `competitionId` bleibt Pflicht.
- Backward compatibility: Aufrufer ohne `competitionId` behalten bestehenden Fallback nur in generischem Helper; CSV-Routen verlangen weiter `competitionId`.
- Migration/data backfill: keine.

## Acceptance Criteria

- Header und Home zeigen das kreisrunde offizielle 5Kampf-Logo.
- CSV-Mailversand findet den ausgewählten 2026-Wettkampf auch bei Multi-Tenant-Admins.
- CSV-Download/Layout-Export nutzen denselben ausgewählten Competition-Tenant.
- Keine Erweiterung des CSV-Inhalts und keine neuen Logs sensibler Daten.
- Ohne Session bleiben Export-Endpunkte geschützt.

## Implementation Handoff

- Relevant files:
  - `app/components/nav-bar.tsx`
  - `app/components/sidebar.tsx`
  - `app/components/home-screen.tsx`
  - `lib/server-permissions.ts`
  - `app/api/admin/daily-orga-export/route.ts`
  - `app/api/admin/teams-export/route.ts`
  - `scripts/verify-admin-csv-export-scope.ts`
  - `package.json`
- Current decisions:
  - Kreisrundes Logo = `FIVE_KAMPF_BRAND.mark` (`/brand/5kampf/mark.webp`).
  - Export-Auth soll den Tenant über `competitionId` auflösen und Rollen gegen genau diesen Tenant prüfen.
  - CSV-Inhalt und Empfänger bleiben unverändert.
- Open decisions: keine.
- Non-goals: keine DB-/Mail-/Export-Inhaltsänderung.
- Expected implementation steps:
  - Shared competition-scoped tenant-role helper ergänzen.
  - CSV-Routen auf Helper umstellen.
  - Branding-Komponenten auf Mark wechseln.
  - Verify-Guard ergänzen und Checks ausführen.
- Required checks:
  - `npm run verify:admin-csv-export-scope`
  - targeted ESLint
  - `npx tsc --noEmit --incremental false`
  - `git diff --check`
  - `npm run build`
- Privacy/security checks:
  - Unauthorized API smoke lokal/production ohne Session bleibt 401.
  - Kein Test-Mailversand.
- Risks/assumptions:
  - Das kreisrunde Mark ist das gewünschte offizielle Logo.
  - Authenticated Browser/Mail-Smoke ist durch Agent mangels Session blockiert.
- Context read before implementation:
  - `SESSION_HANDOFF.md` top block: gelesen.
  - Relevant prior CR(s): `2026-07-17-admin-dashboard-tenant-scope-hotfix.md`.
  - Relevant source files: gelesen.

## Confirmation Gate

- Gate needed: yes
- Reason: production deploy plus Export/Mail-Pfad mit sensiblen Daten.
- Sensitive-data/production-data reason: CSV exportiert PII und wird per Mail versendet.
- Approved by:
- Approval timestamp:

## Implementation Notes

- Files changed:
  - `app/components/nav-bar.tsx`
  - `app/components/sidebar.tsx`
  - `app/components/home-screen.tsx`
  - `lib/server-permissions.ts`
  - `app/api/admin/daily-orga-export/route.ts`
  - `app/api/admin/teams-export/route.ts`
  - `scripts/verify-admin-csv-export-scope.ts`
  - `package.json`
  - `docs/cr/2026-07-17-csv-export-tenant-scope-and-round-logo.md`
- Important decisions during implementation:
  - Header, expanded Sidebar, collapsed Sidebar and Home use `FIVE_KAMPF_BRAND.mark`.
  - New shared `requireCompetitionTenantRoles()` resolves `competitionId` to `competition.tenantId` and checks the actor's allowed role against that tenant.
  - Daily Orga CSV mail, CSV download and layout CSV export now use the competition-scoped helper.
  - CSV payload and recipient resolution are unchanged.

## Verification

- Local checks:
  - `npm run verify:admin-csv-export-scope` -> green
  - `npm run verify:admin-dashboard-scope` -> green
  - `npm run verify:admin-competition-scope` -> green
  - targeted ESLint -> green
  - `npx tsc --noEmit --incremental false` -> green
  - `git diff --check` -> green
- Build:
  - `npm run build` -> green
- Targeted verification:
  - Local `next start` smoke: `/brand/5kampf/mark.webp` -> 200 `image/webp`.
  - Local `next start` smoke: `/` contains `<title>Soier 5Kampf</title>`.
- Sensitive-data negative checks:
  - Local unauthenticated `POST /api/admin/daily-orga-export` with 2026 `competitionId` -> 401, no payload leaked.
  - Local unauthenticated `GET /api/admin/teams-export?competitionId=...` -> 401, no payload leaked.
  - No test mail sent.
- Authenticated role smoke:
  - Gap: no authenticated Admin session in agent.
- Manual smoke:
  - Pending Sebastian after deploy.

## Deploy

- Deployment needed: yes
- Deployment ID: dpl_HDapvhntC5hB4Jmt5gc9qj8A5yfd
- Deployment URL: https://s5-evo-portal-bnnhei0my-sebastiankroeker-2781s-projects.vercel.app
- Production alias: https://portal.s5evo.de
- Deployed at: 2026-07-18 00:11 UTC

## Post-Deploy Smoke

- Routes checked:
  - `https://portal.s5evo.de/` -> 200, `<title>Soier 5Kampf</title>`
  - `https://portal.s5evo.de/brand/5kampf/mark.webp` -> 200 `image/webp`
  - `https://portal.s5evo.de/manifest.webmanifest` -> `name`/`short_name` `Soier 5Kampf`, `display` `standalone`
- API checks:
  - `npm run smoke:public` -> green
  - `POST /api/admin/daily-orga-export` without session and dummy `competitionId` -> 401
  - `GET /api/admin/teams-export?competitionId=test` without session -> 401
- Sensitive-data/API leakage checks:
  - Export endpoints remain protected without session; no CSV payload leaked during smoke.
  - No test mail sent.
- Result: production deploy verified.

## Follow-Ups

- None
