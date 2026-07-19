# CR: Portal Maintenance Mode

Status: Deployed
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
  - Mutating API routes return maintenance `503` while the flag is enabled.
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
  - Read-only API routes remain reachable for status/smoke reads; mutating API
    routes are blocked while maintenance mode is enabled.

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
- Decision 2: If a productized admin switch is added later, decide whether
  read-only APIs should also be hidden or remain available for health/status.

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
  - `proxy.ts`
  - `docs/cr/2026-07-18-portal-maintenance-mode.md`
  - `SESSION_HANDOFF.md`
- Current decisions:
  - Emergency gate is env-based, not DB/tenant-admin-based, because the DB is
    currently the unavailable dependency.
- Open decisions:
  - Later productized admin switch.
- Non-goals:
  - No DB fix, no DB mutation, no tenant-admin maintenance switch in this
    hotfix.
- Expected implementation steps:
  - Add static maintenance screen.
  - Gate root layout via `PORTAL_MAINTENANCE_MODE`.
  - Block mutating `/api/*` requests via `proxy.ts` while maintenance mode is
    enabled.
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
  - Read-only API endpoints remain available; mutating endpoints return
    maintenance `503`.
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
  - `proxy.ts`
  - `docs/cr/2026-07-18-portal-maintenance-mode.md`
  - `SESSION_HANDOFF.md`
- Important decisions during implementation:
  - Maintenance page is rendered before `Providers`, `LayoutWrapper`, and
    `PwaServiceWorker`, so it does not trigger session, permission, competition,
    presence, or unread-count requests.
  - Mutating API methods (`POST`, `PUT`, `PATCH`, `DELETE`) are blocked under
    `/api/*` by `proxy.ts` in maintenance mode.
  - `PORTAL_MAINTENANCE_MODE=1` was added to Vercel Production env.
  - After Prisma/Vercel subscription upgrade, `PORTAL_MAINTENANCE_MODE` was
    overwritten again and the final deployment also passed the flag explicitly
    via `vercel deploy --prod --yes --env PORTAL_MAINTENANCE_MODE=1`.
  - Commit: `fea24c6 Add portal maintenance mode`.
  - Follow-up commit: pending in current session.

## Verification

- Local checks:
  - `npx eslint app/layout.tsx app/components/maintenance-screen.tsx` -> green
  - `npx eslint proxy.ts app/layout.tsx app/components/maintenance-screen.tsx`
    -> green
  - `npx tsc --noEmit --incremental false` -> green
  - `git diff --check` -> green
- Build:
  - `npm run build` -> green
  - `PORTAL_MAINTENANCE_MODE=1 vercel build --prod` -> green
- Targeted verification:
  - Root layout gates before app providers when `PORTAL_MAINTENANCE_MODE=1`.
- Sensitive-data negative checks:
  - Static page uses no DB/session/API data.
- Authenticated role smoke:
  - Not needed for pre-auth maintenance page.
- Manual smoke:
  - `https://portal.s5evo.de/` contains `Wartungsarbeiten`, `Portal aktuell
    geschlossen`, and `wegen Wartungsarbeiten`.
  - `https://portal.s5evo.de/anmeldung` contains the same maintenance copy.

## Deploy

- Deployment needed: yes, completed after Prisma/Vercel subscription upgrade.
- Deployment ID:
  - Failed: `dpl_A3pbRRCcMX6avzXbzECLXmFNwxuU`
  - Failed: `dpl_9w1ifE7aKRgVxmGVzm4GMFkYGfDP`
  - Failed prebuilt: `dpl_75E9dNvj3888R6F5odRmwQyBU4MM`
  - Ready UI-only retry: `dpl_8J2azAcv8CMqUMU1rNFzPisZFRa5`
  - Ready with explicit env flag: `dpl_32ss4Ad7QPoQNsojxtM3TQogA1Mv`
  - Final with mutating API guard: pending in current session.
- Deployment URL:
  - Failed: `https://s5-evo-portal-j1johkzdh-sebastiankroeker-2781s-projects.vercel.app`
  - Failed: `https://s5-evo-portal-hczn59oq2-sebastiankroeker-2781s-projects.vercel.app`
  - Failed prebuilt: `https://s5-evo-portal-ku2ar4dye-sebastiankroeker-2781s-projects.vercel.app`
  - Ready UI-only retry: `https://s5-evo-portal-edscs46ij-sebastiankroeker-2781s-projects.vercel.app`
  - Ready with explicit env flag: `https://s5-evo-portal-bwifyh9iu-sebastiankroeker-2781s-projects.vercel.app`
  - Final with mutating API guard: pending in current session.
- Production alias: `https://portal.s5evo.de`
- Deployed at: 2026-07-19 09:16 UTC for maintenance UI; API guard deploy
  pending in current session.

## Post-Deploy Smoke

- Routes checked:
  - `/` -> 200, maintenance text present.
  - `/anmeldung` -> 200, maintenance text present.
- API checks:
  - `/api/competition` -> 200 after subscription upgrade; read-only API remains
    available.
  - Mutating API guard final production check pending in current session.
- Sensitive-data/API leakage checks:
  - Not applicable; deploy did not go live.
- Result:
  - Maintenance UI is live on the production alias; final mutating API guard is
    pending deployment in current session.

## Follow-Ups

- Add a tenant/competition-admin maintenance switch once Prisma access is
  restored, if this should be controllable without Vercel/env access.
- Disable `PORTAL_MAINTENANCE_MODE` and redeploy when Sebastian wants the portal
  reopened.
