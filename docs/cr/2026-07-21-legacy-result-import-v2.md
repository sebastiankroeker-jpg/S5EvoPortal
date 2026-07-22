# CR: Legacy Ergebnisimport V2

Status: Deployed
Date: 2026-07-21
Type: feature
Risk: high
Owner: S5Evo

## Context

Sebastian wants to return to the Legacy result import after using staged RUN
test data. The current result-staging workbench technically stores packages and
drafts, but the per-record view is too hidden and read-only, and it does not
give a consistent way to inspect raw records, choose another data package, or
prepare manual corrections.

Additional legacy exports were provided for BANK, STOCK, and MTB. The import
should no longer be designed as "one CSV row equals one result" only, because
BANK and STOCK require aggregation.

Known legacy discipline codes:

- `1`: RUN
- `2`: STOCK
- `3`: ROAD
- `4`: BENCH
- `5`: MTB

Known discipline shapes:

- RUN, ROAD, MTB: one raw row creates one result draft.
- BENCH: multiple attempt rows create one result draft per participant.
  `AuBruttoGewicht` is the lifted weight; `AuGewicht` is lifted weight minus
  body weight. Students have 2 attempts; youth/women/men have 3 attempts.
- STOCK: 11 shot rows plus one summary row with `AuSummenkennzeichen = S`
  create one result draft per participant. Lowest shot is dropped, 10 shots are
  scored. Tie-break is higher shot counts, then better dropped result. The
  summary row carries `AuRingeStockStreicherg` and `AuSchubBWZ`.

## Scope

- In scope for first implementation slice:
  - Make staged package details easy to discover from the `Pakete` tab.
  - Show both aggregated result drafts and raw records for a selected package.
  - Preserve package switching when an operator decides to inspect another data
    package.
  - Keep details read-only for this slice.
  - Document the V2 import direction for all five disciplines.
- Out of scope for first implementation slice:
  - Manual edit persistence.
  - New legacy parsers for ROAD/MTB/BENCH/STOCK.
  - Publishing official results.
  - Mutating production result data.
  - Schema migrations.

## Affected Flows

- User/API/admin flows touched:
  - Admin result-staging workbench `/admin/ergebnisse`.
  - Admin batch detail API `GET /api/admin/result-staging/batches/[batchId]`.
- Data model impact:
  - None in this slice.
- Auth/permission impact:
  - No role expansion. Existing `ADMIN`/`MODERATOR` gate remains.
- Sensitive data impact:
  - Participant names, team names, start numbers, classes, and raw legacy result
    payloads are shown to existing admin/moderator users.
- Offline/cache/export/log/mail impact:
  - No offline cache, export, log, or mail change.
- Production/deploy impact:
  - Production deploy needed after checks and explicit approval.

## Privacy / Security Review

- Sensitive fields touched:
  - Participant first/last names, team names, start numbers, class codes,
    legacy participant/team IDs in raw CSV payloads, result values, ranks, and
    validation messages.
- Purpose / data minimization:
  - These fields are needed so admins can inspect and later correct staged
    result packages before publication. No public or non-admin serializer is
    broadened.
- Visibility by role/user/API/UI:
  - Existing admin/moderator result-staging API and UI only.
- Persistence locations:
  - Existing DB tables only: result batches, raw records, drafts. This slice
    does not add new persistence.
- Offline/cache behavior:
  - Browser fetch uses `cache: "no-store"` for batch details. No service-worker
    or localStorage cache change.
- Logs/mails/exports/screenshots exposure:
  - No new technical logging of payloads, no mails, no exports.
- Negative checks for unauthorized access or payload leakage:
  - Unauthenticated batch-detail API should continue to return 401/403 without
    exposing payload fields.
- Authenticated smoke plan or explicit gap:
  - Local automated auth smoke is not available without a session cookie.
    Manual admin browser smoke remains required.
- Residual risk:
  - More raw payload fields become visible in the admin workbench, but only
    behind the existing admin/moderator gate.

## Data / API Design

- Proposed data model:
  - No schema change in first slice.
  - Future manual corrections should be stored as overlays/audit entries rather
    than mutating raw CSV payloads.
- Proposed API shape:
  - Extend batch detail response with `rawRecords` alongside `drafts`.
  - Keep the route read-only.
- Backward compatibility:
  - Existing `drafts` response remains.
- Migration/data backfill:
  - None.

