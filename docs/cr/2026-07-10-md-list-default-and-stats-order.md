# CR: MD List Default And Stats Order

Status: Implemented
Date: 2026-07-10
Type: content
Risk: low
Owner: S5Evo

## Context

Sebastian requested two final cosmetic changes after the participant replacement rollout: the default list should no longer show the tall participant summary column, and the MD stats row should swap position with the filter/layout button row.

## Scope

- In scope:
  - Hide the `participants` summary column from default/local legacy list column state.
  - Keep the column available in the manual column panel.
  - Move the hit stats row above the view/search/filter/layout toolbar row.
- Out of scope:
  - Saved layout migration.
  - New layout UI or data model changes.

## Affected Flows

- User/API/admin flows touched:
  - Mannschafts-Dashboard list defaults and toolbar layout.
- Data model impact:
  - None.
- Auth/permission impact:
  - None.
- Production/deploy impact:
  - Needs normal app deploy after validation.

## Data / API Design

- Proposed data model:
  - None.
- Proposed API shape:
  - None.
- Backward compatibility:
  - Manually saved layouts can still show the member summary column.
  - Legacy local visible-column state drops `participants` on load.
- Migration/data backfill:
  - None.

## Acceptance Criteria

- Default MD list does not include the `Mitglieder`/participant summary column.
- Rows are shorter because the tall participant summary is absent by default.
- The stats pills render before the toolbar button row.
- Existing filters, layouts, CSV export and manual column toggles keep working.

## Implementation Notes

- Files changed:
  - `app/components/dashboard.tsx`
  - `docs/cr/2026-07-10-md-list-default-and-stats-order.md`
- Important decisions during implementation:
  - The column remains selectable manually; only default/local legacy state is cleaned.
  - Stats stay hidden while the filter panel is open, matching the previous mobile behavior.

## Verification

- Local checks:
  - `npx tsc --noEmit` passed.
  - `npm run lint` passed with the existing 11 warnings.
- Build:
  - `npm run build` passed.
- Targeted verification:
  - `git diff --check` passed.
- Manual smoke:
  - Not run locally in browser.

## Deploy

- Deployment needed: yes
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
