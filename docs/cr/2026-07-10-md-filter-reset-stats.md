# CR: MD Filter Reset And Stat Toggles

Status: Implemented
Date: 2026-07-10
Type: hotfix
Risk: low
Owner: S5Evo

## Context

Sebastian reported follow-up issues in the mobile Mannschaften dashboard after the compact toolbar/statistics changes:

- Filter löschen is no longer clearly offered.
- The button right of Download does not have a useful visible effect.
- Filter löschen should also remove the list sort order.
- Tapping stat pills should toggle the filter for the respective class or class group.

## Scope

- In scope:
  - Restore a clear filter reset action in the compact toolbar.
  - Make the right-of-download toolbar button reset filters and list sorting instead of only refreshing teams.
  - Extend reset behavior to default list sorting.
  - Make hit-stat pills clickable/tappable filter toggles for total, Damen, Herren, and individual classes.
- Out of scope:
  - New persisted dashboard layout behavior.
  - API or data model changes.
  - Production deploy.

## Affected Flows

- User/API/admin flows touched: Mannschaften dashboard filtering, mobile toolbar, list sorting.
- Data model impact: none.
- Auth/permission impact: none.
- Production/deploy impact: none in this CR unless deployed later.

## Data / API Design

- Proposed data model: unchanged.
- Proposed API shape: unchanged.
- Backward compatibility: existing stored single-class filters remain valid.
- Migration/data backfill: none.

## Open Questions

- None.

## Acceptance Criteria

- The compact toolbar includes a clear reset action.
- The reset action clears search/filter state and returns sorting to the default.
- The reset action is useful in both card and list view.
- Stat pills outside the open filter panel toggle their respective filter:
  - Gesamt resets class/group filter.
  - Damen toggles DA/DB group.
  - Herren toggles male class group.
  - Individual class toggles that class.
- TypeScript passes.

## Implementation Handoff

- Relevant files:
  - `app/components/dashboard.tsx`
  - `docs/cr/2026-07-10-md-filter-reset-stats.md`
- Current decisions:
  - Use encoded category filter values for group filters instead of adding a second filter state.
  - Keep filter panel statistics hidden while the filter panel is open.
  - Repurpose the refresh-looking right toolbar button as clear/reset to avoid an icon that appears to do nothing.
- Open decisions: none.
- Non-goals: production deploy.
- Expected implementation steps:
  - Add category group constants and helper functions.
  - Update filtering and active-filter counting.
  - Update reset behavior to include default sort.
  - Render stat pills as buttons with pressed state and toggle handlers.
  - Update filter panel category select to tolerate group values.
- Required checks:
  - `npx tsc --noEmit`
- Risks/assumptions:
  - Stored local preference values may contain group filter strings after this change; sanitize logic already accepts strings.

## Model / Subagent Plan

- Model switch needed: no
- Target model/role: current Codex implementation
- Subagent needed: no
- Subagent role: n/a
- Handoff source: this CR

## Confirmation Gate

- Gate needed: no
- Reason: local hotfix only, no schema/auth/production side effect.
- Approved by: n/a
- Approval timestamp: n/a

## Implementation Notes

- Files changed:
  - `app/components/dashboard.tsx`
  - `docs/cr/2026-07-10-md-filter-reset-stats.md`
- Important decisions during implementation:
  - Added `group:damen` and `group:herren` category filter values so existing category filter state can represent class groups.
  - Replaced the refresh-only toolbar icon with a reset icon/action for filters and sort.
  - Rendered the hit-stat row as accessible buttons with `aria-pressed` state.

## Verification

- Local checks:
  - `npx tsc --noEmit` passed.
- Build:
  - Not run.
- Targeted verification:
  - Diff review for dashboard filter state and stat pill toggles.
- Manual smoke:
  - Not run in browser.

## Deploy

- Deployment needed: no
- Deployment ID:
- Deployment URL:
- Production alias:
- Deployed at:

## Post-Deploy Smoke

- Routes checked:
- API checks:
- Result:

## Follow-Ups

- None
