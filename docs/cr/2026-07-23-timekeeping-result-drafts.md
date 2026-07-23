# CR: Timekeeping Result Drafts

Status: Draft
Date: 2026-07-23
Type: feature
Risk: high
Owner: S5Evo

## Context

Sebastian wants the CSV and Uhr result package flow to converge before an
official publish step is introduced. Legacy CSV V2 already creates
`ResultDataBatch`, `ResultRawRecord`, and `ResultDraft` rows as
`PROD_TEST`. Timekeeping sync currently creates only raw records from FINISH
events, so Uhr packages cannot yet be reviewed or published through the same
draft-based path as Legacy CSV packages.

Decision from 2026-07-23:

- Keep Uhr raw and draft format as close as practical to Legacy CSV.
- Carry ROAD/time-trial base time per record in seconds.
- Carry both net and gross/raw elapsed time when available.
- Keep official results untouched in this CR.
- Manage result/public-live changes as separate rollbackable CRs.

## Scope

- In scope:
  - Extend `POST /api/admin/result-staging/timekeeping/import` so new FINISH
    events create `ResultDraft` rows in addition to `ResultRawRecord` rows.
  - Limit draft creation to existing timekeeping disciplines: `RUN`, `ROAD`,
    `MTB`.
  - Match by start number, team, and participant discipline inside the selected
    tenant/competition.
  - Store timekeeping evidence in a Legacy-like `proposedResultSnapshot`:
    result value, class/overall scoring placeholders, raw/gross/net time,
    clock base time, ROAD CSV base time in seconds, source event/session IDs,
    and validation messages.
  - Keep imports as `PROD_TEST`.
- Out of scope:
  - No official publish to `DisciplineResult`.
  - No public Live visibility changes.
  - No schema migration.
  - No scoring/ranking finalization for Uhr data.
  - No UI redesign beyond showing existing draft counts/details.

## Affected Flows

- User/API/admin flows touched:
  - Admin Ergebnisdaten -> Pakete -> Zeitnahme-Sync übernehmen.
  - Admin Ergebnisdaten -> Zuordnung & Validierung package details.
- Data model impact:
  - Uses existing `ResultDraft` rows; no schema change.
- Auth/permission impact:
  - Existing `ADMIN` gate remains unchanged for the import route.
- Sensitive data impact:
  - Participant/team linkage, start numbers, timekeeping event IDs, and result
    times are linked in staging rows.
- Offline/cache/export/log/mail impact:
  - No service-worker or browser cache change.
  - No export or mail change.
  - No intentional technical logging of participant/timekeeping payloads.
- Production/deploy impact:
  - Production deploy only after separate approval.
  - Production DB writes happen only when an admin imports a timekeeping
    session; writes remain `PROD_TEST` staging/test data.

## Privacy / Security Review

- Sensitive fields touched:
  - Start number, team ID, participant ID, discipline, timekeeping event/session
    IDs, net/raw elapsed values, base time, device/session metadata.
- Purpose / data minimization:
  - Drafts are required so Uhr packages can be reviewed and later published
    through the same explicit workflow as Legacy CSV.
  - Participant names are not stored in the draft; IDs are used for linkage.
- Visibility by role/user/API/UI:
  - Import API remains `ADMIN` only.
  - Package details remain `ADMIN`/`MODERATOR` gated.
  - Public `/api/results` still exposes staging data only to admin
    `includeStagingTest=true`; no public visibility is added here.
- Persistence locations:
  - Production database staging tables only: `ResultRawRecord`,
    `ResultDraft`, `ResultDataBatch`, and one `AuditEvent`.
- Offline/cache behavior, TTL/invalidation/logout clearing:
  - No new offline cache or local storage behavior.
- Logs/mails/exports/screenshots exposure:
  - No mails or exports.
  - Do not log raw participant/timekeeping payloads.
- Negative checks for unauthorized access or payload leakage:
  - Unauthenticated import route remains 401.
  - Existing public smoke should remain green.
