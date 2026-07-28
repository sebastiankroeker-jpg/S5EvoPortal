# CR: Competition-scoped permissions audit

Status: Implemented locally
Date: 2026-07-27
Type: hotfix
Risk: high
Owner: S5Evo

## Context

Sebastian asked whether permissions can be safely controlled per competition and
whether all permissions are server-side secured.

Current state:

- `TenantRole` grants roles per tenant, not per competition.
- `PermissionObject` and tenant-scoped `RolePermission` now provide a dynamic
  permission matrix for system roles.
- The initial enforced permission objects are `admin.roles.manage` and
  `portal.map.view`.
- `FRIENDS` is a tenant role and receives `portal.map.view` by default.
- `/karte` checks `portal.map.view` server-side before rendering.
- Existing admin/result/timekeeping/export/messaging routes still use legacy
  role helpers. They were intentionally not mass-converted before this audit.
- Server helpers resolve a selected `competitionId` to its tenant for many
  sensitive routes.
- This means access is competition-aware during checks, but role grants are not
  truly competition-scoped.

Decision from Sebastian, 2026-07-27:

- `ADMIN` may remain tenant-wide.
- Competition scope is primarily relevant for non-admin roles such as
  Moderator, Timekeeping, Friends or future competition-specific operators.
- A future `COMPETITION_ADMIN` role is acceptable later, but does not need to be
  introduced before a concrete organisatoric need exists.

## Scope

- In scope:
  - Audit all role checks and permission-sensitive API routes.
  - Classify routes as tenant-scoped, competition-scoped, entity-scoped,
    public, or global.
  - Identify which roles should remain tenant-wide and which should become
    competition-scoped.
  - Produce an implementation plan for `CompetitionRole` / `AccessGrant`, if
    needed.
  - Extend static guards where gaps are found.
- Out of scope:
  - No schema migration in the audit CR unless explicitly approved as follow-up.
  - No production data mutation.
  - No role reassignment.
  - No broad UI redesign.

## Affected Flows

- User/API/admin flows touched:
  - Admin routes, result staging, timekeeping, exports, claim-links, messaging,
    competition switcher, user management, public/live routes.
- Data model impact:
  - Audit only. Follow-up may add `CompetitionRole` or `AccessGrant`.
- Auth/permission impact:
  - High. The audit reviews authorization boundaries.
- Sensitive data impact:
  - High. Participant/team/contact/result/audit/export data is in scope.
- Offline/cache/export/log/mail impact:
  - Audit cache keys, exports, logs and mails where role scope matters.
- Production/deploy impact:
  - Documentation-only unless guard changes are approved.

## Privacy / Security Review

- Sensitive fields touched:
  - Role assignments, participant names/contact data, claim state, result data,
    audit/event/export metadata.
- Purpose / data minimization:
  - Audit should inspect code paths and payload shape without dumping sensitive
    production data.
- Visibility by role/user/API/UI:
  - Validate that route visibility is enforced server-side.
- Persistence locations:
  - CR findings only; no new data persistence in audit-only phase.
- Offline/cache behavior:
  - Check whether active competition/tenant is present in cache keys.
- Logs/mails/exports/screenshots exposure:
  - Do not print production payloads in audit output.
- Negative checks:
  - Protected routes without session remain 401/403.
  - Routes with entity IDs resolve target tenant/competition before role auth.
- Authenticated smoke plan or explicit gap:
  - Authenticated multi-role smoke is desired; document gap if no reusable test
    session exists.
- Residual risk:
  - Static code audit cannot fully replace end-to-end authenticated role tests.

## Audit Findings

The executable route inventory in `scripts/verify-tenant-scope.ts` classifies
all 78 current `app/api/**/route.ts` files. The check fails when a route is
added or removed without updating its scope classification.

Scope distribution:

- Competition: 31
- Entity: 15
- Tenant: 8
- Self: 6
- Mixed scope: 6
- Public: 3
- Global platform: 3
- Capability token: 3
- Framework auth: 2
- Secret-protected cron: 1

