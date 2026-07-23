# CR: Results matrix display hotfix

Status: Deployed
Date: 2026-07-23
Type: hotfix
Risk: low
Owner: S5Evo

## Context

Sebastian reported that some discipline cells in the team points matrices showed
`-` instead of points when viewing current staging test data.

## Root Cause

The data contained valid zero-point results. The overall result matrix rendered
discipline points with a truthy fallback:

`team.disciplinePoints[discipline] || "-"`

That treated valid `0` points as empty and displayed `-`.

## Scope

- Show valid zero discipline points as `0`.
- Keep `-` only for teams without any result data.
- Keep the already deployed right-side `Gesamt` width/padding fix so total
  points are not clipped at the card edge.

## Files

- `app/components/results-view.tsx`

## Verification

- DB read-only check against staging test drafts found valid zero-point entries
  (for example Bank `-999` and time-test placeholders).
- `npx eslint app/components/results-view.tsx` -> green.
- `npx tsc --noEmit --incremental false` -> green.
- `npm run build` -> green.
- `git diff --check` -> green.
- `npm run smoke:public` after deploy -> green.

## Deploy

- Commit: `3de8925 Fix results matrix point rendering`
- Production alias: `https://portal.s5evo.de`
- Vercel deployment: `dpl_BerSBnUJUmviWDGTHKWEnbyhYpPZ`
- Deployed at: 2026-07-23 10:28 UTC

## Remaining Gaps

- Sebastian should visually confirm the result matrices on the target device.
