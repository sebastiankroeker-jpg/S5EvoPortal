# CR: Participant Invite Placeholder User

Status: Implemented
Date: 2026-07-10
Type: hotfix
Risk: medium
Owner: S5Evo

## Context

After replacing a participant through the Orga replacement flow and sending a participant claim invitation, the new participant shows an open invitation but no visible user record. Team registrations already create placeholder users before the first confirmed login; participant invitations did not.

## Scope

- In scope:
  - Create an internal placeholder `User` for participant claim invitations when no user exists for the target email.
  - Keep the participant unlinked until the claim link is accepted by the invited email.
  - Surface placeholder-user status in team list/detail serializers.
  - Keep participant invitation/claim token status visible after team detail reloads.
- Out of scope:
  - Creating Authentik users externally.
  - Auto-linking participants before claim acceptance.
  - Mutating existing production participant/team data manually.

## Affected Flows

- User/API/admin flows touched:
  - Manual participant invitation.
  - Team edit save that sends participant invitations after email changes/replacements.
  - Mannschafts-Dashboard participant account badges.
- Data model impact:
  - No schema change. Uses existing `User` rows with `authentikSub = null` as placeholders.
- Auth/permission impact:
  - No permission change. Placeholder does not grant access and does not set `participant.userId`.
- Production/deploy impact:
  - Needs normal Vercel deploy and public smoke after validation.

## Data / API Design

- Proposed data model:
  - On participant claim invitation, create `User(email, name, authentikSub = null)` if no non-deleted user exists for the target email.
  - Existing confirmed users are reused; deleted/colliding rows do not block the invitation.
- Proposed API shape:
  - Team serializers expose `hasPlaceholderUser` for participant account-status UI.
  - Team detail serializers include latest participant claim token status, matching the main list API.
- Backward compatibility:
  - Existing invitations remain valid.
  - Existing unclaimed invitations without placeholder can be resent to create the placeholder.
- Migration/data backfill:
  - None for this hotfix.

## Open Questions

- Decision 1:
  - Do not link `participant.userId` until the claim is accepted.
- Decision 2:
  - Do not create external Authentik users from the portal.

## Acceptance Criteria

- Sending a participant invitation creates a placeholder user if no user exists for that email.
- The invited participant remains not eligible for team-manager rights until they claim the link.
- The participant account badge can show placeholder state instead of only "Kein Portal-Konto".
- Reloading a team detail view preserves the open invitation status.
- Existing account-link and participant edit checks stay green.

## Implementation Handoff

- Relevant files:
  - `lib/participant-claim-invitation.ts`
  - `app/api/teams/route.ts`
  - `app/api/teams/[id]/route.ts`
  - `app/components/dashboard.tsx`
- Current decisions:
  - Placeholder user only; no participant link before claim.
  - Detail API catches up with list API for claim token serialization.
- Open decisions:
  - Production deploy requires confirmation.
- Non-goals:
  - Authentik provisioning.
  - Manual production data update.
- Expected implementation steps:
  - Ensure placeholder user during participant invitation.
  - Expose placeholder and claim token status in serializers.
  - Update dashboard status derivation.
  - Run targeted checks/build.
- Required checks:
  - `npm run verify:account-link-status`
  - `npm run verify:participant-edit-flow`
  - `npx tsc --noEmit`
  - `npm run build`
  - `npm run smoke:public` after deploy
- Risks/assumptions:
  - Soft-deleted user email collisions should not fail invitation.

## Model / Subagent Plan

- Model switch needed: no
- Target model/role: Codex implementation
- Subagent needed: no
- Subagent role: n/a
- Handoff source: this CR

## Confirmation Gate

- Gate needed: yes
- Reason: Production deploy and future production writes through the app.
- Approved by:
- Approval timestamp:

## Implementation Notes

- Files changed:
  - `lib/participant-claim-invitation.ts`
  - `app/api/teams/route.ts`
  - `app/api/teams/[id]/route.ts`
  - `app/components/dashboard.tsx`
  - `docs/cr/2026-07-10-participant-invite-placeholder-user.md`
- Important decisions during implementation:
  - Participant invitations now ensure an internal placeholder `User` by email before creating/sending the claim token.
  - The placeholder is not assigned to `participant.userId`; linking still only happens when the invited person accepts the claim link with the matching email.
  - Team list and team detail serializers now expose participant placeholder state separately from confirmed `portalAccount`.
  - `/api/teams/[id]` now includes the latest participant claim token in participant serialization, matching `/api/teams`.
  - The team edit dialog keeps a resend action available for active invitations that have no confirmed or placeholder user yet, so pre-hotfix cases can be repaired by resending the invitation.
- Production data backfill:
  - Approved by Sebastian with "Go" on 2026-07-10.
  - At 2026-07-10 19:00 UTC, created 8 internal placeholder users for active, unclaimed participant invitations that had no matching user row.
  - Included Leonhard Schwaiger's open invite.
  - Verified all 8 affected participants still have `userId = null`; no participant was linked by the backfill.

## Verification

- Local checks:
  - `npm run verify:account-link-status` passed.
  - `npm run verify:participant-edit-flow` passed.
  - `npx tsc --noEmit` passed.
  - `npm run lint` passed with the existing 11 warnings.
- Build:
  - `npm run build` passed.
- Targeted verification:
  - Account link status and participant edit flow scripts passed.
  - Production backfill verification passed: 8 placeholder users found, 8 participants still unlinked.
- Manual smoke:
  - Not run locally in browser.

## Deploy

- Deployment needed: yes
- Deployment ID:
- Deployment URL:
- Production alias: `https://portal.s5evo.de`
- Deployed at:

## Post-Deploy Smoke

- Routes checked:
- API checks:
- Result:

## Follow-Ups

- Consider a support action for future invite/account-status repair cases, if this comes up again.
