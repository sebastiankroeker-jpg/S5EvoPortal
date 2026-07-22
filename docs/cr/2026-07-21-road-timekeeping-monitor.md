# CR: Road Timekeeping Monitor V1

Status: Deployed
Date: 2026-07-21
Type: feature
Risk: high
Owner: S5Evo

## Context

Sebastian wants the ROAD individual time trial finish results shown live on a
monitor/beamer during timekeeping. The legacy application used a separate UI
window shared to the external display. V1 may run on the same device/browser as
the timekeeping PWA and should use local PWA data, not a separate server-live
feed.

User decisions on 2026-07-21:

- Same-device V1 is sufficient.
- Show names, participants, and team names.
- Sort/rank by ROAD net time.
- ROAD only.
- ROAD needs two clocks/start blocks: youth/women start first, then a pause,
  then men start as the next configured start block.
- Finish capture remains the existing single function; correct-clock assignment
  comes from the active configured start block.
- Monitor must be able to show results for different classes.
- If the screen is too small, the monitor view should automatically page.

Additional user decision on 2026-07-21 10:02 UTC:

- Ranking must be per selected class, not across all visible rows.
- `Herren Gesamt` and `Damen Gesamt` must not be shown.
- Operators need to configure one or more classes for the beamer display.

## Scope

- In scope:
  - New monitor/beamer route for same-browser ROAD timekeeping data.
  - Live updates from locally persisted timekeeping sessions.
  - ROAD net-time ranking.
  - Class filter/rotation and automatic paging for smaller screens.
  - Link/button from the existing timekeeping UI to open the monitor view.
  - Two ROAD start blocks supported by the existing configurable block model.
- Out of scope:
  - Separate-device monitor feed.
  - Server-pushed live results, SSE, or WebSockets.
  - Official result publication or writes to `DisciplineResult`.
  - Changes to finish capture semantics.
  - RUN/MTB monitor behavior.

## Affected Flows

- User/API/admin flows touched:
  - Timekeepers can open a ROAD monitor window from `/zeitnahme`.
  - Monitor route reads the same local timekeeping state as `/zeitnahme`.
- Data model impact:
  - None.
- Auth/permission impact:
  - Same `timekeeping.use` gate as `/zeitnahme`.
- Sensitive data impact:
  - Participant names and team names are shown on the beamer and persisted in
    the local cached timekeeping snapshot already used by Zeitnahme.
- Offline/cache/export/log/mail impact:
  - Uses existing browser `localStorage` timekeeping state. Adds same-device
    broadcast/update behavior only; no service-worker API caching.
- Production/deploy impact:
  - Production deploy required after checks and explicit approval.

## Privacy / Security Review

- Sensitive fields touched:
  - Participant first name, last name, team name, class, start number, raw/net
    finish time and local/sync status.
- Purpose / data minimization:
  - Names and teams are explicitly requested for operational beamer display.
    The route is ROAD-only and does not add broader API serializers.
- Visibility by role/user/API/UI:
  - Visible only to authenticated users with `timekeeping.use` who can open
    the local monitor window. Physical monitor visibility is an operator choice.
- Persistence locations (DB, localStorage/IndexedDB, files, logs, audit, external services):
  - No new DB persistence. Existing localStorage timekeeping state remains the
    source. No technical logs with participant data.
- Offline/cache behavior, TTL/invalidation/logout clearing:
  - Existing localStorage state is read. V1 does not add TTL or logout clearing.
    Monitor labels data as local/provisional and shows last update state.
- Logs/mails/exports/screenshots exposure:
  - No mails or exports. Avoid logging local event or participant payloads.
- Negative checks for unauthorized access or payload leakage:
  - Monitor route should use existing session/permission client guard.
  - No new API routes.
- Authenticated smoke plan or explicit gap:
  - Automated authenticated browser smoke is unavailable without a session.
    Local build/static checks plus code review cover the guard; Sebastian should
    smoke with real timekeeper session.
- Residual risk:
  - The beamer intentionally displays names/teams. Operators must avoid showing
    it where that is not appropriate.

