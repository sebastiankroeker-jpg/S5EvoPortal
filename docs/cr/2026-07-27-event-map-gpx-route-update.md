# CR: Event-Map GPX Route Update

Status: Implemented locally
Date: 2026-07-27
Type: feature
Risk: medium
Owner: S5Evo

## Context

Sebastian now has GPX/XML files for the competition routes and wants a CR for
updating the portal map. The existing event map already has a route layer
foundation with static draft route coordinates in `lib/event-map/course-routes.ts`.

Initial sanitized GPX inspection found three usable tracks:

- Running route: about 5.6 km, 414 track points, bounds east of the lake.
- MTB route: about 13.3 km, 2398 track points, bounds south/east of the start
  area.
- Bike route candidate: about 4.5 km, 1038 track points, likely the road/round
  course candidate from the supplied cycling GPX.

The raw GPX files include personal or unnecessary telemetry and must not be
copied into application source or CR prose beyond sanitized technical facts.

## Scope

- In scope:
  - Replace or augment draft route geometries in the event map with sanitized
    GPX-derived coordinates.
  - Preserve the existing static typed route model unless a small helper module
    makes generated route data cleaner.
  - Use only map-relevant route geometry: longitude/latitude coordinate arrays.
  - Simplify/decimate GPX points enough for browser performance while preserving
    route shape.
  - Update route status/source notes to show GPX-derived routes and which ones
    still need manual plausibility review.
  - Keep admin/public visibility behavior unchanged unless Sebastian requests a
    separate map visibility change.
- Out of scope:
  - Importing raw GPX files into production.
  - Storing GPX track names, athletes, activity titles, timestamps, heart rate,
    power, cadence, temperature, comments, device metadata, or original file
    names in source code, logs, smoke output, or deployed bundles.
  - Adding an admin GPX upload UI.
  - Changing map tile provider, offline basemap behavior, or sponsor POIs.
  - Production deploy without explicit Go.

## Affected Flows

- User/API/admin flows touched:
  - `/karte` route layer rendering.
  - Existing map layer toggles for routes.
- Data model impact:
  - No database migration planned.
  - Static route coordinate source changes only.
- Auth/permission impact:
  - No role or permission semantics change planned.
- Sensitive data impact:
  - Raw GPX contains potential personal information and fitness telemetry.
  - Product output must contain sanitized route geometry only.
- Offline/cache/export/log/mail impact:
  - No API cache, export, mail, or logging changes planned.
  - Static route geometry may be bundled in the client like existing route data.
- Production/deploy impact:
  - Normal Vercel production deploy after implementation approval and checks.

## Privacy / Security Review

- Sensitive fields touched:
  - Raw inbound GPX can contain track names/activity titles, people references,
    exact activity timestamps, heart rate, power, cadence, temperature, device
    metadata, and original file names.
- Purpose / data minimization:
  - The map needs only route geometry. Use `[lng, lat]` points.
  - Do not persist times, telemetry, title/name, athlete context, or raw XML.
  - Do not retain precise point timestamps in generated artifacts.
- Visibility by role/user/API/UI:
  - Sanitized route geometry is visible wherever the event map route layer is
    visible.
  - No private API exposure planned.
- Persistence locations:
  - Raw attachments stay only in inbound workspace media while processing.
  - Sanitized coordinates may live in repo static source.
  - No database, browser localStorage/IndexedDB, audit table, email, or export
    persistence planned.
- Offline/cache behavior, TTL/invalidation/logout clearing:
  - Existing static bundle behavior only.
  - No service-worker `/api/*` or `/_next/*` caching changes.
- Logs/mails/exports/screenshots exposure:
  - Do not print or commit original GPX names/titles, timestamps, telemetry, or
    personal references.
  - Smoke output may include only sanitized counts and route IDs.
- Negative checks for unauthorized access or payload leakage:
  - Verify generated source contains no `<time>`, `<extensions>`, `hr`, `power`,
    `cad`, `atemp`, raw GPX track names, or original file names.
  - Verify protected APIs still return expected unauthenticated responses in
    public smoke.
- Authenticated smoke plan or explicit gap:
  - Browser/manual authenticated map smoke may be a gap unless a valid admin
    session is available.
- Residual risk:
  - Route geometry itself can reveal the course, which is intended for a map.
  - Supplied tracks may include warm-up, crash/stop segments, wrong laps, or
    historical deviations; Sebastian should plausibility-check before deploy.

## Data / API Design

- Proposed data model:
  - Keep `CourseRoute` with `coordinates: [number, number][]`.
  - Consider adding a generated/sanitized route data file if the coordinate
    arrays become too large for hand-maintained source.
  - Store source notes such as `GPX-derived, sanitized, needs review` without
    raw activity identity.
- Proposed API shape:
  - No new API.
- Backward compatibility:
  - Existing map component should continue consuming `COURSE_ROUTES`.
- Migration/data backfill:
  - None.

## Open Questions

- Which supplied bike GPX should replace the current `road-round-course`, and
  whether it represents one official competition lap.
- Whether the supplied MTB GPX should replace both current MTB draft routes or
  only the Herren/full MTB route.
- Whether the running GPX represents the exact official lap pattern for all
  classes or only one participant/activity variant.
- Desired route statuses after update: `verified` if Sebastian confirms, or
  `draft_digitization` / review note if not.

## Acceptance Criteria

