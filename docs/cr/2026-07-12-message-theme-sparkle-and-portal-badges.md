# CR: Message Theme Sparkle And Portal Badges

Status: Deployed
Date: 2026-07-12
Type: feature
Risk: medium
Owner: S5Evo

## Context

Sebastian reviewed the latest message center iteration and wants the navigation sparkle effect to be optional through the theme switcher. He also found the inbox still too noisy in read conversations and wants the relevant portal badge visible and navigable from inbox and message headers.

## Scope

- In scope:
  - Add a per-theme sparkle/effect toggle to the existing theme controls.
  - Use that setting for message-center navigation sparkle bursts.
  - Make read inbox subjects visually normal instead of bold.
  - Remove the noisy `wartet auf Antwort` badge wording from the message status surface.
  - Show a portal/contact badge for the relevant addressee/contact in the message overview.
  - Ensure the portal badge dialog can navigate forward to the user dashboard from overview and message header.
- Out of scope:
  - New message data model.
  - New read-receipt persistence.
  - Production deployment without separate approval.

## Affected Flows

- User/API/admin flows touched:
  - Theme switcher in nav/sidebar/command menu.
  - `/nachrichten` inbox, thread header, compose/read metadata.
- Data model impact:
  - None. Sparkle preference is local browser storage.
- Auth/permission impact:
  - User-dashboard navigation remains existing admin route behavior; no new permission grant.
- Production/deploy impact:
  - Needs normal frontend deployment after approval.

## Data / API Design

- Proposed data model:
  - Extend the client theme context with a local-storage map of theme id to sparkle enabled flag.
- Proposed API shape:
  - No API changes.
- Backward compatibility:
  - Existing theme storage remains unchanged.
- Migration/data backfill:
  - None.

## Open Questions

- Decision 1: Treat sparkle as a per-theme display effect, not a separate theme variant.
- Decision 2: Keep user navigation behind the existing portal badge dialog instead of making the full inbox row navigate to the user.

## Acceptance Criteria

- Sparkle can be toggled from the theme switcher and is remembered for the current theme.
- Sparkle bursts only appear in the message center when enabled for the active theme.
- Read message rows do not show the subject in bold; unread rows remain emphasized.
- `wartet auf Antwort` is no longer shown as a prominent status badge in the inbox/header surfaces.
- Overview rows show the relevant portal/contact badge where a concrete user exists.
- Portal/contact badge dialog in overview and mail header offers forward navigation to the user dashboard.
- Existing search, sort, filters, compose, read and reply flows continue to work.

## Implementation Handoff

- Relevant files:
  - `lib/theme-context.tsx`
  - `app/components/nav-bar.tsx`
  - `app/components/sidebar.tsx`
  - `app/components/command-pill.tsx`
  - `app/components/message-center.tsx`
  - `docs/cr/2026-07-12-message-theme-sparkle-and-portal-badges.md`
- Current decisions:
  - Sparkle is a boolean display effect stored per theme in local storage.
  - The message center consumes the setting and does not expose its own separate toggle.
  - Portal badge navigation uses existing `openUserDashboard`.
- Open decisions:
  - None.
- Non-goals:
  - No backend/schema changes.
  - No deploy until approved.
- Expected implementation steps:
  - Extend theme context and UI switches.
  - Gate `NavigationSparkleBurst` triggers by the theme effect.
  - Add helper functions for relevant contact participant and portal badge rendering.
  - Adjust status/subject styling.
  - Run lint, typecheck, build, diff check.
- Required checks:
  - `pnpm exec eslint app/components/message-center.tsx app/components/nav-bar.tsx app/components/sidebar.tsx app/components/command-pill.tsx lib/theme-context.tsx`
  - `npx tsc --noEmit`
  - `git diff --check`
  - `npm run build`
- Risks/assumptions:
  - The existing user-dashboard route handles permission/visibility.

## Model / Subagent Plan

- Model switch needed: no
- Target model/role: current Codex implementation
- Subagent needed: no
- Subagent role:
- Handoff source: current chat + related CR docs

## Confirmation Gate

- Gate needed: no
- Reason: user requested implementation directly; no schema, production deploy, external message, or subagent.
- Approved by: Sebastian
- Approval timestamp: 2026-07-12

## Implementation Notes

- Files changed:
  - `lib/theme-context.tsx`
  - `app/components/nav-bar.tsx`
  - `app/components/sidebar.tsx`
  - `app/components/command-pill.tsx`
  - `app/components/message-center.tsx`
  - `docs/cr/2026-07-12-message-theme-sparkle-and-portal-badges.md`
- Important decisions during implementation:
  - Sparkle is stored in `s5evo-theme-effects` as a per-theme local browser preference.
  - Theme switchers expose Sparkle as an effect toggle, not as a separate theme.
  - Message-center navigation bursts are skipped entirely when Sparkle is off for the current theme.
  - Concrete portal contact badges no longer show E-Mail or team context in the dialog; navigation still passes the existing identifiers to the user dashboard.
  - Read conversation subjects render normal weight; unread conversations keep emphasized subject text and unread count.
  - `WAITING_FOR_USER` remains a backend status but renders as neutral `offen` in the status badge surface.

## Verification

- Local checks:
  - `pnpm exec eslint app/components/message-center.tsx app/components/nav-bar.tsx app/components/sidebar.tsx app/components/command-pill.tsx lib/theme-context.tsx` green
  - `npx tsc --noEmit` green
  - `git diff --check` green
- Build:
  - `npm run build` green
- Targeted verification:
  - Reviewed message center overview/header badge rows for no E-Mail/team context display.
  - Reviewed sparkle gating: trigger and render both require enabled current-theme effect.
- Manual smoke:
  - Not run in browser in this turn.

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
