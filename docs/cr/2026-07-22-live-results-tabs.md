# CR: Live Results Tabs

Status: Deployed
Date: 2026-07-22
Type: feature
Risk: medium
Owner: S5Evo

## Context

Sebastian wants the `Live` area ordered as a competition-day cockpit: teams,
start lists, and results should all stay available, while Sportlerboerse/
marketplace discovery should not appear inside these Live views.

## Scope

- In scope:
  - Keep three Live main tabs: `Teams`, `Startlisten`, `Ergebnisse`.
  - Inside `Ergebnisse`, provide two subtabs: `Gesamtergebnisse` and
    `Einzelergebnisse`.
  - Show `Damen Gesamt` and `Herren Gesamt` as selectable class buttons in both
    result subviews.
  - Mark class buttons with the number of locally stored favorite teams in that
    class, when present.
  - Keep Sportlerboerse/marketplace teams out of the Live team and start-list
    views.
  - Keep favorites as filters/badges/stars across the Live cockpit, not as a
    separate main tab.
  - Use existing `/api/results` payload and existing local Watchlist IDs.
- Out of scope:
  - New API routes, DB migrations, server-side result publication changes.
  - New favorite creation UI inside Live.
  - Sportlerboerse feature changes outside Live.
  - Production deploy before separate Sebastian-Go.

## Affected Flows

- User/API/admin flows touched: public/authenticated Live result UI.
- Data model impact: none.
- Auth/permission impact: none intended; existing `/api/results` visibility and
  publication masking remain leading.
- Sensitive data impact: existing result payload can include team and participant
  display names according to existing publication rules; no new fields.
- Offline/cache/export/log/mail impact: existing result offline cache and
  existing watchlist localStorage IDs are reused; no exports, mails or logs.
- Production/deploy impact: functional frontend change, deploy-gated.

## Privacy / Security Review

- Sensitive fields touched: existing visible team names and participant display
  names in results; existing local favorite team IDs.
- Purpose / data minimization: reuse the already loaded result payload and only
  derive aggregate groupings client-side; favorite counts use team IDs only.
- Visibility by role/user/API/UI: unchanged API visibility; UI only renders
  data returned by `/api/results`.
- Persistence locations: existing `s5evo.offline.results...` cache and existing
  `s5evo.watchlist.teams...` localStorage keys; no new persistence.
- Offline/cache behavior, TTL/invalidation/logout clearing: unchanged from
  PWA Watchlist V1 and offline result cache behavior.
- Logs/mails/exports/screenshots exposure: no new logs, mails or exports.
- Negative checks for unauthorized access or payload leakage: no API/serializer
  change; public smoke should keep protected endpoints 401.
- Authenticated smoke plan or explicit gap: local unauthenticated UI/runtime
  check; authenticated manual browser smoke remains a gap unless Sebastian tests.
- Residual risk: combined `Damen Gesamt` / `Herren Gesamt` scoring is derived
  client-side from existing class result rows until server-side combined result
  publication exists.

## Data / API Design

- Proposed data model: none.
- Proposed API shape: none; combine `damen-a` + `damen-b`, and `jungsters` +
  `herren` + `masters` client-side.
- Backward compatibility: `/api/results` unchanged.
- Migration/data backfill: none.

## Acceptance Criteria

- `Live` shows three primary tabs: `Teams`, `Startlisten`, `Ergebnisse`.
- `Ergebnisse` shows exactly two result subtabs: `Gesamtergebnisse` and
  `Einzelergebnisse`.
- Both result subviews offer class buttons for `Damen Gesamt` and
  `Herren Gesamt`.
- Class buttons show favorite counts when the existing watchlist contains teams
  in that overall class.
- Gesamtergebnisse shows team ranking with all five disciplines and total
  points for selected overall classes.
- Einzelergebnisse shows discipline result lists for selected overall classes.
- Teams and Startlisten are restored as Live cockpit views.
- Sportlerboerse/marketplace teams are filtered out of Teams and Startlisten.
- Watchlist is not a separate main tab; favorites remain available through
  stars, filters and badges.
- No API, DB, serializer, mail, export, or service-worker cache changes.

## Implementation Handoff

- Relevant files:
  - `app/components/live-screen.tsx`
  - `app/components/results-view.tsx`
  - `docs/cr/2026-07-22-live-results-tabs.md`
- Current decisions:
  - Client-side combined result groups only.
  - `Damen Gesamt`: `damen-a`, `damen-b`.
  - `Herren Gesamt`: `jungsters`, `herren`, `masters`.
  - Existing local watchlist IDs only drive favorite counts; no new favorite UI.
- Open decisions:
  - Whether combined results should later be first-class server/API output.
- Non-goals:
  - Sportlerboerse changes outside Live.
  - Production deploy without separate Go.
- Expected implementation steps:
  - Restore Teams and Startlisten as Live main tabs.
  - Remove the separate Watchlist main tab.
  - Filter Sportlerboerse/marketplace teams out of Live team/start-list data.
  - Add result subtabs, overall class buttons, favorite counts, and combined
    result derivation to `ResultsView`.
  - Run targeted lint, TypeScript, diff check and build.
- Required checks:
  - `npx eslint app/components/live-screen.tsx app/components/results-view.tsx`
  - `npx tsc --noEmit --incremental false`
  - `git diff --check`
  - `npm run build`
- Privacy/security checks:
  - Confirm no `/api/*`, schema, service worker, mail, export, or logging change.
