# CR: Team Manager Team Name Change

Status: Draft
Date: 2026-07-12
Type: feature
Risk: medium
Owner: S5Evo

## Context

Sebastian requested that Team Manager:innen should be able to change their Mannschafts-Name from the existing team detail edit flow (`Details -> Bearbeiten`). Follow-up decision: until the competition starts, team-name changes are not approval-required. The route already accepts `teamName`, but currently blocks Team Manager:innen when the name differs from the stored team name because team-name changes are not yet handled for Team Manager:innen.

## Scope

- In scope:
  - Allow Team Manager:innen with edit access to submit a changed Mannschafts-Name from the existing team edit UI.
  - Apply Team Manager team-name changes directly until the competition starts.
  - After competition start, route Team Manager team-name changes through the existing approval/change dashboard model.
  - Show the requested old/new team name clearly in `/aenderungen` only for post-start approval-required changes.
  - Apply an approved post-start team name to the `Team.name` record after Orga/Admin approval.
  - Preserve Admin/Orga direct edit behavior.
- Out of scope:
  - Renaming competitions, tenants, or marketplace-generated team labels outside the normal team edit flow.
  - Bulk renames.
  - New schema unless existing change-request storage cannot safely represent team-level changes.
  - Changing permissions for who is a Team Manager:in.

## Affected Flows

- User/API/admin flows touched:
  - Team details edit flow (`Details -> Bearbeiten`)
  - `PUT /api/teams/[id]`
  - `/aenderungen`
  - Approval/decision flow for change requests
- Data model impact:
  - Prefer no migration.
  - Pre-start direct renames use the existing `Team.name` field and audit trail.
  - Post-start approval-required renames use existing generic `ChangeRequest` capabilities for team-level fields.
  - Legacy participant-only `PendingChange` should not be forced to carry team-level data if that creates awkward participant coupling.
- Auth/permission impact:
  - Only users who already have Team Manager edit access for the team may request the rename.
  - Admin/Orga direct edit remains unchanged.
- Production/deploy impact:
  - Requires production deploy.
  - No production data backfill expected.

## Data / API Design

- Proposed data model:
  - Direct pre-start edits update `Team.name` directly and record audit evidence.
  - Represent post-start Team Manager team-name edits as a team-scoped generic `ChangeRequest` with before/after data such as `{ teamName: "old" } -> { teamName: "new" }`.
  - Keep participant-scoped `PendingChange` for participant data only.
- Proposed API shape:
  - `PUT /api/teams/[id]` should no longer reject Team Manager name changes solely because the workflow is missing.
  - Before competition start, `PUT /api/teams/[id]` applies a valid Team Manager team-name change directly.
  - After competition start, `PUT /api/teams/[id]` creates or updates a team-scoped approval request instead of changing `Team.name` immediately.
  - If the request includes participant fields and a team name change, return one coherent success response summarizing direct updates plus submitted approvals.
  - Approval endpoint applies `Team.name` for post-start team-name requests and records audit evidence.
- Backward compatibility:
  - Existing participant change approval remains unchanged.
  - Existing admin direct edits remain unchanged.
  - Existing clients can continue sending `teamName` in the same payload.
- Migration/data backfill:
  - None planned.

## Open Questions

- Should duplicate team-name validation match registration rules exactly within the same competition/tenant, excluding the current team?
- Should team-name requests be bundled with participant approval requests in the UI, or shown as separate team-level changes in `/aenderungen`?
- Should a pending team-name change block submitting another team-name change, or update the existing pending request?
- Should "competition start" be enforced from `Competition.status` only, or from both `Competition.status` and `Competition.date`? Recommendation: direct edits are allowed only while status is `DRAFT`/`OPEN` and, if `date` is set, now is before `date`.

## Acceptance Criteria

- Before competition start, a Team Manager:in can open a team under `Details -> Bearbeiten`, change the Mannschafts-Name, save, and the stored/public team name updates immediately.
- Before competition start, the direct rename records audit evidence and does not create an approval item.
- After competition start, the same action creates a pending approval request instead of the current 409 error.
- After competition start, `/aenderungen` shows the requested Mannschafts-Name change with old value, new value, requester, team, date, and pending/approved/rejected status.
- Approving a post-start request updates `Team.name` and records audit evidence.
- Rejecting a post-start request leaves `Team.name` unchanged and records the review decision.
- Admin/Orga users can still directly change team names without going through Team Manager approval.
- Duplicate/empty/too-short team names are rejected with user-facing validation.

## Implementation Handoff

Use before model switch or subagent delegation.

- Relevant files:
  - `app/api/teams/[id]/route.ts`
  - `app/api/admin/pending-changes/route.ts`
  - `app/api/admin/pending-changes/[id]/route.ts`
  - `app/components/team-registration.tsx`
  - `app/components/approval-queue.tsx`
  - `lib/change-request.ts`
  - Prisma models around `ChangeRequest`, `AuditEvent`, and `Team`
- Current decisions:
  - Use the existing Team Manager edit flow.
  - Treat Team Manager team-name changes before competition start as direct.
  - Treat Team Manager team-name changes after competition start as approval-required.
  - Keep Admin/Orga direct edit unchanged.
- Open decisions:
  - Exact start-boundary helper: `Competition.status`, `Competition.date`, or both.
  - Exact duplicate-name constraint scope.
  - Whether pending team-name updates overwrite an existing pending request or create a new request.
  - Whether team-level changes need their own decision endpoint or can be handled by the existing generic endpoint.
- Non-goals:
  - No broad redesign of team editing.
  - No permission model changes.
  - No bulk cleanup.
- Expected implementation steps:
  - Remove the current Team Manager hard-block for changed `teamName`.
  - Add validation for Team Manager requested team names.
  - Add a competition-start guard using the selected source of truth.
  - Before start, update `Team.name` directly and write audit evidence.
  - After start, create/update a team-scoped generic change request when `teamName` changes.
  - Surface post-start team-level change requests in `/aenderungen`.
  - Extend approval/rejection handling to apply or reject post-start team-name requests.
  - Update user-facing save result copy if needed.
- Required checks:
  - targeted eslint for changed API/UI files
  - `npx tsc --noEmit`
  - `git diff --check`
  - `npm run build`
  - `npm run verify:team-draft` if team validation/classification code is touched
  - `npm run smoke:public` after deploy
- Risks/assumptions:
  - The current approval queue was originally participant-centered; team-level requests need careful UI labeling so they do not look like participant changes.
  - Avoid creating dummy participant-linked pending changes for a team-level rename.

## Model / Subagent Plan

- Model switch needed: no
- Target model/role: current Codex
- Subagent needed: no
- Subagent role: n/a
- Handoff source: this CR and current repo state

## Confirmation Gate

- Gate needed: yes
- Reason: implementation changes application behavior and production deploy is required.
- Approved by: pending
- Approval timestamp: pending

## Implementation Notes

- Files changed: pending
- Important decisions during implementation: pending

## Verification

- Local checks: pending
- Build: pending
- Targeted verification: pending
- Manual smoke: pending

## Deploy

- Deployment needed: yes
- Deployment ID: pending
- Deployment URL: pending
- Production alias: `https://portal.s5evo.de`
- Deployed at: pending

## Post-Deploy Smoke

- Routes checked: pending
- API checks: pending
- Result: pending

## Follow-Ups

- Consider adding a compact team-level change type/filter in `/aenderungen` if more non-participant team edits are added later.
