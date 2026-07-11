# CR: Status Dialog Admin Message Hotfix

Status: Draft
Date: 2026-07-11
Type: hotfix
Risk: low
Owner: S5Evo

## Context

Im Statusdialog fuer Teilnehmer oder Owner ist der Kontrast einzelner Ziel-Kacheln im dunklen Theme unzureichend. Zusaetzlich soll ein Admin aus diesem Kontext heraus direkt eine Portal-Nachricht an die betroffene Person starten koennen.

## Scope

- In scope:
  - Theme-faehige Kontrastklassen fuer Statusdialog-Zielzeilen.
  - Admin-Compose-Einstieg aus Teilnehmer-/Owner-Statusdialog.
  - Geschuetzte API fuer Admin/Moderator-started Support-Threads an einen konkreten Portal-User.
- Out of scope:
  - Allgemeine Direktnachrichten zwischen allen Benutzern.
  - Neue Conversation-Typen oder Schema-Aenderungen.
  - Attachments, Realtime oder E2EE.

## Affected Flows

- User/API/admin flows touched:
  - Mannschafts-Dashboard Statusdialog.
  - Nachrichtencenter Admin-Inbox.
  - Messaging API fuer Admin-started Support-Threads.
- Data model impact:
  - Keine Schema-Aenderung.
- Auth/permission impact:
  - Neuer Startpfad nur fuer Admin/Moderator mit Tenant-Rolle.
  - Zielperson muss zum Tenant oder konkreten Team-/Teilnehmerkontext gehoeren.
- Production/deploy impact:
  - Frontend/API-Hotfix, normaler Vercel-Deploy.

## Data / API Design

- Proposed data model:
  - Weiterverwendung von `Conversation`, `ConversationParticipant`, `Message`.
- Proposed API shape:
  - `POST /api/messages/admin-conversations` mit `targetUserId`, optional `teamId`, `participantId`, `subject`, `body`.
- Backward compatibility:
  - Bestehende Teilnehmer->Admin Support-Threads bleiben unveraendert.
- Migration/data backfill:
  - Keine.

## Open Questions

- Decision 1: Admin-started Threads nutzen weiterhin `SUPPORT` und Status `WAITING_FOR_USER`.
- Decision 2: Der Einstieg oeffnet das Nachrichtencenter mit vorausgewaehlter Zielperson statt im kleinen Statusdialog einen Editor zu erzwingen.

## Acceptance Criteria

- Statusdialog-Zeilen fuer User/Claim sind in Light und Dark Theme lesbar.
- Bei verknuepfter Portalperson sieht Admin eine Aktion `Nachricht schreiben`.
- Nachrichtencenter zeigt Admin-Compose fuer die Zielperson und erstellt einen Support-Thread.
- Nicht-Admins koennen den Admin-Create-Endpunkt nicht nutzen.

## Implementation Handoff

- Relevant files:
  - `app/components/account-link-status-dialog.tsx`
  - `app/components/dashboard.tsx`
  - `app/components/message-center.tsx`
  - `app/api/messages/admin-conversations/route.ts`
  - `lib/admin-routing.ts`
- Current decisions:
  - Keine Migration.
  - Nur Admin/Moderator-started Support-Thread.
- Open decisions:
  - Keine.
- Non-goals:
  - Keine allgemeine Direktnachrichten-Freischaltung.
- Expected implementation steps:
  - Dialog-Kontrastklassen korrigieren.
  - Routing-Helfer fuer Admin-Message-Ziel ergaenzen.
  - Admin-Compose im Nachrichtencenter aus Queryparametern anzeigen.
  - API-Route mit Tenant-/Kontextvalidierung implementieren.
- Required checks:
  - Targeted eslint.
  - `npx tsc --noEmit`
  - `npm run build`
  - `npm run smoke:public` nach Deploy.
- Risks/assumptions:
  - Zielperson muss ein Portal-User sein; reine E-Mail ohne User kann nicht im Portal angeschrieben werden.

## Model / Subagent Plan

- Model switch needed: no
- Target model/role: current Codex
- Subagent needed: no
- Subagent role: n/a
- Handoff source: `SESSION_HANDOFF.md`

## Confirmation Gate

- Gate needed: no
- Reason: User requested direct implementation of a low-risk hotfix.
- Approved by: Sebastian
- Approval timestamp: 2026-07-11

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

- None