- Risks/assumptions:
  - Combined scoring rules follow the existing scoring engine over aggregated
    class entries.
- Context read before implementation:
  - `SESSION_HANDOFF.md` top block: read 2026-07-22.
  - Relevant prior CR(s): `2026-07-17-pwa-watchlist-v1.md`.
  - Relevant source files: `live-screen.tsx`, `results-view.tsx`,
    `/api/results/route.ts`, `lib/domain/scoring.ts`, `classification.ts`.

## Model / Subagent Plan

- Model switch needed: no
- Target model/role: Codex implementation
- Subagent needed: no
- Subagent role:
- Handoff source: this CR

## Confirmation Gate

- Gate needed: yes for production deploy; no additional gate for local
  implementation because Sebastian directly requested the change and no
  sensitive visibility is broadened.
- Reason: functional Live UI change on production auto-deploy branch.
- Sensitive-data/production-data reason: existing result display data only; no
  new API/data exposure or mutation.
- Approved by: Sebastian request at 2026-07-22T05:00:06Z for implementation;
  production deploy still requires separate Go.
- Approval timestamp: 2026-07-22T05:00:06Z

## Implementation Notes

- Files changed:
  - `app/components/live-screen.tsx`
  - `app/components/results-view.tsx`
  - `docs/cr/2026-07-22-live-results-tabs.md`
- Important decisions during implementation:
  - `LiveScreen` keeps Teams and Startlisten as top-level Live tabs and keeps
    `ResultsView` under the `Ergebnisse` tab.
  - The separate Watchlist main tab was removed; favorites remain available as
    stars and `Nur Favoriten` filters in Teams and Startlisten.
  - Team/start-list data is filtered client-side to exclude
    `registrationMode=MARKETPLACE` and `category=sportlerboerse`.
  - `ResultsView` derives two client-side combined classes:
    `Damen Gesamt` from `damen-a` + `damen-b`, and `Herren Gesamt` from
    `jungsters` + `herren` + `masters`.
  - Combined scoring reruns the existing `rankDiscipline` and
    `calculateTeamScores` engine over the aggregated entries.
  - Overall class buttons remain visible even when no official result rows are
    present yet; empty tables show a local empty state.
  - Favorite counts use only existing local watchlist Team-IDs and are displayed
    only when greater than zero.

## Verification

- Local checks:
  - `npx eslint app/components/live-screen.tsx app/components/results-view.tsx`
    -> green
  - `npx tsc --noEmit --incremental false` -> green
  - `git diff --check` -> green
- Build:
  - `npm run build` -> green
- Targeted verification:
  - Local dev server `http://localhost:3108` responded `HEAD /` -> 200.
  - Local `GET /api/results?competitionId=cmn3a1piz0002l104372yx9yt` -> 200.
  - Combined source mapping check:
    - `Damen Gesamt`: 2 source classes.
    - `Herren Gesamt`: 3 source classes.
  - Source search in `live-screen.tsx` / `results-view.tsx` found the cockpit
    labels `Teams`, `Startlisten`, `Ergebnisse`, plus result labels
    `Gesamtergebnisse`, `Einzelergebnisse`, `Damen Gesamt`, `Herren Gesamt`.
  - Source search confirms no separate Watchlist main tab and no Sportlerboerse
    Live view; `sportlerboerse` appears only in the explicit client-side
    exclusion predicate.
- Sensitive-data negative checks:
  - No `/api/*`, Prisma schema, service worker, mail, export, log, or serializer
    files changed.
  - No new persistence key was introduced; existing results cache and watchlist
    ID store are reused.
- Authenticated role smoke:
  - Gap: no authenticated browser session/cookie in agent; Teams/Startlisten
    require authenticated role visibility for full manual UI smoke.
- Manual smoke:
  - Pending Sebastian/device smoke before or after deploy: open Live, switch
    both tabs, toggle Damen/Herren buttons, confirm favorite badges when local
    favorites exist.

## Deploy

- Deployment needed: yes, completed after Sebastian-Go.
- Deployment ID: `dpl_Cgsp5YyBUqkp38UanLKrqVttRo3K`
- Deployment URL:
  `https://s5-evo-portal-2263mmjyz-sebastiankroeker-2781s-projects.vercel.app`
- Production alias: `https://portal.s5evo.de`
- Deployed at: 2026-07-22T05:25Z

## Post-Deploy Smoke

- Routes checked:
  - `npm run smoke:public` -> green.
  - `HEAD https://portal.s5evo.de/` -> 200, Vercel, `x-vercel-cache:
    PRERENDER`.
- API checks:
  - `GET /api/results?competitionId=cmn3a1piz0002l104372yx9yt` -> 200.
  - Combined mapping from live API response:
    - `Damen Gesamt`: 2 source classes, 0 current official team scores.
    - `Herren Gesamt`: 3 source classes, 0 current official team scores.
    - Overall payload: `classes=9`, `teams=82`.
  - Public smoke kept unauthenticated `/api/teams` and
    `/api/admin/pending-changes` at 401.
- Sensitive-data/API leakage checks:
  - No API/serializer change shipped.
  - Public smoke confirms protected team/admin APIs remain protected without a
    session.
- Result:
  - Production deploy READY and public smoke green. Authenticated manual smoke
    remains open for Teams/Startlisten/Favoriten UI.

## Follow-Ups

- Consider moving combined overall rankings into `/api/results` when official
  result publication needs server-side combined classes.
