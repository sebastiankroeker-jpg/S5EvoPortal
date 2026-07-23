# CR: Timekeeping configuration follow-ups

Status: Deployed
Date: 2026-07-23
Type: feature
Risk: medium
Owner: S5Evo

## Context

Sebastian clarified that the timekeeping UI needs both global configuration and
per-clock/per-start configuration. The global configuration is shared across all
disciplines. The per-clock base time is the start clock time and must support
device alignment and simulations.

## Scope

- Global timekeeping configuration near `Zeitnahme`:
  - shared start blocks for all disciplines.
  - shared first start number per block.
  - shared start-number source.
- Per-clock configuration:
  - device name and device ID.
  - per-clock base time.
  - base time editable in both 24h format with seconds and the Rad-CSV export
    style.
  - editing either base-time format updates the other format.
- Sync/package data:
  - carry base-time and device context in records/data packages so later
    individual time-trial calculations can use the correct start time.

## Files

- `app/zeitnahme/page.tsx`
- `app/api/timekeeping/events/route.ts`
- `app/api/admin/result-staging/timekeeping/import/route.ts`
- `app/admin/ergebnisse/page.tsx`
- supporting local timekeeping helpers where touched

## Verification

- `npx eslint app/zeitnahme/page.tsx app/api/admin/result-staging/timekeeping/import/route.ts app/admin/ergebnisse/page.tsx`
  -> green.
- `npx tsc --noEmit --incremental false` -> green.
- `npm run build` -> green.
- `git diff --check` -> green.
- `npm run smoke:public` after deploy -> green.
- `/api/competition` on production -> 200.

## Deploy

- Commits:
  - `71aefa2 Improve timekeeping configuration and device sync`
  - `d790751 Restore per-clock timekeeping base time`
- Production alias: `https://portal.s5evo.de`
- Latest related deployment was READY at 2026-07-23 09:18 UTC.

## Remaining Gaps

- Manual timekeeper-device smoke is still valuable:
  - set global start blocks.
  - adjust a per-clock base time in both formats.
  - sync records.
  - verify package/import review shows device/base-time context as expected.
