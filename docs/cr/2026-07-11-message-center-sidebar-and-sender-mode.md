# CR: Message center sidebar and sender mode

Status: Deployed
Date: 2026-07-11
Type: schema
Risk: medium
Owner: S5Evo

## Context

The messaging MVP is live. The current message center uses a card-based two-column layout with mode buttons in the header. Sebastian wants the UI closer to ChatGPT Web: a collapsible left panel with chronologically ordered subjects, an explicit admin/user mailbox switch, and an admin compose choice between organization mailbox and personal account.

## Scope

- In scope:
  - Add a collapsible conversation sidebar with compact subject list ordered by latest activity.
  - Move admin/user mailbox switching into a clear mailbox control for admins.
  - Add an admin sender mode for new admin-initiated messages and replies.
  - Persist sender display mode so organization mailbox messages can show as Admin-Team while retaining sender auditability.
- Out of scope:
  - Inbox pagination and message lazy loading performance hardening.
  - General user-to-user messaging or group chats.
  - End-to-end encryption.

## Affected Flows

- User/API/admin flows touched:
  - `/nachrichten` message center UI.
  - `GET/POST /api/messages/conversations`.
  - `POST /api/messages/conversations/[id]/messages`.
  - `POST /api/messages/admin-conversations`.
- Data model impact:
  - Add a small message-level display mode field.
- Auth/permission impact:
  - Only admins/moderators can use organization sender mode.
  - The actual authenticated sender remains stored in `senderId`.
- Production/deploy impact:
  - Requires Prisma migration deploy before the new code path can safely write the field.

## Data / API Design

- Proposed data model:
  - Add `MessageSenderDisplayMode` enum with `PERSONAL` and `ORG`.
  - Add `Message.senderDisplayMode` with default `PERSONAL`.
- Proposed API shape:
  - Accept optional `senderDisplayMode: "ORG" | "PERSONAL"` for admin compose and admin replies.
  - Non-admin participant messages are forced to `PERSONAL`.
- Backward compatibility:
  - Existing messages default to `PERSONAL`.
- Migration/data backfill:
  - No manual backfill; DB default covers existing and future rows.

## Open Questions

- Decision 1: Use label "Admin-Team" for organization sender mode in the UI and email actor name.
- Decision 2: Keep actual `senderId` visible to admins through audit data, but display label is controlled by message mode.

## Acceptance Criteria

- Message center has a collapsible left conversation panel.
- Conversation subjects are ordered by latest activity, newest first.
- Admins can switch between personal and admin mailbox from inside the message UI.
- Admins can choose organization mailbox or personal account before sending admin messages.
- Organization mailbox messages display as Admin-Team while preserving the real sender relation.
- Participant messages continue to work unchanged.

## Implementation Handoff

- Relevant files:
  - `prisma/schema.prisma`
  - `lib/messaging.ts`
  - `app/api/messages/conversations/route.ts`
  - `app/api/messages/admin-conversations/route.ts`
  - `app/api/messages/conversations/[id]/messages/route.ts`
  - `app/components/message-center.tsx`
- Current decisions:
  - Persist sender display mode at message level.
  - Default admin mode to organization mailbox.
  - Keep performance hardening separate.
- Open decisions:
  - None after approval.
- Non-goals:
  - Pagination, group chats, encryption.
- Expected implementation steps:
  - Add schema enum/field and migration.
  - Normalize sender mode in messaging helper.
  - Write mode from admin compose/reply endpoints.
  - Serialize display label to the client.
  - Redesign message center layout.
  - Run Prisma, eslint, typecheck, build, smoke.
- Required checks:
  - `npx prisma generate`
  - `npx prisma validate`
  - targeted eslint
  - `npx tsc --noEmit`
  - `npm run build`
  - `npm run smoke:public`
- Risks/assumptions:
  - Existing full-thread loading remains unchanged intentionally.
  - Authenticated browser smoke still needs real session for final UX validation.

## Model / Subagent Plan

- Model switch needed: no
- Target model/role: current Codex
- Subagent needed: no
- Subagent role: n/a
- Handoff source: this CR and `SESSION_HANDOFF.md`

## Confirmation Gate

- Gate needed: yes
- Reason: schema change, migration, and production deploy.
- Approved by: Sebastian via Telegram "Go"
- Approval timestamp: 2026-07-11T19:03:49Z

## Implementation Notes

- Files changed:
  - `prisma/schema.prisma`
  - `prisma/migrations/20260711190500_add_message_sender_display_mode/migration.sql`
  - `lib/messaging.ts`
  - `app/api/messages/admin-conversations/route.ts`
  - `app/api/messages/conversations/[id]/messages/route.ts`
  - `app/components/message-center.tsx`
- Important decisions during implementation:
  - Added persisted `MessageSenderDisplayMode` with default `PERSONAL`.
  - Added `ORG` display mode for admin compose/replies; non-admin replies are forced to `PERSONAL`.
  - UI sender label uses `Admin-Team` for organization mailbox messages while keeping the real sender relation.
  - The message center now uses a collapsible left sidebar with mailbox switch and compact chronological thread list.

## Verification

- Local checks:
  - `npx prisma generate` passed.
  - `npx prisma validate` passed.
  - `pnpm exec eslint app/components/message-center.tsx app/api/messages/admin-conversations/route.ts app/api/messages/conversations/[id]/messages/route.ts lib/messaging.ts` passed.
  - `npx tsc --noEmit` passed.
  - `git diff --check` passed.
- Build:
  - `npm run build` passed.
- Targeted verification:
  - `npx prisma migrate status` reported database schema up to date after deploy.
- Manual smoke:
  - Authenticated browser smoke remains a follow-up because no session cookie was available in this run.

## Deploy

- Deployment needed: yes
- Deployment ID: `dpl_9aBg7wpVUKNdaDn33uK9cXSsWptF`
- Deployment URL: `https://s5-evo-portal-68ko3rr7l-sebastiankroeker-2781s-projects.vercel.app`
- Production alias: `https://portal.s5evo.de`
- Deployed at: 2026-07-11T19:15:13Z
- Migration: `npx prisma migrate deploy` applied `20260711190500_add_message_sender_display_mode`.

## Post-Deploy Smoke

- Routes checked:
  - `npm run smoke:public` against production alias passed.
  - `/nachrichten`: 200
  - `/admin`: 200
- API checks:
  - `/api/messages/conversations` without session: 401
  - `/api/messages/unread-count` without session: 401
  - `POST /api/messages/admin-conversations` without session: 401
- Result: green.

## Follow-Ups

- Performance hardening CR: pagination, slim conversation list, lazy message loading, DB-side unread counts.
- Authenticated real-smoke: admin switches mailbox, sends as Orga-Postfach and Persönlich, target user sees expected sender labels and unread badge.
