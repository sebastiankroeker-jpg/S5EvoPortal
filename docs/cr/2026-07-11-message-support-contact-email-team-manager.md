# CR: Message Support Contact Email Team Manager

Status: Implemented locally
Date: 2026-07-11
Type: hotfix
Risk: low
Owner: S5Evo

## Context

Nach dem Messaging-MVP sollen auch Team-Manager Nachrichten an das Admin-Team schreiben können, wenn sie keinem Teilnehmerprofil zugeordnet sind. Die bestehende Team-Bearbeitungslogik erlaubt Legacy-Teamchef-/Team-Manager-Zugriff auch über `Team.contactEmail === Session-Mail`. Die neue Messaging-Kontextauflösung berücksichtigte bisher nur `ownerId`, `teamChiefId` und explizite `TeamMemberRole`.

## Scope

- In scope:
  - Support-Kontexte für Teams auch über Kontakt-E-Mail des Teams freischalten.
  - Thread-Erstellung nutzt dieselbe erweiterte Kontextauflösung.
- Out of scope:
  - Neue Rollen.
  - Freie Direktnachrichten.
  - Änderungen am Messaging-Schema.

## Affected Flows

- User/API/admin flows touched:
  - `/api/messages/support-contexts`
  - `/api/messages/conversations`
- Data model impact:
  - none
- Auth/permission impact:
  - Team-Support-Kontext folgt jetzt zusätzlich der bereits vorhandenen Legacy-Team-Zugriffsregel `contactEmail == user.email`.
- Production/deploy impact:
  - App-only deploy, keine Migration.

## Data / API Design

- Proposed data model:
  - unverändert
- Proposed API shape:
  - unverändert
- Backward compatibility:
  - additive Zugriffserweiterung für bestehende Team-Manager-/Kontakt-Mail-Konstellationen.
- Migration/data backfill:
  - none

## Open Questions

- None

## Acceptance Criteria

- User ohne verknüpften Teilnehmer, aber mit Team-Kontakt-E-Mail, bekommt das Team als Support-Kontext.
- User kann damit einen Support-Thread an das Admin-Team starten.
- Bestehende Teilnehmer-, Owner-, TeamChief- und TeamMemberRole-Kontexte bleiben unverändert.

## Implementation Handoff

- Relevant files:
  - `lib/messaging.ts`
  - `app/api/messages/support-contexts/route.ts`
  - `app/api/messages/conversations/route.ts`
- Current decisions:
  - Messaging übernimmt den bestehenden Kontakt-E-Mail-Fallback aus `lib/team-manager-access.ts`.
- Open decisions:
  - none
- Non-goals:
  - keine UI-Änderung
  - keine DB-Änderung
- Expected implementation steps:
  1. `getSupportContextsForUser` um optionale User-Mail erweitern.
  2. Team-Kontextsuche um `contactEmail` case-insensitive ergänzen.
  3. API-Callsites mit `user.email` versorgen.
  4. Checks, Deploy, Smoke.
- Required checks:
  - targeted eslint
  - `npx tsc --noEmit`
  - `npm run build`
  - `npm run smoke:public`
- Risks/assumptions:
  - Kontakt-E-Mail muss mit bestehender Team-Zugriffslogik konsistent bleiben.

## Model / Subagent Plan

- Model switch needed: no
- Target model/role: current S5Evo agent
- Subagent needed: no
- Subagent role:
- Handoff source: this CR plus messaging foundation CR

## Confirmation Gate

- Gate needed: no
- Reason: low-risk app-only hotfix, no schema or production data mutation.
- Approved by: Sebastian
- Approval timestamp: 2026-07-11 16:18 UTC

## Implementation Notes

- Files changed:
  - `lib/messaging.ts`
  - `app/api/messages/support-contexts/route.ts`
  - `app/api/messages/conversations/route.ts`
- Important decisions during implementation:
  - Reuse `normalizeEmail` and case-insensitive Prisma match for `Team.contactEmail`.

## Verification

- Local checks:
  - `pnpm exec eslint lib/messaging.ts app/api/messages/support-contexts/route.ts app/api/messages/conversations/route.ts` gruen
  - `npx tsc --noEmit` gruen
  - `git diff --check` gruen
- Build:
  - `npm run build` gruen
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

- Authenticated Smoke mit Team-Kontaktkonto ohne Teilnehmerzuordnung durchspielen.
