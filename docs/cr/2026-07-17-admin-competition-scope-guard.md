# CR: Admin Competition Scope Guard

Status: Implemented
Date: 2026-07-17
Type: hotfix
Risk: medium
Owner: S5Evo

## Context

Sebastian's admin user had access to both the archived 2024 tenant and the current 2026 tenant. The admin competition switcher briefly appeared to lose the 2026 competition because the API used the first/oldest admin tenant as fallback instead of listing all admin tenants and scoping detail updates by the selected competition.

The production fix is already live in commit `2d04b4a`. This CR adds a narrow regression guard so the same class of mistake is caught during verification.

## Scope

- In scope:
  - Add a dedicated verify script for admin competition multi-tenant scope.
  - Assert that the switcher loads competitions from all tenant roles where the user is `ADMIN`.
  - Assert that competition detail/read-write paths validate access against the selected competition's tenant.
  - Record the business invariant in a CR/handoff.
- Out of scope:
  - No DB migration.
  - No production data mutation.
  - No additional UI behavior change beyond the already deployed fix.
  - No production deploy required for the guard itself unless bundled with a later release.

## Affected Flows

- User/API/admin flows touched:
  - Admin competition switcher verification.
  - Admin competition detail/update verification.
- Data model impact:
  - None.
- Auth/permission impact:
  - No runtime permission change in this CR; it protects the existing rule.
- Production/deploy impact:
  - None required for the verification-only guard.

## Data / API Design

- Proposed data model:
  - No change.
- Proposed API shape:
  - No change.
- Backward compatibility:
  - Existing API behavior remains unchanged.
- Migration/data backfill:
  - None.

## Business Invariants

- Admin competition listing must consider every tenant where the current user has `ADMIN`, not only the first resolved tenant.
- Admin competition detail and save operations must authorize against the tenant of the selected competition.
- A multi-tenant admin user must be able to see both archive and current competitions without the archive tenant shadowing the current one.

## Open Questions

- A future authenticated smoke could exercise Sebastian's real multi-tenant role state against production when reusable session/test-account tooling exists.

## Acceptance Criteria

- `npm run verify:admin-competition-scope` fails if the switcher goes back to `auth.tenantId`-only scoping.
- `npm run verify:admin-competition-scope` fails if selected competition access stops checking the selected competition's tenant.
- CR and handoff document the invariant and the remaining authenticated-smoke gap.

## Implementation Handoff

- Relevant files:
  - `app/api/admin/competitions/route.ts`
  - `app/api/admin/competition/route.ts`
  - `scripts/verify-admin-competition-scope.ts`
  - `package.json`
- Current decisions:
  - Use the repo's existing `verify:*` script pattern instead of adding a new test framework.
  - Keep the guard narrow and tied to the production incident.
- Open decisions:
  - None.
- Non-goals:
  - No runtime refactor.
  - No production data changes.
  - No deploy in this CR.
- Expected implementation steps:
  - Add verification script.
  - Add npm script.
  - Run targeted verification and type checks.
- Required checks:
  - `npm run verify:admin-competition-scope`
  - Targeted ESLint.
  - `npx tsc --noEmit --incremental false`.
  - `git diff --check`.
- Risks/assumptions:
  - This is a static regression tripwire, not a full authenticated API integration test.

## Model / Subagent Plan

- Model switch needed: no
- Target model/role: current Codex operator
- Subagent needed: no
- Subagent role: n/a
- Handoff source: this CR and incident context.

## Confirmation Gate

- Gate needed: no
- Reason: local verification/documentation guard only; no production deploy or production data mutation.
- Approved by: Sebastian via Telegram "Gerne!"
- Approval timestamp: 2026-07-17 11:10 UTC

## Implementation Notes

- Files changed:
  - `scripts/verify-admin-competition-scope.ts`
  - `package.json`
  - `docs/cr/2026-07-17-admin-competition-scope-guard.md`
  - `SESSION_HANDOFF.md`
- Important decisions during implementation:
  - The guard checks the exact high-risk source markers: all-admin-tenant loading for the switcher and selected-competition tenant authorization for GET/PUT.

## Verification

- Local checks:
  - `npm run verify:admin-competition-scope`: passed.
  - `npx eslint scripts/verify-admin-competition-scope.ts app/api/admin/competitions/route.ts app/api/admin/competition/route.ts`: passed.
  - `npx tsc --noEmit --incremental false`: passed.
  - `git diff --check`: passed.
- Build:
  - Not required unless this is bundled into a production release.
- Targeted verification:
  - Static regression guard confirms the switcher reads all admin tenant roles and queries competitions with `tenantId in adminTenantIds`.
  - Static regression guard confirms selected competition GET/PUT paths use `requireCompetitionAdmin()` and authorize against the selected competition's tenant.
- Manual smoke:
  - Not run; authenticated browser/API session is not available in this environment.

## Deploy

- Deployment needed: no
- Deployment ID:
- Deployment URL:
- Production alias:
- Deployed at:

## Post-Deploy Smoke

- Routes checked:
- API checks:
- Result: not applicable.

## Follow-Ups

- Add authenticated production smoke for multi-tenant admin switcher once reusable session/test-account tooling exists.
