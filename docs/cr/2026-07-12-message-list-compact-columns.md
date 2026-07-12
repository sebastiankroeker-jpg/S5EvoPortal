# CR: Message List Compact Columns

Status: Deployed
Date: 2026-07-12
Type: feature
Risk: medium
Owner: S5Evo

## Context

Sebastian tested the mobile message center and sent screenshots. The inbox cards are too tall and the relevant metadata is not structured enough. He wants the inbox row and the read/write message header to show compact, consistent metadata: status, badge sent/received, sender/recipient, subject, date and time. He also wants a configurable list display with column options and sorting like the MD list display.

## Scope

- In scope:
  - Reduce message inbox row height and make the primary metadata scan-friendly.
  - Show status, sent/received badge, sender or recipient, subject, date and time in the inbox row.
  - Apply the same compact metadata structure to thread/read and compose headers where applicable.
  - Add a list options panel for message columns and sorting, following the existing MD control pattern.
  - Persist message list column choices locally.
- Out of scope:
  - Server-side saved message layouts.
  - Backend pagination or query filtering.
  - Message-level read receipt changes beyond already available data.

## Affected Flows

- User/API/admin flows touched:
  - `/nachrichten` inbox list, thread header and compose surfaces.
- Data model impact: none expected.
- Auth/permission impact: none expected.
- Production/deploy impact: frontend feature deploy after approval.

## Data / API Design

- Proposed data model: unchanged.
- Proposed API shape: unchanged.
- Backward compatibility: existing message APIs and conversations remain compatible.
- Migration/data backfill: not required.

## Open Questions

- Server-side reusable message layouts should be evaluated later only if local column preferences are not enough.

## Acceptance Criteria

- Inbox rows are visibly lower and show one compact metadata line: status, sent/received, sender/recipient, subject, date and time.
- On mobile, each thread remains a single tappable row/card that navigates into the thread.
- On desktop, the inbox can render as a compact list with configurable visible columns.
- List options include sorting and visible column selection/reordering similar to the MD list display.
- Thread read header and compose header show the same relevant metadata vocabulary.
- Existing search, status filters, mailbox switch, compose, read and reply flows continue to work.

## Implementation Handoff

- Relevant files:
  - `app/components/message-center.tsx`
  - `app/components/dashboard-controls.tsx` if shared controls need small extensions
- Current decisions:
  - Keep configuration localStorage-based for this CR.
  - Reuse the current DashboardControlsCard/DashboardToolbar/DashboardPanel primitives.
  - Keep production deploy gated separately.
- Open decisions:
  - None for local implementation.
- Non-goals:
  - New DB tables for saved message layouts.
  - Changing message API contracts.
- Expected implementation steps:
  - Define message list column keys and sort directions.
  - Add localStorage load/save for visible columns and sort direction.
  - Replace tall cards with compact row/list renderer.
  - Add list options toolbar button and panel.
  - Add compact metadata blocks to selected thread and compose headers.
- Required checks:
  - `pnpm exec eslint app/components/message-center.tsx`
  - `npx tsc --noEmit`
  - `git diff --check`
  - `npm run build`
  - `npm run smoke:public` after deploy
- Risks/assumptions:
  - Mobile density must stay readable despite shorter rows.
  - Sorting must not break existing default latest-activity behavior.

## Model / Subagent Plan

- Model switch needed: no
- Target model/role: current Codex
- Subagent needed: no
- Subagent role:
- Handoff source: this CR plus MD list display patterns in `app/components/dashboard.tsx`

## Confirmation Gate

- Gate needed: yes
- Reason: production deploy.
- Approved by:
- Approval timestamp:

## Implementation Notes

- Files changed:
  - `app/components/message-center.tsx`
  - `docs/cr/2026-07-12-message-list-compact-columns.md`
- Important decisions during implementation:
  - Message list columns are localStorage-backed in v1 under `s5evo.messages.visibleColumns.v1`.
  - Desktop inbox uses a compact table with configurable columns.
  - Mobile inbox uses a compact row list and keeps tap-to-thread navigation.
  - `gesendet`/`empfangen` is derived from the active mailbox and the latest message:
    - Orga mailbox: `senderDisplayMode === ORG` is sent.
    - Personal mailbox: current viewer sender id is sent.
  - Read and compose headers reuse the same metadata vocabulary: status, badge, sender/recipient, subject, date/time.
  - Post-deploy mobile screenshot follow-up:
    - `MessageMetaStrip` now renders as a compact wrapping horizontal strip instead of a one-column mobile detail card.
    - Read/write compose headers use reduced padding/spacing.
    - The new personal message composer no longer shows the extra context detail helper line below the context select.

## Verification

- Local checks:
  - `pnpm exec eslint app/components/message-center.tsx` green
  - `npx tsc --noEmit` green
  - `git diff --check` green
- Build:
  - `npm run build` green
- Targeted verification:
  - Reviewed inbox rendering paths for desktop table and mobile row list.
  - Reviewed thread/read and compose header metadata order.
  - Follow-up static verification confirms the write/compose header can no longer collapse into five tall label/value rows on mobile.
- Manual smoke:
  - `npm run smoke:public` against production alias green
  - `/nachrichten` returned 200
  - `GET /api/messages/conversations` without session returned 401
  - `POST /api/messages/admin-conversations` without session returned 401

## Deploy

- Deployment needed: yes
- Deployment ID: `dpl_BPueAWdtDt4F7M6SvNy49WdL1P7A`
- Deployment URL: `https://s5-evo-portal-kkqbi66jz-sebastiankroeker-2781s-projects.vercel.app`
- Production alias: `https://portal.s5evo.de`
- Deployed at: 2026-07-12 20:49 UTC

## Post-Deploy Smoke

- Routes checked:
  - `/`, `/login`, `/anmeldung`, `/aenderungen`
  - `/nachrichten`
  - `/api/competition`, `/api/results`
- API checks:
  - `/api/teams` without session: 401
  - `/api/admin/pending-changes` without session: 401
  - `GET /api/messages/conversations` without session: 401
  - `POST /api/messages/admin-conversations` without session: 401
- Result: green

## Follow-Ups

- Consider server-side reusable message layouts if multiple roles need shared default list configurations.
