# CR: Dynamic permission role mapping

Status: Deployed
Date: 2026-07-27
Type: schema
Risk: high
Owner: S5Evo

## Context

Sebastian wants role handling to become configurable instead of relying only on
hard-coded role enums and route-level checks. The target is an admin-managed
permission model where functions / permission objects can be assigned to roles.

Current state:

- `TenantRole` assigns fixed roles (`ADMIN`, `MODERATOR`, `ZEITNAHME`,
  `TEAMCHEF`, `TEILNEHMER`) per tenant.
- Server routes already use centralized helpers for many critical flows.
- There is no editable permission catalog or role-to-permission matrix.

Decision from Sebastian, 2026-07-27:

- `ADMIN` may stay tenant-wide.
- Dynamic permissions should follow the audit's role target model instead of
  prematurely replacing every existing helper.

## Scope

- In scope:
  - Add a durable permission catalog for portal functions / permission objects.
  - Add role-to-permission assignment that can be edited by authorized admins.
  - Keep current roles as seeded defaults / system roles.
  - Add a central server-side permission check API, e.g. `requirePermission()`.
  - Add admin UI for viewing and editing role permission assignments.
  - Add migration/backfill so current behavior remains unchanged after deploy.
- Out of scope:
  - No public broadening of participant/team/result data.
  - No removal of existing tenant/competition guard helpers in the first step.
  - No free-form custom code permissions.
  - No production role changes without explicit admin action after deployment.

## Affected Flows

- User/API/admin flows touched:
  - Admin role management.
  - Admin/user/competition API authorization.
  - Potentially navigation visibility for role-gated functions.
- Data model impact:
  - New permission catalog and role-permission mapping tables.
  - Possible migration/backfill from existing role enum semantics.
- Auth/permission impact:
  - High. This changes the authorization model.
- Sensitive data impact:
  - High. Wrong mappings could expose participant names, contacts, claim state,
    results, audit trails, messages or exports.
- Offline/cache/export/log/mail impact:
  - Permission payload must not be cached broadly without tenant/competition
    scope and invalidation strategy.
- Production/deploy impact:
  - Requires migration, backfill, build, public and authenticated smoke.

## Privacy / Security Review

- Sensitive fields touched:
  - Role assignments, permission grants, user-to-role relationships.
  - Indirectly protects participant/team/contact/result/audit data.
- Purpose / data minimization:
  - Store permission identifiers and grant metadata only.
  - Do not store sensitive payloads in permission records.
- Visibility by role/user/API/UI:
  - Only tenant admins should edit role-permission mappings.
  - Non-admins may receive only minimal effective capability flags needed by UI.
- Persistence locations:
  - PostgreSQL permission tables.
  - Optional UI capability flags; avoid unnecessary localStorage persistence.
- Offline/cache behavior:
  - Effective permissions must be scoped by tenant and competition where
    relevant. Invalidate on login/logout and role changes.
- Logs/mails/exports/screenshots exposure:
  - Do not log full permission matrices in technical logs.
  - Audit administrative changes, but keep old/new values compact.
- Negative checks:
  - Unauthorized users cannot edit or read permission mappings.
  - UI hiding is not sufficient; all protected APIs must enforce server checks.
- Authenticated smoke plan or explicit gap:
  - Needs authenticated admin smoke and at least one negative non-admin check.
- Residual risk:
  - Static route guards must be updated to understand permission checks, not only
    legacy role helper names.

## Data / API Design

- Proposed data model:
  - `PermissionObject`
    - `id`, `key`, `label`, `category`, `description`, `riskLevel`,
      `createdAt`, `updatedAt`
  - `RolePermission`
    - `id`, `role`, `permissionKey`, `tenantId?`, `createdAt`, `createdById`
  - Optional later: `CustomRole` if system roles are not enough.
- Proposed API shape:
  - `GET /api/admin/permissions`
  - `GET /api/admin/role-permissions`
  - `PUT /api/admin/role-permissions`
  - Shared server function:
    - `getEffectivePermissions(userId, tenantId, competitionId?)`
    - `requirePermission(session, permissionKey, scope)`
- Backward compatibility:
  - Seed role-permission mappings to preserve current behavior exactly.
  - Existing `requireTenantRoles()` helpers may internally map roles to
    permissions during transition.
- Migration/data backfill:
  - Create catalog.
  - Seed current role defaults.
  - Do not delete current `TenantRole`.

## Open Questions

- Decision 1: Should custom roles be allowed now, or only system roles with
  editable permission mapping?
- Decision 2: Which permission objects are V1? Suggested V1:
  - admin.users.manage
  - admin.roles.manage
  - admin.teams.manage
  - admin.participants.manage
  - admin.results.manage
  - admin.results.publish
  - admin.timekeeping.manage
  - admin.audit.view
  - admin.exports.run
  - portal.map.view
  - portal.live.view
  - portal.results.view
  - messaging.manage

## Acceptance Criteria

- Existing behavior remains unchanged immediately after deployment.
- Admin can view the permission matrix.
- Admin can assign/unassign permission objects to roles.
- Permission changes are enforced server-side, not only in UI.
- Sensitive admin APIs remain protected without session and for insufficient
  permissions.
- Static guard coverage is updated for permission-based authorization.

## Implementation Handoff

