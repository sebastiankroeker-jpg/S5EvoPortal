# CR: Friends role with map access

Status: Deployed
Date: 2026-07-27
Type: feature
Risk: medium
Owner: S5Evo

## Context

Sebastian wants a new authorization role `FRIENDS`. Friends should have the
same baseline access as regular portal users and additionally access to the map
function.

Decision from Sebastian, 2026-07-27:

- "Portal user" means every logged-in user.
- The map is currently visible only for admins.
- Friends should unlock the map for logged-in non-admin users without granting
  broader admin access.

This can be implemented either as a simple new role enum first or as a
permission assignment after the dynamic permission model exists.

## Scope

- In scope:
  - Add a new role `FRIENDS`.
  - Define the role's V1 capability set.
  - Allow admins to assign/remove the role.
  - Ensure map access is server-side protected if the map becomes non-public.
  - Keep Friends away from admin-only participant/contact/audit/export data.
- Out of scope:
  - No broad Friends dashboard.
  - No participant/team management rights.
  - No result-staging, timekeeping, exports, audit, messaging admin access.

## Affected Flows

- User/API/admin flows touched:
  - User/role management.
  - Navigation visibility.
  - Map route/API access, if map is gated.
- Data model impact:
  - If implemented before dynamic permissions: add `FRIENDS` to `Role` enum.
  - If implemented after dynamic permissions: seed role-permission mapping.
- Auth/permission impact:
  - Medium. New role with intentionally narrow extra permission.
- Sensitive data impact:
  - Low to medium, depending on what map overlays expose.
- Offline/cache/export/log/mail impact:
  - Avoid caching protected map data without role/tenant/competition scope.
- Production/deploy impact:
  - Requires deploy; schema migration if enum changes.

## Privacy / Security Review

- Sensitive fields touched:
  - Role assignment records.
  - Potentially route/map metadata; no participant/contact fields intended.
- Purpose / data minimization:
  - Friends get only map access plus normal portal-user visibility.
- Visibility by role/user/API/UI:
  - Admins can assign Friends.
  - Friends can see map function only where permitted.
- Persistence locations:
  - DB role assignment or role-permission mapping.
- Offline/cache behavior:
  - Map data may be public/static or role-gated. If role-gated, cache keys must
    include tenant/competition/user capability state or avoid offline caching.
- Logs/mails/exports/screenshots exposure:
  - No mails/exports.
  - Do not log role assignment payloads beyond audit metadata.
- Negative checks:
  - Friends cannot access admin APIs.
  - Friends cannot access participant/contact exports.
- Authenticated smoke plan or explicit gap:
  - Needs admin role assignment smoke and Friends account smoke.
- Residual risk:
  - Map payloads must be checked for hidden admin-only overlays before opening
    access to Friends.

## Data / API Design

- Proposed data model:
  - Preferred after dynamic permissions:
    - system role `FRIENDS`
    - permission `portal.map.view`
  - Simpler fallback:
    - add `FRIENDS` to Prisma `Role` enum.
- Proposed API shape:
  - Extend existing user role management API/UI.
  - Add/adjust server guard for map data if needed.
- Backward compatibility:
  - Existing roles unchanged.
  - Existing users unaffected.
- Migration/data backfill:
  - No user should receive Friends automatically unless explicitly decided.

## Open Questions

- Decision 1: Should Friends be a tenant role only, or should Friends be
  competition-scoped after the permission audit?
- Decision 2: Should every logged-in user see a limited map placeholder, or
  should the map navigation appear only for Admins/Friends?

## Acceptance Criteria

- Admin can assign and remove `FRIENDS`.
- Friends can access the map function that is currently admin-only.
- Friends have no admin, export, timekeeping, result-staging, claim-link or
  audit access.
- Unauthenticated users still cannot access protected map functionality.
- Permission behavior is enforced server-side for any non-public map API.

## Implementation Handoff

- Relevant files:
  - `prisma/schema.prisma`
  - `lib/server-permissions.ts`
  - user management APIs/UI
  - map route/API/components
