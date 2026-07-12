# CR: Message Center Nested Controls And Sparkle Navigation

Status: Deployed
Date: 2026-07-12
Type: feature
Risk: low
Owner: S5Evo

## Context

Sebastian reviewed the mobile message center after the compact list deploy. The upper intro box still consumes too much vertical space, the search/layout controls are visually detached from the thread list, and he wants a simple visual aid for screen recordings to show where navigation landed after tapping a control.

## Scope

- In scope:
  - Reduce the top message intro box height substantially.
  - Nest search, status chips, filter and layout controls inside the thread list card.
  - Show the mailbox title and thread count in one compact first line.
  - Add a short-lived sparkle/confetti-style navigation marker when opening a thread, switching mailbox, or opening the composer.
- Out of scope:
  - New persistent animation settings.
  - Backend/API changes.
  - Full guided-tour or product-walkthrough framework.

## Affected Flows

- User/API/admin flows touched:
  - `/nachrichten` message center.
- Data model impact: none.
- Auth/permission impact: none.
- Production/deploy impact: frontend deploy after approval.

## Data / API Design

- Proposed data model: unchanged.
- Proposed API shape: unchanged.
- Backward compatibility: existing message APIs remain compatible.
- Migration/data backfill: not required.

## Open Questions

- None for this scoped UI adjustment.

## Acceptance Criteria

- The upper message intro box is much shorter on mobile.
- Search/layout controls appear within the mailbox/thread-list card, not as a separate middle card.
- The first line of the mailbox card reads like `Orga-Team 3 Threads` or `Mein Postfach 3 Threads`.
- The message header/read/write surfaces remain compact and aligned with the list vocabulary.
- A simple sparkle/confetti marker briefly appears at the navigation destination after tapping thread, mailbox switch, or new-message controls.
- No email or team details are reintroduced in the compact context UI.

## Implementation Handoff

- Relevant files:
  - `app/components/message-center.tsx`
  - `docs/cr/2026-07-12-message-center-nested-controls-sparkle-navigation.md`
- Current decisions:
  - Keep the sparkle effect local and transient; no persistence or user setting.
  - Reuse current dashboard controls inside the existing card rather than introducing new primitives.
- Open decisions:
  - None.
- Non-goals:
  - Guided tour framework.
  - Backend pagination/filtering changes.
- Expected implementation steps:
  - Compact top intro box.
  - Move controls into thread list `CardHeader`.
  - Add thread count inline with mailbox title.
  - Add navigation burst component/state and trigger it at destination-opening controls.
- Required checks:
  - `pnpm exec eslint app/components/message-center.tsx`
  - `npx tsc --noEmit`
  - `git diff --check`
  - `npm run build`
- Risks/assumptions:
  - Animation must be subtle enough not to interfere with normal work but visible enough for recordings.

## Model / Subagent Plan

- Model switch needed: no
- Target model/role: current Codex
- Subagent needed: no
- Subagent role:
- Handoff source: current chat request plus screenshot.

## Confirmation Gate

- Gate needed: yes
- Reason: production deploy.
- Approved by: Sebastian
- Approval timestamp: 2026-07-12 23:35 UTC

## Implementation Notes

- Files changed:
  - `app/components/message-center.tsx`
  - `docs/cr/2026-07-12-message-center-nested-controls-sparkle-navigation.md`
- Important decisions during implementation:
  - Removed the long support-description and top refresh button from the upper message box; the box now stays a compact title/switch row.
  - Moved search, status chips, filter, refresh and list layout/sort controls into the thread-list card header.
  - The mailbox title line now combines title and count, e.g. `Orga-Team 3 Threads`.
  - Search placeholder no longer advertises team context.
  - Added a transient local sparkle marker for mailbox switch, thread navigation and composer navigation.

## Verification

- Local checks:
  - `pnpm exec eslint app/components/message-center.tsx` green
  - `npx tsc --noEmit` green
  - `git diff --check` green
- Build:
  - `npm run build` green
- Targeted verification:
  - Reviewed mobile stacking: top intro row, nested controls in mailbox card, compact thread list remains.
  - Reviewed sparkles as pointer-events-none transient UI only, no API/data impact.
- Manual smoke:
  - Production smoke green after deploy.

## Deploy

- Deployment needed: yes
- Deployment ID: `dpl_8bPskBCMk4kJeoyGNCHqx11wYCvz`
- Deployment URL: `https://s5-evo-portal-2wu5bcdfn-sebastiankroeker-2781s-projects.vercel.app`
- Production alias: `https://portal.s5evo.de`
- Deployed at: 2026-07-12 23:43 UTC

## Post-Deploy Smoke

- Routes checked:
  - `https://portal.s5evo.de` -> 200
  - `https://portal.s5evo.de/nachrichten` -> 200
  - `npm run smoke:public` green
- API checks:
  - `GET /api/messages/conversations` without session -> 401
  - `POST /api/messages/admin-conversations` without session -> 401
- Result: green

## Follow-Ups

- None
