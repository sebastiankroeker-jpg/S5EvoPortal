# CR: Tenant Context Resolution Hardening

Status: Deployed
Date: 2026-07-28
Type: hotfix
Risk: high
Owner: S5Evo

## Context

The portal historically created the closed 2024 event in a separate tenant.
Production now has two tenants but the intended model is one club tenant with
multiple competitions. Several earlier route fixes addressed a recurring
failure mode: `requireTenantRoles()` silently chose the first matching tenant
role when no tenant was supplied. The authenticated competition-clone preview
revealed that the static allowlist did not prevent this pattern from returning.

## Scope

- In scope:
  - Remove implicit first-matching-tenant authorization.
  - Require explicit tenant, competition, or entity context for operational
    routes.
  - Make portal-global admin surfaces explicitly use any-tenant authorization.
  - Carry an active-competition scope anchor for tenant-wide settings written
    from a competition UI.
  - Replace the heuristic static allowlist with a fail-closed route check.
  - Include the already-local clone source-competition guard fix.
- Out of scope:
  - No tenant/competition data migration or 2024 tenant consolidation.
  - No production clone creation, schema migration, or role-data mutation.
  - No navigation/UI restructuring beyond required request context fields.

## Affected Flows

- User/API/admin flows touched: competition clone preview, tenant and
  competition configuration, role permissions, home news, claim-link global
  switch, dashboard layouts, user deletion, runtime logs and changelog.
- Data model impact: none.
- Auth/permission impact: high; an absent scope fails closed instead of
  selecting an arbitrary tenant role.
- Sensitive data impact: high; several affected admin APIs expose or mutate
  contacts, claims, roles, layouts, news and audit/log information.
- Offline/cache/export/log/mail impact: no cache/export/mail payload change.
- Production/deploy impact: release requires separate explicit Go.

## Privacy / Security Review

- Sensitive fields touched: existing role assignments, claim-link state,
  participant/team contacts, layout configuration, news authors and runtime
  log access.
- Purpose / data minimization: no serializer expansion; the change narrows
  reads and writes to the exact authorized context.
- Visibility by role/user/API/UI: selected competition resolves the tenant for
  tenant-wide administration; global log/changelog surfaces require an admin
  in any tenant but do not infer a tenant.
- Persistence locations: existing database records only; no new client cache.
- Offline/cache behavior: unchanged.
- Logs/mails/exports/screenshots exposure: no new logs, mails, exports or
  screenshots; no sensitive payloads in test output.
- Negative checks: static guard rejects unscoped `requireTenantRoles()`;
  missing context returns 400/403 rather than using another tenant.
- Authenticated smoke plan: Sebastian re-tests clone preview after deploy;
  controlled two-tenant test session remains unavailable to the agent.
- Residual risk: full authenticated production multi-tenant verification is a
  documented manual-smoke gap.

## Data / API Design

- `requireTenantRoles()` accepts only an explicit `tenantId`; implicit fallback
  is removed.
- `requireCompetitionRoles()` is the default for selected competition UI.
- `requireAnyTenantRoles()` is reserved for portal-global surfaces.
- Tenant-wide records created from an active competition use a separate scope
  anchor; their persisted `competitionId` remains `null`.
- Missing scope is a client error, never a first-tenant default.

## Acceptance Criteria

- No production route directly calls `requireTenantRoles()` without an
  explicit tenant ID.
- Competition/entity routes resolve their target before authorization.
- Claim-link toggle and tenant-wide dashboard-layout creation use the active
  competition only to resolve their tenant.
- Global runtime-log and changelog routes use explicit any-tenant auth.
- Static verification fails for any newly unscoped route call and covers the
  clone source guard.
- No API response broadens sensitive data.

## Implementation Handoff

- Relevant files: `lib/server-permissions.ts`, `app/api/admin/**`,
  `app/api/dashboard-layouts/**`, relevant UI callers,
  `scripts/verify-tenant-scope.ts`, `scripts/verify-competition-clone.ts`,
  `SESSION_HANDOFF.md`.
- Current decisions: tenant is organisation; competition is the event/year;
  2027 remains a competition under the current club tenant.
- Non-goals: no 2024 tenant move in this CR.
- Required checks: scope/clone guards, targeted ESLint, TypeScript, diff
  check, production build and unauthenticated protected-route checks after a
  separately approved release.

## Model / Subagent Plan

- Model switch needed: no
- Target model/role: current Codex implementation
- Subagent needed: no
- Handoff source: this CR and `SESSION_HANDOFF.md`.

