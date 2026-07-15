# CR: Change dashboard navigation and team-name direct edits

Status: Implemented locally
Date: 2026-07-15
Type: hotfix
Risk: medium
Owner: S5Evo

## Context

Sebastian requested follow-ups in the change dashboard:

- Default filter should show open requests.
- Default sort should be latest activity.
- Requester and team need forward navigation.
- Team dashboard change badges should navigate to the change dashboard with the fitting filter.
- A small team-name correction, "Radsport Veloass Master", unexpectedly appeared for approval although team edits before the registration deadline should not require approval.

## Scope

- In scope:
  - Change dashboard defaults to `PENDING` and latest activity.
  - Add clear navigation from change cards to requester user lookup and team dashboard.
  - Make team-dashboard pending-change badges navigate to `/aenderungen` with `teamId` and `PENDING`.
  - Ensure direct team-name saves before the registration deadline supersede stale pending team-name requests.
- Out of scope:
  - Automatic production data cleanup.
  - Schema changes.
  - Broad redesign of the approval dashboard.

## Affected Flows

- User/API/admin flows touched:
  - `/aenderungen`
  - team dashboard compact/detail cards
  - `PUT /api/teams/[id]`
- Data model impact:
  - None.
- Auth/permission impact:
  - Existing admin/team-edit gates stay unchanged.
- Production/deploy impact:
  - Functional code change; production deploy needs separate go.

## Data / API Design

- Proposed data model:
  - Unchanged.
- Proposed API shape:
  - Unchanged.
- Backward compatibility:
  - Existing dashboard query params keep working.
- Migration/data backfill:
  - None in this CR.

## Acceptance Criteria

- `/aenderungen` opens with open requests and latest activity by default.
- Team and requester in change cards are navigable for admins.
- Pending-change badges in team cards open the change dashboard filtered to the affected team and open status.
- Direct pre-deadline team-name saves mark stale pending team-name requests as rejected/overridden instead of leaving them for approval.

## Implementation Handoff

- Relevant files:
  - `app/components/approval-queue.tsx`
  - `app/components/dashboard.tsx`
  - `app/api/teams/[id]/route.ts`
  - `docs/cr/2026-07-15-change-dashboard-navigation-and-teamname-direct.md`
- Current decisions:
  - Keep navigation simple using existing admin-routing helpers.
  - Do not mutate existing production data automatically.
- Open decisions:
  - Whether the already visible Veloass request should be manually rejected/cleaned after deploy.
- Non-goals:
  - No context-menu redesign in this pass.
- Expected implementation steps:
  - Adjust dashboard defaults.
  - Add requester/team action buttons.
  - Wire team badges to `openChangesDashboard`.
  - Reject stale team-name `ChangeRequest(PENDING)` entries during a direct team-name save.
- Required checks:
  - `npx eslint app/components/approval-queue.tsx app/components/dashboard.tsx app/api/teams/[id]/route.ts`
  - `npx tsc --noEmit`
  - `npm run verify:team-draft`
  - `git diff --check`
- Risks/assumptions:
  - Existing stale production requests remain until a deliberate cleanup or a subsequent direct save supersedes them.

## Model / Subagent Plan

- Model switch needed: no
- Target model/role: current Codex implementation
- Subagent needed: no
- Subagent role: n/a
- Handoff source: this CR

## Confirmation Gate

- Gate needed: no for local implementation
- Reason: Sebastian gave implementation request in direct chat; deploy/push still needs separate go if production auto-deploy is involved.
- Approved by: Sebastian request in Telegram
- Approval timestamp: 2026-07-15 08:38 UTC

## Implementation Notes

- Files changed:
  - `app/components/approval-queue.tsx`
  - `app/components/dashboard.tsx`
  - `app/api/teams/[id]/route.ts`
  - `docs/cr/2026-07-15-change-dashboard-navigation-and-teamname-direct.md`
- Important decisions during implementation:
  - Dashboard page default is now `PENDING` plus `latest`; deep links can still override `status`, `q`, `participantId`, `teamId`, and now `sort`.
  - Change cards keep direct team navigation and add explicit requester/user navigation in compact mode.
  - Existing team-card pending-change badges now call `openChangesDashboard({ teamId, status: "PENDING" })`.
  - The direct team update path now records a direct team-name `ChangeRequest(APPLIED)` and rejects stale `TEAM/UPDATE/PENDING` requests for the same team with the direct-edit obsolete reason.

## Verification

- Local checks:
  - `npx eslint app/components/approval-queue.tsx app/components/dashboard.tsx app/api/teams/[id]/route.ts` -> passed with one pre-existing hook dependency warning in `approval-queue`.
  - `npx tsc --noEmit` -> passed
  - `npm run verify:team-draft` -> passed
  - `git diff --check` -> passed
- Build:
  - Not run.
- Targeted verification:
  - Team draft parity verify covers core team validation/classification assumptions.
- Manual smoke:
  - Not run locally in browser.

## Deploy

- Deployment needed: yes
- Deployment ID:
- Deployment URL:
- Production alias:
- Deployed at:

## Post-Deploy Smoke

- Routes checked:
- API checks:
- Result:

## Follow-Ups

- Decide whether to manually resolve the already visible Veloass pending request in production.
