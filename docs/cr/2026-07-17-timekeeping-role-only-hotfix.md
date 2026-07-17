# CR: Zeitnahme nur mit Zeitnahme-Rolle

Status: Deployed
Date: 2026-07-17
Type: hotfix
Risk: medium
Owner: S5Evo

## Context

Sebastian clarified that timekeeping functionality must not be shown or available to admins by default. Users should only get the stopwatch/timekeeping capture surface after the explicit `ZEITNAHME` tenant role is assigned.

## Scope

- In scope:
  - Require explicit `ZEITNAHME` role for `/zeitnahme`.
  - Require explicit `ZEITNAHME` role for timekeeping snapshot and event sync APIs.
  - Hide timekeeping navigation/home/mobile entries for admins and moderators without `ZEITNAHME`.
- Out of scope:
  - No schema or migration changes.
  - No changes to user-role assignment UI; `ZEITNAHME` already exists.
  - No changes to admin result-staging review/import workflow.

## Affected Flows

- User/API/admin flows touched:
  - Admin and moderator users no longer inherit `timekeeping.use`.
  - Timekeeper users can still open `/zeitnahme`, load snapshots, and sync events.
- Data model impact:
  - None.
- Auth/permission impact:
  - `timekeeping.use` and `timekeeping.review` are explicit timekeeping-role permissions, not admin-wildcard permissions.
- Production/deploy impact:
  - Production deploy required after checks and Sebastian approval.

## Data / API Design

- Proposed data model:
  - No change.
- Proposed API shape:
  - Existing timekeeping APIs remain unchanged but accept only `ZEITNAHME`.
- Backward compatibility:
  - Users who already have `ZEITNAHME` keep access.
  - Admins who need stopwatch access must additionally receive `ZEITNAHME`.
- Migration/data backfill:
  - None.

## Open Questions

- None blocking local implementation.

## Acceptance Criteria

- Admin without `ZEITNAHME` does not see direct timekeeping entries.
- Admin without `ZEITNAHME` gets no `/zeitnahme` client access.
- Admin/moderator without `ZEITNAHME` receive `403` from timekeeping snapshot/event APIs.
- User with `ZEITNAHME` can still use the timekeeping page and APIs.
- Admin result-staging page remains admin-gated as before.

## Implementation Handoff

- Relevant files:
  - `lib/permissions.ts`
  - `app/api/timekeeping/snapshot/route.ts`
  - `app/api/timekeeping/events/route.ts`
  - `app/page.tsx`
  - `app/components/sidebar.tsx`
  - `app/components/bottom-tab-bar.tsx`
  - `app/zeitnahme/page.tsx`
- Current decisions:
  - Treat stopwatch capture as explicit role access.
  - Do not remove admin's ability to assign the role or review result-staging data.
- Open decisions:
  - Production deploy approval after local checks.
- Non-goals:
  - No DB migration.
  - No broader permission-system refactor.
- Expected implementation steps:
  - Adjust permission helper so `timekeeping.*` requires explicit `ZEITNAHME`.
  - Restrict timekeeping APIs to `ZEITNAHME`.
  - Remove sidebar result-edit shortcut to `/zeitnahme` unless `timekeeping.use`.
  - Run targeted checks.
- Required checks:
  - Targeted permission assertion.
  - `npx eslint` on touched files.
  - `npx tsc --noEmit --incremental false`.
  - `git diff --check`.
- Risks/assumptions:
  - Authenticated role smoke is not possible without live session cookies in this environment.

## Model / Subagent Plan

- Model switch needed: no
- Target model/role: current Codex operator
- Subagent needed: no
- Subagent role: n/a
- Handoff source: this CR and `SESSION_HANDOFF.md`

## Confirmation Gate

- Gate needed: yes
- Reason: role/permission semantics and production deploy.
- Approved by: Sebastian request in Telegram for local implementation
- Approval timestamp: 2026-07-17 07:10 UTC
- Production deploy approved by: Sebastian via Telegram "Go deploy"
- Production deploy approval timestamp: 2026-07-17 07:20 UTC

## Implementation Notes

- Files changed:
  - `lib/permissions.ts`
  - `app/api/timekeeping/snapshot/route.ts`
  - `app/api/timekeeping/events/route.ts`
  - `app/components/sidebar.tsx`
- Important decisions during implementation:
  - `ADMIN` keeps the general wildcard model, but `hasPermission()` treats `timekeeping.use` and `timekeeping.review` as explicit-role permissions.
  - The stopwatch APIs now call `requireTenantRoles(..., ["ZEITNAHME"])`; admin/moderator access no longer passes unless that user also has the timekeeping role.
  - The old Orga sidebar shortcut from `results.edit` to `/zeitnahme` now uses the same `timekeeping.use` gate as the other direct entries.

## Verification

- Local checks:
  - `npx tsx -e ...` permission assertions: passed (`ADMIN`/`MODERATOR` false, `ZEITNAHME` and `ADMIN+ZEITNAHME` true; admin wildcard still allows `config.edit`).
  - `npx eslint lib/permissions.ts app/api/timekeeping/snapshot/route.ts app/api/timekeeping/events/route.ts app/components/sidebar.tsx app/page.tsx app/components/bottom-tab-bar.tsx app/zeitnahme/page.tsx`: passed.
  - `npx tsc --noEmit --incremental false`: passed.
  - `git diff --check`: passed.
- Build:
  - `npm run build`: passed.
- Targeted verification:
  - Static code check confirms `/api/timekeeping/snapshot` and `/api/timekeeping/events` allow only `ZEITNAHME`.
- Manual smoke:
  - Authenticated browser smoke not run locally; no live session cookies available.

## Deploy

- Deployment needed: yes
- Commit: `5b9516c Restrict timekeeping to explicit role`
- Deployment ID: `dpl_HxJJjXkwHC5q5CF6guN9hsqzphjb`
- Deployment URL: `https://s5-evo-portal-bsfbqm5m4-sebastiankroeker-2781s-projects.vercel.app`
- Production alias: `https://portal.s5evo.de`
- Deployed at: 2026-07-17 07:26 UTC

## Post-Deploy Smoke

- Routes checked:
  - `npm run smoke:public` against `https://portal.s5evo.de`: passed.
  - `GET /zeitnahme` via production alias: 200, `server: Vercel`.
- API checks:
  - `GET /api/timekeeping/snapshot?competitionId=cmn3a1piz0002l104372yx9yt` without session: 401.
  - `POST /api/timekeeping/events` without session: 401.
- Result: passed.

## Follow-Ups

- Authenticated live smoke with one admin-only account and one `ZEITNAHME` account remains recommended.