Mixed routes participate in more than one authorization category; the
executable inventory assigns each route one primary category.

### F-01 — Timekeeping session ID was not scope-bound

- Severity: High
- Status: Fixed locally
- Surface: `app/api/timekeeping/events/route.ts`
- Finding:
  - The caller was authorized against the submitted competition tenant.
  - A submitted `session.id` was then passed to a global-ID `upsert`.
  - A known session ID from another tenant/competition could therefore select
    and update the foreign session and its event rows.
- Fix:
  - Load an existing session by ID inside the transaction.
  - Reject it unless both `tenantId` and `competitionId` equal the authorized
    scope.
  - Only then update it; otherwise create a new session in the authorized scope.
  - `verify:tenant-scope` now asserts both scope comparisons.
- Production status: not deployed.

### F-02 — Non-admin grants are tenant-wide, not competition-scoped

- Severity: High architectural gap
- Status: Open follow-up
- Surface:
  - `TenantRole`, `getTenantRoleFlagsForUserId`,
    `requireCompetitionTenantRoles`, timekeeping, moderation, result staging,
    messaging and export routes.
- Finding:
  - Sensitive routes usually resolve `competitionId -> tenantId` correctly.
  - Authorization then checks `TenantRole`, so `MODERATOR` or `ZEITNAHME` for a
    tenant is effective for every competition in that tenant.
  - This is server-side enforcement, but it does not express the requested
    competition boundary.
- Recommendation:
  - Keep `ADMIN` tenant-wide.
  - Add explicit competition grants for `MODERATOR` and `ZEITNAHME`.
  - Add `FRIENDS` as a competition grant when maps/news differ by competition.
  - Keep `TEAMCHEF` and `TEILNEHMER` primarily entity-derived from team and
    participant relationships.

### F-03 — Optional competition IDs can fall back to tenant scope

- Severity: High design risk
- Status: Open follow-up
- Surface:
  - `requireCompetitionTenantRoles` falls back to `requireTenantRoles` when the
    competition ID is absent.
  - List/audit routes intentionally support tenant-wide fallback today.
- Finding:
  - The helper name suggests a strict competition guard, but missing scope can
    broaden access to the whole tenant.
  - This becomes an authorization bypass as soon as a non-admin role is
    competition-scoped unless the helper is made explicit.
- Recommendation:
  - Split into strict `requireCompetitionRoles` and explicit
    `requireTenantRoles`.
  - Competition-sensitive non-admin APIs must require a non-empty
    `competitionId`; tenant-wide admin APIs must opt into tenant scope.

### F-04 — Client role profile mixes tenant scopes

- Severity: Medium
- Status: Open follow-up
- Surface: `app/api/profile/roles/route.ts`,
  `lib/permissions-context.tsx`
- Finding:
  - The endpoint returns the union of roles from all tenants.
  - Dynamic permissions are evaluated for the first tenant role.
  - The offline role cache key contains neither tenant nor competition.
  - Server routes still enforce their own checks, so this primarily causes
    incorrect UI affordances and stale/overbroad client state.
- Recommendation:
  - Require or derive the active `competitionId`.
  - Return effective roles/permissions for that scope only.
  - Include user + tenant + competition in the cache key and clear scoped
    entries on logout/scope change.

### F-05 — Global platform surfaces use tenant roles

- Severity: Medium
- Status: Open follow-up
- Surface:
  - Admin changelog routes.
  - Vercel runtime log route.
- Finding:
  - These resources are global to the portal/project, but any user with the
    accepted role in any tenant can access them.
- Recommendation:
  - Mark them explicitly as platform scope.
  - Restrict runtime logs to a platform-operator permission; do not derive
    global authority from `MODERATOR` in one tenant.

### F-06 — Map permission is any-tenant

