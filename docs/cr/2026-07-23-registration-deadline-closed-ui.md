# CR: Registration deadline closed UI freshness

Status: Deployed
Date: 2026-07-23
Type: hotfix
Risk: medium
Owner: S5Evo

## Context

Sebastian set the active competition registration deadline in Admin-Wettkampf to
2026-07-22 so that new registrations are closed. As logged-in user `NDBS`, the
registration UI still appeared open.

Backend creation paths in `app/api/teams/route.ts` already reject new normal
team, Sportlerboerse, and MTC submissions after `registrationDeadline`. The
remaining risk is stale client state and weak UI signalling for logged-in users.

Admin back-office flows were checked separately:

- `app/api/admin/marketplace-matching/route.ts` finalizes MTCs without a
  `registrationDeadline` guard; admin finalize requires `canEditAllTeams`, and
  owner finalize still requires ownership/auth checks.
- `app/api/admin/start-numbers/import/route.ts` is ADMIN-only and can still
  create missing teams when `createMissingTeams` is explicitly set and the CSV
  rows validate; it has no `registrationDeadline` guard.

This CR also records that the event-map CR now references the sponsor working
list: `docs/sponsorenliste-2026-07-23.md`.

## Scope

- In scope:
  - Make public competition status reads no-store so deadline changes are
    reflected immediately.
  - Make the registration form visibly closed for logged-in users, not only for
    anonymous routes.
  - Keep backend deadline enforcement intact.
- Out of scope:
  - Changing the admin deadline data model or stored date value.
  - Changing existing team/participant edit-after-deadline approval rules.
  - Blocking admin back-office operations such as MTC finalization or
    start-number import/team creation.
  - Production deploy before Sebastian explicitly approves.

## Affected Flows

- User/API/admin flows touched:
  - `/api/competition`
  - `TeamRegistration` public and logged-in registration UI
  - `CompetitionProvider` active competition bootstrap
- Data model impact:
  - None.
- Auth/permission impact:
  - None.
- Sensitive data impact:
  - No new sensitive fields are exposed or persisted.
- Offline/cache/export/log/mail impact:
  - `/api/competition` responses now send `Cache-Control: no-store`.
  - Client fetches for competition status use `{ cache: "no-store" }`.
- Production/deploy impact:
  - Functional hotfix deployed after Sebastian approved delivery on
    2026-07-23 00:42 UTC.

## Privacy / Security Review

- Sensitive fields touched:
  - None. Registration status includes competition metadata only.
- Purpose / data minimization:
  - Only deadline/status/team count data already used by the registration UI.
- Visibility by role/user/API/UI:
  - `/api/competition` remains public and unchanged in shape.
- Persistence locations:
  - No DB changes. Reduced cache persistence for the public competition status.
- Offline/cache behavior:
  - Explicit no-store to avoid stale open/closed registration state.
- Logs/mails/exports/screenshots exposure:
  - No new logs, mails, exports, or screenshots.
- Negative checks for unauthorized access or payload leakage:
  - Public payload shape unchanged; no sensitive fields added.
- Authenticated smoke plan or explicit gap:
  - Manual/authenticated NDBS UI smoke still needed after deploy.
- Residual risk:
  - Existing browser tab may need refresh to pick up the new client code.

## Data / API Design

- Proposed data model:
  - No change.
- Proposed API shape:
  - No response shape change.
  - Add no-store cache headers to `/api/competition`.
- Backward compatibility:
  - Compatible.
- Migration/data backfill:
  - None.

## Acceptance Criteria

- After the deadline is in the past, logged-in users see a visible
  `geschlossen` registration notice.
- The registration form is visually inactive after deadline.
- Client competition status fetches are not served from stale cache.
- New registration API submissions remain blocked after deadline.

## Implementation Handoff

- Relevant files:
  - `app/api/competition/route.ts`
  - `app/components/team-registration.tsx`
  - `lib/competition-context.tsx`
  - `docs/cr/2026-07-22-interaktive-event-map.md`
  - `docs/cr/2026-07-23-registration-deadline-closed-ui.md`
- Current decisions:
  - Treat the current bug as stale/read-model/UI signalling, not as a DB change.
  - Keep POST-side deadline blocks unchanged.
- Open decisions:
  - None for the hotfix deploy.
- Non-goals:
  - No production data mutation.
  - No registration deadline admin UI redesign.
- Expected implementation steps:
  - Add no-store headers/fetches.
  - Show closed registration notice for all users.
  - Reference sponsor list in the event-map CR.