## Data / API Design

- Proposed data model:
  - No DB/schema changes.
  - Reuse existing `s5evo-timekeeping-v1:{competitionId}` localStorage envelope.
- Proposed API shape:
  - No new API.
- Backward compatibility:
  - Existing `/zeitnahme` capture and sync behavior remains unchanged.
- Migration/data backfill:
  - None.

## Open Questions

- None blocking.

## Acceptance Criteria

- `/zeitnahme/monitor` opens for users with `timekeeping.use`.
- Monitor is ROAD-only and reads the active competition's local timekeeping state.
- Monitor displays ROAD results with rank, start number, name, team, class, net
  time, and sync/local status.
- Results are ranked per class by net time.
- User can display all scoring classes or any configured subset of classes.
- `Herren Gesamt` and `Damen Gesamt` are excluded from the monitor selector and rows.
- Auto-paging cycles through result rows when the viewport cannot show all rows.
- Existing finish capture remains unchanged.
- Existing configurable ROAD blocks support separate youth/women and men clocks.
- No official result publication or API mutation is introduced.

## Implementation Handoff

- Relevant files:
  - `app/zeitnahme/page.tsx`
  - `app/zeitnahme/monitor/page.tsx`
  - optional helper under `lib/`
  - this CR
- Current decisions:
  - Same-device local monitor only.
  - ROAD-only V1.
  - Show names/participants/team as requested.
  - Net-time ranking.
- Open decisions:
  - None.
- Non-goals:
  - Separate-device/server-live feed.
  - Official results/publish.
  - RUN/MTB.
- Expected implementation steps:
  - Extract/reuse local timekeeping types/helpers.
  - Broadcast local timekeeping state changes from `/zeitnahme`.
  - Add `/zeitnahme/monitor` ROAD display with class filter and auto-paging.
  - Add monitor-open action to `/zeitnahme`.
  - Run targeted ESLint, TypeScript, build, and diff check.
- Required checks:
  - `npx eslint app/zeitnahme/page.tsx app/zeitnahme/monitor/page.tsx lib/timekeeping-local.ts`
  - `npx tsc --noEmit --incremental false`
  - `git diff --check`
  - `npm run build`
- Privacy/security checks:
  - No new API route.
  - No service-worker API caching change.
  - No technical logging of participant/timekeeping payloads.
- Risks/assumptions:
  - Same-device windows share same-origin browser storage and BroadcastChannel.
  - Authenticated manual smoke requires Sebastian's real session.
- Context read before implementation:
  - `SESSION_HANDOFF.md` top block: yes
  - Relevant prior CR(s): `2026-07-15-timekeeping-v1.md`,
    `2026-07-17-pwa-offline-read-model-v1.md`,
    `2026-07-15-result-staging-v1.md`
  - Relevant source files: `app/zeitnahme/page.tsx`

## Model / Subagent Plan

- Model switch needed: no
- Target model/role: current Codex implementation
- Subagent needed: no
- Subagent role: n/a
- Handoff source: this CR

## Confirmation Gate

- Gate needed: yes
- Reason: sensitive local/offline display of participant names and production deploy.
- Sensitive-data/production-data reason:
  - Participant names/team names are intentionally displayed in a beamer view.
- Approved by: Sebastian via Telegram details for implementation
- Approval timestamp: 2026-07-21 09:49 UTC

## Implementation Notes

- Files changed:
  - `lib/timekeeping-local.ts`
  - `app/zeitnahme/page.tsx`
  - `app/zeitnahme/monitor/page.tsx`
  - `docs/cr/2026-07-21-road-timekeeping-monitor.md`
