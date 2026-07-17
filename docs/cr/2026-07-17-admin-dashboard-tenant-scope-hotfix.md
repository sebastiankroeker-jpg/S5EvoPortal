# CR: Admin Dashboard Tenant Scope Hotfix

Status: Implemented locally
Date: 2026-07-17
Type: hotfix
Risk: high
Owner: S5Evo

## Context

Sebastian meldete nach dem Wechsel vom alten Tenant auf den aktuellen Wettkampf, dass im Änderungsdashboard keine Änderungen mehr sichtbar sind und der Benutzer `Leonhard.Schwaiger@t-online.de` fehlt.

Read-only-Rekonstruktion:

- `Leonhard.Schwaiger@t-online.de` existiert als User im aktuellen Tenant `esv-bad-bayersoien`.
- Der Teilnehmer hängt im aktuellen 2026-Wettkampf am Team `5Kampf Orga`.
- Der 2026-Wettkampf hat ChangeRequests; 2024 hat keine.
- Code-Review zeigt: `/api/admin/pending-changes` und `/api/admin/users` verwenden `requireTenantRoles()` ohne ausgewählten Wettkampf-/Tenant-Scope. Bei Admins mit mehreren Tenants kann dadurch wieder der alte 2024-Fallback-Tenant greifen.

## Scope

- In scope:
  - Änderungsdashboard nach aktivem `competitionId` scopen.
  - Benutzerverwaltung nach aktivem `competitionId` scopen.
  - Benutzer-Rollen-Speichern und Benutzer-Löschen gegen denselben ausgewählten Tenant autorisieren.
  - Keine Produktionsdaten mutieren.
- Out of scope:
  - Keine DB-Migration.
  - Keine Änderung an bestehenden ChangeRequests, Usern, Rollen oder Teilnehmerdaten.
  - Keine Neugestaltung der Dashboards.

## Affected Flows

- User/API/admin flows touched:
  - `/aenderungen`
  - Admin Benutzerverwaltung
  - `/api/admin/pending-changes`
  - `/api/admin/users`
  - `/api/admin/users/[id]/roles`
  - `/api/admin/users/[id]` DELETE
- Data model impact: keiner.
- Auth/permission impact: ja, Admin-Autorisierung wird explizit gegen Tenant des ausgewählten Wettkampfs geprüft.
- Sensitive data impact: ja, Benutzerverwaltung und Änderungsdashboard enthalten personenbezogene Daten.
- Offline/cache/export/log/mail impact: keiner.
- Production/deploy impact: Hotfix erforderlich, nach explizitem Go.

## Privacy / Security Review

- Sensitive fields touched: User-E-Mail, Name, Rollen, Teilnehmer-/Teambezug, ChangeRequests.
- Purpose / data minimization: keine neuen Felder; bestehende Admin-Daten werden nur im korrekten Tenant-Kontext geladen.
- Visibility by role/user/API/UI: nur Admins des ausgewählten Wettkampf-Tenants.
- Persistence locations: keine neue Persistenz.
- Offline/cache behavior: keine Änderung.
- Logs/mails/exports/screenshots exposure: keine neuen Logs/Mails/Exports.
- Negative checks for unauthorized access or payload leakage: ohne Session weiter 401; User ohne Admin-Rolle im ausgewählten Tenant darf Daten nicht sehen oder mutieren.
- Authenticated smoke plan or explicit gap: Agent hat keine Admin-Session; DB-/Code-Checks und Public Smoke möglich, authentifizierter Browser-Smoke bleibt Sebastian.
- Residual risk: echter Admin-Browser-Smoke muss manuell erfolgen.

## Data / API Design

- Proposed data model: keine Änderung.
- Proposed API shape:
  - `GET /api/admin/pending-changes?competitionId=...`
  - `GET /api/admin/users?competitionId=...`
  - `PUT /api/admin/users/[id]/roles` akzeptiert `competitionId` im Body.
  - `DELETE /api/admin/users/[id]?competitionId=...`
- Backward compatibility: ohne `competitionId` bleibt bisheriger Fallback erhalten.
- Migration/data backfill: keine.

## Acceptance Criteria

