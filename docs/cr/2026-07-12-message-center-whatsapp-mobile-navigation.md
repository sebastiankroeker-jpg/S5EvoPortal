# CR: Message Center WhatsApp Mobile Navigation

Status: Deployed
Date: 2026-07-12
Type: feature
Risk: medium
Owner: S5Evo

## Context

Sebastian wants the message center to feel more like WhatsApp, especially on mobile. The current sidebar/thread UI improved navigation, but mobile should behave more like a conversation list: rows in the overview and explicit navigation into one thread.

## Scope

- In scope:
  - Mobile `/nachrichten` overview as a compact row list of conversations.
  - Tap/click row navigates into the selected thread view.
  - In thread view, provide a clear back action to the conversation overview.
  - Keep desktop layout broadly as currently deployed.
  - Preserve admin/user mailbox switch and sender mode behavior.
- Out of scope:
  - Messaging data model changes.
  - Pagination/performance hardening beyond what is necessary for the UI.
  - WhatsApp branding, exact visual copy, or external app integration.

## Affected Flows

- User/API/admin flows touched:
  - `/nachrichten` responsive UI.
- Data model impact: none expected.
- Auth/permission impact: none expected.
- Production/deploy impact: frontend hotfix/feature deploy.

## Data / API Design

- Proposed data model: unchanged.
- Proposed API shape: unchanged unless the UI needs small serialization helpers.
- Backward compatibility: full.
- Migration/data backfill: not required.

## Open Questions

- Decision 1: Mobile starts in conversation overview unless a URL-driven target/thread is selected.
- Decision 2: Keep chronological latest-activity order for v1; unread state is visual/filterable, not a hard sort override.

## Acceptance Criteria

- On mobile, `/nachrichten` first shows a scan-friendly conversation overview with one row per thread.
- Selecting a row opens the thread.
- Thread view has a visible back action to the overview.
- Desktop keeps the current sidebar/thread layout.
- Admin mailbox switch and sender mode remain usable on mobile and desktop.
- No regression to sending, replying, unread count, or admin compose.

## Implementation Handoff

- Relevant files:
  - `app/components/message-center.tsx`
  - message API routes only if serialization gaps are found
- Current decisions:
  - Treat this as responsive UX work, not messaging model work.
  - Mobile row list is the primary surface; desktop remains current layout.
- Open decisions:
  - Default mobile entry state.
  - Unread-vs-chronological sort priority.
- Non-goals:
  - Performance pagination.
  - Read receipts.
- Expected implementation steps:
  - Split mobile overview/thread state from desktop sidebar state.
  - Add mobile-only row list and back navigation.
  - Verify across narrow and desktop viewports.
- Required checks:
  - targeted eslint for `message-center.tsx`
  - `npx tsc --noEmit`
  - `git diff --check`
  - `npm run build`
  - `npm run smoke:public` after deploy
- Risks/assumptions:
  - Existing full thread loading can remain for this CR.

## Model / Subagent Plan

- Model switch needed: no
- Target model/role: current Codex
- Subagent needed: optional
- Subagent role: UI review if scope grows
- Handoff source: this CR and `SESSION_HANDOFF.md`

## Confirmation Gate

- Gate needed: yes
- Reason: production deploy.
- Approved by:
- Approved by: Sebastian
- Approval timestamp: 2026-07-12 09:18 UTC

## Implementation Notes

- Files changed:
  - `app/components/message-center.tsx`
- Important decisions during implementation:
  - Mobile blendet die Threadliste aus, sobald ein Thread aktiv geöffnet wurde.
  - Mobile Thread-Ansicht bekommt eine explizite `Übersicht`-Zurück-Aktion.
  - Desktop nutzt weiterhin die bestehende Sidebar-/Thread-Zweispaltigkeit.

## Verification

- Local checks:
  - `pnpm exec eslint app/components/message-center.tsx app/components/approval-queue.tsx` gruen mit bestehender Hook-Warnung in `approval-queue.tsx`
  - `npx tsc --noEmit` gruen
  - `git diff --check` gruen
- Build:
  - `npm run build` gruen
- Targeted verification:
  - Mobile-Navigation ist state-basiert getrennt (`mobileThreadOpen`), Desktop bleibt ueber `lg:` sichtbar.
- Manual smoke:
  - `npm run smoke:public` gegen Production-Alias gruen
  - `/nachrichten`: 200
  - `/api/messages/conversations` ohne Session: 401

## Deploy

- Deployment needed: yes
- Deployment ID: `dpl_881AguqPcGbhDUBNUewE5iXJHbPu`
- Deployment URL: `https://s5-evo-portal-a5rb0h4ce-sebastiankroeker-2781s-projects.vercel.app`
- Production alias: `https://portal.s5evo.de`
- Deployed at: 2026-07-12 09:24 UTC

## Post-Deploy Smoke

- Routes checked:
  - `/nachrichten`: 200
- API checks:
  - `/api/messages/conversations` without session: 401
- Result: green

## Follow-Ups

- Consider pagination/lazy-loading as a separate messaging performance CR.