- Important decisions during implementation:
  - Added a shared local timekeeping helper for storage key, broadcast channel,
    types, formatting, and start-number matching.
  - Existing `/zeitnahme` writes the same localStorage envelope as before and
    now also broadcasts state changes on `s5evo-timekeeping-local-v1`.
  - Existing finish capture is unchanged; events remain stored under the active
    configured session/start block.
  - Monitor route combines all local ROAD sessions so Block 2 and Block 3 can
    contribute to the same ROAD display.
  - Monitor ranking is by net time within each class, with missing times last.
  - Monitor supports all scoring classes or multiple selected classes.
  - Combined/overall classes such as `Herren Gesamt` and `Damen Gesamt` are
    excluded defensively by code/label.
  - Page size is derived from viewport height and rotates every 8 seconds when
    there are more rows than fit.
  - No new API route, DB write, service-worker caching, export, or log output
    was added.

## Verification

- Local checks:
  - `npx eslint app/zeitnahme/page.tsx app/zeitnahme/monitor/page.tsx lib/timekeeping-local.ts`: passed.
  - `npx tsc --noEmit --incremental false`: passed.
  - `git diff --check`: passed.
- Build:
  - `npm run build`: passed after initial implementation; `/zeitnahme/monitor` appears in the built route list.
  - `npm run build`: passed again after per-class rank / multi-class selection change.
- Targeted verification:
  - Static review confirms finish capture logic remains unchanged.
  - Static review confirms monitor reads `localStorage`/BroadcastChannel only.
  - Static review confirms no new API route or service-worker API caching.
- Sensitive-data negative checks:
  - No technical logging of monitor/timekeeping payloads added.
  - No API serializer broadened.
- Authenticated role smoke:
  - Gap: not run without an authenticated timekeeper browser session.
- Manual smoke:
  - Pending Sebastian test after deploy or local authenticated session.

## Deploy

- Deployment needed: done
- Deployment ID: `dpl_EAQdgjRXSHoiMRAQpZg8v3xsV1ZS`
- Deployment URL: `https://s5-evo-portal-abm7mw4qc-sebastiankroeker-2781s-projects.vercel.app`
- Production alias: `https://portal.s5evo.de`
- Deployed at: 2026-07-21 10:09 UTC

## Post-Deploy Smoke

- Routes checked:
  - `npm run smoke:public` against `https://portal.s5evo.de`: passed.
  - `curl -sSI https://portal.s5evo.de`: 200.
  - `curl -sSI https://portal.s5evo.de/zeitnahme/monitor`: 200.
- API checks:
  - Unauthenticated `GET /api/timekeeping/snapshot?competitionId=...`: `{"error":"Unauthorized"}`.
- Sensitive-data/API leakage checks:
  - No new API route exists for the monitor.
  - Unauthenticated snapshot request exposes no participant payload.
- Result: production ready, with authenticated real-session monitor smoke still manual.

## Follow-Ups

- Consider server-backed separate-device monitor in V2 if needed.

## Addendum: Clock Card Finish Stats And Negative ROAD Net Times

- Date: 2026-07-21 16:59 UTC
- Trigger:
  - Sebastian's screenshot showed captured ROAD rows with `0:00.00` times.
  - He also requested the discipline as the first item in each clock card's
    top-left label and the number of participants already in the finish in the
    top-right stats.
- Diagnosis:
  - ROAD net time is calculated as block elapsed time minus the per-start-number
    interval offset. During tests, a finish can be captured before that
    start-number's scheduled start when the local base time is too recent.
  - The UI formatter clamped negative durations to zero, hiding the diagnostic
    signal as `0:00.00`.
- Fix:
  - Duration formatting now preserves negative values, so test captures before
    the planned individual start show e.g. `-2:10.00` instead of `0:00.00`.
  - Rows with negative net times are marked with the existing warning styling
    and tooltip text.
  - Clock cards now show `Disziplin · Startblock` in the top-left label.
  - Clock-card stats now show unique known finishes as `x/y im Ziel` alongside
    ROAD first-start-number and interval details.
- Privacy/security:
  - UI-only local timekeeping change. No new API, DB write, export, cache scope,
    mail, or technical logging.
- Verification:
  - `npx eslint app/zeitnahme/page.tsx`: passed.
  - `npx tsc --noEmit --incremental false`: passed.
  - `git diff --check -- app/zeitnahme/page.tsx`: passed.
  - `npm run build`: passed.
  - `npm run build`: passed.
