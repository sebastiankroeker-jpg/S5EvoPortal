# CR: Message Center Admin Mailbox UX

Status: Draft
Date: 2026-07-12
Type: feature
Risk: medium
Owner: S5Evo

## Context

Sebastian tested the current message center on mobile as an admin. Several admin/org mailbox semantics are still confusing:

- Messages addressed to the Orga-Team appear in the admin's personal mailbox.
- Starting a new message requires scrolling to the bottom of the message center.
- The personal/admin mailbox switch has the personal mailbox first, while admins should default to the admin mailbox.
- Thread headers do not expose the same user/status dialog affordance already used in team/user contexts.
- Organization sender icons/labels still read too much like an individual admin instead of a group mailbox.

## Scope

- In scope:
  - Separate admin group mailbox visibility from the personal mailbox in `/nachrichten`.
  - For admins/moderators, default `/nachrichten` to the Admin/Orga mailbox.
  - Swap mailbox switch order so Admin/Orga is left and personal mailbox is right.
  - Add a header compose action in the mailbox card so users do not need to scroll to the bottom to create a new support message.
  - Reuse the existing account/status dialog pattern for the relevant user badge in a message/thread header.
  - Rename and visually clarify organization sender affordances as `Orga-Team`, with group/mailbox semantics instead of a single-person admin icon.
- Out of scope:
  - Message-level read receipts from `docs/cr/2026-07-12-message-read-receipts.md`.
  - Realtime messaging, typing indicators, websocket updates.
  - DB pagination/performance hardening.
  - A general multi-user group chat model beyond the current support conversation model.

## Affected Flows

- User/API/admin flows touched:
  - `/nachrichten` responsive message center UI.
  - `GET /api/messages/conversations?mode=mine|admin`.
  - Potentially message serialization in `lib/messaging.ts`.
- Data model impact:
  - No migration expected.
  - Existing `ConversationParticipant.role` should be enough to distinguish admin group participation from personal ownership/member participation.
- Auth/permission impact:
  - Admin/moderator users should see support threads in the Admin/Orga mailbox.
  - Personal mailbox should not show threads solely because the user is an admin/moderator participant of a support thread.
  - If an admin is also the actual target/user participant of a conversation, it may still appear in the personal mailbox via OWNER/MEMBER semantics.
- Production/deploy impact:
  - Requires frontend/API deploy.
  - No production data mutation expected.

## Data / API Design

- Proposed data model:
  - Unchanged.
- Proposed API shape:
  - Keep `mode=admin` for the support group mailbox.
  - Adjust `mode=mine` filtering so admin/moderator support participation alone does not include Orga-Team threads in the personal mailbox.
  - Include enough participant/user context in serialized conversations for a header user badge/dialog without additional client-side round trips, if not already present.
- Backward compatibility:
  - Non-admin users continue to see their own support conversations.
  - Existing conversations/messages remain valid.
- Migration/data backfill:
  - None planned.

## Open Questions

- Decision 1: Organization display label should be `Orga-Team` rather than `Admin-Team`.
- Decision 2: Admin/moderator default mailbox should be the Admin/Orga mailbox.
- Decision 3: The quick compose action opens the existing new-message composer near the top or as an in-place panel; it should not create a second compose implementation.
- Open: For an admin who is also personally the target/owner of a support thread, should that thread appear in both mailboxes or only personal? Recommendation: appear in personal when role is OWNER/MEMBER, in Admin/Orga when handled as support staff.

## Acceptance Criteria

- As an admin, opening `/nachrichten` defaults to the Admin/Orga mailbox.
- The mailbox switch shows Admin/Orga on the left and personal mailbox on the right.
- Orga-Team/support threads no longer appear in `Mein Postfach` merely because the admin is part of the support staff participant list.
- A visible icon button in the mailbox header opens the new-message composer without scrolling to the bottom.
- The existing bottom compose area is either moved, collapsed behind the new action, or kept only as the action target so there is one coherent compose flow.
- In a thread header, the relevant user badge opens a dialog/menu using the same account/status dialog pattern as team/user contexts.
- Organization sender mode and related icons are labeled `Orga-Team` and visually read as a group mailbox.
- Existing sending, replying, status changes, filters/search/sort, mobile overview/thread navigation, and notifications keep working.

## Implementation Handoff

Use before model switch or subagent delegation.

- Relevant files:
  - `app/components/message-center.tsx`
  - `lib/messaging.ts`
  - `app/api/messages/conversations/route.ts`
  - `app/api/messages/admin-conversations/route.ts`
  - `app/api/messages/conversations/[id]/messages/route.ts`
  - `app/components/account-link-status-dialog.tsx`
  - Existing account dialog usage in `app/components/dashboard.tsx` and `app/components/user-management.tsx`
- Current decisions:
  - Treat this as one coherent message center UX/API CR.
  - Prefer no schema migration.
  - Keep current support conversation model.
  - Use `Orga-Team` as the organization label.
- Open decisions:
  - Whether personal target/admin overlap should duplicate a thread across both mailboxes.
  - Exact compose presentation: top inline panel, modal, or scroll-to-open existing panel.
- Non-goals:
  - Read receipts.
  - Pagination/performance hardening.
  - General group chat.
- Expected implementation steps:
  - Adjust initial mode for admins/moderators to `admin`.
  - Swap mailbox switch order and labels.
  - Update `mode=mine` API filtering to exclude support-staff-only conversations.
  - Replace `Admin-Team` organization display copy with `Orga-Team`.
  - Add group/mailbox visual affordance for organization sender mode.
  - Add mailbox-header compose trigger and consolidate compose panel behavior.
  - Add/reuse account/status dialog in thread header for the user/context badge.
  - Run targeted checks and deploy smoke after approval.
- Required checks:
  - `pnpm exec eslint app/components/message-center.tsx app/api/messages/conversations/route.ts app/api/messages/admin-conversations/route.ts app/api/messages/conversations/[id]/messages/route.ts lib/messaging.ts`
  - `npx tsc --noEmit`
  - `git diff --check`
  - `npm run build`
  - `npm run smoke:public` after deploy
  - Post-deploy route checks: `/nachrichten`, `/api/messages/conversations` without session -> 401
- Risks/assumptions:
  - Current API loads full conversations; this CR should not broaden payload size.
  - Mailbox filtering must not hide legitimate personal conversations for users with admin rights.
  - Authenticated real-smoke is valuable because mailbox defaults and filtering depend on actual roles.

## Model / Subagent Plan

- Model switch needed: no
- Target model/role: current Codex
- Subagent needed: optional
- Subagent role: UI/API review if implementation diff grows
- Handoff source: this CR, `SESSION_HANDOFF.md`, existing message center CRs

## Confirmation Gate

- Gate needed: yes
- Reason: production deploy and admin mailbox behavior change.
- Approved by:
- Approval timestamp:

## Implementation Notes

- Files changed:
- Important decisions during implementation:

## Verification

- Local checks:
- Build:
- Targeted verification:
- Manual smoke:

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

- Keep message-level read receipts in the existing separate draft CR.
- Consider later performance CR for pagination, slim thread list, and lazy message loading.
