# CR: Message Orga Context Privacy Hotfix

Status: Deployed
Date: 2026-07-12
Type: hotfix
Risk: low
Owner: S5Evo

## Context

Sebastian reported via mobile screenshot that the Orga-Team context dialog in `/nachrichten` exposes too much information. The dialog currently shows the Orga mailbox e-mail address and the team context.

## Scope

- In scope:
  - Hide e-mail from the Orga-Team context dialog.
  - Hide team from the Orga-Team context dialog.
  - Keep the existing person/contact dialog behavior for non-Orga thread contacts.
- Out of scope:
  - Changing API payloads or database models.
  - Redesigning message read receipts or mailbox navigation.

## Affected Flows

- User/API/admin flows touched: Messenger thread header badge/dialog in `/nachrichten`.
- Data model impact: none.
- Auth/permission impact: none.
- Production/deploy impact: frontend-only hotfix, deployment needed after checks.

## Data / API Design

- Proposed data model: unchanged.
- Proposed API shape: unchanged.
- Backward compatibility: unchanged client-side filtering of displayed rows.
- Migration/data backfill: none.

## Open Questions

- None for the hotfix scope.

## Acceptance Criteria

- Orga-Team badge dialog no longer shows `E-Mail`.
- Orga-Team badge dialog no longer shows `Team`.
- Non-Orga thread contact dialog still shows its existing context rows.
- TypeScript/build checks pass.

## Implementation Handoff

- Relevant files:
  - `app/components/message-center.tsx`
- Current decisions:
  - Treat `ADMIN` and `MODERATOR` dialog participants as Orga-Team context.
  - Filter sensitive rows only for that Orga-Team context.
- Open decisions:
  - None.
- Non-goals:
  - No API redaction or schema changes in this hotfix.
- Expected implementation steps:
  - Add a local boolean for Orga-Team dialog participant.
  - Conditionally omit e-mail and team rows for Orga-Team.
  - Run targeted lint, typecheck, diff check, build.
- Required checks:
  - `pnpm exec eslint app/components/message-center.tsx`
  - `npx tsc --noEmit`
  - `git diff --check`
  - `npm run build`
- Risks/assumptions:
  - API still returns the data for other existing UI/search use cases; this hotfix removes it from the visible dialog only.

## Model / Subagent Plan

- Model switch needed: no
- Target model/role: current Codex implementation
- Subagent needed: no
- Subagent role: n/a
- Handoff source: this CR

## Confirmation Gate

- Gate needed: yes
- Reason: production deploy
- Approved by: Sebastian (`Go`)
- Approval timestamp: 2026-07-12 18:44 UTC

## Implementation Notes

- Files changed:
  - `app/components/message-center.tsx`
- Important decisions during implementation:
  - Added an explicit `selectedDialogIsOrgTeam` branch for the message header dialog.
  - Orga-Team context omits `E-Mail` and `Team`; normal thread contacts still receive the previous rows.

## Verification

- Local checks:
  - `pnpm exec eslint app/components/message-center.tsx` passed.
  - `npx tsc --noEmit` passed.
  - `git diff --check` passed.
- Build:
  - `npm run build` passed.
- Targeted verification:
  - Static code verification confirms Orga-Team dialog rows no longer include e-mail or team.
- Manual smoke:
  - Production smoke passed after deploy.

## Deploy

- Deployment needed: yes
- Deployment ID: `dpl_FeS1MGBkRfmmFr7F2on6eoKqA7XJ`
- Deployment URL: `https://s5-evo-portal-ewsk1ae6h-sebastiankroeker-2781s-projects.vercel.app`
- Production alias: `https://portal.s5evo.de`
- Deployed at: 2026-07-12 18:49 UTC

## Post-Deploy Smoke

- Routes checked:
  - `npm run smoke:public` against `https://portal.s5evo.de` passed.
  - `/nachrichten`: 200.
- API checks:
  - `GET /api/messages/conversations` without session: 401.
  - `POST /api/messages/admin-conversations` without session: 401.
- Result: passed.

## Follow-Ups

- None