- Authenticated smoke plan or explicit gap:
  - Automated authenticated browser smoke is unavailable without Sebastian's
    session. Manual admin smoke should import a small timekeeping session and
    inspect package draft counts/details.
- Residual risk:
  - Drafts are production DB staging records. Reset/test-data cleanup remains
    the rollback path before any official publication exists.

## Data / API Design

- Proposed data model:
  - Reuse `ResultDraft`.
  - `rawValue`/`normalizedValue`: net elapsed milliseconds when present,
    otherwise raw elapsed milliseconds.
  - `netElapsedMs`: net elapsed milliseconds when present, otherwise raw
    elapsed milliseconds.
  - `rawValueText`: formatted display value, matching current Uhr raw record
    format.
  - `proposedResultSnapshot.result`: time result status and display fields.
  - `proposedResultSnapshot.classScoring` and `overallGenderScoring`: present
    but points/rank remain `null` until publish preview/scoring CR.
  - `proposedResultSnapshot.legacy.fields`: Legacy-like fields including
    `Au1Startnr`, `Au1Disziplin`, `AuZeit`, `AuZeitBasis`, `Basiszeit`.
  - `proposedResultSnapshot.timekeeping`: source session/event/device plus
    net/raw elapsed and base-time evidence.
- Proposed API shape:
  - Same endpoint and request body.
  - Response `counts` gains `draftsCreated`.
- Backward compatibility:
  - Duplicate protection remains based on raw row key
    `timekeeping:{timekeepingEventId}`.
  - Existing raw record behavior is retained.
- Migration/data backfill:
  - None.

## Open Questions

- None blocking for CR1.
- Publish CR must decide official `DisciplineResult.rawValue` unit for time
  disciplines before writing official results.

## Acceptance Criteria

- Timekeeping import still creates one `PROD_TEST` batch and raw records for
  new FINISH events only.
- For each new FINISH event, the import creates one linked `ResultDraft`.
- Draft matching uses start number plus participant discipline.
- Missing start number, missing elapsed, unmatched team, ambiguous start number,
  missing participant, or ambiguous participant become validation messages and
  conflict draft state where appropriate.
- ROAD/time-trial base time is carried per record as ISO, clock text, and CSV
  seconds.
- Net and raw/gross elapsed values are preserved in snapshot/details.
- Official `DisciplineResult` rows are not written or updated.
- Unauthenticated API access remains rejected.

## Implementation Handoff

- Relevant files:
  - `app/api/admin/result-staging/timekeeping/import/route.ts`
  - `app/admin/ergebnisse/page.tsx` if the response/count display needs a small
    copy/count update.
  - `docs/cr/2026-07-23-timekeeping-result-drafts.md`
- Current decisions:
  - Local implementation is allowed by Sebastian's 2026-07-23 "Rest passt ...
    gutes Gelingen" message.
  - Production deploy is not yet approved and needs a separate Go.
- Open decisions:
  - Official publish units and scoring remain later CR scope.
- Non-goals:
  - No public Live visibility change.
  - No official result publication.
  - No DB migration.
- Expected implementation steps:
  - Add starter matching helper to the timekeeping import route.
  - Link created raw records back to drafts by row key.
  - Create `ResultDraft` rows with Legacy-like snapshot/details.
  - Add response count for created drafts.
  - Run targeted checks.
- Required checks:
  - `npx eslint app/api/admin/result-staging/timekeeping/import/route.ts app/admin/ergebnisse/page.tsx`
  - `npx tsc --noEmit --incremental false`
  - `git diff --check`
  - `npm run build`
- Privacy/security checks:
  - Unauthenticated `POST /api/admin/result-staging/timekeeping/import` returns
    401.
  - Static review: no official result writes, no service-worker/API caching,
    no sensitive technical logs.
- Risks/assumptions:
  - Timekeeping imports remain admin-triggered and `PROD_TEST`.
  - Existing test-data reset remains the immediate rollback path.