- Current decisions:
  - Friends are narrower than Moderator/Admin/Timekeeping.
  - Friends should not expose participant/contact data.
  - Baseline portal user means every logged-in user.
  - The map is currently admin-only and should be opened for Friends.
- Open decisions:
  - Tenant-wide Friends vs competition-scoped Friends.
  - Navigation behavior for logged-in users without Friends.
- Non-goals:
  - No admin capabilities.
  - No broad data serializer changes.
- Expected implementation steps:
  - Confirm baseline access.
  - Add role or permission mapping.
  - Update user management UI/API.
  - Gate map UI/API where needed.
  - Add negative checks.
- Required checks:
  - `npx prisma generate` if schema changes.
  - targeted ESLint
  - `npx tsc --noEmit --incremental false`
  - `npm run build`
  - `git diff --check`
- Privacy/security checks:
  - Friends cannot reach admin APIs.
  - Friends map payload contains no unnecessary PII.
- Risks/assumptions:
  - The map is admin-only today; opening it for Friends requires checking that
    map payloads do not include admin-only overlays or sensitive details.
- Context read before implementation:
  - `SESSION_HANDOFF.md` top block: required.
  - Relevant prior CR(s):
    - `docs/cr/2026-07-27-event-map-gpx-route-update.md`
    - dynamic permission role mapping CR if implemented first.
  - Relevant source files:
    - map route/component files
    - user role management files

## Model / Subagent Plan

- Model switch needed: no
- Target model/role: current Codex implementation after approval
- Subagent needed: optional
- Subagent role: security review if map visibility becomes restricted
- Handoff source: this CR.

## Confirmation Gate

- Gate needed: yes
- Reason: role/permission change and potential schema migration.
- Sensitive-data/production-data reason: role assignment controls visibility.
- Approved by: Sebastian ("Go")
- Approval timestamp: 2026-07-28 04:34 UTC

## Implementation Notes

- Files changed:
  - `prisma/schema.prisma`
  - both dynamic-permission migrations
  - `app/api/admin/users/[id]/roles/route.ts`
  - `app/components/user-management.tsx`
  - `app/components/sidebar.tsx`
  - `app/karte/page.tsx`
  - `app/components/admin-event-map-page.tsx`
  - `app/api/profile/roles/route.ts`
  - `lib/permissions.ts`
  - `lib/permissions-context.tsx`
  - `lib/server-permissions.ts`
  - `lib/team-access-config.ts`
- Important decisions during implementation:
  - `FRIENDS` is a tenant system role in V1.
  - Friends receives `portal.map.view` by default and no admin permissions.
  - `/karte` performs a server-side permission check before rendering.
  - Map data remains PII-free; no participant/contact overlays were added.

## Verification

- Local checks: Prisma validate/generate, targeted ESLint, TypeScript,
  production build and `git diff --check` passed.
- Build: local and Vercel production builds passed.
- Targeted verification:
  - Friends is accepted by the user-role API and shown in user management.
  - Permission seed assigns `portal.map.view` to `ADMIN` and `FRIENDS`.
- Sensitive-data negative checks:
  - `/karte` without session redirects (307) instead of rendering the map.
  - Permission-matrix API without session returns 401.
- Authenticated role smoke:
  - Gap: no reusable Friends/non-admin cookie was available.
- Manual smoke:
  - Assign Friends, re-login, verify map access and absence of admin access.

## Deploy

- Deployment needed: yes
- Deployment ID: `dpl_9LpqN8yWyDnscGRHYDLz7vPkKX75`
- Deployment URL:
  `https://s5-evo-portal-6drw9nxx1-sebastiankroeker-2781s-projects.vercel.app`
- Production alias: `https://portal.s5evo.de`
- Deployed at: 2026-07-28 04:37 UTC

## Post-Deploy Smoke

- Routes checked: public smoke passed; `/karte` unauthenticated -> 307.
- API checks: permission matrix unauthenticated -> 401.
- Sensitive-data/API leakage checks: no map PII or new broad serializer.
- Result: Vercel `READY`, production alias active.

## Follow-Ups

- Competition-scope decision for Friends belongs to the permission audit.
- Add authenticated Friends and negative non-admin browser/API smoke.
