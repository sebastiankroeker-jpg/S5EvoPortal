# CR: Entity-ID Tenant Scope Guardrails

Status: Deployed
Date: 2026-07-18 / 2026-07-19
Type: hotfix
Risk: high
Owner: S5Evo

## Context

Follow-up from `docs/cr/2026-07-18-tenant-scope-audit-guardrail.md`.
The previous hotfix secured direct `competitionId` admin surfaces. Five remaining
routes are scoped by entity IDs (`teamId`, `participantId`, `pendingChangeId`,
or `bundleId`) and still need target-entity tenant resolution before role
authorization.

On 2026-07-19 the Messenger inbox exposed a sibling issue: multi-tenant admin
routes without an explicit entity or competition scope must not use the first
matching/default tenant as a hard data filter. The inbox list was fixed in
`678c866`; this CR additionally hardens admin Messenger target lookup and admin
conversation creation.

On 2026-07-18 16:52 UTC Sebastian reported that no teams were visible. Live
diagnosis found a production DB access restriction, not an admin-role loss:
`/api/competition` returned 500 and Vercel logs showed Prisma P1001. A direct
`psql` connection attempt returned `planLimitReached`.

## Scope

- In scope:
  - Add entity-scoped auth helpers or route-local tenant resolution for the
    documented entity-ID-only routes.
  - Ensure selected entity tenant determines Admin/Moderator authorization
    before sensitive reads or mutations.
  - Add static guard coverage so these routes cannot silently regress to
    fallback tenant authorization.
  - Harden Messenger admin target lookup and admin conversation creation so
    multi-tenant Orga accounts use all manageable tenants or the target context
    tenant instead of an implicit first tenant.
  - Keep request/response API shapes unchanged.
- Out of scope:
  - No DB migration.
  - No production data mutation during verification.
  - No outbound claim, lifecycle, participant, or org mails during agent tests.
  - No production deploy without separate explicit Go.
  - No fix for the current Prisma `planLimitReached` account restriction.

## Affected Flows

- User/API/admin flows touched:
  - Claim link create/revoke/regenerate flows by `teamId` or `participantId`.
  - Deleted team restore by route `teamId`.
  - Participant change bundle create/detail/decision by pending-change or bundle
    IDs.
  - Messenger admin target list and admin-created support conversations.
- Data model impact: none.
- Auth/permission impact: yes; entity target tenant should be resolved before
  role authorization, avoiding fallback tenant mismatch for multi-tenant admins.
- Sensitive data impact: high; affected flows include team names, participants,
  birth dates/years, e-mails, claim-link state, audit records, and role-scoped
  mutations.
- Offline/cache/export/log/mail impact:
  - No offline cache change intended.
  - Some touched routes can send operational mails in real use; verification
    must avoid sending mails.
  - No new technical logs of sensitive payloads.
- Production/deploy impact: local only until a separate deploy approval.

## Privacy / Security Review

- Sensitive fields touched:
  - Participant names, birth dates/years, e-mails, claim-token state, team
    identity, team contact context, pending-change snapshots, audit/mail
    metadata.
- Purpose / data minimization:
  - Use entity IDs only to derive the owning tenant for authorization and to
    continue existing route behavior.
  - Do not broaden serializers or add new response fields.
- Visibility by role/user/API/UI:
  - Existing Admin/Moderator/Admin-only route semantics remain.
  - Authorization must be checked against the tenant of the target entity, not
    against the first matching tenant role.
- Persistence locations:
  - Existing database writes in real user flows remain.
  - CR and handoff documentation only; no new persistence.
- Offline/cache behavior, TTL/invalidation/logout clearing:
  - No offline cache changes.
- Logs/mails/exports/screenshots exposure:
  - Do not print sensitive payloads in smoke output.
  - Do not send test mails or generate exports.
- Negative checks for unauthorized access or payload leakage:
  - Static guard should reject fallback `requireTenantRoles()` usage in the five
    entity-scoped follow-up routes unless an explicit scoped helper is present.
  - Unauthenticated requests should remain 401.
- Authenticated smoke plan or explicit gap:
  - Gap: agent has no reusable authenticated multi-tenant Admin session/cookies.
- Residual risk:
  - Static guards reduce regression risk but do not replace authenticated
    multi-tenant integration tests.

## Data / API Design