- Context read before implementation:
  - `SESSION_HANDOFF.md` top block: yes
  - Relevant prior CR(s):
    - `docs/cr/2026-07-15-result-staging-v1.md`
    - `docs/cr/2026-07-21-legacy-result-import-v2.md`
    - `docs/cr/2026-07-21-road-timekeeping-monitor.md`
  - Relevant source files:
    - `app/api/admin/result-staging/timekeeping/import/route.ts`
    - `app/api/admin/result-staging/timekeeping/sessions/route.ts`
    - `app/api/admin/result-staging/legacy-results/import/route.ts`
    - `lib/legacy-result-import.ts`
    - `app/admin/ergebnisse/page.tsx`
    - `app/api/results/route.ts`

## Model / Subagent Plan

- Model switch needed: no
- Target model/role: current Codex operator
- Subagent needed: no
- Subagent role: n/a
- Handoff source: this CR

## Confirmation Gate

- Gate needed: yes
- Reason:
  - High-risk result staging change with production DB staging writes.
- Sensitive-data/production-data reason:
  - Creates participant-linked result drafts in production staging tables when
    an admin imports a timekeeping session.
- Approved by:
  - Sebastian for local CR1 implementation via Telegram on 2026-07-23:
    "Rest passt! Falls es keine Einwände oder Fragen gibt gutes Gelingen!"
- Approval timestamp:
  - 2026-07-23 20:55 UTC
- Production deploy approval:
  - Not yet approved; requires separate explicit Go.

## Implementation Notes

- Files changed:
  - `app/api/admin/result-staging/timekeeping/import/route.ts`
  - `app/admin/ergebnisse/page.tsx`
  - `docs/cr/2026-07-23-timekeeping-result-drafts.md`
- Important decisions during implementation:
  - Timekeeping import now creates one linked `ResultDraft` for every newly
    imported FINISH raw record.
  - Draft matching mirrors the Legacy CSV approach: start number -> one team
    in the selected competition -> one participant with the session discipline.
  - Missing elapsed/start number or failed matching turns the draft into
    `CONFLICT`; clean matches remain `DRAFT`/`UNCHECKED`.
  - `proposedResultSnapshot` keeps a Legacy-like shape with `result`,
    `classScoring`, `overallGenderScoring`, `legacy.details.fields`, and
    `timekeeping` evidence.
  - `rawValue`, `normalizedValue`, and `netElapsedMs` use the selected elapsed
    milliseconds (`netElapsedMs` preferred, otherwise `rawElapsedMs`), matching
    the current Legacy draft convention.
  - ROAD/base-time evidence is stored per draft as ISO timestamp, clock text,
    and CSV seconds (`roadCsvBaseTime`).
  - Official `DisciplineResult` rows remain untouched.

## Verification

- Local checks:
  - `npx eslint app/api/admin/result-staging/timekeeping/import/route.ts app/admin/ergebnisse/page.tsx`: passed.
  - `npx tsc --noEmit --incremental false`: passed.
  - `git diff --check`: passed.
- Build:
  - `npm run build`: passed.
- Targeted verification:
  - Static diff review confirms only `ResultDataBatch`, `ResultRawRecord`,
    `ResultDraft`, and `AuditEvent` writes are added/changed in the timekeeping
    import transaction.
  - Static diff review confirms no official `DisciplineResult` write.
  - UI feedback now reports created Drafts in addition to Raw Records.
- Sensitive-data negative checks:
  - Existing session/admin guard remains before import/matching work.
  - No public API serializer was broadened.
  - No service-worker/API cache change.
  - No mails/exports/logging of participant-linked payloads added.
- Authenticated role smoke:
  - Gap: no authenticated browser/admin session available to the agent.
- Manual smoke:
  - Pending Sebastian/admin session: import a small timekeeping session and
    inspect package Raw/Draft counts plus draft details.

## Deploy

- Deployment needed: yes, after separate Go
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

- CR2: Publish preview for CSV/Uhr drafts.
- CR3: Publish execute and publication revert.
- CR4: Granular public Live visibility for start lists, discipline result
  lists, and overall results.