- Severity: Medium
- Status: Accepted for the current single shared map; follow-up before clone
- Surface: `app/karte/page.tsx`,
  `hasEffectivePermissionForAnyTenant`
- Finding:
  - A map permission in any tenant grants access to the shared map.
  - This is server-side protected, but not tied to an active competition.
- Recommendation:
  - Before competition-specific maps are introduced, require the active
    competition and evaluate `portal.map.view` in its effective scope.

### F-07 — Public/default competition selection is globally implicit

- Severity: Low
- Status: Open hardening
- Surface:
  - Public competition/news/visitor-counter defaults.
  - Marketplace fallback when no competition ID is provided.
- Finding:
  - Missing scope can select the globally newest/open/default competition.
  - Current public serializers minimize fields and no private payload leak was
    identified, but multi-tenant behavior is ambiguous.
- Recommendation:
  - Resolve public scope by host/tenant slug or require an explicit competition
    identifier once multiple tenants are active.

## Data / API Design

- Proposed data model:
  - Recommendation: add an explicit `CompetitionRole` relation in addition to
    existing `TenantRole`.
  - Do not start with a generic polymorphic `AccessGrant`; it adds nullable
    scope combinations and validation complexity without a current
    resource-level grant requirement.
  - Suggested uniqueness: `(userId, competitionId, role)`.
  - The competition relation provides the tenant invariant; authorization must
    still reject grants whose competition does not belong to the selected
    tenant.
- Proposed API shape:
  - Add a scoped role-assignment API requiring `competitionId`.
  - Effective authorization input is `(userId, tenantId, competitionId?)`.
  - Tenant-wide `ADMIN` remains valid for every competition of its tenant.
  - Non-admin competition roles are read only from `CompetitionRole` once
    migration is complete.
- Backward compatibility:
  - Use a bounded compatibility phase in which existing non-admin
    `TenantRole`s are treated as explicitly labelled tenant-wide legacy grants.
  - Do not silently convert them to one arbitrary competition.
- Migration/data backfill:
  - No migration in audit CR.
  - Follow-up must inventory current non-admin grants and require an explicit
    competition assignment or intentional tenant-wide exception.
  - `ADMIN` remains in `TenantRole`.

## Open Questions

- Resolved for target design:
  - `MODERATOR` and `ZEITNAHME` need competition scope.
  - `ADMIN` remains tenant-wide.
  - `TEAMCHEF` and `TEILNEHMER` remain entity/self-derived.
- Still open:
  - Whether `FRIENDS` becomes competition-scoped immediately or only when the
    2027 clone has distinct maps/news.
  - Whether a future `COMPETITION_ADMIN` is needed; it is not required now.

## Acceptance Criteria

- Every API route with role-sensitive behavior is classified.
- Known sensitive routes have documented server-side guards.
- Gaps are listed with severity and proposed fix.
- A recommended target model is documented.
- Static guards are updated if obvious regressions are found.
- No production data is mutated.

## Implementation Handoff

- Relevant files:
  - `lib/server-permissions.ts`
  - `lib/permissions.ts`
  - `app/api/admin/role-permissions/route.ts`
  - `app/karte/page.tsx`
  - `scripts/verify-tenant-scope.ts`
  - `app/api/**/route.ts`
  - `app/components/**`
  - `prisma/schema.prisma`
- Current decisions:
  - Current grants are tenant-wide.
  - Dynamic permission assignments are also tenant-scoped in V1.
  - `ADMIN` and `FRIENDS` are seeded with `portal.map.view`; ADMIN must retain
    `admin.roles.manage`.
  - Legacy role guards remain authoritative except for explicitly migrated
    permission consumers.
  - Many checks are competition-aware by resolving competition -> tenant.
  - `ADMIN` should remain tenant-wide for now.
  - `COMPETITION_ADMIN` is a valid future role, but not required for the first
    permission iteration.
- Open decisions:
  - Timing of competition-scoped `FRIENDS`.
  - Whether platform-level permissions need a separate model or a fixed
    operator allowlist first.
