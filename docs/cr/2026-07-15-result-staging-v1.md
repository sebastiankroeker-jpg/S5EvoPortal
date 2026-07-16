# CR: Result Staging V1

Status: Deployed
Date: 2026-07-15
Type: schema
Risk: high
Owner: S5Evo

## Context

Sebastian clarified that official results will come from multiple sources: legacy backend imports, PWA timekeeping sync, and later manual admin corrections. Production testing must be possible without leaving untraceable test data behind. The current `DisciplineResult` table represents the final current value per discipline/participant and is not enough for staging, versioning, package-level cleanup, or conflict review.

## Scope

- In scope:
  - Define the result-staging concept for V1.
  - Add additive schema foundation for result data packages, raw records, draft candidates, publication versions, and reset snapshots.
  - Make source/purpose/status explicit, including production test packages.
  - Preserve the current official result behavior until a later publish workflow writes to `DisciplineResult`.
- Out of scope:
  - No automatic takeover of timekeeping events into official results.
  - No legacy backend parser/import UI yet.
  - No admin review UI yet.
  - No mutation of production result data in this CR.

## Affected Flows

- User/API/admin flows touched:
  - Later admin result import/review/reset flows will use the new models.
  - Current public results remain unchanged.
- Data model impact:
  - Adds staging/versioning tables and enums only.
  - Existing team, participant, timekeeping, and final result tables remain compatible.
- Auth/permission impact:
  - No new permission in V1 foundation.
  - Later APIs should require admin/moderator or a dedicated result-management permission.
- Production/deploy impact:
  - Requires additive Prisma migration before later APIs can use the tables.
  - No production data mutation beyond creating empty tables/enums.

## Data / API Design

- Proposed data model:
  - `ResultDataBatch`: one package from `LEGACY_IMPORT`, `TIMEKEEPING_SYNC`, or `MANUAL_ADMIN`, with `purpose` such as `PRODUCTION` or `PROD_TEST`.
  - `ResultRawRecord`: immutable row/event-level raw payload inside a batch.
  - `ResultDraft`: normalized candidate result derived from raw records or timekeeping events, including validation/conflict state.
  - `ResultPublication`: explicit publish version per competition.
  - `ResultPublicationItem`: before/after snapshot of every result touched by a publication.
  - `ResultResetSnapshot`: preview/execution snapshot for deleting or resetting result layers.
- Proposed API shape:
  - Later V1 APIs should start with preview-only endpoints:
    - `GET /api/admin/result-staging/batches`
    - `POST /api/admin/result-staging/batches`
    - `POST /api/admin/result-staging/reset/preview`
    - `POST /api/admin/result-staging/reset`
  - Publishing to `DisciplineResult` remains a separate confirmation-gated step.
- Backward compatibility:
  - Current `/api/results` continues reading `DisciplineResult`.
  - Timekeeping sync continues writing append-only `TimekeepingEvent`.
- Migration/data backfill:
  - No backfill.
  - Existing results are not imported into staging in this CR.

## Business Invariants

- Legacy imports, timekeeping sync, and manual result corrections must pass through the same staging/review/reset model before becoming official results.
- Raw packages are source evidence. They should be discarded through batch status/reset workflows, not silently overwritten.
- Production test data must be explicitly tagged, previewable, and cleanly removable by package/scope.
- Publishing results must be versioned and auditable with before/after data.
- `DisciplineResult` remains the current official read model until a later CR introduces publish semantics.

## Open Questions

- Exact legacy backend file/API format is still open.
- Whether result-management should get its own permission key or use admin/moderator initially is still open.
- Whether published versions need a public display toggle is later scope.

## Acceptance Criteria

- Additive Prisma schema represents batches, raw records, drafts, publication versions, publication items, and reset snapshots.
- Schema can distinguish production data from production test packages.
- Schema can link staging records to timekeeping events without mutating timekeeping data.
- Reset snapshots can capture preview/execution summaries for raw, draft, and published result scopes.
- Existing result API remains unchanged.

## Implementation Handoff

- Relevant files:
  - `prisma/schema.prisma`
  - new Prisma migration under `prisma/migrations/`
  - optional helper constants/types under `lib/`
  - this CR
- Current decisions:
  - Start with schema foundation only.
  - Keep result publishing and reset execution behind later explicit implementation.
  - Use source/purpose/status fields to support production tests safely.
- Open decisions:
  - Admin UI shape for review/reset.
  - Exact legacy import payload format.
- Non-goals:
  - No production deploy or migration execution without separate approval.
  - No final result mutation.
- Expected implementation steps:
  - Update Prisma schema additively.
  - Add matching migration SQL.
  - Run Prisma validation/generate/build checks.
  - Commit local foundation.
- Required checks:
  - `npx prisma validate`
  - `npx prisma generate`
  - `npm run build`
  - `git diff --check`
- Risks/assumptions:
  - High-risk because this is result data architecture and future production migration.
  - This local work is not a production deploy approval.

