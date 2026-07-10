# CR: Participant Replacement Flow

Status: Implemented
Date: 2026-07-10
Type: feature
Risk: medium
Owner: S5Evo

## Context

Participant edits keep `participants.id` stable. That is correct for typo/data corrections, but wrong when a slot should become a different person. The current guardrails warn users, but there is not yet a clear "replace this participant identity" action.

## Scope

- In scope:
  - Add an Orga/Admin replacement action in the team edit modal.
  - Replacement archives the old participant record and creates a new participant record in the same team/slot.
  - Keep linked portal account, audit history, and pending/history records on the old participant identity.
  - Revoke active team-manager rights for this team when the old participant identity is replaced.
  - Recalculate team classification/age after replacement.
  - Document and verify the flow.
- Out of scope:
  - DB schema changes.
  - Moving historical results to the new participant.
  - Participant merge/deduplication.
  - Self-service/team-manager replacement requests.
  - Production data mutation outside normal app use.

## Affected Flows

- User/API/admin flows touched:
  - Dashboard team edit modal.
  - Admin direct `PUT /api/teams/:id` update path.
  - MTC teams when edited through dashboard team edit.
- Data model impact:
  - No schema change. Uses existing `deletedAt` archive semantics and creates a new `Participant`.
- Auth/permission impact:
  - Replacement is direct-edit only, therefore Orga/Admin scoped via existing `canEditAllTeams`.
- Production/deploy impact:
  - Needs normal Vercel deploy and public smoke after validation.

## Data / API Design

- Proposed data model:
  - Old participant: `deletedAt = now`.
  - New participant: copied submitted fields, same `teamId`, new `id`, no `userId`, no claim tokens, no results, no pending changes.
- Proposed API shape:
  - Team participant payload accepts optional `replaceParticipant: true` for direct admin edits.
- Backward compatibility:
  - Existing updates without `replaceParticipant` keep current behavior.
  - Non-admin/team-manager updates cannot replace identities.
- Migration/data backfill:
  - None.

## Open Questions

- Decision 1:
  - MVP creates a fresh participant rather than selecting an existing participant from another team.
- Decision 2:
  - Old identity remains archived with account/history. Later "restore/merge/select existing" can be a separate CR.

## Acceptance Criteria

- Orga/Admin can mark a participant row as "Andere Person einsetzen".
- Saving a marked row archives the old participant and creates a new participant ID with the submitted row data.
- The UI clearly says account/history stay on the old participant.
- Unmarked suspicious identity changes still show the correction warning/confirm.
- Non-admin/team-manager edits cannot trigger replacement.
- Existing validation/checks remain green.

## Implementation Handoff

- Relevant files:
  - `lib/domain/team.ts`
  - `app/components/dashboard.tsx`
  - `app/api/teams/[id]/route.ts`
  - `docs/cr/2026-07-10-participant-replacement-flow.md`
- Current decisions:
  - Admin direct-edit MVP only.
  - Archive old participant, create new participant.
  - Keep account/history/results on old participant.
  - Revoke team-manager access on the old linked account for this team.
- Open decisions:
  - None for MVP.
- Non-goals:
  - Existing-participant picker.
  - Merge/move history.
- Expected implementation steps:
  - Add optional replacement flag to participant payload.
  - Add row-level replacement toggle/copy in team edit modal for anchored participants and admins.
  - Teach direct admin team update to archive/create instead of update for flagged rows.
  - Add audit log entries on old/new participant identities.
  - Run tsc, participant/team verifiers, lint, build, smoke after deploy.
- Required checks:
  - `npx tsc --noEmit`
  - `npm run verify:participant-edit-flow`
  - `npm run verify:team-draft`
  - `npm run lint`
  - `npm run build`
  - `npm run smoke:public` after deploy
- Risks/assumptions:
  - Existing result/history views may hide archived participants; that is acceptable for MVP because old history must not be moved silently.

## Model / Subagent Plan

- Model switch needed: no
- Target model/role: Codex implementation
- Subagent needed: no
- Subagent role: n/a
- Handoff source: this CR

## Confirmation Gate

- Gate needed: no
- Reason: User explicitly said "Go" after the replacement-flow recommendation; no schema migration or production data mutation outside normal app deploy.
- Approved by: Sebastian
- Approval timestamp: 2026-07-10 18:06 UTC

## Implementation Notes

- Files changed:
  - `lib/domain/team.ts`
  - `app/components/dashboard.tsx`
  - `app/api/teams/[id]/route.ts`
  - `docs/cr/2026-07-10-participant-replacement-flow.md`
- Important decisions during implementation:
  - Replacement is explicit row state in the team edit modal, not inferred only from name changes.
  - Replacement rows skip the suspicious-correction confirm and instead show a stronger archive/create confirmation.
  - The API only accepts replacement in the existing direct admin edit path; team-manager self-service receives 403.
  - Old participant claim tokens are revoked, active team-manager rights for the old linked user on this team are revoked, and derived Teamchef role state is resynced.
  - Old pending participant changes and legacy change requests are rejected as superseded by replacement.
  - New participant gets a fresh `participants.id` with submitted fields and no linked account/history/results.

## Verification

- Local checks:
  - `npx tsc --noEmit` passed.
  - `npm run verify:participant-edit-flow` passed.
  - `npm run verify:team-draft` passed.
  - `npm run lint` passed with the existing 11 warnings.
- Build:
  - `npm run build` passed.
- Targeted verification:
  - Team draft and participant edit verification scripts passed.
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

- Add existing-participant picker for replacing a slot with an already registered participant.
- Add richer identity timeline/restore tooling for archived participant identities.
