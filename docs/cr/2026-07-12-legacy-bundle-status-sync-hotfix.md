# CR: Legacy Bundle Status Sync Hotfix

Status: Deployed
Date: 2026-07-12
Type: hotfix
Risk: low
Owner: S5Evo

## Context

Sebastian reported that an older `/aenderungen` entry for Edward Wolf stayed visible as `In Prüfung` and could not be cleared through editing. The screenshot showed a 2026-06-29 discipline swap bundle (`MTB -> ROAD`) in team `5Kampf Orga`.

Investigation showed the canonical `pending_changes` bundle records were already `APPROVED`, but one mirrored generic `change_requests` row still had status `PENDING`. The consolidated change dashboard preferred the generic status and therefore displayed the stale mirror as actionable.

## Scope

- In scope:
  - Correct the concrete stale production data row for Edward Wolf without touching participant data or sending mails.
  - Make `/api/admin/pending-changes?scope=all` prefer the canonical legacy `pending_changes.status` when a generic `ChangeRequest` mirrors a legacy pending change.
  - Ensure future participant change bundle approvals/rejections also synchronize linked generic `change_requests`.
- Out of scope:
  - Schema changes.
  - Replaying old participant changes.
  - Broad data cleanup beyond the reported stale row.

## Affected Flows

- User/API/admin flows touched:
  - `/aenderungen`
  - `/api/admin/pending-changes?scope=all`
  - `/api/admin/participant-change-bundles/[id]/decision`
- Data model impact: none.
- Auth/permission impact: unchanged, Admin/Moderator-only routes.
- Production/deploy impact:
  - One targeted production data correction was applied on 2026-07-12 10:42 UTC.
  - Code deploy completed after Sebastian approved with "Go" on 2026-07-12 11:55 UTC.

## Data / API Design

- Proposed data model: no schema change.
- Proposed API shape:
  - Legacy-linked generic `ChangeRequest` entries use `pending_changes.status` as the display status when the linked legacy row exists.
  - Bundle decision route updates linked generic `change_requests` to `APPLIED` for approvals and `REJECTED` for rejections.
- Backward compatibility:
  - Existing review endpoints and UI action model remain unchanged.
  - Historical stale mirrors display according to canonical legacy state after deploy.
- Migration/data backfill:
  - Targeted fix:
    - `pending_changes.id = cmqytaj3y0001kz042y7gc5tj` was already `APPROVED`.
    - `change_requests.id = cmqytajju0005kz04wvdu99eo` was updated from `PENDING` to `APPLIED`.
    - Two audit log entries were inserted: `APPROVED` and `APPLIED`, both marked as legacy-bundle synchronization.

## Open Questions

- None for the hotfix.

## Acceptance Criteria

- Edward Wolf's old swap bundle no longer appears as `In Prüfung`.
- The consolidated dashboard does not show stale generic mirrors as pending when the linked legacy row is already approved/rejected.
- Future bundle decisions synchronize both legacy and generic review records.
- No participant data is changed during the cleanup.

## Implementation Handoff

- Relevant files:
  - `app/api/admin/pending-changes/route.ts`
  - `app/api/admin/participant-change-bundles/[id]/decision/route.ts`
- Current decisions:
  - Treat `pending_changes` as canonical for legacy-linked participant change status.
  - Keep generic `ChangeRequest` audit trail synchronized in bundle decisions.
- Open decisions: none.
- Non-goals:
  - No schema migration.
  - No bulk historical cleanup.
- Expected implementation steps:
  - Patch API status normalization.
  - Patch bundle decision sync.
  - Run targeted checks/build.
  - Commit and deploy after Sebastian approves.
- Required checks:
  - targeted eslint
  - `npx tsc --noEmit`
  - `git diff --check`
  - `npm run build`
  - `npm run smoke:public` after deploy
- Risks/assumptions:
  - Existing stale generic mirrors with no legacy row remain governed by generic status.

## Model / Subagent Plan

- Model switch needed: no
- Target model/role: current Codex
- Subagent needed: no
- Subagent role: n/a
- Handoff source: this CR and current repo state

## Confirmation Gate

- Gate needed: yes
- Reason: production data mutation and later production deploy.
- Approved by:
  - Production data correction: implicit incident response to Sebastian's reported stuck entry.
  - Production code deploy: Sebastian approved with "Go".
- Approval timestamp:
  - Data correction applied at 2026-07-12 10:42 UTC.
  - Code deploy approved at 2026-07-12 11:55 UTC.

## Implementation Notes

- Files changed:
  - `app/api/admin/pending-changes/route.ts`
  - `app/api/admin/participant-change-bundles/[id]/decision/route.ts`
- Important decisions during implementation:
  - `pendingChangeMeta.status` now overrides a stale generic `ChangeRequest` status in the consolidated endpoint.
  - Bundle approve/reject transactions now call a local sync helper that updates linked generic `ChangeRequest` rows and writes corresponding audit entries.
  - Approval sync marks generic requests as `APPLIED`, matching the legacy bundle behavior that immediately updates participant data.

## Verification

- Local checks:
  - `pnpm exec eslint app/api/admin/pending-changes/route.ts app/api/admin/participant-change-bundles/[id]/decision/route.ts` green.
  - `npx tsc --noEmit` green.
  - `git diff --check` green.
- Build:
  - `npm run build` green.
- Targeted verification:
  - DB verification after targeted data correction:
    - `pending_changes.cmqytaj3y0001kz042y7gc5tj`: `APPROVED` / `APPROVED`.
    - `change_requests.cmqytajju0005kz04wvdu99eo`: `APPLIED`, with `reviewedAt` and `appliedAt` set to `2026-06-29T06:04:27.820Z`.
- Manual smoke:
  - `npm run smoke:public` green against `https://portal.s5evo.de`.
  - `/aenderungen` returned 200.
  - `/api/admin/pending-changes?scope=all` without session returned 401.
  - Authenticated browser smoke still recommended for the specific dashboard row.

## Deploy

- Deployment needed: yes
- Deployment ID: `dpl_GZ7tX93ZywkDFU6fZTsUayzQNSYC`
- Deployment URL: `https://s5-evo-portal-9g6e5dgwo-sebastiankroeker-2781s-projects.vercel.app`
- Production alias: `https://portal.s5evo.de`
- Deployed at: 2026-07-12 11:57 UTC

## Post-Deploy Smoke

- Routes checked:
  - `npm run smoke:public`
  - `GET /aenderungen`: 200
- API checks:
  - `GET /api/admin/pending-changes?scope=all` without session: 401
- Result: green

## Follow-Ups

- Consider a later read-only consistency report for legacy `pending_changes` and generic `change_requests` mirrors.