- Deploy:
  - Deployment ID: `dpl_98WCC7p2SYDYX6h3iUi6HxsDRWkw`
  - Deployment URL: `https://s5-evo-portal-m8zungrp5-sebastiankroeker-2781s-projects.vercel.app`
  - Production alias: `https://portal.s5evo.de`
  - Deployed at: 2026-07-21 17:47 UTC
  - Post-deploy smoke:
    - `npm run smoke:public`: passed.
    - `curl -sSI https://portal.s5evo.de`: 200.
    - `curl -sSI https://portal.s5evo.de/zeitnahme`: 200.
    - `curl -sSI https://portal.s5evo.de/zeitnahme/monitor`: 200.
    - Unauthenticated `GET /api/timekeeping/snapshot?competitionId=cmn3a1piz0002l104372yx9yt&startNumberSource=imported-test`:
      401.
  - Result: production ready; authenticated timekeeper browser smoke remains manual.

## Addendum: Combined ROAD Finish List

- Date: 2026-07-21 17:03 UTC
- Trigger:
  - Sebastian reported that the stopped-times list only showed the clock for
    which the most recent participant was captured, instead of the captured
    times from both ROAD clocks.
- Diagnosis:
  - ROAD finish capture correctly routed each event into the derived target
    start-block session and then made that session active.
  - The times table still read only `activeSession.events`, so it switched to
    the last target clock after every capture.
- Fix:
  - The times table now combines finish events from all visible sessions for
    the selected discipline. For ROAD this means all configured visible ROAD
    clock cards, including `Schüler`, `Herren`, and custom blocks.
  - Finish order, duplicate-start-number warnings, filters, search, and sort
    now operate on the combined visible list.
  - ROAD rows show the row's start block under the class label so operators can
    distinguish which clock produced the time.
  - Manual start-number assignment from the list now updates the row's source
    session instead of the currently active clock.
- Privacy/security:
  - UI-only local timekeeping change. No new API, DB write, cache scope, export,
    mail, or technical logging.
- Verification:
  - `npx eslint app/zeitnahme/page.tsx`: passed.
  - `npx tsc --noEmit --incremental false`: passed.
  - `git diff --check -- app/zeitnahme/page.tsx docs/cr/2026-07-21-road-timekeeping-monitor.md SESSION_HANDOFF.md`: passed.
  - `npm run build`: passed.
- Deploy:
  - Pre-deploy checks:
    - `npx eslint app/zeitnahme/page.tsx app/zeitnahme/monitor/page.tsx app/api/timekeeping/snapshot/route.ts`: passed.
    - `npx tsc --noEmit --incremental false`: passed.
    - `git diff --check`: passed.
  - Production URL: `https://s5-evo-portal-1ka8bg23j-sebastiankroeker-2781s-projects.vercel.app`
  - Production alias: `https://portal.s5evo.de`
  - Inspect URL: `https://vercel.com/sebastiankroeker-2781s-projects/s5-evo-portal/GRhuiJcF3MTWHpUrC3gcTQht5SCR`
  - Deployed at: 2026-07-21 17:10 UTC
  - Post-deploy smoke:
    - `npm run smoke:public`: passed.
    - `curl -sSI https://portal.s5evo.de`: 200.
    - `curl -sSI https://portal.s5evo.de/zeitnahme`: 200.
    - `curl -sSI https://portal.s5evo.de/zeitnahme/monitor`: 200.
    - Unauthenticated `GET /api/timekeeping/snapshot?competitionId=...&startNumberSource=imported-test`: 401.

## Addendum: ROAD Dual Clock Timekeeping Controls

- Date: 2026-07-21 16:05 UTC
- Trigger:
  - Sebastian reported the ROAD race can have two start blocks on course at
    the same time and asked for two visible ROAD clocks with per-block config,
    editable local base time for testing, and resumable clocks after stop.
  - Sebastian clarified that finish capture should derive the target start
    block automatically from the entered start number.
