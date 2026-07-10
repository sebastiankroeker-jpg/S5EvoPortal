# CR: MD Listenanzeige Spaltenausbau

Status: Implemented locally
Date: 2026-07-10
Type: feature
Risk: medium
Owner: S5Evo

## Context

Sebastian wants the Mannschafts-Dashboard list view to be more useful and compact after the saved layout customization. "MD" is accepted as shorthand for Mannschafts-Dashboard.

## Scope

- In scope:
  - Add MD glossary shorthand to `SESSION_HANDOFF.md`.
  - Show team start number in the MD list view.
  - Offer one optional list column per discipline/slot.
  - Allow users to adjust visible column order in list options.
  - Keep class out of the team-name column; class stays its own optional column/filter.
  - Keep layout config/export allowlists aligned with new columns.
- Out of scope:
  - Production deploy.
  - DB schema changes or migrations.
  - Redesign of card view.
  - Persisting filters in saved layouts.

## Affected Flows

- User/API/admin flows touched: Mannschafts-Dashboard list view, saved MD layouts, layout CSV export.
- Data model impact: none.
- Auth/permission impact: none.
- Production/deploy impact: none unless deployed later.

## Data / API Design

- Proposed data model: reuse existing `Team.startNumber` and participant `disciplineCode`.
- Proposed API shape: include `startNumber` in serialized teams.
- Backward compatibility: existing saved layouts remain valid; unknown/new columns are allowlisted.
- Migration/data backfill: none.

## Open Questions

- None for V1.

## Acceptance Criteria

- MD is documented as shorthand for Mannschafts-Dashboard in the handoff.
- List view can show `Startnummer`.
- List view can show participants in separate discipline columns for RUN, BENCH, STOCK, ROAD and MTB.
- List options allow moving selected columns up/down.
- Team-name column contains the team name and badges only, not the class; class remains separate.
- Saved layouts can persist and reapply the new columns/order.
- Layout CSV export accepts the new columns via allowlist.

## Implementation Handoff

- Relevant files:
  - `SESSION_HANDOFF.md`
  - `app/components/dashboard.tsx`
  - `lib/dashboard-layout-config.ts`
  - `lib/team-csv-export.ts`
  - `app/api/teams/route.ts`
- Current decisions:
  - `MD` means Mannschafts-Dashboard.
  - Valid disciplines are `RUN`, `BENCH`, `STOCK`, `ROAD`, `MTB`.
  - Start number is team-level (`Team.startNumber`).
  - Class must not be mixed into the team-name column.
- Open decisions: none.
- Non-goals: no schema migration, no deploy, no filter persistence in layouts.
- Expected implementation steps:
  - Add start number to serialized team data.
  - Extend list/saved-layout column keys.
  - Render discipline-specific participant columns.
  - Add compact column-order controls to list options.
  - Extend layout export definitions.
  - Update handoff.
- Required checks:
  - `npx tsc --noEmit`
  - `npm run build` if TypeScript passes.
- Risks/assumptions:
  - Saved layout config is version 1; adding keys is backward-compatible because existing layouts keep their old arrays.

## Model / Subagent Plan

- Model switch needed: no
- Target model/role: current Codex implementation
- Subagent needed: no
- Subagent role: none
- Handoff source: this CR plus `SESSION_HANDOFF.md`

## Confirmation Gate

- Gate needed: no
- Reason: no production deploy, schema change, production data mutation, external message, model switch, or subagent.
- Approved by: Sebastian request in Telegram
- Approval timestamp: 2026-07-10 12:02 UTC

## Implementation Notes

- Files changed:
  - `SESSION_HANDOFF.md`
  - `app/api/teams/route.ts`
  - `app/components/dashboard.tsx`
  - `lib/dashboard-layout-config.ts`
  - `lib/team-csv-export.ts`
- Important decisions during implementation:
  - Existing local visible-column preferences are upgraded client-side to include `startNumber` and the five discipline participant columns.
  - The list team-name column no longer renders the class badge; class is only shown through its own optional column/filter.
  - Discipline participant columns reuse dashboard publication/privacy label logic.
  - Layout CSV export was extended with allowlisted columns instead of free JSON paths.

## Verification

- Local checks: `npx tsc --noEmit` green.
- Build: `npm run build` green.
- Targeted verification: TypeScript/build cover dashboard config, API serialization and layout export typing.
- Manual smoke: not run locally in browser.

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