- Event map shows GPX-derived route shapes for the intended disciplines.
- Route layer remains performant on mobile.
- No raw GPX files or original GPX metadata are committed.
- Generated/source route data contains coordinates only, plus sanitized route
  labels/status/source notes.
- Existing sponsor, infrastructure, and location POIs keep working.
- Map visibility/auth behavior remains unchanged.
- Checks pass before deploy:
  - targeted ESLint for map/route files
  - `npx tsc --noEmit --incremental false`
  - `npm run build`
  - `git diff --check`
  - `npm run smoke:public` after deploy

## Implementation Handoff

- Relevant files:
  - `lib/event-map/course-routes.ts`
  - `app/components/admin-event-map-page.tsx`
  - `app/karte/page.tsx`
  - optional one-off local script for sanitized GPX conversion
  - `docs/cr/2026-07-27-event-map-gpx-route-update.md`
- Current decisions:
  - Use supplied GPX only as source material.
  - Strip everything except route geometry.
  - Keep route data static for this CR.
  - Keep map visibility unchanged.
- Open decisions:
  - Final mapping of the three supplied tracks to running, road cycling, and
    MTB route IDs/classes.
  - Whether to mark routes as verified or still needing review.
- Non-goals:
  - Raw GPX upload/management UI.
  - Tile provider or offline map change.
  - Sponsor/infrastructure data changes.
- Expected implementation steps:
  - Parse GPX locally.
  - Convert to sanitized `[lng, lat]` arrays.
  - Simplify points with a deterministic tolerance suitable for mobile.
  - Replace/augment route coordinates.
  - Update route source notes/status without personal metadata.
  - Run privacy grep and build checks.
- Required checks:
  - targeted ESLint for changed route/map files
  - `npx tsc --noEmit --incremental false`
  - `npm run build`
  - `git diff --check`
  - production smoke after Go/deploy
- Privacy/security checks:
  - Grep generated/source files for raw GPX metadata and telemetry tags.
  - Confirm no raw inbound GPX file is staged for commit.
  - Confirm no service-worker/API cache change.
- Risks/assumptions:
  - GPX-derived routes may include non-official activity deviations.
  - Simplification tolerance must not visibly cut corners on tight course
    segments.
  - Browser map screenshot/manual smoke is ideal but may be limited by missing
    authenticated admin session.
- Context read before implementation:
  - `SESSION_HANDOFF.md` top block: read 2026-07-27.
  - Relevant prior CR(s): `docs/cr/2026-07-22-interaktive-event-map.md`.
  - Relevant source files: `lib/event-map/course-routes.ts`.

## Model / Subagent Plan

- Model switch needed: no
- Target model/role: current Codex implementation agent
- Subagent needed: no
- Subagent role: none
- Handoff source: this CR

## Confirmation Gate

- Gate needed: yes
- Reason: implementation touches map content derived from raw external files and
  likely production deploy.
- Sensitive-data/production-data reason: raw GPX includes personal/activity
  metadata that must be stripped before commit/deploy.
- Approved by: Sebastian requested adding the routes to the map, with one round
  enough where recordings contain multiple rounds.
- Approval timestamp: 2026-07-27 18:13 UTC

## Implementation Notes

- Files changed:
  - `lib/event-map/course-routes.ts`
  - `docs/cr/2026-07-27-event-map-gpx-route-update.md`
- Important decisions during implementation:
  - Added GPX-derived routes as additional map tracks instead of replacing the
    existing draft routes.
  - Added one sanitized round per supplied track:
    - `running-gpx-round`: about 1.85 km, 24 simplified coordinates.
    - `road-gpx-round`: about 4.38 km, 44 simplified coordinates.
    - `mtb-gpx-round`: about 4.23 km, 55 simplified coordinates.
  - Kept all new routes at `draft_digitization` because Sebastian should still
    plausibility-check the shapes/classes.
  - Stored only `[lng, lat]` coordinates and a sanitized GPX source note.
  - Did not store raw GPX files, original file names, track titles, timestamps,
    heart rate, power, cadence, temperature, or extension metadata.

## Verification

- Local checks:
  - `npx eslint lib/event-map/course-routes.ts app/components/event-map.tsx app/components/admin-event-map-page.tsx` -> pass
  - `npx tsc --noEmit --incremental false` -> pass
  - `git diff --check` -> pass
- Build:
  - `npm run build` -> pass
- Targeted verification:
  - `npx tsx -e ... COURSE_ROUTES ...` confirmed:
    - `running-gpx-round`: 24 coordinates
    - `road-gpx-round`: 44 coordinates
    - `mtb-gpx-round`: 55 coordinates
- Sensitive-data negative checks:
  - `lib/event-map/course-routes.ts` contains no raw GPX XML tags, track
    titles, original file names, timestamps, telemetry extensions, heart-rate,
    power, cadence, or temperature fields.
  - CR mentions telemetry terms only as explicit negative-check criteria and
    implementation notes, not as copied raw activity data.
- Authenticated role smoke:
  - Not run locally; no admin browser session available in this terminal.
- Manual smoke:
  - Not run yet; recommended before production deploy or immediately after.

## Deploy

- Deployment needed: yes, after implementation approval
- Deployment ID:
- Deployment URL:
- Production alias:
- Deployed at:

## Post-Deploy Smoke

- Routes checked:
- API checks:
- Sensitive-data/API leakage checks:
- Result:

## Follow-Ups

- Decide whether future CR should add an admin route import workflow for
  sanitized GPX uploads.
