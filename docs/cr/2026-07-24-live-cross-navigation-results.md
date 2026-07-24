# CR: Live cross-navigation for teams, start lists and results

Status: Deployed
Date: 2026-07-24
Type: feature
Risk: medium
Owner: S5Evo

## Context

Sebastian requested additional Live-route navigation helpers after the live
publication and privacy-name hotfixes. Existing Live navigation already supports
focus and colored marking between Live teams and start lists. The next step is
to extend the same interaction pattern across start lists, individual results
and overall results.

The request was made during the running 2026 competition, so this CR should be
implemented conservatively and deployed only after explicit approval.

## Scope

- In scope:
  - From `Live -> Teams`, clicking/tapping a participant navigates to the
    relevant start-list row with focus and colored marking.
  - If a result already exists for that participant, participant navigation
    should prefer the participant's placement in the individual result list.
  - From individual result lists and overall result lists, add the same
    cross-navigation behavior where matching target data exists.
  - In the overall-result points matrix, clicking a scored point navigates to
    the participant's row in the individual discipline result list.
  - In the overall-result points matrix, clicking the team navigates to the
    team card under `Live -> Teams`.
  - All navigation targets use the existing focus/scroll/temporary colored
    marker pattern from the Live teams/start-list navigation.
- Out of scope:
  - New API endpoints or database tables unless existing payloads cannot map
    points to participants reliably.
  - Changing ranking/scoring logic.
  - Changing publication visibility rules.
  - Broad PWA/offline caching changes.

## Affected Flows

- User/API/admin flows touched:
  - Public/Spectator Live route: Teams, Startlisten, Ergebnisse.
  - Portal-user/admin Live route with the same UI interactions.
  - Results view components that render individual and overall results.
- Data model impact:
  - Expected none.
- Auth/permission impact:
  - Expected none. Navigation must stay inside data already visible to the
    current viewer under the Live publication level.
- Sensitive data impact:
  - Participant names, team names, start numbers and result placements are
    linked more directly in UI navigation.
- Offline/cache/export/log/mail impact:
  - Expected none. No new exports, mails or logs.
- Production/deploy impact:
  - Requires normal production deploy after implementation approval.

## Privacy / Security Review

- Sensitive fields touched:
  - Participant names tied to discipline results, team names, start numbers and
    placement/points data already returned by the Live APIs.
- Purpose / data minimization:
  - Use existing client payloads and identifiers to navigate between visible
    rows. Do not add contact data, birth dates, e-mail, phone, claim/account
    fields, or admin-only fields.
- Visibility by role/user/API/UI:
  - Navigation must not reveal hidden rows. It may only focus rows already
    present in the active Live payload for the current viewer.
- Persistence locations:
  - Client component state only. No DB, localStorage, IndexedDB, files, audit
    logs or external services planned.
- Offline/cache behavior:
  - No new cache. Existing PWA/offline behavior remains unchanged.
- Logs/mails/exports/screenshots exposure:
  - No technical logs, mails or exports planned.
- Negative checks for unauthorized access or payload leakage:
  - Verify implementation does not broaden `/api/teams` or `/api/results`
    serializers beyond the current Live payload requirements.
- Authenticated smoke plan or explicit gap:
  - Public smoke can verify routes/API health. Authenticated role smoke remains
    manual unless session cookies are available.
- Residual risk:
  - If overall-result matrix entries do not currently carry participant IDs,
    mapping may require careful derivation from discipline rankings to avoid
    wrong targets.

## Data / API Design

- Proposed data model:
  - No schema change.
- Proposed API shape:
  - `GET /api/results` now includes `participantId` on each discipline ranking
    entry. This is the same stable participant identifier already present in
    the Live team/start-list payload and is required to avoid brittle matching
    by display name.
- Backward compatibility:
  - Additive UI behavior. Existing tabs, filters, printing and exports should
    keep working.
- Migration/data backfill:
  - None.

## Open Questions

- Should participant click from `Live -> Teams` always prefer existing result,
  or should users be able to choose between Startliste and Ergebnis? Current
  requested default: prefer result when present, otherwise start list.
- If multiple discipline results exist for one participant over time, target
  the discipline assigned to the participant/start-list row, not an arbitrary
  first result.

## Acceptance Criteria

- From a participant in `Live -> Teams`, navigation lands on:
  - the participant's individual-result placement when a result exists.
  - otherwise the participant's start-list row.
- From an individual-result row, navigation to the owning team lands on the
  correct `Live -> Teams` card with focus and colored marking.
- From an overall-result row/team, navigation to the owning team lands on the
  correct `Live -> Teams` card with focus and colored marking.
- From a scored point in the overall-result matrix, navigation lands on the
  correct participant row in the relevant individual discipline result list,
  with focus and colored marking.
- Navigation respects current Live visibility and does not show data outside
  the active viewer's published access level.
- If filters would hide the target row, the UI adjusts or clears only the
  necessary filter state so the focused target is visible.
- Keyboard/focus behavior remains usable: target rows receive programmatic
  focus or an accessible focus target, not only a visual highlight.
- Existing printing, CSV export, publication locks, and Teams/Startlisten tabs
  continue to work.

## Implementation Handoff