- Fix:
  - `/zeitnahme` now shows the discipline selector in the page header.
  - For ROAD, two clock cards are shown for the default blocks `Schüler` and
    `Herren`.
  - Each clock card shows the start block and included classes, and contains
    editable block configuration including first start number, start interval,
    classes, and local base time.
  - Stop no longer makes a clock final; pressing Start after Stop resumes from
    the previously elapsed time.
  - The shared finish capture remains a single input/button, but ROAD finish
    events are now routed to the start block derived from the entered start
    number's class. If no start number or no match exists, the current active
    block remains the fallback to preserve existing ad-hoc capture behavior.
  - The finish input stays usable while any clock for the selected discipline is
    running; the capture button requires the derived/fallback target clock to be
    running.
- Privacy/security:
  - No new API route, DB write, official result publication, service-worker
    cache, export, mail, or technical logging.
  - Existing local timekeeping storage continues to hold operational
    participant/start-number context already required by the monitor.
- Verification:
  - `npx eslint app/zeitnahme/page.tsx`: passed.
  - `npx tsc --noEmit --incremental false`: passed.
  - `git diff --check -- app/zeitnahme/page.tsx`: passed.
- Deploy:
  - Pre-deploy checks:
    - `npx eslint app/zeitnahme/page.tsx app/zeitnahme/monitor/page.tsx app/api/timekeeping/snapshot/route.ts`: passed.
    - `npx tsc --noEmit --incremental false`: passed.
    - `git diff --check`: passed.
    - `npm run build`: passed.
  - Deployment ID: `dpl_8AS3Lt3eZL5qSi2cYgc1BVN16Twz`
  - Deployment URL: `https://s5-evo-portal-7og5cbazd-sebastiankroeker-2781s-projects.vercel.app`
  - Production alias: `https://portal.s5evo.de`
  - Deployed at: 2026-07-21 16:33 UTC
  - Post-deploy smoke:
    - `npm run smoke:public`: passed.
    - `curl -sSI https://portal.s5evo.de`: 200.
    - `curl -sSI https://portal.s5evo.de/zeitnahme`: 200.
    - `curl -sSI https://portal.s5evo.de/zeitnahme/monitor`: 200.
    - Unauthenticated `GET /api/timekeeping/snapshot?competitionId=...&startNumberSource=imported-test`: 401.
  - Result: production ready; authenticated real-session ROAD dual-clock smoke
    remains manual.

## Addendum: Restore Start Block Customizing

- Date: 2026-07-21 16:45 UTC
- Trigger:
  - Sebastian reported a regression after the dual-clock UI change: the
    previously useful start-block customizing was lost. Defaults were correct,
    but operators could no longer add, remove, rename, and reassign classes to
    start blocks as before.
- Fix:
  - Restored `Block hinzufügen` in the timekeeping UI.
  - ROAD now displays all configured ROAD start blocks instead of hard-limiting
    the view to the first two. The default remains two blocks (`Schüler` and
    `Herren`), but custom-added blocks are visible and configurable.
  - Existing per-card controls continue to support block name, classes, first
    start number, interval, local base time, and removal.
- Privacy/security:
  - UI-only local timekeeping change. No new API, DB write, cache scope, export,
    mail, or technical logging.
- Verification:
  - `npx eslint app/zeitnahme/page.tsx`: passed.
  - `npx tsc --noEmit --incremental false`: passed.
  - `git diff --check -- app/zeitnahme/page.tsx`: passed.
- Deploy:
  - Deployment ID: `dpl_ATRyPFps8QMZt3gxPen8ZPFcYLLh`
  - Deployment URL: `https://s5-evo-portal-l5whajbam-sebastiankroeker-2781s-projects.vercel.app`
  - Production alias: `https://portal.s5evo.de`
  - Deployed at: 2026-07-21 17:23 UTC
  - Post-deploy smoke:
    - `npm run smoke:public`: passed.
    - `curl -sSI https://portal.s5evo.de`: 200.
    - `curl -sSI https://portal.s5evo.de/zeitnahme`: 200.
    - `curl -sSI https://portal.s5evo.de/zeitnahme/monitor`: 200.
    - Unauthenticated `GET /api/timekeeping/snapshot?competitionId=...&startNumberSource=imported-test`: 401.
  - Result: production ready; authenticated timekeeper browser smoke remains manual.