- Relevant files:
  - `prisma/schema.prisma`
  - `lib/server-permissions.ts`
  - `app/api/admin/**/route.ts`
  - `app/admin/**`
  - `scripts/verify-tenant-scope.ts`
  - `package.json`
- Current decisions:
  - Keep existing roles as system roles.
  - Introduce permission objects as the next authorization layer.
  - Preserve tenant-wide `ADMIN` unless the audit explicitly recommends
    otherwise.
- Open decisions:
  - Custom roles in V1 or later.
  - Exact V1 permission catalog.
- Non-goals:
  - No broad UI redesign.
  - No sensitive serializer expansion.
- Expected implementation steps:
  - Add schema/migration.
  - Seed permission catalog and role defaults.
  - Add central permission resolver.
  - Add admin API and UI.
  - Convert a small number of routes first or wrap old helpers internally.
  - Add guards and tests.
- Required checks:
  - `npx prisma generate`
  - `npx prisma validate`
  - migration review
  - targeted ESLint
  - `npx tsc --noEmit --incremental false`
  - `npm run build`
  - `git diff --check`
  - relevant auth/tenant guard scripts
- Privacy/security checks:
  - Negative unauthenticated API checks.
  - Authenticated admin/non-admin smoke where possible.
- Risks/assumptions:
  - This is a high-risk auth migration and should be implemented in small steps.
- Context read before implementation:
  - `SESSION_HANDOFF.md` top block: required.
  - Relevant prior CR(s):
    - `docs/cr/2026-07-18-tenant-scope-audit-guardrail.md`
    - `docs/cr/2026-07-18-entity-id-tenant-scope-guardrails.md`
  - Relevant source files:
    - `prisma/schema.prisma`
    - `lib/server-permissions.ts`

## Model / Subagent Plan

- Model switch needed: yes
- Target model/role: Codex implementation after approval
- Subagent needed: recommended
- Subagent role: independent auth/security review
- Handoff source: this CR and prior tenant-scope CRs.

## Confirmation Gate

- Gate needed: yes
- Reason: high-risk auth and schema change.
- Sensitive-data/production-data reason: incorrect permissions could expose
  participant/team/contact/result/audit data.
- Approved by: Sebastian ("Go")
- Approval timestamp: 2026-07-28 04:34 UTC

## Implementation Notes

- Files changed:
  - `prisma/schema.prisma`
  - `prisma/migrations/20260728043000_add_dynamic_role_permissions/migration.sql`
  - `prisma/migrations/20260728043100_seed_friends_map_permission/migration.sql`
  - `lib/server-permissions.ts`
  - `lib/permissions.ts`
  - `app/api/admin/role-permissions/route.ts`
  - `app/api/profile/roles/route.ts`
  - `app/components/permission-matrix.tsx`
  - `app/components/user-management.tsx`
  - `lib/permissions-context.tsx`
- Important decisions during implementation:
  - V1 keeps system roles; custom roles remain a follow-up.
  - `PermissionObject` is the catalog and tenant-scoped `RolePermission`
    assigns catalog entries to system roles.
  - V1 exposes only permission objects with an implemented server consumer:
    `admin.roles.manage` and `portal.map.view`.
  - Existing legacy route guards remain in place until the separate
    competition-scoped permission audit. The new matrix does not pretend to
    control unaudited routes.
  - `ADMIN` cannot lose `admin.roles.manage`, preventing matrix lockout.
  - Online clients receive effective dynamic permission keys from the profile
    endpoint; legacy client permissions remain role-based.
  - Dynamic permissions are not written to the offline role cache.
  - PostgreSQL requires the new `FRIENDS` enum value to commit before it is
    used; enum/schema and Friends seed are therefore separate migrations.

## Verification

- Local checks:
  - `npx prisma generate`
  - `npx prisma validate`
  - targeted ESLint
  - `npx tsc --noEmit --incremental false`
  - `git diff --check`
- Build: `npm run build` passed locally and on Vercel.
- Targeted verification:
  - `npx prisma migrate deploy` applied both new migrations.
  - `npx prisma migrate status` reports the production schema up to date.
- Sensitive-data negative checks:
  - `GET /api/admin/role-permissions` without session returns 401.
  - No participant/contact/result payload was added to the matrix API.
- Authenticated role smoke:
  - Gap: no reusable admin/non-admin cookie was available for automation.
- Manual smoke:
  - Still requested for matrix editing and role change behavior.

## Deploy

- Deployment needed: yes
- Deployment ID: `dpl_9LpqN8yWyDnscGRHYDLz7vPkKX75`
- Deployment URL:
  `https://s5-evo-portal-6drw9nxx1-sebastiankroeker-2781s-projects.vercel.app`
- Production alias: `https://portal.s5evo.de`
- Deployed at: 2026-07-28 04:37 UTC

## Post-Deploy Smoke

- Routes checked: public smoke suite passed.
- API checks:
  - `/api/admin/role-permissions` without session -> 401.
- Sensitive-data/API leakage checks:
  - Public smoke does not expose protected API payloads.
- Result: Vercel `READY`; alias points to the deployment.

## Follow-Ups

- Competition-scoped permission grants.
- Custom roles, if later needed.
- Add authenticated admin/non-admin permission-matrix tests.
