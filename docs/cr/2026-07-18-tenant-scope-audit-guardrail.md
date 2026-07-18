# CR: Tenant Scope Audit Guardrail

Status: Deployed
Date: 2026-07-18
Type: hotfix
Risk: high
Owner: S5Evo

## Context

Sebastian raised concern after two same-day multi-tenant hotfixes: the admin competition switcher/dashboard could fall back to an old tenant, and the manual CSV export searched the selected 2026 competition under the wrong fallback tenant.

The recurring pattern is `requireTenantRoles()` without an explicit tenant scope. For multi-tenant admins it may resolve the first matching tenant role, while the UI has an active `competitionId` from another tenant.

## Scope

- In scope:
  - Audit admin/API surfaces that accept or derive a `competitionId`.
  - Convert direct `competitionId` admin surfaces from fallback tenant auth to competition-scoped auth where feasible.
  - Add a generalized `npm run verify:tenant-scope` guard to prevent reintroducing fallback auth on competition-scoped routes.
  - Document remaining non-competition-ID entity-scoped follow-ups.
- Out of scope:
  - No DB migration.
  - No production data mutation.
  - No broad role redesign.
  - No production deploy without separate explicit Go.
  - No authenticated production mail/export/reset execution by the agent.

## Affected Flows

- User/API/admin flows touched:
  - Admin routes with `competitionId` query/body filters.
  - PII-heavy admin lists, audit views, exports/imports, result-staging and claim-link views.
- Data model impact: none.
- Auth/permission impact: yes, selected `competitionId` should determine the tenant for role checks.
- Sensitive data impact: high; affected flows include names, e-mails, phone numbers, claim-link state, roles, audit trails, mail/export metadata and result-staging data.
- Offline/cache/export/log/mail impact: export/mail/log views are in audit scope; no intended payload changes.
- Production/deploy impact: local implementation only until separate deploy approval.

## Privacy / Security Review

- Sensitive fields touched: participant names, birth years, e-mails, phone numbers, team contacts, claim-link state, role assignments, audit/log/mail metadata, result-staging data.
- Purpose / data minimization: no new fields should be exposed; the change narrows existing reads/writes to the tenant of the selected competition.
- Visibility by role/user/API/UI: Admin/Moderator/Admin-only routes must authorize against the selected competition tenant when `competitionId` is present.
- Persistence locations: no new persistence; existing DB reads/writes remain.
- Offline/cache behavior, TTL/invalidation/logout clearing: no offline-cache change.
- Logs/mails/exports/screenshots exposure: no new technical logs, mails, exports or screenshots; no test mail/export/reset execution.
- Negative checks for unauthorized access or payload leakage: protected APIs without session must remain 401/403; static guard must reject fallback auth on competition-scoped routes.
- Authenticated smoke plan or explicit gap: no reusable authenticated Admin session in agent; document as gap.
- Residual risk: entity-ID-only routes need a follow-up guard/helper family because they do not always carry `competitionId`.

## Data / API Design

- Proposed data model: none.
- Proposed API shape: existing request shapes preserved; routes with `competitionId` continue accepting it.
- Backward compatibility: routes without `competitionId` may keep legacy fallback only where the route explicitly supports tenant-level defaults.
- Migration/data backfill: none.

## Open Questions

- Decision 1: For entity-ID-only mutating routes, add `requireTeamTenantRoles()`/`requireParticipantTenantRoles()` now or schedule as follow-up?
- Decision 2: Should future admin routes require `competitionId` instead of supporting fallback defaults?

## Acceptance Criteria

- General tenant-scope guard fails when a competition-scoped admin route calls `requireTenantRoles()` without explicit tenant resolution.
- Existing targeted guards remain green.
- Direct `competitionId` routes in high-risk admin surfaces use competition-scoped authorization.
- CR records audited surfaces and follow-up risk for entity-ID-only routes.
- No sensitive payload is broadened.

## Implementation Handoff

- Relevant files:
  - `lib/server-permissions.ts`
  - `app/api/admin/**/route.ts`
  - `app/api/dashboard-layouts/**/route.ts`
  - `scripts/verify-tenant-scope.ts`
  - `package.json`
  - `SESSION_HANDOFF.md`
- Current decisions:
  - `requireCompetitionTenantRoles()` is the canonical helper when a route receives a selected `competitionId`.
  - The guard should be conservative and explicit: allow tenant-level routes only with a documented allowlist.
  - Do not send mails, exports or run destructive resets during verification.
- Open decisions:
  - Entity-ID-only helper rollout can become a follow-up if too broad for this CR.
- Non-goals:
  - No deploy, no migration, no production data mutation.
- Expected implementation steps:
  - Inventory current route patterns.
  - Patch high-risk direct `competitionId` routes to competition-scoped auth.
  - Add generalized verification script.
  - Run targeted guards, TypeScript, diff check and build.
- Required checks:
  - `npm run verify:tenant-scope`
  - `npm run verify:admin-competition-scope`
  - `npm run verify:admin-dashboard-scope`
  - `npm run verify:admin-csv-export-scope`
  - targeted ESLint
  - `npx tsc --noEmit --incremental false`
  - `git diff --check`
  - `npm run build`
- Privacy/security checks:
  - No API serializer expansion.
  - No technical logging of sensitive payloads.
  - Protected endpoints without session remain protected in public smoke after deploy.
- Risks/assumptions:
  - Static guards reduce regression risk but do not replace authenticated multi-tenant integration tests.
  - Some routes are tenant-level by design and must remain allowlisted.
- Context read before implementation:
  - `SESSION_HANDOFF.md` top block: read.
  - Relevant prior CR(s): admin competition scope guard, admin dashboard tenant scope hotfix, CSV export tenant scope and round logo.
  - Relevant source files: `lib/server-permissions.ts`, existing verify scripts, admin route inventory.