## Addendum: Monitor Competition Context Hotfix

- Date: 2026-07-21 10:23 UTC
- Trigger:
  - Sebastian reported that the beamer view did not show start-number data,
    participant name, or team.
- Likely cause:
  - The monitor route preferred the new window's active competition context over
    the `competitionId` passed in the monitor URL. If those diverged, the route
    could read a different local timekeeping envelope than the source
    `/zeitnahme` window.
- Fix:
  - `app/zeitnahme/monitor/page.tsx` now treats URL `competitionId` as the
    authoritative monitor source and uses the active competition only as a
    fallback.
- Verification:
  - `npx eslint app/zeitnahme/monitor/page.tsx app/zeitnahme/page.tsx lib/timekeeping-local.ts`: passed.
  - `npx tsc --noEmit --incremental false`: passed.
  - `git diff --check`: passed.
  - `npm run build`: passed.
- Deploy:
  - Deployed together with imported test start number snapshot addendum.

## Addendum: Imported Test Start Numbers For Timekeeping Snapshot

- Date: 2026-07-21 10:55 UTC
- Trigger:
  - Sebastian clarified that the timekeeping snapshot should use the imported
    team-assigned test start numbers instead of synthetic 9000-series numbers.
- Data check:
  - Active 2026 competition has `0` official approved teams with start numbers
    in the strict snapshot filter.
  - Active 2026 competition has `74` teams with imported `Team.startNumber`
    test assignments.
  - These assignments yield `74` ROAD starters for testing.
- Fix:
  - `GET /api/timekeeping/snapshot` now accepts
    `startNumberSource=imported-test`.
  - `official` mode remains strict: approved teams with `Team.startNumber`.
  - `imported-test` mode uses non-deleted teams with imported `Team.startNumber`
    regardless of approval, and marks returned starters as test numbers.
  - The timekeeping UI now offers `Startnummernquelle` with only two options:
    `Offizielle Startnummern` and `Importierte Test-Startnummern`.
  - Synthetic 9000-series start numbers were removed from the UI.
  - Existing local storage flag is migrated conservatively: old enabled test
    flag maps to `imported-test`.
- Privacy/security:
  - Route remains gated by `timekeeping.use`/tenant role checks.
  - No new public API route and no participant data in technical logs.
  - No team start numbers are written or mutated by this snapshot mode.
- Verification:
  - `npx eslint app/api/timekeeping/snapshot/route.ts app/zeitnahme/page.tsx app/zeitnahme/monitor/page.tsx lib/timekeeping-local.ts`: passed.
  - `npx tsc --noEmit --incremental false`: passed.
  - Local DB source check: `officialTeams=0`, `importedTestTeams=74`,
    `roadFromImportedTest=74`.
  - `git diff --check`: passed.
  - `npm run build`: passed.
- Deploy:
  - Deployment ID: `dpl_736bWE2MDXie2gqgYN8iBps5Vyaw`
  - Deployment URL: `https://s5-evo-portal-it0s268wu-sebastiankroeker-2781s-projects.vercel.app`
  - Production alias: `https://portal.s5evo.de`
  - Deployed at: 2026-07-21 10:56 UTC
  - Post-deploy smoke:
    - `npm run smoke:public`: passed.
    - `curl -sSI https://portal.s5evo.de`: 200.
    - `curl -sSI https://portal.s5evo.de/zeitnahme/monitor`: 200.
    - Unauthenticated `GET /api/timekeeping/snapshot?competitionId=...&startNumberSource=imported-test`:
      `{"error":"Unauthorized"}`.
  - Result: production ready; authenticated timekeeper browser smoke remains manual.