- Proposed data model: none.
- Proposed API shape: unchanged for existing request/response contracts.
- Backward compatibility:
  - Existing request bodies and route params remain valid.
  - Error semantics should stay close to current behavior: 401 unauthenticated,
    403 unauthorized, 404 missing target where applicable.
- Migration/data backfill: none.

## Open Questions

- Decision 1: Use shared helpers in `lib/server-permissions.ts` for team,
  participant, pending-change, and bundle tenant resolution, or keep narrowly
  route-local helpers for this hotfix?
- Decision 2: Extend `npm run verify:tenant-scope` or create a separate
  `verify:entity-tenant-scope` script for clarity?

## Acceptance Criteria

- Claim-link POST/PATCH authorize against the tenant of the target team or
  participant before mutation.
- Deleted-team restore authorizes against the deleted team's competition tenant
  before restore/mails/audit.
- Participant-change bundle create/detail/decision authorize against the tenant
  derived from the pending changes in the target bundle or request body before
  returning sensitive details or applying decisions.
- Static guard covers all five entity-ID-only follow-up routes.
- No serializer expansion, no DB migration, no production data mutation during
  verification.

## Implementation Handoff

- Relevant files:
  - `lib/server-permissions.ts`
  - `app/api/admin/claim-links/route.ts`
  - `app/api/admin/deleted-teams/[id]/restore/route.ts`
  - `app/api/admin/participant-change-bundles/route.ts`
  - `app/api/admin/participant-change-bundles/[id]/route.ts`
  - `app/api/admin/participant-change-bundles/[id]/decision/route.ts`
  - `scripts/verify-tenant-scope.ts` or a new verify script
  - `package.json`
  - `SESSION_HANDOFF.md`
- Current decisions:
  - Current production outage is DB-account-side `planLimitReached`, not this
    CR's auth logic.
  - Entity target tenant must be resolved before relying on `auth.tenantId`.
- Open decisions:
  - Shared helper shape and verify script placement.
- Non-goals:
  - No deploy, no DB migration, no production data mutation, no mails.
- Expected implementation steps:
  - Add shared entity-scope helper(s) or route-local target-tenant resolution.
  - Patch the five follow-up routes.
  - Add static guard coverage.
  - Run targeted guards, ESLint for touched routes, TypeScript, diff check, and
    build if feasible.
- Required checks:
  - `npm run verify:tenant-scope`
  - targeted ESLint for touched routes and helper/script files
  - `npx tsc --noEmit --incremental false`
  - `git diff --check`
  - `npm run build`
- Privacy/security checks:
  - No serializer expansion.
  - Protected endpoints without session remain protected.
  - No mail/export/reset execution.
- Risks/assumptions:
  - Production DB currently blocked by Prisma account restriction
    `planLimitReached`; live authenticated smoke is blocked until resolved.
- Context read before implementation:
  - `SESSION_HANDOFF.md` top block: read 2026-07-18.
  - Relevant prior CR(s): `docs/cr/2026-07-18-tenant-scope-audit-guardrail.md`.
  - Relevant source files: route inventory read 2026-07-18.

## Model / Subagent Plan

- Model switch needed: no
- Target model/role: current Codex implementation after approval
- Subagent needed: no
- Subagent role: n/a
- Handoff source: this CR, prior tenant-scope CR, and current session context.

## Confirmation Gate

- Gate needed: yes
- Reason: high-risk auth/tenant-scope hardening touching sensitive Admin
  mutation flows.
- Sensitive-data/production-data reason: affected APIs expose or mutate
  participant/team/claim/change/audit/mail-adjacent data.
- Approved by: Sebastian (`Go`)
- Approval timestamp: 2026-07-19 10:14 UTC

## Implementation Notes

- Files changed:
  - `lib/server-permissions.ts`
  - `app/api/admin/claim-links/route.ts`
  - `app/api/admin/deleted-teams/[id]/restore/route.ts`
  - `app/api/admin/participant-change-bundles/route.ts`
  - `app/api/admin/participant-change-bundles/[id]/route.ts`
  - `app/api/admin/participant-change-bundles/[id]/decision/route.ts`
  - `app/api/messages/admin-targets/route.ts`
  - `app/api/messages/admin-conversations/route.ts`
  - `scripts/verify-tenant-scope.ts`
  - `scripts/verify-admin-csv-export-scope.ts`
  - `docs/cr/2026-07-18-entity-id-tenant-scope-guardrails.md`
