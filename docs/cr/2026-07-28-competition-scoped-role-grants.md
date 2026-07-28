# CR: Competition-scoped role grants

Status: Draft
Date: 2026-07-28
Type: schema
Risk: high
Owner: S5Evo

## Context

The competition-scoped permission audit found that sensitive routes normally
resolve a selected competition to its tenant, but effective roles still come
from `TenantRole`. A tenant-level `MODERATOR` or `ZEITNAHME` grant therefore
applies to every competition of that tenant.

Audit source:
`docs/cr/2026-07-27-competition-scoped-permissions-audit.md`.

## Scope

- In scope:
  - Add explicit user-role grants per competition.
  - Keep tenant-wide `ADMIN`.
  - Make competition-sensitive non-admin APIs require an explicit competition.
  - Scope the effective role/permission profile and offline cache.
  - Add migration, compatibility behavior, negative tests and admin UI support.
- Out of scope:
  - No generic resource-level ACL framework.
  - No automatic creation of `COMPETITION_ADMIN`.
  - No implicit reassignment of current users to arbitrary competitions.
  - No production migration or deploy without separate confirmation.

## Affected Flows

- User/API/admin flows touched:
  - Moderator, timekeeping, result staging, exports, messaging, role management,
    profile roles, map access and competition switcher.
- Data model impact:
  - New `CompetitionRole` relation.
- Auth/permission impact:
  - High; effective non-admin authority changes from tenant-wide to selected
    competition.
- Sensitive data impact:
  - High; participant/contact/result/audit/export data is protected.
- Offline/cache/export/log/mail impact:
  - Profile-role cache becomes user/tenant/competition scoped.
  - Export/mail execution remains competition-bound.
- Production/deploy impact:
  - Schema migration, application rollout and explicit assignment/backfill.

## Privacy / Security Review

- Sensitive fields touched:
  - User IDs, roles, competition assignments, participant/contact/result and
    audit metadata protected by those roles.
- Purpose / data minimization:
  - Persist only `(userId, competitionId, role)` plus grant audit metadata.
- Visibility by role/user/API/UI:
  - Tenant `ADMIN` may manage competition grants in its own tenant.
  - Non-admin users may read only their own effective profile.
- Persistence locations:
  - PostgreSQL role grants and audit events.
  - Scoped offline role cache without sensitive participant payloads.
- Offline/cache behavior:
  - Key by user + tenant + competition; invalidate on scope change, role update
    and logout.
- Logs/mails/exports/screenshots exposure:
  - Never log raw role-management request payloads with personal details.
  - Negative tests must not execute production mail/export endpoints.
- Negative checks:
  - A grant for competition A must not authorize competition B in the same
    tenant.
  - A grant in tenant A must not authorize tenant B.
  - Missing `competitionId` must not fall back for scoped non-admin routes.
  - Entity IDs must resolve to the same authorized competition.
- Authenticated smoke plan or explicit gap:
  - Create controlled test users for Admin, Moderator, Timekeeping and Friends
    across two competitions before production rollout.
- Residual risk:
  - Legacy tenant-wide non-admin grants remain broad until explicitly migrated
    or disabled.

## Data / API Design

- Proposed data model:
  - `CompetitionRole`
    - `id`
    - `userId -> User`
    - `competitionId -> Competition`
    - `role -> Role`
    - `createdAt`
    - optional `grantedById -> User`
    - unique `(userId, competitionId, role)`
    - indexes `(competitionId, role)` and `(userId, competitionId)`
  - Keep `TenantRole` for tenant-wide `ADMIN` and an explicitly documented
    compatibility window.
  - Keep tenant-scoped `RolePermission` as the tenant policy mapping from an
    effective role to permission objects.
- Proposed API shape:
  - `GET /api/admin/competition-roles?competitionId=...`
  - `PUT /api/admin/users/:id/competition-roles`
    with required `competitionId` and validated role array.
  - `GET /api/profile/roles?competitionId=...` returns only effective roles and
    permissions for that competition.
- Backward compatibility:
  - Tenant `ADMIN` remains effective throughout its tenant.
  - During a bounded transition, current non-admin `TenantRole` rows are shown
    as `LEGACY_TENANT_WIDE` and remain effective until explicitly converted.
  - New non-admin assignments must use `CompetitionRole`.