## Model / Subagent Plan

- Model switch needed: no
- Target model/role: current Codex implementation
- Subagent needed: no
- Subagent role: n/a
- Handoff source: this CR and current session context.

## Confirmation Gate

- Gate needed: yes
- Reason: high-risk auth/tenant-scope hardening touching PII-heavy admin flows.
- Sensitive-data/production-data reason: impacted APIs expose or mutate participant/team/user/contact/audit/export data.
- Approved by: Sebastian (`Go`)
- Approval timestamp: 2026-07-18 00:26 UTC

## Implementation Notes

- Files changed:
  - `app/api/admin/audit-events/route.ts`
  - `app/api/admin/claim-audit/route.ts`
  - `app/api/admin/claim-links/route.ts`
  - `app/api/admin/competition/reset/route.ts`
  - `app/api/admin/deleted-teams/route.ts`
  - `app/api/admin/mail-events/route.ts`
  - `app/api/admin/orga-summary/route.ts`
  - `app/api/admin/participant-audit/route.ts`
  - `app/api/admin/participants/route.ts`
  - `app/api/admin/pending-changes/[id]/route.ts`
  - `app/api/admin/result-staging/batches/route.ts`
  - `app/api/admin/result-staging/reset/preview/route.ts`
  - `app/api/admin/result-staging/reset/route.ts`
  - `app/api/admin/result-staging/timekeeping/sessions/route.ts`
  - `app/api/admin/start-numbers/import/route.ts`
  - `app/api/admin/team-access-audit/route.ts`
  - `scripts/verify-tenant-scope.ts`
  - `package.json`
  - `docs/cr/2026-07-18-tenant-scope-audit-guardrail.md`
- Important decisions during implementation:
  - Direct `competitionId` routes now authorize with `requireCompetitionTenantRoles()` before using `auth.tenantId` in data queries.
  - `PUT /api/admin/pending-changes/[id]` now resolves the tenant from the target ChangeRequest/PendingChange before role auth, avoiding fallback-tenant rejection for current-tenant pending decisions.
  - `GET /api/admin/claim-links` is competition-scoped; POST/PATCH remain entity-ID scoped and are documented as follow-up.
  - Result-staging reset preview/execute, start-number import and competition reset parse the selected competition before authorization and then use the selected tenant.
  - `npm run verify:tenant-scope` is intentionally static and allowlist-based. It blocks competition-scoped fallback auth regressions and records five entity-scoped follow-ups.

## Verification

- Local checks:
  - `npm run verify:tenant-scope` -> green
  - `npm run verify:admin-competition-scope` -> green
  - `npm run verify:admin-dashboard-scope` -> green
  - `npm run verify:admin-csv-export-scope` -> green
  - targeted ESLint -> green
  - `npx tsc --noEmit --incremental false` -> green
  - `git diff --check` -> green
- Build:
  - `npm run build` -> green
- Targeted verification:
  - Guard verifies 13 direct `competitionId` admin routes import/use `requireCompetitionTenantRoles()`.
  - Guard verifies claim-link GET uses competition-scoped auth.
  - Guard verifies competition reset GET/POST derives competition scope before role authorization.
  - Guard verifies pending-change decision route resolves target tenant before role authorization.
  - Existing dashboard/competition/CSV guards remain green.
- Sensitive-data negative checks:
  - No serializer fields added.
  - No mails sent, no exports generated, no resets executed.
  - No production data mutation.
- Authenticated role smoke:
  - Gap: no authenticated multi-tenant Admin session in agent.
- Manual smoke:
  - Pending Sebastian if deployed.

## Deploy

- Deployment needed: yes, completed after separate deploy approval.
- Deployment ID: `dpl_9gaTBCHhd46gWNt93yhf8wfRmvqm`
- Deployment URL: `https://s5-evo-portal-cpztoggsn-sebastiankroeker-2781s-projects.vercel.app`
- Production alias: `https://portal.s5evo.de`
- Deployed at: 2026-07-18 00:42 UTC

## Post-Deploy Smoke

- Routes checked:
  - `npm run smoke:public` -> green
  - `https://portal.s5evo.de/` -> 200
  - `https://portal.s5evo.de/admin` -> 200
  - `https://portal.s5evo.de/` contains `<title>Soier 5Kampf</title>`
- API checks:
  - `GET /api/admin/participants?competitionId=...` without session -> 401
  - `GET /api/admin/mail-events?competitionId=...` without session -> 401
  - `GET /api/admin/audit-events?competitionId=...` without session -> 401
  - `GET /api/admin/result-staging/batches?competitionId=...` without session -> 401
  - `POST /api/admin/start-numbers/import` with `competitionId` without session -> 401
  - `POST /api/admin/result-staging/reset/preview` with `competitionId` without session -> 401
  - `POST /api/admin/competition/reset` with `id` without session -> 401
  - `GET /api/admin/claim-links?competitionId=...` without session -> 401
- Sensitive-data/API leakage checks:
  - Protected admin endpoints did not leak payloads without session.
  - No mails sent, no exports generated, no resets executed.
- Result: production deploy verified.

## Follow-Ups

- Add entity-scoped helpers/guards for:
  - `app/api/admin/claim-links/route.ts` POST/PATCH by `teamId`/`participantId`.
  - `app/api/admin/deleted-teams/[id]/restore/route.ts` by team id.
  - `app/api/admin/participant-change-bundles/route.ts` by pendingChange ids.
  - `app/api/admin/participant-change-bundles/[id]/route.ts` by bundle id.
  - `app/api/admin/participant-change-bundles/[id]/decision/route.ts` by bundle id.
- Add authenticated multi-tenant integration smoke once reusable session/test-account tooling exists.
