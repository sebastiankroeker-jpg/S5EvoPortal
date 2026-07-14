# CR: MTC Owner Offline Visibility Hotfix

Status: Implemented locally, not deployed
Date: 2026-07-14
Type: hotfix
Risk: low
Owner: S5Evo

## Context

Markus Huber reported that he cannot convert his finished MTC teams into regular registrations.

Read-only production check showed:

- `Huber Cars, Team 1`: `MARKETPLACE`, `MATCHING`, 5/5 participants, complete disciplines, no blocking validation errors.
- `Huber Cars, Team 3`: `MARKETPLACE`, `MATCHING`, 5/5 participants, complete disciplines, no blocking validation errors.
- `Huber Cars, Team 2`: 4/5 participants, not finalizable yet.
- Markus owns Team 1 and Team 3, has an active portal login, and the finalize API preconditions are satisfied.
- The active competition has `marketplaceGlobalVisibility = OFFLINE`.

Root cause: marketplace visibility returned `false` for global `OFFLINE` before own-team visibility was considered, so non-admin owners could lose their own MTC drafts from the team API response before they could click `Uebernehmen`.

## Scope

- In scope:
  - Allow owners of their own marketplace/MTC teams to see those teams even when the public marketplace is globally offline.
  - Preserve global `OFFLINE` behavior for unrelated marketplace teams and public browsing.
  - Treat explicit `ownerId` ownership as own-marketplace ownership for list and detail API visibility.
- Out of scope:
  - Auto-finalizing Markus' teams.
  - Changing marketplace public visibility.
  - Changing MTC slot management for owners.
  - DB migration or production data mutation.

## Affected Flows

- User/API/admin flows touched:
  - `/api/teams` team list visibility for marketplace teams.
  - `/api/teams/[id]` detail visibility for marketplace teams.
  - Dashboard MTC owner finalize entry point.
- Data model impact:
  - None.
- Auth/permission impact:
  - Owners can see their own marketplace teams while the marketplace is globally offline.
  - Non-owners still cannot see offline/admin-only marketplace teams.
- Production/deploy impact:
  - Code deploy required; no migration.

## Data / API Design

- Proposed data model:
  - No change.
- Proposed API shape:
  - `canViewerSeeMarketplaceTeam` allows `ownsMarketplaceTeam` before applying global `OFFLINE`.
  - Team list/detail API passes explicit `ownerId === currentUser.id` into `ownsMarketplaceTeam`.
- Backward compatibility:
  - Admin/moderator visibility unchanged.
  - Public marketplace offline behavior unchanged for non-owners.
- Migration/data backfill:
  - None.

## Open Questions

- Decision 1: Own marketplace/MTC teams remain visible to their owner even when the public marketplace is offline.
- Decision 2: Finalization still requires the existing API checks; visibility alone does not bypass validation.

## Acceptance Criteria

- Markus can see `Huber Cars, Team 1` and `Huber Cars, Team 3` as own MTC drafts while marketplace global visibility is `OFFLINE`.
- Non-owner, non-privileged users still cannot see unrelated marketplace teams while global visibility is `OFFLINE`.
- Admin/moderator visibility remains unchanged.
- No production data is mutated by the fix.

## Implementation Handoff

- Relevant files:
  - `lib/marketplace-visibility.ts`
  - `app/api/teams/route.ts`
  - `app/api/teams/[id]/route.ts`
  - `docs/cr/2026-07-14-mtc-owner-offline-visibility-hotfix.md`
- Current decisions:
  - Reorder owner visibility before global offline block.
  - Pass explicit ownerId ownership from the team APIs.
- Open decisions:
  - None.
- Non-goals:
  - No auto-finalize.
  - No public marketplace reopening.
- Expected implementation steps:
  - Adjust visibility helper.
  - Adjust list/detail API caller ownership calculation.
  - Run TypeScript, targeted ESLint, and read-only DB verification.
- Required checks:
  - `npx eslint lib/marketplace-visibility.ts app/api/teams/route.ts app/api/teams/[id]/route.ts`
  - `npx tsc --noEmit`
  - `git diff --check`
- Risks/assumptions:
  - `ownerId` is the intended source of truth for MTC owner visibility.

## Model / Subagent Plan

- Model switch needed: no
- Target model/role: current Codex implementation
- Subagent needed: no
- Subagent role: n/a
- Handoff source: this CR + `SESSION_HANDOFF.md`

## Confirmation Gate

- Gate needed: yes
- Reason: Production deploy still requires explicit Go.
- Approved by: Sebastian, "Bitte korrigieren" for local implementation.
- Approval timestamp: 2026-07-14 10:57 UTC

## Implementation Notes

- Files changed:
  - `lib/marketplace-visibility.ts`
  - `app/api/teams/route.ts`
  - `app/api/teams/[id]/route.ts`
  - `docs/cr/2026-07-14-mtc-owner-offline-visibility-hotfix.md`
- Important decisions during implementation:
  - `ownsMarketplaceTeam` is evaluated before global `OFFLINE`.
  - `/api/teams` now treats `team.ownerId === currentUser.id` as own-marketplace visibility even if legacy edit access is false.
  - `/api/teams/[id]` mirrors the same owner-aware behavior.

## Verification

- Local checks:
  - `npx eslint lib/marketplace-visibility.ts app/api/teams/route.ts app/api/teams/[id]/route.ts` gruen.
  - `npx tsc --noEmit` gruen.
  - `git diff --check` gruen.
- Build:
  - Not run; low-risk server/helper hotfix, TypeScript and targeted ESLint green.
- Targeted verification:
  - `npx tsx` assertions:
    - own marketplace team remains visible with `globalVisibility=OFFLINE`.
    - non-owner marketplace team remains hidden with `globalVisibility=OFFLINE`.
    - privileged viewer remains visible.
    - `PORTAL_USERS` behavior under `SELECTIVE` remains visible for authenticated users.
  - Read-only production-data verification for Markus:
    - `Huber Cars, Team 1`: 5 participants, visible after fix.
    - `Huber Cars, Team 2`: 4 participants, visible after fix but not finalizable.
    - `Huber Cars, Team 3`: 5 participants, visible after fix.
- Manual smoke:
  - Pending production/authenticated smoke after deploy.

## Deploy

- Deployment needed: yes
- Deployment ID:
- Deployment URL:
- Production alias: `https://portal.s5evo.de`
- Deployed at:

## Post-Deploy Smoke

- Routes checked:
- API checks:
- Result:

## Follow-Ups

- After deploy: Markus should reload the dashboard and try Team 1 or Team 3 again.