- Migration/data backfill:
  - Add schema without deleting existing `TenantRole` rows.
  - Inventory every non-admin tenant role.
  - Admin must choose target competitions or acknowledge a deliberate
    tenant-wide legacy exception.
  - Remove compatibility only after assignments and authenticated tests pass.

## Open Questions

- Decision 1:
  - Make `FRIENDS` competition-scoped during this rollout, or defer until the
    2027 clone has separate maps/news?
- Decision 2:
  - Should global runtime logs use a fixed operator allowlist first, or a new
    platform-level permission model?

## Acceptance Criteria

- `MODERATOR` for competition A cannot access sensitive competition B routes in
  the same tenant.
- `ZEITNAHME` for competition A cannot read/write competition B timekeeping.
- Missing competition IDs fail closed on scoped non-admin APIs.
- Tenant `ADMIN` retains access to every competition in its tenant.
- Entity-scoped routes resolve entity -> competition -> tenant before role
  authorization.
- Profile roles/permissions and offline cache are scoped to the active
  competition.
- Existing protected routes remain 401/403 without a session.
- Migration and rollback instructions are documented and tested.

## Implementation Handoff

- Relevant files:
  - `prisma/schema.prisma`
  - `lib/server-permissions.ts`
  - `app/api/admin/users/[id]/roles/route.ts`
  - `app/api/profile/roles/route.ts`
  - `lib/permissions-context.tsx`
  - `scripts/verify-tenant-scope.ts`
  - `app/api/**/route.ts`
- Current decisions:
  - Use `CompetitionRole`, not generic `AccessGrant`.
  - `ADMIN` remains tenant-wide.
  - `MODERATOR` and `ZEITNAHME` become competition-scoped.
  - `TEAMCHEF` and `TEILNEHMER` remain primarily entity/self-derived.
- Open decisions:
  - Immediate or deferred competition scope for `FRIENDS`.
  - End date for legacy tenant-wide non-admin compatibility.
- Non-goals:
  - No platform-wide ACL abstraction.
  - No production role mutation without an approved mapping.
- Expected implementation steps:
  - Add schema/migration and effective-role resolver.
  - Introduce strict competition authorization helper.
  - Convert non-admin sensitive routes in small groups.
  - Scope profile/cache.
  - Add role management UI/API.
  - Run two-competition negative tests.
  - Deploy application, migrate, verify, then convert assignments.
- Required checks:
  - `npm run verify:tenant-scope`
  - all existing scope guards
  - targeted unit/integration tests
  - `npx tsc --noEmit --incremental false`
  - `npm run build`
  - `git diff --check`
- Privacy/security checks:
  - No production payload dumps.
  - No live mails/exports/resets during verification.
  - Explicit cross-competition and cross-tenant negative tests.
- Risks/assumptions:
  - No reusable authenticated multi-role fixture exists yet.
  - Current production appears operationally single-tenant, but the design must
    not depend on that assumption.
- Context read before implementation:
  - `SESSION_HANDOFF.md` top block: required.
  - Relevant prior CR(s):
    - `docs/cr/2026-07-27-competition-scoped-permissions-audit.md`
    - `docs/cr/2026-07-27-dynamic-permission-role-mapping.md`
  - Relevant source files:
    - `lib/server-permissions.ts`
    - `scripts/verify-tenant-scope.ts`

## Model / Subagent Plan

- Model switch needed: yes
- Target model/role: GPT-5.6 Sol for authorization design and review
- Subagent needed: no unless Sebastian explicitly requests delegation
- Subagent role: independent security review if later approved
- Handoff source: this CR and the completed audit CR

## Confirmation Gate

- Gate needed: yes
- Reason:
  - Schema and authorization semantics change; production role effects are
    material.
- Sensitive-data/production-data reason:
  - Incorrect migration could broaden or remove access to personal and result
    data.
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

- Deployment needed: yes
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

- Evaluate `COMPETITION_ADMIN` only when a concrete operating model requires it.
- Replace global runtime-log access with explicit platform scope.
