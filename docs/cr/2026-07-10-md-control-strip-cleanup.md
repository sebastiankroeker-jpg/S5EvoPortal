# CR: MD Control Strip Cleanup

Status: Implemented locally
Date: 2026-07-10
Type: feature
Risk: medium
Owner: S5Evo

## Context

The MD list view now has saved layouts, new list columns and column ordering. Search, filters, layout controls, quick filters and list options are functional but visually too spread out. Sebastian wants the control area to feel modern, compact and intuitive with the existing UI stack.

## Scope

- In scope:
  - Consolidate MD search, filter, column, layout, export and refresh controls into a compact control strip.
  - Keep search always visible.
  - Move filter, column and layout configuration into clear icon/action panels.
  - Surface active state with compact badges/chips.
  - Keep all existing dashboard behavior and saved layout semantics.
- Out of scope:
  - DB schema changes or migrations.
  - Production deploy.
  - Rebuilding the table/card content itself.
  - New UI libraries or drag-and-drop dependency.
  - Persisting filters in saved layouts.

## Affected Flows

- User/API/admin flows touched: Mannschafts-Dashboard toolbar, filters, list options, layout controls, CSV export trigger.
- Data model impact: none.
- Auth/permission impact: none.
- Production/deploy impact: none unless deployed later.

## Data / API Design

- Proposed data model: unchanged.
- Proposed API shape: unchanged.
- Backward compatibility: existing layout and filter localStorage state should continue to load.
- Migration/data backfill: none.

## Open Questions

- None for V1.

## Acceptance Criteria

- Search remains directly visible in the MD control area.
- View switch is compact and obvious.
- Filter, column and layout controls are reachable as separate compact panels.
- Active filter count, layout dirty state and quick-filter state are visible without expanding panels.
- CSV export and refresh are direct commands.
- Existing filtering, quick filters, list column visibility/order, sorting and layout save/update/delete flows keep working.
- UI remains responsive on mobile and desktop.

## Implementation Handoff

- Relevant files:
  - `app/components/dashboard.tsx`
  - `docs/cr/2026-07-10-md-control-strip-cleanup.md`
  - `SESSION_HANDOFF.md`
- Current decisions:
  - Keep implementation dependency-free.
  - Prefer icon+tooltip/title buttons for tool actions.
  - Reuse existing `filtersOpen`, `listOptionsOpen`, and `layoutManagerOpen` state where practical.
  - Do not deploy without explicit deploy approval.
- Open decisions: none.
- Non-goals: no schema/API changes, no external UI library, no drag-and-drop.
- Expected implementation steps:
  - Restructure the MD top control area into a compact strip.
  - Add active tool buttons for filters, columns and layout.
  - Keep quick filters compact in a popover-style panel.
  - Move layout management behind the layout tool panel.
  - Keep list options panel focused on sorting and columns.
  - Run TypeScript and build.
- Required checks:
  - `npx tsc --noEmit`
  - `npm run build`
- Risks/assumptions:
  - The dashboard component is large; changes should stay scoped to the control surface.

## Model / Subagent Plan

- Model switch needed: no
- Target model/role: current Codex implementation
- Subagent needed: no
- Subagent role: none
- Handoff source: this CR plus `SESSION_HANDOFF.md`

## Confirmation Gate

- Gate needed: no for local implementation; yes before production deploy.
- Reason: no schema change, no production data mutation, no external side effect for local implementation.
- Approved by: Sebastian "Go" in Telegram
- Approval timestamp: 2026-07-10 12:26 UTC

## Implementation Notes

- Files changed:
  - `app/components/dashboard.tsx`
  - `docs/cr/2026-07-10-md-control-strip-cleanup.md`
  - `SESSION_HANDOFF.md`
- Important decisions during implementation:
  - Replaced the prior stacked control blocks with one compact control strip: view segment, always-visible search and right-aligned tool icons.
  - Kept Schnellfilter as a popover-style menu with an active count badge.
  - Split the heavy controls into separate panels: Filter, Spalten/Sortierung and Layout.
  - Kept CSV export and refresh as direct icon commands.
  - Added a compact status chip row for active filters, quick filters, selected layout and dirty layout state.
  - No behavior/API/schema changes beyond the already-local MD list column work.

## Verification

- Local checks: `npx tsc --noEmit` green.
- Build: `npm run build` green.
- Targeted verification: TypeScript/build cover the dashboard control surface and existing layout/filter state usage.
- Manual smoke: not run locally in browser.

## Deploy

- Deployment needed: not yet approved
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
