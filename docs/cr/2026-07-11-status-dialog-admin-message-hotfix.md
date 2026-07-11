# CR: Status Dialog Admin Message Hotfix

Status: Deployed
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
  - `app/components/account-link-status-dialog.tsx`
  - `app/components/dashboard.tsx`
  - `app/components/message-center.tsx`
  - `app/api/messages/admin-conversations/route.ts`
  - `lib/admin-routing.ts`
- Important decisions during implementation:
  - Die hellen Zielkacheln wurden durch semantische, dark-mode-faehige Farbklassen ersetzt.
  - `Nachricht schreiben` erscheint nur fuer Admin-UI-Kontexte und nur bei vorhandener Portal-User-ID.
  - Admin-started Threads verwenden weiterhin `SUPPORT`, setzen initial `WAITING_FOR_USER` und benachrichtigen die Zielperson ohne Nachrichtentext per Mail.
  - Der neue Endpoint validiert Admin/Moderator, Tenant und optionalen Team-/Teilnehmerkontext vor Conversation-Erstellung.

## Verification

- Local checks:
  - `pnpm exec eslint app/components/account-link-status-dialog.tsx app/components/dashboard.tsx app/components/message-center.tsx app/api/messages/admin-conversations/route.ts lib/admin-routing.ts` gruen
  - `npx tsc --noEmit` gruen
  - `git diff --check` gruen
- Build:
  - `npm run build` gruen
- Targeted verification:
  - Vercel build listet `/api/messages/admin-conversations` und `/nachrichten`.
- Manual smoke:
  - `/nachrichten`: 200
  - `/api/messages/admin-conversations` ohne Session: 401
  - `/admin`: 200
  - `/sportlerboerse-dashboard`: 200

## Deploy

- Deployment needed: yes
- Deployment ID: `dpl_AGj5R1cCRYrJcVD6yp6Zy5UX134w`
- Deployment URL: `https://s5-evo-portal-ces016epu-sebastiankroeker-2781s-projects.vercel.app`
- Production alias: `https://portal.s5evo.de`
- Deployed at: 2026-07-11 17:30 UTC

## Post-Deploy Smoke

- Routes checked:
  - `/`
  - `/login`
  - `/anmeldung`
  - `/aenderungen`
  - `/nachrichten`
  - `/admin`
  - `/sportlerboerse-dashboard`
- API checks:
  - `/api/competition`: 200
  - `/api/results`: 200
  - `/api/teams` ohne Session: 401
  - `/api/admin/pending-changes` ohne Session: 401
  - `POST /api/messages/admin-conversations` ohne Session: 401
- Result:
  - Gruen.

## Follow-Ups

- None