- Required checks:
  - `npx eslint app/api/competition/route.ts app/components/team-registration.tsx lib/competition-context.tsx`
  - `npx tsc --noEmit --incremental false`
  - `git diff --check`
  - Targeted deadline helper/API behavior check where feasible.
- Privacy/security checks:
  - Confirm `/api/competition` shape unchanged except headers.
- Risks/assumptions:
  - Backend was already rejecting after deadline; this CR mainly fixes UI
    freshness and visibility.
- Context read before implementation:
  - `SESSION_HANDOFF.md` top block: read.
  - Relevant prior CR(s): `2026-07-22-interaktive-event-map.md`,
    `2026-07-14-team-edit-direct-until-registration-deadline.md`.
  - Relevant source files: listed above.

## Model / Subagent Plan

- Model switch needed: no
- Target model/role: current Codex
- Subagent needed: no
- Subagent role: n/a
- Handoff source: this CR

## Confirmation Gate

- Gate needed: yes for production deploy, no for local docs/code preparation.
- Reason: production deploy is externally visible.
- Sensitive-data/production-data reason: no sensitive-data broadening; no
  production data mutation.
- Approved by: Sebastian via Telegram, "Bitte noch ausliefern :)"
- Approval timestamp: 2026-07-23 00:42 UTC

## Implementation Notes

- Files changed:
  - `app/api/competition/route.ts`
  - `app/components/team-registration.tsx`
  - `lib/competition-context.tsx`
  - `docs/cr/2026-07-22-interaktive-event-map.md`
  - `docs/cr/2026-07-23-registration-deadline-closed-ui.md`
- Important decisions during implementation:
  - `/api/competition` success and error responses now include no-store cache
    headers.
  - Registration UI fetches competition status with `{ cache: "no-store" }`.
  - Closed status notice now appears for logged-in users too; the form below is
    visually inactive while existing submit guards remain in place.

## Verification

- Local checks:
  - `npx eslint app/api/competition/route.ts app/components/team-registration.tsx lib/competition-context.tsx` -> pass, with existing `react-hooks/exhaustive-deps` warning in `team-registration.tsx`.
  - `npx tsc --noEmit --incremental false` -> pass.
  - `git diff --check` -> pass.
- Build:
  - `npm run build` -> pass.
- Targeted verification:
  - Code review confirmed POST-side deadline blocks in `app/api/teams/route.ts`
    remain in place for MTC drafts, Sportlerboerse, and normal team
    registrations.
  - Code review confirmed `/api/competition` response shape is unchanged and
    only cache headers were added.
- Sensitive-data negative checks:
  - Response shape unchanged; no sensitive fields added.
- Authenticated role smoke:
  - Pending/gap until Sebastian or an authenticated browser session verifies
    user `NDBS`.
- Manual smoke:
  - Pending until deploy.

## Deploy

- Deployment needed: yes, completed.
- Commit:
  - `257a407 Fix registration deadline freshness`
- Deployment ID:
  - `dpl_9etNRAM7vJyYZSMC9AKpKTf9s6JT`
- Deployment URL:
  - `https://s5-evo-portal-7p2gv5dcy-sebastiankroeker-2781s-projects.vercel.app`
- Production alias:
  - `https://portal.s5evo.de`
- Deployed at:
  - 2026-07-23 00:48 UTC

## Post-Deploy Smoke

- Routes checked:
  - `npm run smoke:public` against `https://portal.s5evo.de` -> pass:
    `/`, `/login`, `/anmeldung`, `/aenderungen`, `/api/competition`,
    `/api/results`; protected `/api/teams` and
    `/api/admin/pending-changes` return 401 without session.
  - `HEAD https://portal.s5evo.de/` -> 200.
- API checks:
  - `HEAD https://portal.s5evo.de/api/competition` -> 200 with
    `Cache-Control: no-store, max-age=0`.
  - `GET https://portal.s5evo.de/api/competition` reports
    `registrationDeadline: 2026-07-22T00:00:00.000Z`.
  - `GET https://portal.s5evo.de/api/teams` without session -> 401
    `{"error":"Unauthorized"}`.
- Sensitive-data/API leakage checks:
  - Public smoke confirms protected team/admin APIs remain unauthorized without
    session.
- Result:
  - Pass.

## Follow-Ups

- Sebastian should refresh the logged-in `NDBS` session and verify that the
  registration form is closed in the browser.
