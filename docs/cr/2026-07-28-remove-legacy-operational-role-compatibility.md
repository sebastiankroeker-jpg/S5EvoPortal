# CR: Remove legacy tenant-wide operational-role compatibility

Status: Implementation complete — release approval pending
Date: 2026-07-28
Type: schema
Tier: High-risk
Risk: high
Owner: S5Evo

## Context

`CompetitionRole` is deployed for `MODERATOR` and `ZEITNAHME`. Sebastian has
now explicitly converted all three existing production timekeeping users to
the active competition. Aggregate verification shows no remaining tenant-wide
operational grants.

The former compatibility code still treats an accidental tenant-wide
`MODERATOR` or `ZEITNAHME` `TenantRole` as effective. That fallback must be
removed so a future competition cannot be reached through a stale role row.

## Scope

- In scope:
  - Make `MODERATOR` and `ZEITNAHME` effective only via `CompetitionRole`.
  - Remove legacy role labels and API fields from the UI/read model.
  - Prevent new tenant-wide operational grants at database level.
  - Restrict tenant-wide admin/switcher/messaging fallbacks to genuinely
    tenant-wide roles.
  - Extend the two-competition negative verification matrix.
- Out of scope:
  - No user/role conversion; production already has zero legacy operational
    grants.
  - No change to tenant-wide `ADMIN`, `FRIENDS`, `TEILNEHMER` or entity-derived
    team rights.
  - No generic ACL framework or platform-operator role.

## Affected Flows

- Timekeeping, moderator administration, competition switcher, profile role
  endpoint, offline role profile, admin messaging/support recipient handling
  and user-role management.
- Existing stale `TenantRole` rows for `MODERATOR`/`ZEITNAHME` will cease to
  grant access after rollout.

## Privacy / Security Review

- Data touched: role assignments, selected competition IDs and recipient
  selection only; no participant/contact/result fields are added or exported.
- Purpose/minimization: retain only explicit `(user, competition, role)`
  grants for operational authority.
- Visibility: only tenant admins manage grants; non-admin profiles receive
  effective roles for their active competition.
- Persistence/cache: no new browser cache data. Existing V2 profile cache is
  user/tenant/competition scoped and invalidated by the deployed role flow.
- Logs/mails/exports: no role payloads in technical logs; no mail/export is
  executed by this CR.
- Residual risk: authenticated production cross-competition smoke remains
  unavailable without controlled sessions. The production inventory is safe to
  deploy because it contains zero legacy operational rows.

## Design / Invariants

- `ADMIN`, `FRIENDS` and `TEILNEHMER` remain tenant-scoped.
- `MODERATOR` and `ZEITNAHME` are never effective from `TenantRole`.
- The database rejects future tenant-wide `MODERATOR`/`ZEITNAHME` rows.
- A user with an operational grant for competition A is denied in competition
  B unless an explicit competition B grant exists.
- Global/admin-only surfaces must not inherit competition roles.

## Acceptance Criteria

- A legacy tenant role for `MODERATOR` or `ZEITNAHME` does not authorize any
  competition-sensitive route.
- Explicit `CompetitionRole` grants retain their authorised competition only.
- `ADMIN` retains tenant-wide authority and its full competition switcher.
- A DB migration fails to allow tenant-wide operational roles.
- User/profile APIs no longer expose `LEGACY_TENANT_WIDE` as a valid scope.
- All relevant scope scripts, TypeScript and production build pass.

## Implementation Handoff

- Relevant source:
  - `lib/competition-role-policy.ts`
  - `lib/server-permissions.ts`
  - `lib/messaging.ts`
  - `app/api/admin/competitions/route.ts`
  - `app/api/admin/users/route.ts`
  - `app/api/profile/roles/route.ts`
  - admin messaging/conversation routes
  - `scripts/verify-competition-role-scope.ts`
- Expected database migration: add a `tenant_roles` constraint rejecting
  `MODERATOR` and `ZEITNAHME`.
- Local implementation approval: Sebastian, “Bitte weiter machen”,
  2026-07-28 10:47 UTC.

## Confirmation Gate

- Local implementation and verification: approved.
- Not approved: production migration, functional commit/push to `main`,
  Vercel production deploy, or any production data mutation.
- Required release evidence: zero legacy operational role rows immediately
  before deploy; migration status; target scope matrix; TypeScript/build;
  public and protected-route smoke; documented authenticated-smoke gap.
- Rollback: re-alias the prior application deployment. Do not remove the DB
  constraint while any prohibited role row exists; no data migration is
  planned.

## Implementation Notes

- `lib/competition-role-policy.ts` excludes operational roles from the
  tenant-role portion of every effective-role calculation.
- `lib/server-permissions.ts` excludes them from tenant-wide permission
  queries and removes the legacy-role response field.
- Competition selection, support/messaging and global operational endpoints
  now distinguish tenant-wide admin authority from competition-local grants.
- The profile and user-management read models no longer expose a legacy
  operational-role scope.
- Migration `20260728105000_disallow_tenant_wide_operational_roles` adds a
  `tenant_roles` CHECK constraint for `MODERATOR` and `ZEITNAHME`.
- Important decision: global runtime logs and changelog endpoints are
  explicitly admin-only; a competition grant must not become platform-wide
  access.

## Verification

- Local checks: `git diff --check`, `npx prisma validate` and targeted ESLint
  all pass.
- Build: `npm run build` passes.
- Targeted verification:
  - `npm run verify:competition-role-scope` passes, including legacy-role
    negative cases and the migration/static guards;
  - `npm run verify:tenant-scope` passes (78 API routes classified);
  - `npm run verify:admin-competition-scope` passes;
  - `npx tsc --noEmit --incremental false` passes.
- Sensitive-data negative checks:
- Authenticated role smoke: still pending controlled production sessions;
  this known gap is retained for release evidence.

## Deploy

- Deployment needed: yes; not approved.
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

- Create reusable controlled Admin/Moderator/Timekeeping sessions for
  authenticated production negative smoke.
- Continue with the 2027 competition-clone CR after this security gate.
