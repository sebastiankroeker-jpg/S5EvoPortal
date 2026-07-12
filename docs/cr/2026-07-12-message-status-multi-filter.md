# CR: Message status multi filter persistence

Status: Implemented
Date: 2026-07-12
Type: feature
Risk: low
Owner: S5Evo

## Context

Sebastian wants the Messenger filter panel to support combined status filters, hide closed threads by default, and remember filters when navigating away and back, as long as this stays lightweight.

## Scope

- In scope: Messenger status multi-select, default status set without closed threads, local filter persistence.
- Out of scope: API changes, database changes, production data mutation, new global dashboard filter framework.

## Affected Flows

- User/API/admin flows touched: `/nachrichten` UI filter panel for personal and admin mailbox.
- Data model impact: none.
- Auth/permission impact: none.
- Production/deploy impact: frontend-only deploy after approval.

## Data / API Design

- Proposed data model: no server-side model change.
- Proposed API shape: unchanged `/api/messages/conversations`.
- Backward compatibility: stored legacy/malformed filter values fall back to defaults.
- Migration/data backfill: none.

## Open Questions

- None.

## Acceptance Criteria

- Status filters can be combined in the filter panel.
- Closed threads are hidden by default.
- Filter reset returns to open/waiting statuses and does not include closed.
- Search, status filters, unread-only, sort field, and sort direction are remembered locally when returning to the page.
- No additional backend load is introduced beyond existing conversation loading.

## Implementation Handoff

- Relevant files: `app/components/message-center.tsx`.
- Current decisions: use `localStorage`; keep persistence per mailbox mode; keep status filtering client-side.
- Open decisions: none.
- Non-goals: no API changes, no schema changes.
- Expected implementation steps: add status filter type/helpers, replace status select with multi-select controls, persist filter state, run targeted checks.
- Required checks: ESLint for Messenger component, `npx tsc --noEmit`, `git diff --check`, `npm run build`.
- Risks/assumptions: stale localStorage should never break rendering.

## Model / Subagent Plan

- Model switch needed: no
- Target model/role: current Codex implementation
- Subagent needed: no
- Subagent role: none
- Handoff source: this CR

## Confirmation Gate

- Gate needed: no
- Reason: local frontend-only change; deployment still requires explicit Go.
- Approved by: Sebastian requested implementation in chat
- Approval timestamp: 2026-07-12

## Implementation Notes

- Files changed:
  - `app/components/message-center.tsx`
  - `docs/cr/2026-07-12-message-status-multi-filter.md`
- Important decisions during implementation:
  - Default visible statuses are `OPEN`, `WAITING_FOR_ADMIN`, and `WAITING_FOR_USER`.
  - `CLOSED` remains available in the filter panel but must be selected explicitly.
  - Filter state is stored in `localStorage` under `s5evo.messages.filters.v1` per `mine`/`admin` mailbox mode.

## Verification

- Local checks:
  - `pnpm exec eslint app/components/message-center.tsx` gruen
  - `npx tsc --noEmit` gruen
  - `git diff --check` gruen
- Build: `npm run build` gruen
- Targeted verification: status filter defaults and localStorage restore covered by TypeScript-safe helpers and client-side filtering.
- Manual smoke: pending production deploy.

## Deploy

- Deployment needed: yes, after user Go
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
