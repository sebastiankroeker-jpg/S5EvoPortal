# CR: Participant Identity Guardrails

Status: Implemented
Date: 2026-07-10
Type: feature
Risk: medium
Owner: S5Evo

## Context

Participant data can be corrected, but `participants.id` remains stable on edit. With linked portal accounts this can become confusing: changing name/birth data can look like replacing a person while the linked participant identity is kept.

## Scope

- In scope:
  - Make the participant edit dialog clearer when a participant has identity anchors such as a linked portal account or pending changes.
  - Rename the existing linked-account action so it no longer claims to create a true participant replacement.
  - Warn before saving suspicious identity-field changes on anchored participants.
- Out of scope:
  - Creating the full replacement flow with a new participant ID.
  - Database schema changes.
  - Production deployment.

## Affected Flows

- User/API/admin flows touched:
  - Admin/team participant edit dialog.
  - Linked participant account reset action text.
- Data model impact:
  - None.
- Auth/permission impact:
  - None. Existing admin-only unlink action stays admin-only.
- Production/deploy impact:
  - Needs normal app deploy after validation.

## Data / API Design

- Proposed data model:
  - No schema changes.
- Proposed API shape:
  - No API changes.
- Backward compatibility:
  - Existing `/api/participants/:id`, `/api/teams/:id`, and `/api/admin/claim-links` behavior remains unchanged.
- Migration/data backfill:
  - None.

## Open Questions

- Decision 1:
  - Use lightweight UI guardrails now; implement true participant replacement later as a separate CR.
- Decision 2:
  - Keep normal corrections possible after confirmation instead of hard-blocking every name/birth change.

## Acceptance Criteria

- Linked participants clearly show that saving keeps the same participant ID.
- The existing linked-account action no longer says "Teilnehmer ersetzen".
- If name and birth-year changes look like a person swap, the user sees a warning and must confirm that it is a correction.
- No API or database behavior changes.

## Implementation Handoff

- Relevant files:
  - `app/components/participant-edit-dialog.tsx`
  - `docs/cr/2026-07-10-participant-identity-guardrails.md`
- Current decisions:
  - UI guardrails only for MVP.
  - Existing unlink/reset API remains unchanged.
  - True replacement flow is a follow-up.
- Open decisions:
  - None for MVP.
- Non-goals:
  - New participant creation from the edit dialog.
  - Slot archival/reassignment implementation.
- Expected implementation steps:
  - Add anchored identity detection in participant edit dialog.
  - Add stable ID warning panel.
  - Rename linked-account reset button and messages.
  - Add suspicious identity-change confirmation before save.
- Required checks:
  - `npx tsc --noEmit`
  - `npm run verify:participant-edit-flow`
  - `npm run lint`
- Risks/assumptions:
  - Existing API does not create a new participant ID on reset; UI text must reflect that precisely.

## Model / Subagent Plan

- Model switch needed: no
- Target model/role: Codex implementation
- Subagent needed: no
- Subagent role: n/a
- Handoff source: this CR

## Confirmation Gate

- Gate needed: no
- Reason: User explicitly approved following the recommendation; no schema, prod deploy, external side effects, or subagent.
- Approved by: Sebastian
- Approval timestamp: 2026-07-10 17:18 UTC

## Implementation Notes

- Files changed:
  - `app/components/participant-edit-dialog.tsx`
  - `docs/cr/2026-07-10-participant-identity-guardrails.md`
- Important decisions during implementation:
  - Existing account reset behavior remains unchanged: it only clears/reissues portal linkage for the same participant ID.
  - Added inline identity context for anchored participants instead of adding a modal-only warning.
  - The inline copy presents the operator decision explicitly: correction in this dialog, other person through the replacement flow.
  - Suspicious identity-field edits stay possible after explicit confirmation so real typo corrections are not blocked.

## Verification

- Local checks:
  - `npx tsc --noEmit` passed.
  - `npm run verify:participant-edit-flow` passed.
  - `npm run lint` passed with the existing 11 warnings.
- Build:
  - `npm run build` passed.
- Targeted verification:
  - Participant edit and marketplace verification script passed.
- Manual smoke:
  - Not run locally in browser.

## Deploy

- Deployment needed: yes
- Deployment ID: `dpl_5YhrsDou4qFUrTE2jR9BXhBGzxTa`
- Deployment URL: `https://s5-evo-portal-2conslhbt-sebastiankroeker-2781s-projects.vercel.app`
- Production alias: `https://portal.s5evo.de`
- Deployed at: 2026-07-10 17:32 UTC

## Post-Deploy Smoke

- Routes checked:
  - `npm run smoke:public`
  - `GET /sportlerboerse-dashboard`
- API checks:
  - `/api/competition`: 200
  - `/api/results`: 200
  - `/api/teams`: 401 without session, expected
  - `/api/admin/pending-changes`: 401 without session, expected
- Result:
  - Passed. `/sportlerboerse-dashboard` returned 200 on production alias.

## Follow-Ups

- Implement a true replacement flow that creates/selects a separate participant identity and reassigns the slot while preserving old history.
