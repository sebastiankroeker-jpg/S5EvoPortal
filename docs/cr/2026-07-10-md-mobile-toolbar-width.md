# CR: MD Mobile Toolbar Width

Status: Implemented locally
Date: 2026-07-10
Type: hotfix
Risk: low
Owner: S5Evo

## Context

Sebastian sent a mobile production screenshot after the MD hit-statistics rollout. The compact toolbar works, but the icon row is visually right-aligned and does not use the available mobile width evenly. He also clarified that the hit statistics are not needed below the opened filter area.

## Scope

- In scope:
  - Hide the compact hit-statistics row while the main Filter panel is open.
  - Make the MD tool icons distribute across the full mobile width.
  - Keep active badges without creating extra toolbar columns.
- Out of scope:
  - Changing filter, quick-filter, layout or export semantics.
  - DB/API/schema changes.
  - Production deploy without explicit approval.

## Affected Flows

- User/API/admin flows touched: Mannschafts-Dashboard mobile control strip.
- Data model impact: none.
- Auth/permission impact: none.
- Production/deploy impact: production deploy requires explicit approval.

## Data / API Design

- Proposed data model: unchanged.
- Proposed API shape: unchanged.
- Backward compatibility: existing local UI state and saved layouts remain unchanged.
- Migration/data backfill: none.

## Open Questions

- None for local implementation.

## Acceptance Criteria

- Trefferstatistik is hidden when the Filter panel is expanded.
- On mobile, Schnellfilter, Filter, Listenoptionen, Layout, Download and Refresh controls use the full available toolbar width with equal columns.
- Active-count and dirty-state badges overlay the related icon instead of consuming separate width.
- Desktop toolbar remains compact and right-aligned.
- Existing MD interactions continue to work.

## Implementation Handoff

- Relevant files:
  - `app/components/dashboard.tsx`
  - `docs/cr/2026-07-10-md-mobile-toolbar-width.md`
  - `SESSION_HANDOFF.md`
- Current decisions:
  - Use responsive Tailwind grid on mobile and preserve flex behavior on large screens.
  - Keep all behavior state unchanged.
- Open decisions: production deploy approval only.
- Non-goals: no schema/API changes, no new dependencies.
- Expected implementation steps:
  - Convert the MD tool icon container to a mobile full-width grid.
  - Move badges into the relevant button wrappers.
  - Hide hit statistics while `filtersOpen` is true.
  - Run TypeScript and build.
- Required checks:
  - `npx tsc --noEmit`
  - `npm run build`
  - `git diff --check`
- Risks/assumptions:
  - The list-options and export buttons are conditional; the mobile grid must still distribute whatever controls are visible.

## Model / Subagent Plan

- Model switch needed: no
- Target model/role: current Codex implementation
- Subagent needed: no
- Subagent role: none
- Handoff source: this CR plus current diff.

## Confirmation Gate

- Gate needed: yes for production deploy.
- Reason: production deploy.
- Approved by: not yet.
- Approval timestamp: n/a.

## Implementation Notes

- Files changed:
  - `app/components/dashboard.tsx`
  - `docs/cr/2026-07-10-md-mobile-toolbar-width.md`
  - `SESSION_HANDOFF.md`
- Important decisions during implementation:
  - The MD tool strip now uses a responsive mobile grid with `auto-fit` columns so the visible icon buttons share the full available width.
  - Quick-filter count, active-filter count and layout-dirty markers now overlay their owning icon instead of consuming separate toolbar cells.
  - The hit-statistics row is hidden while the Filter panel is expanded, but remains available in the compact closed-control state.
  - No filter, layout, CSV export or refresh behavior was changed.

## Verification

- Local checks: `npx tsc --noEmit` green; `git diff --check` green.
- Build: `npm run build` green.
- Targeted verification: reviewed MD toolbar diff for mobile grid distribution, badge overlay behavior and `filtersOpen` stats visibility.
- Manual smoke: not run locally in browser; build covers Tailwind class generation.

## Deploy

- Deployment needed: not yet.
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
