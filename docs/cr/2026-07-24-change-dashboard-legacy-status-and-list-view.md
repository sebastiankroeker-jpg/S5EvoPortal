# CR: Change Dashboard Legacy Status And List View

Status: Deployed
Date: 2026-07-24
Type: feature
Risk: medium
Owner: S5Evo

## Context

Sebastian requested a cleanup of the `/aenderungen` overview on competition day:
the compact change cards should lead with start number and team context, the
requester/date line should be clearer, a manually maintainable `Legacy OK`
status is needed for cross-system reconciliation, filters should survive
navigation away and back, and the dashboard should offer a table/list view
similar to the team dashboard.

## Scope

- In scope:
  - Compact dashboard card header layout.
  - Forward navigation from team and requester/user context.
  - Durable manual legacy sync status with `Legacy OK`.
  - Dashboard filter for legacy status.
  - Session-persisted dashboard filters/search/sort/view while navigating away.
  - Optional list view with default columns:
    start number, changed object, new value, approval status, legacy status.
- Out of scope:
  - Changing the existing expanded detail content semantics.
  - Production deploy or production migration without explicit Go.
  - Broader approval workflow redesign.

## Affected Flows

- User/API/admin flows touched:
  - Admin/moderator `/aenderungen` dashboard.
  - `GET /api/admin/pending-changes`.
  - `PATCH /api/admin/pending-changes/[id]` for legacy status maintenance.
- Data model impact:
  - Add `LegacySyncStatus` enum.
  - Add `legacyStatus` to `PendingChange`, `ChangeRequest`, and
    `ParticipantAuditLog`, so legacy pending changes, generic change requests,
    team-name requests, and direct audit entries can all be reconciled.
- Auth/permission impact:
  - Existing admin/moderator tenant checks remain required.
- Sensitive data impact:
  - Existing admin-visible participant/team/requester names remain visible.
  - Browser session storage stores filter state, including optional search text.
- Offline/cache/export/log/mail impact:
  - No exports, mails, or service-worker/offline read-model changes.
  - Browser storage uses sessionStorage, not localStorage/IndexedDB.
- Production/deploy impact:
  - Sebastian explicitly approved production deploy and migration with "Go" on
    2026-07-24 07:56 UTC.

## Privacy / Security Review

- Sensitive fields touched:
  - Participant names, team names/start numbers, requester names/emails,
    approval/audit history context.
- Purpose / data minimization:
  - Fields are already displayed in the admin change dashboard. The change
    rearranges and filters existing admin-visible data; `legacyStatus` stores
    only reconciliation state, not additional personal data.
- Visibility by role/user/API/UI:
  - `GET` and `PATCH` remain restricted to tenant admin/moderator roles.
  - Team/user forward navigation remains admin-link gated in the UI.
- Persistence locations:
  - DB: `legacyStatus` on relevant change/audit records.
  - Browser: sessionStorage key for dashboard filter/search/view state.
  - No technical logs, exports, or mails added.
- Offline/cache behavior:
  - No service worker/API cache change.
  - sessionStorage is browser-session scoped; reset clears it.
- Logs/mails/exports/screenshots exposure:
  - No new mail/export/log payloads.
- Negative checks:
  - TypeScript should verify API/UI contract shape.
  - Existing role guard paths are reused.
- Authenticated smoke plan or explicit gap:
  - Local authenticated browser smoke not available in this run; document as
    gap unless Sebastian tests live.
- Residual risk:
  - Production deploy requires a migration. It must not be run without an
    explicit Go during competition-day live support.

## Data / API Design

- Proposed data model:
  - `LegacySyncStatus = OPEN | LEGACY_OK`.
  - Default `OPEN`.
- Proposed API shape:
  - `GET /api/admin/pending-changes` returns `legacyStatus`.
  - `PATCH /api/admin/pending-changes/[id]` accepts
    `{ "legacyStatus": "OPEN" | "LEGACY_OK" }`.
  - Generic participant ChangeRequest updates also mirror the value to the
    linked legacy PendingChange when present.
- Backward compatibility:
  - Existing entries default to `OPEN`.
  - Existing approve/reject PUT flow remains unchanged.
- Migration/data backfill:
  - Add nullable-free columns with default `OPEN`.

## Acceptance Criteria

- Compact dashboard card first line shows start number, clickable team name,
  then the current pills.
- Second line shows requester/user navigation plus date and time.
- A `Legacy OK` state can be toggled/maintained.
- `Legacy OK` is available as a dashboard filter.
- Search, filters, sort, and view mode survive navigating away and back in the
  same browser session.
- List view exists with default columns:
  `Strnr`, `geändertes Objekt`, `Wert neu`, `Genehmigungsstatus`,
  `Legacy-Status`.
- Clicking a list row opens/navigates to the detail card for that change.

## Implementation Handoff