## Addendum: Clock Config Start Block Selector

- Date: 2026-07-21 17:17 UTC
- Trigger:
  - Sebastian reported that the clock configuration no longer exposed the
    previous ability to define and select start blocks.
- Fix:
  - `app/zeitnahme/page.tsx` now shows a `Startblock` selector inside the
    clock configuration.
  - `Block hinzufügen` moved back into the clock configuration context.
  - Selecting a configured block focuses and opens that block's configuration.
  - Existing per-block settings remain unchanged: block name, class assignment,
    first start number, interval, local base time, start-number source, and
    removal.
- Privacy/security:
  - UI-only local timekeeping change. No API, DB write, export, log, or cache
    behavior changed.
- Verification:
  - `npx eslint app/zeitnahme/page.tsx`: passed.
  - `npx tsc --noEmit --incremental false`: passed.
  - `git diff --check -- app/zeitnahme/page.tsx`: passed.
  - `npm run build`: passed.
- Deploy:
  - Not deployed yet.

## Addendum: Clock Config Start Block Buttons

- Date: 2026-07-21 17:40 UTC
- Trigger:
  - Sebastian clarified that configured start blocks should be displayed as
    buttons like the class chips. The dropdown was not the original intended
    solution.
- Fix:
  - `app/zeitnahme/page.tsx` replaces the clock-configuration `Startblock`
    dropdown with a wrapping button list.
  - The active start block uses the primary button state; inactive configured
    blocks use outline buttons.
  - `Block hinzufügen` remains in the same configuration area.
  - Existing per-block editing remains unchanged.
- Privacy/security:
  - UI-only local timekeeping change. No API, DB write, export, log, or cache
    behavior changed.
- Verification:
  - `npx eslint app/zeitnahme/page.tsx`: passed.
  - `npx tsc --noEmit --incremental false`: passed.
  - `git diff --check -- app/zeitnahme/page.tsx docs/cr/2026-07-21-road-timekeeping-monitor.md SESSION_HANDOFF.md`: passed.
  - `npm run build`: passed.
- Deploy:
  - Not deployed yet.

## Addendum: ROAD Two Visible Clock Slots

- Date: 2026-07-21 18:01 UTC
- Trigger:
  - Sebastian reported that ROAD currently shows three clock cards after
    configuring three start blocks, but only two visible clocks are needed.
- Fix:
  - `app/zeitnahme/page.tsx` keeps all configured ROAD start blocks available
    in the clock configuration.
  - The ROAD timekeeping surface now renders at most two visible clock slots.
  - Selecting a configured start-block button inside a clock configuration
    replaces that clock slot instead of adding another visible clock card.
  - Finish routing by start number now targets only the visible ROAD clock
    slots; hidden configured blocks remain configuration options.
- Privacy/security:
  - UI-only local timekeeping change. No API, DB write, export, log, or cache
    behavior changed.
- Verification:
  - `npx eslint app/zeitnahme/page.tsx app/zeitnahme/monitor/page.tsx app/api/timekeeping/snapshot/route.ts`: passed.
  - `npx tsc --noEmit --incremental false`: passed.
  - `git diff --check`: passed.
  - `npm run build`: passed.
- Deploy:
  - Production deployment: `dpl_AbfseswHwun99qcAgcB2bJ7Mh7vN`.
  - URL: `https://s5-evo-portal-5q3i6rsdn-sebastiankroeker-2781s-projects.vercel.app`.
  - Alias: `https://portal.s5evo.de`.
  - Ready state: `READY`.
  - Post-deploy smoke:
    - `npm run smoke:public`: passed.
    - `curl -sSI https://portal.s5evo.de`: 200.
    - `curl -sSI https://portal.s5evo.de/zeitnahme`: 200.
    - `curl -sSI https://portal.s5evo.de/zeitnahme/monitor`: 200.
    - Unauthenticated `GET /api/timekeeping/snapshot?competitionId=cmn3a1piz0002l104372yx9yt&startNumberSource=imported-test`: 401.
