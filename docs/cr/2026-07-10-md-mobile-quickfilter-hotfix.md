# CR: MD Mobile Quickfilter Hotfix

Status: Ready for Deploy
Date: 2026-07-10
Type: hotfix
Risk: low
Owner: S5Evo

## Context

Sebastian sent a mobile production screenshot showing the MD Schnellfilter popover clipped off the left side of the viewport. The issue is caused by an absolute popover anchored to the quick-filter icon while the icon sits near the right edge on narrow screens.

## Scope

- In scope:
  - Keep the quick-filter control compact in the MD control strip.
  - Render the opened quick-filter controls as a full-width inline tool area on mobile and desktop.
  - Close other tool panels when quick filters open, and close quick filters when other tool panels open.
  - Add a compact hit-statistics row with current/total counts for overall, Damen, Herren, and each class.
- Out of scope:
  - Changing quick-filter semantics.
  - DB/API changes.
  - Redesigning the Mannschaft cards/list content.

## Affected Flows

- User/API/admin flows touched: Mannschafts-Dashboard control strip, Schnellfilter interaction.
- Data model impact: none.
- Auth/permission impact: none.
- Production/deploy impact: production deploy requires explicit approval.

## Data / API Design

- Proposed data model: unchanged.
- Proposed API shape: unchanged.
- Backward compatibility: existing quick-filter state and saved layouts remain unchanged.
- Migration/data backfill: none.

## Open Questions

- None for the hotfix.

## Acceptance Criteria

- Schnellfilter no longer clips outside the mobile viewport.
- Schnellfilter rows remain readable and tappable on narrow screens.
- Opening Schnellfilter does not leave Filter, Spalten, or Layout panels open at the same time.
- MD shows compact hit statistics for current filters versus the unfiltered dashboard base.
- Damen/Herren totals are grouped from the existing class keys without new data model fields.
- Existing filter behavior remains unchanged.

## Implementation Handoff

- Relevant files:
  - `app/components/dashboard.tsx`
  - `docs/cr/2026-07-10-md-mobile-quickfilter-hotfix.md`
  - `SESSION_HANDOFF.md`
- Current decisions:
  - Use an inline tool area below the control strip instead of an icon-anchored absolute popover.
  - Keep the implementation dependency-free.
- Open decisions: production deploy approval.
- Non-goals: no data/API/schema changes.
- Expected implementation steps:
  - Move Schnellfilter panel rendering out of the icon container.
  - Keep mode buttons compact and tappable.
  - Add a narrow, horizontally scrollable hit-statistics row under the control strip.
  - Run TypeScript and build.
- Required checks:
  - `npx tsc --noEmit`
  - `npm run build`
- Risks/assumptions:
  - Hotfix is UI-only and should have low blast radius.

## Model / Subagent Plan

- Model switch needed: no
- Target model/role: current Codex implementation
- Subagent needed: no
- Subagent role: none
- Handoff source: this CR plus current diff.

## Confirmation Gate

- Gate needed: yes
- Reason: production deploy.
- Approved by: pending
- Approval timestamp: pending

## Implementation Notes

- Files changed:
  - `app/components/dashboard.tsx`
  - `docs/cr/2026-07-10-md-mobile-quickfilter-hotfix.md`
  - `SESSION_HANDOFF.md`
- Important decisions during implementation:
  - Removed the icon-anchored absolute quick-filter popover that could overflow narrow screens.
  - Added an inline quick-filter panel under the MD control strip.
  - Made tool panels mutually exclusive.
  - Added a compact Trefferstatistik row: `Gesamt`, `Damen`, `Herren`, and class chips show current hits; when filters are active they show `current/without-filter`.
  - Damen totals use `damen-a` + `damen-b`; Herren totals use `jungsters` + `herren` + `masters`.

## Verification

- Local checks: `npx tsc --noEmit` green; `git diff --check` green.
- Build: `npm run build` green.
- Targeted verification: dashboard control-strip and Trefferstatistik TypeScript/build coverage; reviewed mobile clipping cause and compact stats placement in `app/components/dashboard.tsx`.
- Manual smoke: pending production deploy.

## Deploy

- Deployment needed: yes, after approval
- Deployment ID: pending
- Deployment URL: pending
- Production alias: `https://portal.s5evo.de`
- Deployed at: pending

## Post-Deploy Smoke

- Routes checked: pending
- API checks: pending
- Result: pending

## Follow-Ups

- Production deploy after Sebastian approval.