- Important decisions during implementation:
  - Added shared entity-scope auth helpers in `lib/server-permissions.ts`:
    `requireTeamTenantRoles()`, `requireParticipantTenantRoles()`,
    `requirePendingChangesTenantRoles()`, and
    `requirePendingChangeBundleTenantRoles()`.
  - Added `requireAnyTenantRoles()` for explicitly multi-tenant admin flows
    where the route should operate over all manageable tenants rather than
    selecting one fallback tenant.
  - Claim-link POST now authorizes against the target participant/team tenant
    before token creation.
  - Claim-link PATCH `resetParticipantLink` now authorizes against the target
    participant tenant before unlinking/reinviting.
  - Claim-link token revoke resolves the token's owning tenant and calls
    `requireTenantRoles(..., { tenantId, fallbackToFirstMatchingTenant: false })`
    before revocation.
  - Deleted-team restore now authorizes against the deleted team's competition
    tenant via `requireTeamTenantRoles(..., { includeDeleted: true })`.
  - Bundle create/detail/decision now authorize against the tenant derived from
    the requested pending changes or bundle before sensitive details, mutations,
    mails or audit writes.
  - Messenger admin targets now list targets from all tenants in which the
    acting user is Admin/Moderator.
  - Messenger admin conversation creation now derives the conversation tenant
    from participant/team context first, then a shared target-user tenant, never
    from the actor's first/default tenant.
  - `npm run verify:tenant-scope` now asserts all five entity-scoped routes and
    the two Messenger admin routes.

## Verification

- Local checks:
  - `npm run verify:tenant-scope` -> green
  - `npm run verify:admin-competition-scope` -> green
  - `npm run verify:admin-dashboard-scope` -> green
  - `npm run verify:admin-csv-export-scope` -> green
  - Targeted ESLint for touched helpers/routes/scripts -> green
  - `npx tsc --noEmit --incremental false` -> green
  - `git diff --check` -> green
- Build:
  - `npm run build` -> green
- Targeted verification:
  - Static guard verifies entity-scoped helpers on all five documented
    follow-up routes.
  - Static guard verifies Messenger admin target/conversation routes use
    `requireAnyTenantRoles()` and `tenantId: { in: auth.tenantIds }`.
  - Broad pattern scan reviewed remaining `requireTenantRoles()` /
    `auth.tenantId` / default-tenant references.
- Sensitive-data negative checks:
  - No serializer expansion.
  - No DB migration.
  - No production data mutation during local verification.
  - No mails, exports, resets or claim invitations executed during tests.
- Authenticated role smoke:
  - Gap: no reusable authenticated multi-tenant Admin session/cookies.
- Manual smoke:
  - Pending Sebastian for authenticated multi-tenant UI confirmation.

## Deploy

- Deployment needed: yes, completed after approval.
- Commit: `2afbbf8 Harden entity tenant scoped admin routes`
- Deployment ID: `dpl_Xgx3fzLQjFkRivwoyFnWbKbCB8nx`
- Deployment URL: `https://s5-evo-portal-ptynuwniy-sebastiankroeker-2781s-projects.vercel.app`
- Production alias: `https://portal.s5evo.de`
- Deployed at: 2026-07-19 10:31 UTC

## Post-Deploy Smoke

- Routes checked:
  - `npm run smoke:public` -> green
  - `https://portal.s5evo.de/nachrichten` -> 200
- API checks:
  - `POST /api/admin/claim-links` without session -> 401
  - `PATCH /api/admin/claim-links` without session -> 401
  - `POST /api/admin/deleted-teams/test-team/restore` without session -> 401
  - `GET /api/admin/participant-change-bundles/test-bundle` without session -> 401
  - `PUT /api/admin/participant-change-bundles/test-bundle/decision` without session -> 401
  - `GET /api/messages/admin-targets` without session -> 401
  - `POST /api/messages/admin-conversations` without session -> 401
- Sensitive-data/API leakage checks:
  - Protected touched endpoints did not expose payloads without session.
  - No test mails, claim invitations, exports, resets or production data
    mutations were executed.
- Result: production deploy verified.

## Follow-Ups

- Add authenticated multi-tenant admin smoke/test-account tooling.
- Consider a deeper tenant-level UX decision for routes that remain intentionally
  tenant-level, such as tenant settings and changelog moderation, so multi-tenant
  admins can choose the active tenant explicitly where needed.
