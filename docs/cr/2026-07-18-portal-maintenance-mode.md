# CR: Portal Maintenance Mode

Status: Draft
Date: 2026-07-18
Type: ops
Risk: medium
Owner: S5Evo

## Context

Sebastian reported that teams were no longer visible. Investigation showed this
was not an admin-role loss. Production cannot reach the Prisma database because
the DB account is restricted with `planLimitReached`; `/api/competition`
returns 500 and public smoke is red.

Sebastian asked to take the portal offline and show a construction/maintenance
notice that the portal is currently closed for maintenance.

## Scope

- In scope:
  - Add an app-level maintenance gate independent of database access.
  - Show a static German maintenance notice for the portal UI.
  - Enable the gate in Vercel Production with `PORTAL_MAINTENANCE_MODE=1`.
  - Deploy to `https://portal.s5evo.de`.
- Out of scope:
  - No DB migration.
  - No production data mutation.
  - No fix for Prisma `planLimitReached`.
  - No tenant-admin-controlled switch in this emergency hotfix.

## Affected Flows

- User/API/admin flows touched:
  - All app-router pages render the maintenance screen while the env flag is on.
  - API routes are not changed.
- Data model impact: none.
- Auth/permission impact: none; the maintenance page renders before auth
  providers and role context.
- Sensitive data impact: none intended; the page is static and does not fetch
  DB/session data.
- Offline/cache/export/log/mail impact:
  - No offline cache schema change.
  - No exports, mails, or sensitive logs.
- Production/deploy impact:
  - Production deploy required.
  - Vercel Production env var required.

## Privacy / Security Review

- Sensitive fields touched: none.
- Purpose / data minimization:
  - Avoid DB/session/API reads while the portal is in maintenance mode.
- Visibility by role/user/API/UI:
  - Same static page for public users and authenticated users.
- Persistence locations:
  - Code and Vercel env var only.
- Offline/cache behavior, TTL/invalidation/logout clearing:
  - No local data persistence added.
- Logs/mails/exports/screenshots exposure:
  - No sensitive values logged, mailed, or exported.
- Negative checks for unauthorized access or payload leakage:
  - Maintenance page should render without calling `/api/competition`.
- Authenticated smoke plan or explicit gap:
  - Authenticated smoke not required for a pre-auth static maintenance gate.
- Residual risk:
  - API routes remain technically reachable and may still fail while DB is
    restricted; this CR targets user-facing portal access.

## Data / API Design

- Proposed data model: none.
- Proposed API shape: unchanged.
- Backward compatibility:
  - Removing or setting `PORTAL_MAINTENANCE_MODE=0` restores normal app UI after
    redeploy/restart.
- Migration/data backfill: none.

## Open Questions

- Decision 1: After Prisma access is restored, add a tenant/competition admin
  maintenance switch backed by DB config?
- Decision 2: Should API routes also return a maintenance JSON response while
  the flag is enabled?

## Acceptance Criteria

- Production root page shows a clear German maintenance notice.
- The rendered maintenance page does not depend on Prisma, session, or tenant
  administration.
- Existing source can be restored by disabling `PORTAL_MAINTENANCE_MODE`.
- Build succeeds.
- Production alias `https://portal.s5evo.de` serves the maintenance page.

## Implementation Handoff

- Relevant files:
  - `app/layout.tsx`
  - `app/components/maintenance-screen.tsx`
  - `docs/cr/2026-07-18-portal-maintenance-mode.md`
  - `SESSION_HANDOFF.md`
- Current decisions:
  - Emergency gate is env-based, not DB/tenant-admin-based, because the DB is
    currently the unavailable dependency.
- Open decisions:
  - Later productized admin switch.
- Non-goals:
  - No DB fix, no DB mutation, no API maintenance middleware in this hotfix.
- Expected implementation steps:
  - Add static maintenance screen.
  - Gate root layout via `PORTAL_MAINTENANCE_MODE`.
  - Set Production env var to `1`.
  - Build and deploy.
- Required checks:
  - targeted ESLint
  - `npx tsc --noEmit --incremental false`
  - `git diff --check`
  - `npm run build`
  - post-deploy alias smoke for maintenance text
- Privacy/security checks:
  - Verify no DB/API/session fetch is needed to render the page.
- Risks/assumptions:
  - API endpoints remain unchanged and can still report DB errors.
- Context read before implementation:
  - `SESSION_HANDOFF.md` top block: read.
  - Relevant prior CR(s): tenant-scope guardrail CR and DB outage note.
  - Relevant source files: root layout and home flow.

## Model / Subagent Plan

- Model switch needed: no
- Target model/role: current Codex implementation
- Subagent needed: no
- Subagent role: n/a
- Handoff source: this CR and current session.

## Confirmation Gate

- Gate needed: yes
- Reason: production deploy and remote Vercel env mutation.
- Sensitive-data/production-data reason: no sensitive-data broadening; this is
  an emergency availability/ops action.
- Approved by: Sebastian requested taking the portal offline in Telegram.
- Approval timestamp: 2026-07-18 18:18 UTC

## Implementation Notes

- Files changed:
  - `app/layout.tsx`
  - `app/components/maintenance-screen.tsx`
  - `docs/cr/2026-07-18-portal-maintenance-mode.md`
- Important decisions during implementation:
  - Maintenance page is rendered before `Providers`, `LayoutWrapper`, and
    `PwaServiceWorker`, so it does not trigger session, permission, competition,
    presence, or unread-count requests.

## Verification

- Local checks:
- Build:
- Targeted verification:
- Sensitive-data negative checks:
- Authenticated role smoke:
- Manual smoke:

## Deploy

- Deployment needed: yes
- Deployment ID:
- Deployment URL:
- Production alias: `https://portal.s5evo.de`
- Deployed at:

## Post-Deploy Smoke

- Routes checked:
- API checks:
- Sensitive-data/API leakage checks:
- Result:

## Follow-Ups

- Add a tenant/competition-admin maintenance switch once Prisma access is
  restored, if this should be controllable without Vercel/env access.
