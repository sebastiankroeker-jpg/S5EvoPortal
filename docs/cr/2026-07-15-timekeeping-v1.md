# CR: Zeitnahme V1

Status: Deployed
Date: 2026-07-15
Type: schema
Risk: high
Owner: S5Evo

## Context

Sebastian wants a first live-testable PWA stopwatch for manual timekeeping. The local Tailscale dev test on iPhone was not reliable because it ran over HTTP and did not represent the production PWA/Auth setup.

## Scope

- In scope:
  - Dedicated `ZEITNAHME` role and permissions.
  - `/zeitnahme` page for manual block starts and finish captures.
  - Snapshot API for approved RUN, ROAD, and MTB starters with start numbers.
  - Local browser persistence for captured events.
  - Event sync API writing append-only timekeeping sessions/events.
  - Navigation entry for users allowed to use timekeeping.
- Out of scope:
  - Automatic result takeover.
  - Master data changes from the stopwatch UI.
  - Barcode/QR scanning.
  - Final review/merge of raw times into official results.

## Affected Flows

- User/API/admin flows touched:
  - Admin user role assignment can include `ZEITNAHME`.
  - Admin/moderator/timekeeping users can open `/zeitnahme`.
  - Timekeepers can load a competition snapshot, capture local times, and sync raw events.
- Data model impact:
  - Adds `ZEITNAHME` to the Postgres/Prisma `Role` enum.
  - Adds `timekeeping_sessions` and `timekeeping_events`.
- Auth/permission impact:
  - `timekeeping.use` is granted to admin, moderator, and timekeeping.
  - `timekeeping.review` is reserved for admin/moderator.
- Production/deploy impact:
  - Requires Prisma migration deploy before sync can work.
  - Production smoke must cover protected route behavior and unauthenticated API status.

## Data / API Design

- Proposed data model:
  - `TimekeepingSession` groups a device/block/discipline stopwatch run.
  - `TimekeepingEvent` stores append-only client events with `clientEventId` de-duplication per session.
- Proposed API shape:
  - `GET /api/timekeeping/snapshot?competitionId=...`
  - `POST /api/timekeeping/events`
- Backward compatibility:
  - Existing team, participant, registration, and result tables are not modified by the migration.
  - No official result data is written by V1.
- Migration/data backfill:
  - No backfill.
  - New tables start empty.

## Open Questions

- Authenticated mobile smoke depends on Sebastian's real iPhone session after deploy.
- Review/official-results takeover remains a later CR.

## Acceptance Criteria

- `/zeitnahme` loads in production for allowed roles.
- Unauthenticated timekeeping APIs do not expose data.
- Snapshot returns active approved starters for the active competition.
- A manual test can capture times with and without start number, edit missing start numbers locally, and sync raw events.
- Synced raw events do not alter official results.

## Implementation Handoff

- Relevant files:
  - `app/zeitnahme/page.tsx`
  - `app/api/timekeeping/snapshot/route.ts`
  - `app/api/timekeeping/events/route.ts`
  - `prisma/schema.prisma`
  - `prisma/migrations/20260715111500_add_timekeeping_foundation/migration.sql`
  - `lib/permissions.ts`
  - `lib/server-permissions.ts`
  - navigation and user-management components
- Current decisions:
  - One installable portal PWA; access is role/permission-gated.
  - RUN and MTB are mass-start block timing but still capture individual finish times.
  - ROAD supports two active block clocks and configurable interval, default 30 seconds.
  - Local device data is the working buffer; server sync is append-only raw-event storage.
- Open decisions:
  - None blocking deploy.
- Non-goals:
  - No automated official result calculation in this release.
- Expected implementation steps:
  - Run local checks.
  - Take DB backup before migration.
  - Apply Prisma migration.
  - Commit and push to `main` after explicit deploy approval.
  - Verify production alias and smoke routes.
- Required checks:
  - `npx tsc --noEmit --incremental false`
  - `npm run build`
  - `git diff --check`
  - `npm run smoke:public` after deploy
- Risks/assumptions:
  - High-risk because this touches role enum, migration, and production deploy.
  - Migration is additive and should not mutate existing domain data.

## Model / Subagent Plan

- Model switch needed: no
- Target model/role: current Codex operator
- Subagent needed: no
- Subagent role: n/a
- Handoff source: this CR and `SESSION_HANDOFF.md`

## Confirmation Gate

- Gate needed: yes
- Reason: production deploy and DB migration.
- Approved by: Sebastian via Telegram "Dann Go"
- Approval timestamp: 2026-07-15 13:51 UTC

## Implementation Notes

- Files changed:
  - `app/zeitnahme/page.tsx`
  - `app/api/timekeeping/snapshot/route.ts`
  - `app/api/timekeeping/events/route.ts`
  - `prisma/schema.prisma`
  - `prisma/migrations/20260715111500_add_timekeeping_foundation/migration.sql`
  - `lib/permissions.ts`
  - `lib/server-permissions.ts`
  - `lib/team-access-config.ts`
  - `app/api/admin/users/[id]/roles/route.ts`
  - `app/components/bottom-tab-bar.tsx`
  - `app/components/nav-bar.tsx`
  - `app/components/role-simulation-banner.tsx`
  - `app/components/sidebar.tsx`
  - `app/components/user-management.tsx`
  - `app/page.tsx`
  - `app/changelog/page.tsx`
- Important decisions during implementation:
  - Production rollback is via previous Vercel deployment or redeploy of prior commit.
  - DB restore requires a real DB dump; CSV export is useful but not a full database backup.
  - Pre-migration DB dump created at `backups/db/s5evo-prod-before-timekeeping-20260715T135817Z.dump` with sidecar SHA256.
  - Previous production rollback point before deploy: `dpl_5XAKJRkWhDz3opiCLpwuUDvDLCQM`.

## Verification

- Local checks:
  - `npx tsc --noEmit --incremental false` passed.
  - `git diff --check` passed.
  - Targeted ESLint for timekeeping, role, navigation, and permission files passed.
- Build:
  - `npm run build` passed.
- Targeted verification:
  - `npx prisma migrate status` after deploy reported schema up to date.
  - Production DB timekeeping tables verified empty immediately after migration: `sessions=0`, `events=0`.
- Manual smoke:
  - Pending Sebastian iPhone check.

## Deploy

- Deployment needed: yes
- Deployment ID: `dpl_2BCfRS4pNu4rDYw5jVLCpB3beYDj`
- Deployment URL: `https://s5-evo-portal-m0yaq1wwb-sebastiankroeker-2781s-projects.vercel.app`
- Production alias: `https://portal.s5evo.de`
- Deployed at: 2026-07-15 14:02 UTC

## Post-Deploy Smoke

- Routes checked:
  - `npm run smoke:public`: `/`, `/login`, `/anmeldung`, `/aenderungen` all 200.
  - `/zeitnahme` returned 200 from production alias and included expected Next CSS/JS assets.
- API checks:
  - `/api/competition` -> 200.
  - `/api/results` -> 200.
  - `/api/teams` without session -> 401.
  - `/api/admin/pending-changes` without session -> 401.
  - `/api/timekeeping/snapshot?competitionId=...` without session -> 401.
  - `/api/timekeeping/events` with GET -> 405.
- Result:
  - Automated public/unauthenticated smoke passed.
  - Authenticated mobile/timekeeper smoke remains manual.

## Follow-Ups

- Build official result review/merge workflow as a separate CR.