## Open Questions

- How manual correction overlays should be persisted in V2.
- Whether active test-package selection should be stored server-side or remain
  a UI selection until publication logic exists.

## Acceptance Criteria

- From `Pakete`, an admin can choose `Records ansehen` for any package.
- The selected package details load automatically after choosing it.
- The detail area shows a clear package header and tabs for `Drafts` and
  `Raw Records`.
- Raw records show row number, row key, validation status/messages, start
  number, discipline/class fields, and relevant legacy fields where present.
- Switching packages updates the details without requiring an import rerun.
- No official result publication or DB mutation is introduced.

## Implementation Handoff

- Relevant files:
  - `app/admin/ergebnisse/page.tsx`
  - `app/api/admin/result-staging/batches/[batchId]/route.ts`
  - `docs/cr/2026-07-21-legacy-result-import-v2.md`
  - `SESSION_HANDOFF.md`
- Current decisions:
  - First slice is read-only package/record visibility.
  - Raw CSV payloads remain immutable.
  - Manual edits will be modeled later as correction overlays.
- Open decisions:
  - Correction persistence model.
  - Active package selection semantics.
- Non-goals:
  - Parser V2 implementation.
  - Official result publication.
  - Production data mutation.
- Expected implementation steps:
  - Extend batch detail API to return raw records.
  - Add UI types/state for raw records and package detail tab.
  - Improve package table actions and auto-load behavior.
  - Add draft/raw record tables.
  - Run targeted ESLint, TypeScript, build, diff check.
- Required checks:
  - `npx eslint app/admin/ergebnisse/page.tsx app/api/admin/result-staging/batches/[batchId]/route.ts`
  - `npx tsc --noEmit --incremental false`
  - `git diff --check`
  - `npm run build`
- Privacy/security checks:
  - Verify unauthenticated batch detail API returns 401/403 and no payload.
- Risks/assumptions:
  - Route remains admin/moderator-only.
  - Raw record fields may contain legacy IDs and participant-linked data.
- Context read before implementation:
  - `SESSION_HANDOFF.md` top block: yes
  - Relevant prior CR(s): result-staging history in handoff; current CR
  - Relevant source files: yes

## Model / Subagent Plan

- Model switch needed: no
- Target model/role: current Codex implementation
- Subagent needed: no
- Subagent role: n/a
- Handoff source: this CR

## Confirmation Gate

- Gate needed: yes
- Reason: admin UI/API exposes participant-linked raw result payloads and needs
  production deploy.
- Sensitive-data/production-data reason:
  - Raw records include participant-linked legacy result data and IDs.
- Approved by: Sebastian via "los" for local implementation
- Approval timestamp: 2026-07-21

## Implementation Notes

- Files changed:
  - `app/api/admin/result-staging/batches/[batchId]/route.ts`
  - `app/admin/ergebnisse/page.tsx`
  - `docs/cr/2026-07-21-legacy-result-import-v2.md`
- Important decisions during implementation:
  - Batch detail API now returns `rawRecords` alongside existing `drafts`.
  - Raw records are read-only and limited to the selected batch/tenant/
    competition under the existing admin/moderator gate.
  - Result workbench now has a detail tab state for `Drafts` and `Raw Records`.
  - Package table action is labeled `Records ansehen` and opens the detail
    context with raw records selected.
  - After Legacy RUN import, the workbench still jumps to package details with
    drafts selected for immediate result preview.
  - Raw table shows row number, start number, discipline, class, time/value,
    attempt/shot number, BENCH gross/net weight, STOCK shot/drop/BWZ fields,
    points/rank, validation status, messages, and row key.

## Addendum: Package Workbench Clarity

Status: Deployed

Approved by Sebastian via "go" after the first deployed read-only slice worked
in production.

- Package list now surfaces the filtered package totals directly next to the
  list: package count, raw/draft total, warning signals, and open packages.
- Each package row shows a derived discipline label and a warning-signal badge
  based on existing summary/validation-summary counters.
- Package details now have read-only tabs for `Übersicht`, `Drafts`,
  `Raw Records`, and `Konflikte`.
- The overview tab gives source/purpose, status, raw/draft counts, warning
  count, reference, timestamp, and a clear read-only next step.
- The conflict tab combines draft and raw-record warning rows so operators can
  inspect the problem set without scanning full tables.
