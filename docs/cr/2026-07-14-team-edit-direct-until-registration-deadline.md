# CR: Team edit direct until registration deadline

Status: Implemented locally
Date: 2026-07-14
Type: hotfix
Risk: medium
Owner: S5Evo

## Context

Sebastian clarified the team-edit rule: Bis zum Anmeldeschluss sind Aenderungen in der Mannschaft nicht genehmigungspflichtig.

Current behavior only stores some participant fields directly for team managers. Identity, birth, gender and discipline changes go into pending approval requests. The team-name exception is also based on competition start/date instead of `registrationDeadline`.

## Scope

- In scope:
  - Allow team owners/managers to apply valid full team edits directly until `competition.registrationDeadline`.
  - Keep admin direct-edit behavior unchanged.
  - Keep post-deadline non-admin participant/name changes in the existing approval flow.
  - Preserve validation, duplicate team-name checks, participant claim invitation checks, classification recalculation, audit, and stale pending-change cleanup.
- Out of scope:
  - Production data mutation.
  - Schema changes.
  - UI redesign.
  - Changing new-registration deadline behavior.

## Affected Flows

- User/API/admin flows touched:
  - `PUT /api/teams/[id]` for team owners/managers.
  - Team edit modal behavior through existing API response.
- Data model impact:
  - None.
- Auth/permission impact:
  - Same team edit permission gate as today.
  - Timing policy changes from approval-required to direct when `registrationDeadline` has not been reached.
- Production/deploy impact:
  - Requires production deploy after approval.

## Data / API Design

- Proposed data model:
  - Unchanged.
- Proposed API shape:
  - Unchanged response shape.
  - Non-admin valid team edits before registration deadline return `applied: true` instead of creating pending requests.
- Backward compatibility:
  - Existing clients keep working.
  - Post-deadline behavior remains approval-based.
- Migration/data backfill:
  - None.

## Open Questions

- Decision 1:
  - Treat missing `registrationDeadline` as still open, matching existing registration checks.
- Decision 2:
  - Existing pending requests overwritten by a direct pre-deadline edit are rejected as obsolete, same as direct admin edits.

## Acceptance Criteria

- A team owner/manager editing a valid team before `registrationDeadline` saves participant identity, birth, gender and discipline changes directly.
- A team owner/manager before `registrationDeadline` can save a team-name change directly.
- A team owner/manager after `registrationDeadline` still gets pending approval requests for review fields.
- Admin behavior stays direct.
- Team validation and duplicate name checks still run.

## Implementation Handoff

- Relevant files:
  - `app/api/teams/[id]/route.ts`
  - `lib/registration-deadline.ts`
  - `docs/cr/2026-07-14-team-edit-direct-until-registration-deadline.md`
  - `SESSION_HANDOFF.md`
- Current decisions:
  - Use `registrationDeadline`, not competition date/status, for approval-free team edits.
  - Keep the helper small and reusable without refactoring unrelated create-registration checks.
- Open decisions:
  - None.
- Non-goals:
  - No schema or UI redesign.
- Expected implementation steps:
  - Add deadline helper.
  - Route non-admin team edits before deadline into direct update path.
  - Adjust audit wording for self-service direct edits.
  - Add targeted assertions.
- Required checks:
  - `npx eslint app/api/teams/[id]/route.ts`
  - `npx tsc --noEmit`
  - `npm run verify:team-draft`
  - `git diff --check`
- Risks/assumptions:
  - Direct pre-deadline edits may supersede existing pending requests; this is intended because the requested state is now directly editable.

## Model / Subagent Plan

- Model switch needed: no
- Target model/role: current Codex implementation
- Subagent needed: no
- Subagent role: n/a
- Handoff source: this CR

## Confirmation Gate

- Gate needed: no
- Reason: Sebastian directly requested correction; no schema, production data mutation, subagent, or deploy is performed without separate approval.
- Approved by: Sebastian requested implementation in chat
- Approval timestamp: 2026-07-14 11:28 UTC

## Implementation Notes

- Files changed:
  - `app/api/teams/[id]/route.ts`
  - `lib/registration-deadline.ts`
  - `docs/cr/2026-07-14-team-edit-direct-until-registration-deadline.md`
  - `SESSION_HANDOFF.md`
- Important decisions during implementation:
  - `canApplyTeamUpdateDirectly = access.canEditAllTeams || isRegistrationDeadlineOpen(existingTeam.competition.registrationDeadline)`.
  - Non-admin team owners/managers before the registration deadline now use the existing direct update path, including participant identity, birth, gender, discipline, team-name, classification and invite handling.
  - Post-deadline non-admin edits still use the existing pending request branch.
  - Existing pending participant/change requests superseded by a direct pre-deadline save are rejected with a self-service deadline reason.
  - Participant replacement is allowed through the direct path before the registration deadline; after the deadline it remains blocked for non-admins.

## Verification

- Local checks:
  - `npx eslint app/api/teams/[id]/route.ts lib/registration-deadline.ts` -> passed
  - `npx tsc --noEmit` -> passed
  - `git diff --check` -> passed
- Build:
  - Not run; targeted TypeScript and route checks passed.
- Targeted verification:
  - `npx tsx -e` assertions for `isRegistrationDeadlineOpen(...)` before/after deadline and missing deadline -> passed
  - `npm run verify:team-draft` -> passed
- Manual smoke:
  - Pending production deploy / authenticated smoke.

## Deploy

- Deployment needed: yes, after explicit Go
- Deployment ID:
- Deployment URL:
- Production alias:
- Deployed at:

## Post-Deploy Smoke

- Routes checked:
- API checks:
- Result:

## Follow-Ups

- None