- Non-goals:
  - No immediate data migration.
  - No production permission edits.
- Expected implementation steps:
  - Implement the follow-up CR for competition-scoped role grants.
  - Keep the executable 78-route inventory current.
  - Deploy the local timekeeping scope fix only after explicit approval.
- Required checks:
  - `npm run verify:tenant-scope`
  - existing admin scope guard scripts
  - targeted route scan
  - `npx tsc --noEmit --incremental false` if code changes
  - `git diff --check`
- Privacy/security checks:
  - No sensitive payload dumps.
  - Unauthorized public checks for high-risk endpoints where feasible.
- Risks/assumptions:
  - Authenticated role smoke may be blocked without test users/sessions.
- Context read before implementation:
  - `SESSION_HANDOFF.md` top block: required.
  - Relevant prior CR(s):
    - `docs/cr/2026-07-18-tenant-scope-audit-guardrail.md`
    - `docs/cr/2026-07-18-entity-id-tenant-scope-guardrails.md`
  - Relevant source files:
    - `lib/server-permissions.ts`
    - `scripts/verify-tenant-scope.ts`

## Model / Subagent Plan

- Model switch needed: yes
- Target model/role: GPT-5.6 Sol for the security/authorization audit
- Subagent needed: no
- Subagent role: not used; no delegation was requested
- Handoff source: this CR.

## Confirmation Gate

- Gate needed: yes
- Reason: high-risk auth/security audit; code guard changes may follow.
- Sensitive-data/production-data reason: routes protect sensitive participant,
  team, contact, result and audit data.
- Approved by: Sebastian ("los")
- Approval timestamp: 2026-07-28 08:19 UTC
- Commit/push/production deploy approved by: Sebastian ("Go")
- Deploy approval timestamp: 2026-07-28 08:41 UTC

## Implementation Notes

- Files changed:
  - `app/api/timekeeping/events/route.ts`
  - `scripts/verify-tenant-scope.ts`
  - `docs/cr/2026-07-27-competition-scoped-permissions-audit.md`
  - `docs/cr/2026-07-28-competition-scoped-role-grants.md`
  - `SESSION_HANDOFF.md`
- Important decisions during implementation:
  - Explicit `CompetitionRole` is preferred over generic `AccessGrant`.
  - `ADMIN` remains tenant-wide; non-admin operational roles become
    competition-scoped.
  - New API routes must be added to the executable scope inventory.

## Verification

- Local checks:
  - `npm run verify:tenant-scope` -> green; 78 routes classified.
  - Targeted ESLint -> green.
  - `npx tsc --noEmit --incremental false` -> green.
  - `git diff --check` -> green.
- Build:
  - `npm run build` -> green.
- Targeted verification:
  - Static guard checks competition/entity helper usage.
  - Static guard checks timekeeping session tenant and competition binding.
- Sensitive-data negative checks:
  - No production payloads read or logged.
  - No mail/export/reset endpoint executed.
  - No schema or production data mutation.
- Authenticated role smoke:
  - Gap: no reusable multi-role test sessions/cookies.
- Manual smoke:
  - Not applicable before deployment.

## Deploy

- Deployment needed: yes for F-01 only; approved 2026-07-28 08:41 UTC
- Deployment ID:
- Deployment URL:
- Production alias:
- Deployed at:
- Rollback:
  - No database migration or production-data mutation is part of this package.
  - Restore the prior application commit/deployment if the timekeeping sync
    regresses; the previous documented production deployment is
    `dpl_E8i4FtbMXvxD1zgBbUSBx55pBU3y`.

## Post-Deploy Smoke

- Routes checked:
- API checks:
- Sensitive-data/API leakage checks:
- Result:

## Follow-Ups

- Implement competition-scoped grants if audit recommends it.
- Add authenticated multi-role test tooling.
- Scope `/api/profile/roles` and its offline cache to the active competition.
- Introduce a platform-operator permission for runtime logs.
