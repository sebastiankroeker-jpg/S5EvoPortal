# CR: Message Detail Chat Refresh

Status: Implemented
Date: 2026-07-12
Type: feature
Risk: medium
Owner: S5Evo

## Context

Sebastian approved the recommended Manager-perspective UI refresh for message details. The current detail view still feels like a portal form/card: large metadata block, scroll-heavy layout, and reply controls below the conversation.

## Scope

- In scope:
  - Make the selected message detail feel like a modern chat screen.
  - Keep mobile overview as row list and desktop inbox as current list/table.
  - Use a compact sticky thread header.
  - Move full metadata into collapsible thread details.
  - Keep the message composer sticky at the bottom of the detail view.
  - Show message-level read timing for sent/outgoing messages when available.
- Out of scope:
  - Message schema changes.
  - New read-receipt recipient identities.
  - Pagination or virtualized message loading.
  - Broad redesign of non-message detail pages.

## Affected Flows

- User/API/admin flows touched:
  - `/nachrichten` selected thread detail, mobile and desktop.
- Data model impact: none.
- Auth/permission impact: none.
- Production/deploy impact: frontend deploy after approval.

## Data / API Design

- Proposed data model: unchanged; uses existing conversation participant `lastReadAt`.
- Proposed API shape: unchanged.
- Backward compatibility: full.
- Migration/data backfill: not required.

## Open Questions

- Decision 1: Read indicators should stay privacy-preserving and show only "Gelesen" plus timestamp, not recipient identity.
- Decision 2: Thread status actions remain in collapsible details to keep the primary header quiet.

## Acceptance Criteria

- Detail view has a compact chat-style header instead of a large form header.
- Full status/direction/person/subject/date metadata is available behind a details toggle.
- Message history scrolls independently between header and composer.
- Reply composer stays available at the bottom of the detail view.
- Sent/outgoing messages show "Gelesen" with timestamp when a recipient has read them.
- Mobile back-to-overview navigation remains obvious.
- Existing message list, filters, sort, compose, reply and admin close/reopen flows continue to work.

## Implementation Handoff

- Relevant files:
  - `app/components/message-center.tsx`
  - `docs/cr/2026-07-12-message-detail-chat-refresh.md`
- Current decisions:
  - Keep the API contract unchanged.
  - Use existing participant `lastReadAt` to derive per-message read timing.
  - Do not expose recipient email/team details in the compact header.
- Open decisions:
  - None before local implementation.
- Non-goals:
  - New read receipt tables.
  - Full redesign of the list view.
- Expected implementation steps:
  - Add read receipt helper.
  - Replace large detail header with sticky compact chat header.
  - Add collapsible metadata area.
  - Make the message pane independently scrollable.
  - Make reply composer sticky at the bottom.
- Required checks:
  - `pnpm exec eslint app/components/message-center.tsx`
  - `npx tsc --noEmit`
  - `git diff --check`
  - `npm run build`
  - `npm run smoke:public` after deploy
- Risks/assumptions:
  - Mobile viewport height must stay usable with sticky header and composer.
  - Existing all-thread payload is acceptable for this UI-only refresh.

## Model / Subagent Plan

- Model switch needed: no
- Target model/role: current Codex
- Subagent needed: no
- Subagent role:
- Handoff source: current request, existing message CRs, and `app/components/message-center.tsx`

## Confirmation Gate

- Gate needed: yes
- Reason: production deploy.
- Approved by: Sebastian
- Approval timestamp: 2026-07-12 21:14 UTC

## Implementation Notes

- Files changed:
  - `app/components/message-center.tsx`
  - `docs/cr/2026-07-12-message-detail-chat-refresh.md`
- Important decisions during implementation:
  - `lastReadAt` is already serialized on conversation participants, so only the TypeScript type and UI derivation were needed.
  - Header fallback for non-org contacts uses "Kontakt" instead of an email address.

## Verification

- Local checks:
  - `pnpm exec eslint app/components/message-center.tsx` green
  - `npx tsc --noEmit` green
  - `git diff --check` green
- Build:
  - `npm run build` green
- Targeted verification:
  - Reviewed mobile back action, details toggle, admin close/reopen placement, reply composer path, and read-receipt derivation.
- Manual smoke:
  - pending after deploy

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

- Consider a future message pagination CR once real production thread volume requires it.