- No manual edit persistence, parser V2, schema change, publication, or
  official result mutation is included in this addendum.

Verification:

- `npx eslint app/admin/ergebnisse/page.tsx`: passed.
- `npx tsc --noEmit --incremental false`: passed.
- `git diff --check -- app/admin/ergebnisse/page.tsx docs/cr/2026-07-21-legacy-result-import-v2.md SESSION_HANDOFF.md`: passed.
- `npm run build`: passed.
- `npm run smoke:public`: passed.
- `curl -sSI https://portal.s5evo.de/admin/ergebnisse`: 200.
- Unauthenticated batch-detail API: 401 without payload leakage.

Production deploy:

- Deployment ID: `dpl_GM8rqv8eyhKSMex9W1DrFPqChZtG`
- URL: `https://s5-evo-portal-fhwdtolom-sebastiankroeker-2781s-projects.vercel.app`
- Alias: `https://portal.s5evo.de`
- Ready state: `READY`

## Addendum: Manual Correction Overlays

Status: Deployed

Approved by Sebastian via "go" after confirming manual corrections should be
the next slice.

- Manual corrections are stored as overlay events in the existing `AuditEvent`
  table, not by mutating `ResultRawRecord` or `ResultDraft`.
- New admin/moderator route:
  `POST /api/admin/result-staging/batches/[batchId]/corrections`.
- Supported operations:
  - `apply`: writes an active correction overlay.
  - `revert`: writes a revert event for an existing correction overlay.
- Supported first-slice fields:
  - Draft: `startNumber`, `rawValueText`, `resultStatus`.
  - Raw record: `startNumber`, `rawValueText`, `validationStatus`.
- Batch detail API folds correction/revert events and returns `corrections`
  plus effective display values for corrected fields.
- Admin workbench UI:
  - Draft and Raw rows have correction buttons for the supported fields.
  - New `Korrekturen` tab shows the `vorher -> neu` overlay form and the
    correction journal.
  - Active corrections can be reverted.
  - Corrected display values are marked as `Overlay`.
- No schema migration, parser V2, ranking/scoring recalculation, publication,
  or official result mutation is included in this addendum.
- Guardrail: this is persistence in production DB only for overlay audit
  events; it does not alter official results or raw CSV payloads.

Local verification:

- `npx eslint app/admin/ergebnisse/page.tsx app/api/admin/result-staging/batches/[batchId]/route.ts app/api/admin/result-staging/batches/[batchId]/corrections/route.ts`: passed.
- `npx tsc --noEmit --incremental false`: passed.
- `npm run verify:tenant-scope`: passed.
- `git diff --check -- app/admin/ergebnisse/page.tsx app/api/admin/result-staging/batches/[batchId]/route.ts app/api/admin/result-staging/batches/[batchId]/corrections/route.ts scripts/verify-tenant-scope.ts docs/cr/2026-07-21-legacy-result-import-v2.md SESSION_HANDOFF.md`: passed.
- `npm run build`: passed.

Production verification:

- Deployment ID: `dpl_DQGgyXVUf3b6LQxmVVTtMRh3D935`
- URL: `https://s5-evo-portal-65ptkv2vb-sebastiankroeker-2781s-projects.vercel.app`
- Alias: `https://portal.s5evo.de`
- Ready state: `READY`
- `npm run smoke:public`: passed.
- `curl -sSI https://portal.s5evo.de/admin/ergebnisse`: 200.
- Unauthenticated batch-detail API: 401.
- Unauthenticated correction API `POST`: 401.

## Addendum: Legacy Result Parser V2 Dry-run

Status: Deployed

Approved by Sebastian via "go" after deciding to focus first on importing
legacy data under the assumption that no manual corrections are needed.

- New generic parser module: `lib/legacy-result-import.ts`.
- New admin-only dry-run route:
  `POST /api/admin/result-staging/legacy-results/import`.
- The existing RUN staging endpoint remains unchanged.
- The V2 route intentionally rejects `dryRun:false`; this slice does not stage
  or mutate DB result packages.
- Supported detected discipline codes:
  - `1` -> RUN
  - `2` -> STOCK
  - `3` -> ROAD
  - `4` -> BENCH
  - `5` -> MTB