- Relevant files:
  - `prisma/schema.prisma`
  - `app/api/admin/pending-changes/route.ts`
  - `app/api/admin/pending-changes/[id]/route.ts`
  - `app/components/approval-queue.tsx`
- Current decisions:
  - Use sessionStorage for dashboard state, because URL filters already exist
    and session scope is preferable to localStorage for potentially personal
    search terms.
  - Use a DB-backed enum so `Legacy OK` is durable for all overview entry
    types.
- Open decisions:
  - Authenticated admin browser smoke by Sebastian or with a valid admin
    session.
- Non-goals:
  - No public visibility, no mail/export/offline cache change.
- Expected implementation steps:
  - Add schema/migration.
  - Extend GET serialization and PATCH status update.
  - Add UI state, filter, persistence, card layout, list view, and toggle.
- Required checks:
  - `npx prisma generate`
  - targeted ESLint
  - `npx tsc --noEmit --incremental false`
  - `git diff --check`
  - `npm run build` if time allows before deploy decision.
- Privacy/security checks:
  - Verify no localStorage/IndexedDB/service-worker cache addition.
  - Verify PATCH uses tenant-scoped admin/moderator auth.
- Risks/assumptions:
  - Migration is required for production.
  - Authenticated browser smoke remains manual unless a session is available.
- Context read before implementation:
  - `SESSION_HANDOFF.md` top block: read.
  - Relevant prior CRs: change dashboard CRs and approval queue files found.
  - Relevant source files: listed above.

## Model / Subagent Plan

- Model switch needed: no
- Target model/role: current Codex implementation
- Subagent needed: no
- Subagent role: n/a
- Handoff source: this CR

## Confirmation Gate

- Gate needed: yes for production deploy/migration
- Reason: schema change and admin-sensitive dashboard flow.
- Sensitive-data/production-data reason:
  - Admin dashboard contains participant/user names and request history.
  - Production migration changes DB schema.
- Approved by:
  - Sebastian requested implementation in Telegram on 2026-07-24 07:28 UTC.
  - Sebastian approved production deploy/migration with "Go" in Telegram on
    2026-07-24 07:56 UTC.
- Approval timestamp: 2026-07-24 07:56 UTC for production deploy/migration

## Implementation Notes

- Files changed:
  - `prisma/schema.prisma`
  - `prisma/migrations/20260724073100_add_legacy_sync_status_to_changes/migration.sql`
  - `app/api/admin/pending-changes/route.ts`
  - `app/api/admin/pending-changes/[id]/route.ts`
  - `app/components/approval-queue.tsx`
- Important decisions during implementation:
  - Added durable `legacyStatus` to legacy pending changes, generic change
    requests, and direct participant audit logs.
  - Added `PATCH /api/admin/pending-changes/[id]` for `OPEN` /
    `LEGACY_OK`; generic participant requests mirror to the linked legacy
    pending change.
  - Kept dashboard state in `sessionStorage` plus shareable URL params for
    active filters; no localStorage/IndexedDB/service-worker cache was added.
  - Added compact card header rework, legacy filter/toggle, and list view.

## Verification

- Local checks:
  - `npx prisma generate` -> pass
  - `npx eslint app/components/approval-queue.tsx app/api/admin/pending-changes/route.ts app/api/admin/pending-changes/[id]/route.ts` -> pass
  - `npx tsc --noEmit --incremental false` -> pass
  - `git diff --check` -> pass
- Build:
  - `npm run build` -> pass
- Targeted verification:
  - Compile/build verified `/aenderungen` and pending-changes API routes.
- Sensitive-data negative checks:
  - No new localStorage/IndexedDB/service-worker API cache.
  - PATCH resolves target tenant before update and still requires
    admin/moderator tenant role.
- Authenticated role smoke:
  - Not run locally; requires an authenticated admin session.
- Manual smoke:
  - Pending Sebastian/local browser smoke.

## Deploy

- Deployment needed: done.
- Commit: `f9d4131 Add change dashboard legacy status`
- Migration:
  `20260724073100_add_legacy_sync_status_to_changes` applied successfully to
  production.
- Deployment ID: `dpl_6sfp9w4sC57G7fMBk2ucrczCC14K`
- Deployment URL:
  `https://s5-evo-portal-5i4gm76uo-sebastiankroeker-2781s-projects.vercel.app`
- Production alias: `https://portal.s5evo.de`
- Deployed at: 2026-07-24 08:04 UTC

## Post-Deploy Smoke

- `npm run smoke:public` -> pass
- `HEAD https://portal.s5evo.de/aenderungen` -> 200
- `GET https://portal.s5evo.de/api/admin/pending-changes` without session
  -> 401 as expected
- Authenticated admin smoke was not run from this host; validate in live UI
  with an admin session.

## Follow-Ups

- Manual authenticated smoke on `/aenderungen` after deploy.
