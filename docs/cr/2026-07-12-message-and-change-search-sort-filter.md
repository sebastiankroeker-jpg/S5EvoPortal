# CR: Message And Change Search Sort Filter

Status: Draft
Date: 2026-07-12
Type: feature
Risk: medium
Owner: S5Evo

## Context

Sebastian wants Nachrichten and Änderungs-Dashboard to get search, sort, and filter logic like the Mannschafts-Dashboard, adjusted to the relevant domain values.

## Scope

- In scope:
  - Reuse the established dashboard control-strip pattern where appropriate.
  - Add domain-specific search, sort, and filters to `/nachrichten`.
  - Add stronger search, sort, and filters to `/aenderungen`.
  - Keep mobile controls compact and usable.
- Out of scope:
  - Full backend pagination unless necessary for correctness/performance.
  - Visual redesign unrelated to controls.
  - New messaging features such as read receipts.

## Affected Flows

- User/API/admin flows touched:
  - `/nachrichten`
  - `/aenderungen`
  - possibly message and change-list APIs if server-side filtering is needed
- Data model impact: none expected.
- Auth/permission impact: none expected.
- Production/deploy impact: frontend/API feature deploy.

## Data / API Design

- Proposed data model: unchanged.
- Proposed API shape:
  - Prefer client-side filtering while lists are small.
  - If data volume requires it, add query params such as `q`, `status`, `mailbox`, `sort`, `teamId`, `participantId`.
- Backward compatibility: existing endpoints keep default behavior.
- Migration/data backfill: not required.

## Open Questions

- Nachrichten filters v1:
  - mailbox: personal/admin
  - status/open/closed
  - unread/read
  - context: team/participant/support
  - sender mode: org/personal?
- Änderungs filters v1:
  - status: open/approved/rejected/direct/all
  - entity: participant/team/user later
  - team/participant/actor
  - field changed
  - date range?
- Sort defaults:
  - newest activity first for both, or domain-specific defaults?

## Acceptance Criteria

- `/nachrichten` has search across subject, participant/team context, sender, and preview where safe.
- `/nachrichten` can filter by relevant mailbox/status/unread values.
- `/aenderungen` has search across participant, team, actor, field labels, and changed values.
- `/aenderungen` can filter by relevant status/kind values.
- Sort options are explicit and predictable.
- Mobile controls stay compact and do not crowd the primary list.

## Implementation Handoff

- Relevant files:
  - `app/components/message-center.tsx`
  - `app/components/approval-queue.tsx`
  - `app/components/dashboard-controls.tsx`
  - possibly message/change APIs
- Current decisions:
  - Follow MD control-strip patterns where they fit.
  - Tailor filter values to each domain instead of copying MD labels.
- Open decisions:
  - Client-side vs server-side filtering thresholds.
  - Exact first set of filters per dashboard.
- Non-goals:
  - Read receipts.
  - WhatsApp mobile navigation.
  - Consolidated change-history semantics beyond available data.
- Expected implementation steps:
  - Define filter/sort model for each dashboard.
  - Reuse shared controls.
  - Add URL query state where useful for deep links.
  - Verify mobile and desktop layout.
- Required checks:
  - targeted eslint
  - `npx tsc --noEmit`
  - `git diff --check`
  - `npm run build`
  - `npm run smoke:public` after deploy
- Risks/assumptions:
  - Client-side filtering may become insufficient if message/change volume grows.

## Model / Subagent Plan

- Model switch needed: no
- Target model/role: current Codex
- Subagent needed: optional
- Subagent role: UX review for control density
- Handoff source: this CR and MD control-strip CRs

## Confirmation Gate

- Gate needed: yes
- Reason: production deploy; possible API query behavior changes.
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

- Promote heavy filters to server-side queries when volume demands it.
