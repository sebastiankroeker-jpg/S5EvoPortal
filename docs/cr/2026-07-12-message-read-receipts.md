# CR: Message Read Receipts

Status: Draft
Date: 2026-07-12
Type: feature
Risk: medium
Owner: S5Evo

## Context

Sebastian wants messages to make it visible whether and when they were read.

## Scope

- In scope:
  - Show read state for sent messages where the current user is allowed to see it.
  - Display when a message or conversation was read.
  - Keep unread count/read-state behavior consistent with the existing messaging MVP.
- Out of scope:
  - Real-time websocket delivery/read indicators.
  - Typing indicators.
  - Delivery receipts beyond portal read state.
  - External email open tracking.

## Affected Flows

- User/API/admin flows touched:
  - `/nachrichten`
  - message read endpoint
  - conversation/message serialization
- Data model impact:
  - Likely uses existing `ConversationParticipant.lastReadAt` first.
  - Message-level per-recipient read receipts may require a new table if conversation-level precision is insufficient.
- Auth/permission impact:
  - Read visibility must respect mailbox/admin boundaries.
- Production/deploy impact:
  - If schema is needed, requires migration deploy; otherwise frontend/API deploy only.

## Data / API Design

- Proposed data model:
- Option A: derive conversation-level read state from existing participant `lastReadAt`.
- Option B: add message-level read receipt table for exact per-message/per-recipient timestamps.
- Decision: Sebastian chose Option B / message-level receipts on 2026-07-12.
- Proposed API shape:
  - Include read receipt summary in conversation detail, e.g. `readBy`, `lastReadAt`, or `readStatus`.
- Backward compatibility:
  - Existing messages without precise receipts fall back to conversation-level status.
- Migration/data backfill:
  - Not required for Option A.
  - Required for Option B.

## Open Questions

- Decision 1: Use exact message-level receipts, not only conversation-level `lastReadAt`.
- For admin/org mailbox messages, should participants see which individual admin read it, or only `Admin-Team gelesen`?
- Should admins see read state for all participants in a support conversation?
- Should read time be shown inline, in tooltip, or in message detail metadata?

## Acceptance Criteria

- Sender can see whether a message/conversation has been read where allowed.
- Read timestamp is displayed in a compact, understandable way.
- Org mailbox privacy/audit semantics remain clear.
- Unread badges still work correctly.
- No read-state leaks across unauthorized users or mailboxes.

## Implementation Handoff

- Relevant files:
  - `prisma/schema.prisma` if Option B is selected
  - `lib/messaging.ts`
  - `app/api/messages/conversations/[id]/route.ts`
  - `app/api/messages/conversations/[id]/read/route.ts`
  - `app/components/message-center.tsx`
- Current decisions:
  - Implement as message-level receipts when this CR is picked up.
  - Existing `ConversationParticipant.lastReadAt` may remain as unread/conversation cursor, but is not sufficient for receipts.
- Open decisions:
  - Option A vs Option B.
  - Exact visibility labels for org mailbox/admin reads.
- Non-goals:
  - Realtime indicators.
  - Email open tracking.
- Expected implementation steps:
  - Inspect current read-state model and endpoints.
  - Choose conversation-level or message-level model.
  - Add serialized read summary.
  - Add compact UI indicator/timestamp.
  - Verify admin/user mailbox semantics.
- Required checks:
  - `npx prisma generate` and migration checks if schema changes
  - targeted eslint
  - `npx tsc --noEmit`
  - `git diff --check`
  - `npm run build`
  - `npm run smoke:public` after deploy
- Risks/assumptions:
  - Message-level receipts increase schema/API complexity and should not be added unless needed.

## Model / Subagent Plan

- Model switch needed: no
- Target model/role: current Codex
- Subagent needed: optional
- Subagent role: schema/API review if Option B is chosen
- Handoff source: this CR and messaging MVP CRs

## Confirmation Gate

- Gate needed: yes
- Reason: production deploy; possible schema migration.
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

- Consider realtime read indicators later if the portal becomes chat-heavy.