## Confirmation Gate

- Gate needed: yes
- Reason: high-risk authorization hardening across sensitive admin flows.
- Sensitive-data/production-data reason: existing admin flows can expose or
  mutate roles, contacts, claim state, layouts and logs.
- Approved by: Sebastian (`Go`)
- Approval timestamp: 2026-07-28 13:02 UTC
- Release approval: Sebastian (`Go`), 2026-07-28 13:24 UTC.

## Implementation Notes

- Files changed:
  - `lib/server-permissions.ts`
  - scoped admin/API routes for competition, tenant settings, role permissions,
    home news, claim links, user deletion, runtime logs, changelog, visitor
    counter and dashboard layouts
  - claim-link and dashboard-layout UI callers
  - `scripts/verify-tenant-scope.ts`,
    `scripts/verify-admin-competition-scope.ts` and clone verification
  - clone CR and session handoff.
- Important decisions during implementation:
  - The `requireTenantRoles()` TypeScript signature now requires a non-empty
    `tenantId`; its database lookup of the first matching role is deleted.
  - Tenant settings, role permissions, competition settings and competition
    home news require a selected competition and resolve its tenant server-side.
  - Existing tenant-global dashboard layouts remain persisted with
    `competitionId: null`; create requests now provide
    `tenantContextCompetitionId` solely for authorization.
  - The claim-link global toggle now carries the selected competition and
    updates only that competition's tenant setting.
  - Changelog and Vercel runtime logs are intentionally portal-global and now
    use `requireAnyTenantRoles()` rather than a misleading selected tenant.
  - Entry-specific home-news updates resolve the entry first and recheck admin
    access against that entry's real tenant.
  - Competition configuration no longer silently loads/updates the newest
    competition in a first tenant; a competition ID is mandatory. New
    competitions continue to be created through the explicit clone flow.

## Rollback / Mitigation

- No database schema or production data changes are part of this CR.
- Before release, production remains unchanged.
- If an unexpected legacy caller is found after release, roll back the code
  commit; do not restore first-tenant fallback. The caller must instead pass a
  selected competition or an explicit tenant context.

## Verification

- Local checks:
  - `npm run verify:tenant-scope` -> green; all 79 API routes classified.
  - `npm run verify:competition-clone` -> green.
  - `npm run verify:admin-competition-scope` -> green.
  - `npm run verify:admin-dashboard-scope` -> green.
  - `npm run verify:admin-csv-export-scope` -> green.
  - targeted ESLint -> green.
  - `npx tsc --noEmit --incremental false` -> green.
  - `git diff --check` -> green.
- Build: `npm run build` -> green.
- Targeted verification:
  - Static route guard rejects every direct API use of `requireTenantRoles()`
    without `tenantId` and rejects the former fallback marker.
  - The clone route requires `ADMIN` for the source competition directly.
  - Tenant-global layout and claim-toggle UI callers send the active
    competition only as their tenant context anchor.
- Sensitive-data negative checks:
  - no serializer, cache, export, mail or technical-log expansion;
  - no production requests, production data mutation or production clone.
- Authenticated role smoke: manual post-release clone preview remains required;
  a controlled two-tenant production session remains unavailable to the agent.

## Deploy

- Deployment needed: yes, completed.
- Functional commit: `7414bb4 Harden tenant context resolution`.
- Auto-deploy: `dpl_9bA2NL98rddoLF7BGuf5YXqFFtG1`, READY.
- Explicit deploy: `dpl_BnrF18c3TrPWfuTnXNa8dSqKntjD`, READY.
- Deployment URL:
  `https://s5-evo-portal-dvexidy9z-sebastiankroeker-2781s-projects.vercel.app`
- Production alias: `https://portal.s5evo.de`.
- Migration/data mutation: none.

## Post-Deploy Smoke

- Public smoke against the production alias -> green: root, login,
  registration, changes, competition and results APIs.
- Protected APIs remain protected without a session: teams and pending changes
  -> 401; clone preview with an invalid source ID -> 401; claim-link global
  toggle -> 401.
- `/karte` without a session -> 307 redirect.
- Sensitive-data/API leakage: no payload was emitted in smoke output; no clone
  or other production data was created.
- Authenticated manual smoke: Sebastian must re-run clone preview using the
  selected 2026 competition; controlled two-tenant session remains unavailable
  to the agent.

## Follow-Ups

- Perform a read-only 2024 tenant consolidation dry-run as a separate CR.
