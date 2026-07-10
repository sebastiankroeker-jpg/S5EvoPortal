# CR: MD Active Toolbar Cosmetics

Status: Deployed
Date: 2026-07-10
Type: hotfix
Risk: low
Owner: S5Evo

## Context

Sebastian reported two cosmetic issues in the mobile Mannschaften dashboard:

- Kacheln/Liste should clearly show which view is selected.
- The small count circles on the panel buttons should be consistently color-highlighted when the related panel is open; current quick/filter badges behave differently.

## Scope

- In scope:
  - Make the selected Kacheln/Liste tab use the primary active color.
  - Normalize toolbar count badges so active/open panel counters keep a colored background.
- Out of scope:
  - Data, API, auth, or layout persistence behavior.
  - Further toolbar behavior changes.

## Affected Flows

- User/API/admin flows touched: Mannschaften dashboard toolbar visuals.
- Data model impact: none.
- Auth/permission impact: none.
- Production/deploy impact: deployed after Sebastian's approval.

## Data / API Design

- Proposed data model: unchanged.
- Proposed API shape: unchanged.
- Backward compatibility: unchanged.
- Migration/data backfill: none.

## Open Questions

- None.

## Acceptance Criteria

- Kacheln/Liste visibly marks the selected mode with the primary active color.
- Quick-filter and filter counter circles use consistent colored styling while counts are present and panels are open.
- TypeScript passes.

## Implementation Handoff

- Relevant files:
  - `app/components/dashboard.tsx`
  - `docs/cr/2026-07-10-md-active-toolbar-cosmetics.md`
- Current decisions:
  - Keep the compact toolbar layout unchanged.
  - Use primary color for selected segmented-control state.
  - Keep counter badges round, small, and visually separated with a background ring.
- Open decisions: none.
- Non-goals: further toolbar behavior changes.
- Expected implementation steps:
  - Update view-mode button active classes.
  - Normalize toolbar counter badge variants/classes.
  - Run `npx tsc --noEmit`.
- Required checks:
  - `npx tsc --noEmit`
- Risks/assumptions:
  - Pure UI class change, no behavior change expected.

## Model / Subagent Plan

- Model switch needed: no
- Target model/role: current Codex implementation
- Subagent needed: no
- Subagent role: n/a
- Handoff source: this CR

## Confirmation Gate

- Gate needed: yes for production deploy
- Reason: production deploy.
- Approved by: Sebastian via "Deploy"
- Approval timestamp: 2026-07-10 14:15 UTC

## Implementation Notes

- Files changed:
  - `app/components/dashboard.tsx`
  - `docs/cr/2026-07-10-md-active-toolbar-cosmetics.md`
- Important decisions during implementation:
  - View-mode tabs now use the same primary selected state as other active toolbar controls.
  - Quick/filter counter bubbles now share one colored badge style with a background ring.

## Verification

- Local checks:
  - `npx tsc --noEmit` passed.
  - `npm run lint` passed with existing warnings only.
- Build:
  - `npm run build` passed.
- Targeted verification:
  - Diff review for view-mode selected state and toolbar badge classes.
- Manual smoke:
  - Not run in browser.

## Deploy

- Deployment needed: yes
- Deployment ID: `dpl_4MF9zbz5bsDmBahkigz8SgFtoyH6`
- Deployment URL: `https://s5-evo-portal-cl2mpb4zf-sebastiankroeker-2781s-projects.vercel.app`
- Production alias: `https://portal.s5evo.de`
- Deployed at: 2026-07-10 14:16 UTC

## Post-Deploy Smoke

- Routes checked:
  - `/` -> 200
  - `/login` -> 200
  - `/anmeldung` -> 200
  - `/aenderungen` -> 200
  - `/sportlerboerse-dashboard` -> 200
- API checks:
  - `/api/competition` -> 200
  - `/api/results` -> 200
  - `/api/teams` without session -> 401 expected
  - `/api/admin/pending-changes` without session -> 401 expected
- Result: `npm run smoke:public` passed against `https://portal.s5evo.de`.

## Follow-Ups

- 2026-07-10 14:32 UTC: Sebastian reported three additional cosmetic follow-ups from mobile:
  - Filter/Schnellfilter toolbar buttons should stay primary-colored when their closed panel has an active criterion.
  - The active-state summary pills below the hit-stat pills are redundant and should be removed.
  - In list view, the participant-count stats under the team name should be removed for regular teams.
- Local implementation:
  - The redundant summary row below the hit-stat pills was removed.
  - The list-view team-name subline now only appears for `MARKETPLACE` rows via marketplace badges; regular teams no longer show `x / 5 Teilnehmer:innen` there.
- Local verification:
  - `eslint app/components/dashboard.tsx` passed.
  - `npx tsc --noEmit` passed.
  - `npm run lint` passed with existing warnings only.
  - `npm run build` passed.
- Deploy status: pending Sebastian approval.
- 2026-07-10 14:39 UTC: Sebastian clarified that the toolbar buttons already stayed blue while collapsed; the open/closed toggle and color concept needed review.
- Local correction:
  - Removed the redundant explicit toolbar button-active booleans and kept the original direct button rule: blue when the panel is open or its relevant state is active.
  - Split the filter toolbar count so quick-filter-only excludes no longer inflate the filter-panel counter.
  - Counter bubbles now have a distinct closed/open color treatment: closed counters sit as a light badge on active buttons, while open panels switch the counter to the primary filled treatment.
- Local verification:
  - `eslint app/components/dashboard.tsx` passed.
  - `npx tsc --noEmit` passed.