## Model / Subagent Plan

- Model switch needed: no
- Target model/role: current Codex operator
- Subagent needed: no
- Subagent role: n/a
- Handoff source: this CR and `SESSION_HANDOFF.md`

## Confirmation Gate

- Gate needed: yes
- Reason: schema foundation and future production migration/deploy.
- Approved by: Sebastian via Telegram "Konzept anpassen und bitte mit V1 beginnen"
- Approval timestamp: 2026-07-15 19:03 UTC

## Implementation Notes

- Files changed:
  - `prisma/schema.prisma`
  - `prisma/migrations/20260715190500_add_result_staging_foundation/migration.sql`
  - `lib/result-staging.ts`
  - `docs/cr/2026-07-15-result-staging-v1.md`
- Important decisions during implementation:
  - Models intentionally use additive tables/enums only; existing `DisciplineResult` remains unchanged.
  - `ResultDataPurpose.PROD_TEST` and `DRY_RUN` explicitly support production test packages.
  - `ResultResetSnapshot` stores both preview and executed reset snapshots so destructive result maintenance can be audited.
  - `ResultDraft.timekeepingEventId` is stored as a plain reference for now; timekeeping events remain append-only and untouched.
  - Production backup before migration: `backups/db/s5evo-prod-before-result-staging-20260715T192343Z.dump` plus `.sha256`.
  - Added read-only admin/moderator APIs:
    - `GET /api/admin/result-staging/batches`
    - `POST /api/admin/result-staging/reset/preview`
  - Reset preview is intentionally non-destructive and does not persist preview snapshots yet.
  - Added the first admin UI surface under `/admin?tab=competition`:
    - shows recent result-staging batches and aggregate raw/draft/publication counts.
    - calls reset preview by scope, batch, publication, discipline, participant, or start number.
    - keeps destructive reset execution disabled in the UI.

## Verification

- Local checks:
  - `npx prisma validate` passed.
  - `npx prisma generate` passed.
  - `npx tsc --noEmit --incremental false` passed.
  - `git diff --check` passed.
  - `npx eslint app/api/admin/result-staging/batches/route.ts app/api/admin/result-staging/reset/preview/route.ts lib/result-staging.ts` passed.
  - `npx eslint app/admin/page.tsx app/api/admin/result-staging/batches/route.ts app/api/admin/result-staging/reset/preview/route.ts lib/result-staging.ts` passed after adding the admin UI.
- Build:
  - `npm run build` passed.
- Targeted verification:
  - Prisma schema validation passed after formatting.
  - `npx prisma migrate deploy` applied `20260715190500_add_result_staging_foundation`.
  - `npx prisma migrate status` reported database schema up to date after deploy.
  - New result staging tables verified empty after migration: all six new tables count `0`.
- Manual smoke:
  - Not applicable before UI/API.

## Deploy

- Deployment needed: done
- Initial foundation deployment ID: `dpl_3QGsKAzXaDSVVc5CtRjRVSnSGZw1`
- Initial foundation deployment URL: `https://s5-evo-portal-n2awz16wk-sebastiankroeker-2781s-projects.vercel.app`
- Manual result-staging UI/API deployment ID: `dpl_AoTiw3GL7Trcox2Q7LoH3HSq8AZw`
- Manual result-staging UI/API deployment URL: `https://s5-evo-portal-fp4nqzxs9-sebastiankroeker-2781s-projects.vercel.app`
- Latest origin-sync deployment ID: `dpl_2qfjziTrj4TBaTdSw9vvPVTyiQXW`
- Latest origin-sync deployment URL: `https://s5-evo-portal-1q23xile0-sebastiankroeker-2781s-projects.vercel.app`
- Production alias: `https://portal.s5evo.de`
- Initial foundation deployed at: 2026-07-15 19:27 UTC
- Manual UI/API deployed at: 2026-07-16 04:50 UTC
- Origin-sync deploy after `git push origin main` at: 2026-07-16 05:00 UTC

## Post-Deploy Smoke

- Routes checked:
  - `npm run smoke:public` passed against `https://portal.s5evo.de`.
  - `/` returned 200.
- API checks:
  - `/api/competition` returned active competition data.
  - `/api/results?competitionId=cmn3a1piz0002l104372yx9yt` returned 200.
  - Public smoke confirmed protected APIs still return 401 without session.
- Result:
  - Deployment and additive migration verified.
  - No result staging data was created by the migration.
  - Latest UI/API deploy verified the `/admin` page returns 200.
  - New protected result-staging APIs return 401 without session:
    - `GET /api/admin/result-staging/batches`
    - `POST /api/admin/result-staging/reset/preview`

## Follow-Ups

- Build destructive result reset execution with snapshot/export guard.
- Build legacy import parser into `ResultDataBatch`/`ResultRawRecord`.
- Build timekeeping-to-draft derivation from `TimekeepingEvent`.
- Build explicit publish workflow into `DisciplineResult`.