- Strategy support:
  - RUN/ROAD/MTB: one raw row creates one draft preview.
  - BENCH: attempt rows grouped by start number/legacy participant/class; best
    valid `AuGewicht` is the draft value, while `AuBruttoGewicht` stays in
    details.
  - STOCK: 11 shot rows plus `AuSummenkennzeichen = S` summary grouped into one
    draft preview; summary row carries sum, dropped result, and BWZ.
- Admin UI now has a read-only V2 block `Legacy-Ergebnis-CSV prüfen`; it can
  dry-run any of the five result CSVs without writing a package.
- Existing `Legacy-Laufen-CSV importieren` remains available for the current
  RUN staging flow.
- Test files remain in `/home/ocadmin/.openclaw/media/inbound/` and are used
  read-only by `npm run verify:legacy-result-import`; they were not copied into
  repo fixtures because they contain participant-linked result data.

Fixture verification:

- RUN: 111 raw rows -> 111 drafts.
- ROAD: 112 raw rows -> 112 drafts.
- MTB: 111 raw rows -> 111 drafts.
- BENCH: 309 raw rows -> 111 drafts.
- STOCK: 1344 raw rows -> 112 drafts.

Verification:

- `npx eslint lib/legacy-result-import.ts app/api/admin/result-staging/legacy-results/import/route.ts app/admin/ergebnisse/page.tsx scripts/verify-legacy-result-import.ts scripts/verify-tenant-scope.ts`: passed.
- `npx tsc --noEmit --incremental false`: passed.
- `npm run verify:legacy-result-import`: passed.
- `npm run verify:tenant-scope`: passed.
- `git diff --check -- lib/legacy-result-import.ts app/api/admin/result-staging/legacy-results/import/route.ts app/admin/ergebnisse/page.tsx scripts/verify-legacy-result-import.ts scripts/verify-tenant-scope.ts package.json docs/cr/2026-07-21-legacy-result-import-v2.md SESSION_HANDOFF.md`: passed.
- `npm run build`: passed.

Production deploy:

- Deployment ID: `dpl_DZ6Un29B7DCikWQ1CgedNdUon3kw`
- URL: `https://s5-evo-portal-1uytzwvso-sebastiankroeker-2781s-projects.vercel.app`
- Alias: `https://portal.s5evo.de`
- Ready state: `READY`
- `npm run smoke:public`: passed.
- `curl -sSI https://portal.s5evo.de/admin/ergebnisse`: 200.
- Unauthenticated V2 dry-run API `POST`: 401.

## Verification

- Local checks:
  - `npx eslint app/admin/ergebnisse/page.tsx app/api/admin/result-staging/batches/[batchId]/route.ts`: passed.
  - `npx tsc --noEmit --incremental false`: passed.
  - `git diff --check -- app/admin/ergebnisse/page.tsx app/api/admin/result-staging/batches/[batchId]/route.ts docs/cr/2026-07-21-legacy-result-import-v2.md`: passed.
- Build:
  - `npm run build`: passed.
- Targeted verification:
  - Code review confirms route remains `ADMIN`/`MODERATOR` gated via
    `requireCompetitionTenantRoles`.
- Sensitive-data negative checks:
  - Unauthenticated production request to
    `/api/admin/result-staging/batches/invalid-batch-id?competitionId=cmn3a1piz0002l104372yx9yt`
    returned 401 without payload exposure.
- Authenticated role smoke:
  - Gap: no admin browser session/cookie available in automation.
- Manual smoke:
  - Pending Sebastian/admin browser check after deploy.

## Deploy

- Deployment needed: yes
- Deployment ID: `dpl_FH6HHUyrBWRB7u1m18Ln5i2kZo3G`
- Deployment URL: `https://s5-evo-portal-80rgmfjk3-sebastiankroeker-2781s-projects.vercel.app`
- Production alias: `https://portal.s5evo.de`
- Deployed at: 2026-07-21 19:02 UTC

## Post-Deploy Smoke

- Routes checked:
  - `https://portal.s5evo.de`: 200.
  - `https://portal.s5evo.de/admin/ergebnisse`: 200.
  - `npm run smoke:public`: passed.
- API checks:
  - Public smoke APIs passed.
- Sensitive-data/API leakage checks:
  - Unauthenticated batch-detail request returned 401.
- Result:
  - Production deploy ready; manual authenticated admin browser smoke remains
    open.

## Follow-Ups

- Add manual correction overlay persistence.
- Add generic Legacy parser V2 with strategies for RUN, ROAD, MTB, BENCH, and
  STOCK.