- Relevant files:
  - `app/components/live-screen.tsx`
  - `app/components/results-view.tsx`
  - `app/api/results/route.ts` only if stable participant IDs are missing from
    result entries.
- Current decisions:
  - Reuse existing Live focus state/pattern: `scrollIntoView`, temporary focus
    marker, section/tab switching, and filter adjustment.
  - Keep data local to the Live route; no new persistent state.
- Open decisions:
  - Whether `/api/results` already exposes enough participant identity for the
    overall matrix point -> individual result navigation.
- Non-goals:
  - No scoring/ranking changes.
  - No privacy/publication model changes.
  - No new offline read model.
- Expected implementation steps:
  - Inspect existing `focusedTeamId`, `focusedStartParticipantElementId`, and
    focus helper logic in `live-screen.tsx`.
  - Inspect `results-view.tsx` overall and individual table row data.
  - Add a shared Live navigation target model or callbacks passed between
    `LiveScreen` and `ResultsView`.
  - Add stable DOM IDs for result rows and overall matrix cells.
  - Implement result-target lookup by participant/team/discipline.
  - Preserve current filter state except where target visibility requires a
    narrow adjustment.
- Required checks:
  - `npx eslint app/components/live-screen.tsx app/components/results-view.tsx`
  - `npx tsc --noEmit`
  - `npm run build`
  - `git diff --check`
  - `npm run smoke:public` after production deploy.
- Privacy/security checks:
  - Verify no contact/e-mail/birth/claim/role fields are added to result/team
    payloads.
  - If `/api/results` changes, inspect unauthenticated spectator payload shape.
- Risks/assumptions:
  - Result entries may not currently carry participant IDs; avoid brittle
    matching by display name when possible.
  - Highlight/focus should not fight print layout or mobile sticky controls.
- Context read before implementation:
  - `SESSION_HANDOFF.md` top block: read on 2026-07-24.
  - Relevant prior CR(s): `docs/cr/2026-07-23-live-map-message-ui-followups.md`.
  - Relevant source files: `app/components/live-screen.tsx`,
    `app/components/results-view.tsx`.

## Model / Subagent Plan

- Model switch needed: no
- Target model/role: Codex implementation in the same repo context
- Subagent needed: no
- Subagent role: none
- Handoff source: this CR

## Confirmation Gate

- Gate needed: yes
- Reason:
  - Production Live UI behavior during competition day; deployment should be
    explicitly approved.
- Sensitive-data/production-data reason:
  - Participant/team/result identities are linked in the UI. No broader data
    exposure is intended, but serializer changes would need review.
- Approved by:
  - Sebastian via "Bitte ausliefern"
- Approval timestamp:
  - 2026-07-24 19:05 UTC

## Implementation Notes

- Files changed:
  - `lib/domain/scoring.ts`
  - `app/api/results/route.ts`
  - `app/components/live-screen.tsx`
  - `app/components/results-view.tsx`
- Important decisions during implementation:
  - Added only `participantId` to result ranking entries; no contact, birth,
    account, claim, role, phone, or e-mail fields were added.
  - `LiveScreen` sends a result-focus request when a team participant is
    clicked and Live results are available.
  - If no result row exists yet, the request falls back to the existing
    start-list focus behavior.
  - `ResultsView` owns result-row focus, class/discipline filter adjustment,
    and point-matrix navigation.
  - Team cells in individual and overall result tables navigate back to
    `Live -> Teams`.

## Verification

- Local checks:
  - `npx eslint app/components/live-screen.tsx app/components/results-view.tsx app/api/results/route.ts lib/domain/scoring.ts`
  - `npx tsc --noEmit`
- Build:
  - `npm run build`
- Targeted verification:
  - Diff reviewed: `/api/results` serializer only adds `participantId` to
    already-visible result rows.
- Sensitive-data negative checks:
  - No contact, e-mail, phone, birth date/year, claim/account, role or owner
    fields added to `/api/results`.
- Authenticated role smoke:
  - Pending/manual unless cookies are available.
- Manual smoke:
  - Pending

## Deploy

- Deployment needed: yes
- Deployment ID:
  - `dpl_HsL78ALG84G1EJEr2ssWmXvsHTa4`
- Deployment URL:
  - `https://s5-evo-portal-6fbyzbjsy-sebastiankroeker-2781s-projects.vercel.app`
- Production alias:
  - `https://portal.s5evo.de`
- Deployed at:
  - 2026-07-24 19:12 UTC

## Post-Deploy Smoke

- Routes checked:
  - `HEAD https://portal.s5evo.de` -> 200
  - `npm run smoke:public` -> pass
- API checks:
  - Public smoke: `/api/competition` -> 200, `/api/results` -> 200.
  - Targeted shape check against production `/api/results`:
    `resultEntries=102`, `entriesWithParticipantId=102`.
- Sensitive-data/API leakage checks:
  - Targeted shape check found `forbiddenFieldHits=0` for contact e-mail,
    phone, birth date/year, participant e-mail, owner fields and claim tokens
    on result entries.
- Result:
  - Passed. Authenticated/manual UI smoke remains for Sebastian in the live UI.

## Follow-Ups

- None yet.