- Admin-Dashboards nutzen den aktiv ausgewählten Wettkampf/Tenant.
- `Leonhard.Schwaiger@t-online.de` ist in der Benutzerverwaltung des 2026-Tenants sichtbar.
- Änderungsdashboard fällt nicht auf den 2024-Tenant zurück, wenn 2026 aktiv ist.
- Rollen-/Lösch-Aktionen in der Benutzerverwaltung verwenden denselben ausgewählten Tenant.
- Keine Produktionsdaten-Mutation während Analyse/Implementierung.

## Implementation Handoff

- Relevant files:
  - `app/api/admin/pending-changes/route.ts`
  - `app/api/admin/users/route.ts`
  - `app/api/admin/users/[id]/roles/route.ts`
  - `app/api/admin/users/[id]/route.ts`
  - `app/components/approval-queue.tsx`
  - `app/components/user-management.tsx`
- Current decisions:
  - `competitionId` aus `useCompetition()` im Frontend an Admin-APIs geben.
  - Server löst `competitionId` auf Tenant auf und prüft Admin-Rolle gegen genau diesen Tenant.
  - Legacy-Fallback bleibt nur für alte Aufrufer ohne `competitionId`.
- Non-goals:
  - keine Datenkorrektur.
  - kein Rollen-/User-Move.
- Required checks:
  - targeted ESLint
  - `npx tsc --noEmit --incremental false`
  - `git diff --check`
  - `npm run build`
  - gezielte DB-/Code-Verification für Leonhard und Scope
- Privacy/security checks:
  - keine neuen Serializer-Felder.
  - ohne Session weiter 401.
  - Mutationen nur im ausgewählten Tenant.

## Confirmation Gate

- Gate needed: yes
- Reason: Auth/tenant-scope hotfix plus production deploy.
- Sensitive-data/production-data reason: Admin-Dashboards zeigen PII und Rolleninformationen.
- Approved by:
- Approval timestamp:

## Implementation Notes

- Files changed:
  - `app/api/admin/pending-changes/route.ts`
  - `app/api/admin/users/route.ts`
  - `app/api/admin/users/[id]/roles/route.ts`
  - `app/api/admin/users/[id]/route.ts`
  - `app/components/approval-queue.tsx`
  - `app/components/user-management.tsx`
  - `scripts/verify-admin-dashboard-scope.ts`
  - `package.json`
  - `docs/cr/2026-07-17-admin-dashboard-tenant-scope-hotfix.md`
- Important decisions during implementation:
  - Existing fallback remains for old callers without `competitionId`.
  - When `competitionId` is present, the server resolves the competition's tenant and checks the acting user's `ADMIN` or `MODERATOR` role against that tenant.
  - User list, owned/chief/participant/team-manager scopes are all filtered to the selected competition when provided.
  - Role updates and user deletion now use the selected competition tenant, not the fallback tenant.
  - Added `npm run verify:admin-dashboard-scope` guard for these routes/components.

## Verification

- Local checks:
  - `npm run verify:admin-dashboard-scope` -> green
  - `npm run verify:admin-competition-scope` -> green
  - `npx eslint app/api/admin/pending-changes/route.ts app/api/admin/users/route.ts app/api/admin/users/[id]/roles/route.ts app/api/admin/users/[id]/route.ts app/components/approval-queue.tsx app/components/user-management.tsx scripts/verify-admin-dashboard-scope.ts` -> green
  - `npx tsc --noEmit --incremental false` -> green
  - `git diff --check` -> green
- Build:
  - `npm run build` -> green
- Targeted verification:
  - Read-only DB check: `Leonhard.Schwaiger@t-online.de` is in current tenant `esv-bad-bayersoien` (`leonhardCurrent=1`) and not in old tenant `esv-2024` (`leonhardOld=0`).
  - Read-only DB check: 2026 competition has `crCurrent=25`; old tenant has `crOld=0`.
- Sensitive-data negative checks:
  - No new serializer fields.
  - No data mutation performed during investigation or implementation.
  - Unauthorized production API smoke still pending deploy; local code keeps existing session gates.
- Authenticated role smoke:
  - Gap: no authenticated Admin browser session in agent.

## Deploy

- Deployment needed: pending explicit Go.
- Deployment ID:
- Deployment URL:
- Production alias:
- Deployed at:

## Post-Deploy Smoke

- Routes checked:
- API checks:
- Sensitive-data/API leakage checks:
- Result:

## Follow-Ups

- Consider extracting a shared `requireCompetitionScopedAdmin` helper for all Admin APIs.
