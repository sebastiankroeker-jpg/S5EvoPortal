# CR: Competition-scoped permissions audit

Status: Draft
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

## Data / API Design

- Proposed data model:
  - Audit output should recommend one of:
    - keep tenant-wide roles only;
    - add `CompetitionRole`;
    - add generic `AccessGrant` with tenant and optional competition scope.
- Proposed API shape:
  - Audit-only CR may produce no API changes.
  - Follow-up may introduce role assignment APIs for competition-scoped grants.
- Backward compatibility:
  - Current tenant-wide roles should continue to work.
- Migration/data backfill:
  - No migration in audit CR.
  - Follow-up migration should backfill current tenant roles into equivalent
    tenant-wide grants.

## Open Questions

- Decision 1: Which non-admin roles need competition scope for 2027?
  - `ZEITNAHME`
  - `MODERATOR`
  - possible `FRIENDS`
- Decision 2: When a concrete organisatoric need appears, define the exact
  authority difference between tenant-wide `ADMIN` and scoped
  `COMPETITION_ADMIN`.

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
  - Target model: `CompetitionRole` vs generic `AccessGrant`.
  - Which non-admin roles become competition-scoped.
- Non-goals:
  - No immediate data migration.
  - No production permission edits.
- Expected implementation steps:
  - Inventory API routes and permission helpers.
  - Classify route scopes.
  - Review UI-only gates vs server-side gates.
  - Review cache/export/messaging/timekeeping/result-staging surfaces.
  - Extend guard scripts for any missing patterns.
  - Produce follow-up implementation CR if needed.
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
- Subagent needed: recommended
- Subagent role: independent auth review
- Handoff source: this CR.

## Confirmation Gate

- Gate needed: yes
- Reason: high-risk auth/security audit; code guard changes may follow.
- Sensitive-data/production-data reason: routes protect sensitive participant,
  team, contact, result and audit data.
- Approved by:
- Approval timestamp:

## Implementation Notes

- Files changed:
- Important decisions during implementation:

## Verification

- Local checks:
- Build:
- Targeted verification:
- Sensitive-data negative checks:
- Authenticated role smoke:
- Manual smoke:

## Deploy

- Deployment needed: maybe
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

- Implement competition-scoped grants if audit recommends it.
- Add authenticated multi-role test tooling.
