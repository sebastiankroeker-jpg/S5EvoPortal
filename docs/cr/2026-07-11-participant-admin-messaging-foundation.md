# CR: Participant/Admin Messaging Foundation

Status: Deployed
Date: 2026-07-11
Type: schema
Risk: medium
Owner: S5Evo

## Context

Teilnehmer:innen sollen im Portal Nachrichten mit dem Admin-Team austauschen können. Perspektivisch sollen Benutzer:innen je nach Rollen, Sichtbarkeit und persönlichen Einstellungen auch untereinander oder in Gruppen schreiben können.

Die bestehende Plattform hat bereits Portal-Konten, Teilnehmer-/Team-Verknüpfungen, Rollen, Mailversand, Audit-Events und Dashboard-Control-Muster. Es gibt aber noch kein dauerhaftes Conversation-/Message-Modell. Ein reines Kontaktformular oder spezielle `ParticipantMessage`-Tabellen würden den späteren Ausbau zu Team-, Gruppen- oder Direktnachrichten unnötig erschweren.

## Scope

- In scope:
  - Generische Messaging-Grundlage für spätere Support-, Team-, Direkt- und Gruppenunterhaltungen.
  - MVP-Use-Case `SUPPORT`: Teilnehmer:in oder Teamchef:in schreibt an das Admin-/Moderationsteam; Admin/Moderator kann antworten.
  - DB-Modelle für Conversations, Conversation-Teilnehmer und Messages.
  - Crypto-ready Message-Struktur, ohne im MVP echte Verschlüsselung zu implementieren.
  - API für Thread-Liste, Thread-Details, Thread-Erstellung, Antwort senden und Read-State.
  - Admin-Inbox mit Status-/Unread-Filter.
  - Portal-/Teilnehmer-Entry-Point "Admin kontaktieren" bzw. "Nachrichten".
  - Mail-Benachrichtigung ohne Nachrichtentext: "Neue Nachricht im Portal".
- Out of scope:
  - Freier Benutzer-zu-Benutzer-Chat.
  - Anhänge.
  - Echtzeit-Websocket/SSE.
  - Ende-zu-Ende-Verschlüsselung.
  - Volltextsuche über Nachrichtentexte.
  - Öffentliche Benutzerverzeichnisse.
  - Moderationsfunktionen wie Melden, Blockieren, Stummschalten.

## Affected Flows

- User/API/admin flows touched:
  - Teilnehmer-/Teamchef-Portal bekommt einen Support-Thread-Einstieg.
  - Admin-/Moderator-Bereich bekommt eine Messaging-Inbox.
  - Mail-Benachrichtigung nutzt bestehende Resend-Infrastruktur.
- Data model impact:
  - Neue Prisma-Enums und Tabellen für Conversations, Participants, Messages und optional Delivery/Audit-Metadaten.
  - Migration erforderlich.
- Auth/permission impact:
  - User sieht nur Conversations, in denen er Mitglied ist.
  - Admin/Moderator sieht Support-Conversations des aktuellen Tenants/Wettkampfs.
  - Teilnehmer:innen dürfen Support-Threads nur für eigene verknüpfte Teilnehmer/Teams starten.
  - Teamchef:innen dürfen Support-Threads für eigene Teams starten.
- Production/deploy impact:
  - Schema-Migration plus App-Deploy.
  - Nach Deploy: Migration ausführen, danach Smoke für Admin, Teilnehmer und relevante APIs.

## Data / API Design

- Proposed data model:
  - `Conversation`
    - `id`
    - `type`: `SUPPORT`, später `TEAM`, `DIRECT`, `GROUP`, `SYSTEM`
    - `status`: `OPEN`, `WAITING_FOR_ADMIN`, `WAITING_FOR_USER`, `CLOSED`
    - `subject`
    - `tenantId`
    - `competitionId?`
    - `teamId?`
    - `participantId?`
    - `createdById`
    - `lastMessageAt?`
    - `closedAt?`, `closedById?`
    - `createdAt`, `updatedAt`, `deletedAt?`
  - `ConversationParticipant`
    - `conversationId`
    - `userId`
    - `role`: `OWNER`, `MEMBER`, `ADMIN`, `MODERATOR`, `READ_ONLY`
    - `lastReadAt?`
    - `mutedAt?` for later
    - `joinedAt`, `leftAt?`
  - `Message`
    - `conversationId`
    - `senderId`
    - `contentFormat`: `PLAIN`, later `ENCRYPTED`
    - `body`
    - `bodyCiphertext?`
    - `bodyPreview?`
    - `encryptionVersion?`
    - `keyId?`
    - `createdAt`, `editedAt?`, `deletedAt?`
  - Optional later: `MessageDelivery` for per-recipient email/push status.
- Proposed API shape:
  - `GET /api/messages/conversations`
  - `POST /api/messages/conversations`
  - `GET /api/messages/conversations/:id`
  - `POST /api/messages/conversations/:id/messages`
  - `POST /api/messages/conversations/:id/read`
  - `PATCH /api/messages/conversations/:id` for status close/reopen.
- Backward compatibility:
  - New tables only; no existing data shape changes.
  - Existing participant/team/admin flows bleiben unverändert.
- Migration/data backfill:
  - Keine Backfill-Pflicht.
  - Existing marketplace/admin messages bleiben historisch in bisherigen Feldern/Audit-Events.

## Open Questions

- Decision 1: Wo soll der erste Teilnehmer-Einstieg sitzen?
  - Vorschlag: Teilnehmer-Dashboard plus Team-/Teilnehmer-Detailkontext mit "Admin kontaktieren".
- Decision 2: Welche Admin-Rollen dürfen antworten?
  - Vorschlag: `ADMIN` und `MODERATOR`.
- Decision 3: Welche Mail-Empfänger bekommen Admin-Hinweise?
  - Vorschlag: bestehende `registrationNotificationEmail` / Tenant-Kontaktlogik wiederverwenden.
- Decision 4: Soll der MVP einen globalen "Nachrichten"-Nav-Eintrag bekommen?
  - Vorschlag: ja, aber nur sichtbar mit ungelesenen/zugänglichen Conversations; Admin-Inbox zusätzlich im Admin-Bereich.

## Acceptance Criteria

- Teilnehmer:in oder Teamchef:in kann im Portal einen Support-Thread an das Admin-Team eröffnen.
- Admin/Moderator sieht neue Support-Threads in einer Inbox und kann antworten.
- Teilnehmer:in/Teamchef:in sieht Antwort im eigenen Nachrichtenbereich.
- Conversations zeigen Status, letzte Nachricht, ungelesene Zähler und Kontext Team/Teilnehmer, soweit vorhanden.
- Geschlossene Threads sind lesbar, aber nicht versehentlich weiter beschreibbar oder müssen bewusst wieder geöffnet werden.
- Mail-Benachrichtigungen enthalten keinen Nachrichtentext, sondern nur Hinweis und Portal-Link.
- API blockiert Zugriff auf fremde Conversations.
- Datenmodell bleibt gruppenchatfähig über mehrere `ConversationParticipant`-Einträge.
- Message-Struktur ist crypto-ready, ohne MVP-Verschlüsselung zu versprechen.

## Implementation Handoff

- Relevant files:
  - `prisma/schema.prisma`
  - `app/api/messages/**`
  - `app/api/admin/**` or shared admin API helpers
  - `app/components/dashboard-controls.tsx`
  - `app/components/participant-list.tsx`
  - `app/components/team-screen.tsx`
  - `app/admin/page.tsx`
  - `lib/server-permissions.ts`
  - `lib/mail/**`
  - `SESSION_HANDOFF.md`
- Current decisions:
  - Build generic conversation model; enable only support conversations in MVP.
  - No free direct/user chat in this CR.
  - No attachments and no real-time transport.
  - Notifications do not include message body.
  - Keep content model crypto-ready.
- Open decisions:
  - Final placement of non-admin user inbox.
  - Whether admin inbox is a new route or admin tab.
  - Exact subject/context defaults for participant vs team messages.
- Non-goals:
  - E2EE, attachments, full chat presence, public directory, moderation suite.
- Expected implementation steps:
  1. Add Prisma schema/enums and migration.
  2. Add permission helpers for conversation visibility and support-thread creation.
  3. Add message/conversation API routes.
  4. Add minimal UI components for thread list/detail/reply.
  5. Wire admin inbox and participant/team entry point.
  6. Add mail notification helper without body text.
  7. Run schema, type, lint, build and targeted API checks.
  8. Deploy, run migration, smoke production routes and APIs.
- Required checks:
  - `npx prisma generate`
  - `npx tsc --noEmit`
  - targeted eslint for changed files
  - `npm run build`
  - targeted API checks for unauthorized, participant-owned and admin paths
  - `npm run smoke:public` after deploy
- Risks/assumptions:
  - Auth boundaries must be tested carefully; private messages must not leak across teams/participants.
  - Schema migration touches production DB and needs explicit deploy/migration sequencing.
  - Mail notification must not expose message content.
  - UI scope can grow quickly; keep MVP narrow.

## Model / Subagent Plan

- Model switch needed: no
- Target model/role: current S5Evo agent
- Subagent needed: optional
- Subagent role: optional review after first implementation diff
- Handoff source: this CR plus `SESSION_HANDOFF.md`

## Confirmation Gate

- Gate needed: yes
- Reason: Schema migration, auth-sensitive messaging APIs, production deploy and possible mail notifications.
- Approved by: Sebastian ("kannst du direkt los legen")
- Approval timestamp: 2026-07-11 12:52 UTC

## Implementation Notes

- Files changed:
  - `prisma/schema.prisma`
  - `prisma/migrations/20260711125500_add_messaging_foundation/migration.sql`
  - `lib/messaging.ts`
  - `lib/mail/message-notification.ts`
  - `app/api/messages/conversations/route.ts`
  - `app/api/messages/conversations/[id]/route.ts`
  - `app/api/messages/conversations/[id]/messages/route.ts`
  - `app/api/messages/conversations/[id]/read/route.ts`
  - `app/api/messages/support-contexts/route.ts`
  - `app/components/message-center.tsx`
  - `app/nachrichten/page.tsx`
  - `app/components/nav-bar.tsx`
  - `app/profile/page.tsx`
- Important decisions during implementation:
  - MVP uses a standalone `/nachrichten` route instead of expanding the existing admin page monolith.
  - Admin visibility is tenant-role based for `ADMIN`/`MODERATOR`; conversation participants are still created for current admins/moderators for read-state and future group-chat semantics.
  - User support-thread creation is limited to linked participants and owned/managed teams.
  - Message notifications deliberately omit message body and link back to `/nachrichten`.
  - Message schema is crypto-ready with `contentFormat`, `bodyCiphertext`, `bodyPreview`, `encryptionVersion` and `keyId`, but MVP stores plaintext body.

## Verification

- Local checks:
  - `npx prisma generate` gruen
  - `npx prisma validate` gruen
  - `pnpm exec eslint app/components/message-center.tsx app/nachrichten/page.tsx app/components/nav-bar.tsx app/profile/page.tsx app/api/messages/conversations/route.ts app/api/messages/conversations/[id]/route.ts app/api/messages/conversations/[id]/messages/route.ts app/api/messages/conversations/[id]/read/route.ts app/api/messages/support-contexts/route.ts lib/messaging.ts lib/mail/message-notification.ts` gruen
  - `npx tsc --noEmit` gruen
  - `git diff --check` gruen
- Build:
  - `npm run build` gruen
- Targeted verification:
  - `/nachrichten` gegen Production-Alias: 200
  - `/api/messages/conversations` ohne Session: 401
  - `/api/messages/support-contexts` ohne Session: 401
- Manual smoke:
  - `npm run smoke:public` gegen Production-Alias gruen

## Deploy

- Deployment needed: yes
- Deployment ID: `dpl_bfLFtFkkNZc57p9Rk7H2vSq6dwUb`
- Deployment URL: `https://s5-evo-portal-2cmr1k3vr-sebastiankroeker-2781s-projects.vercel.app`
- Production alias: `https://portal.s5evo.de`
- Deployed at: 2026-07-11 13:07 UTC
- Migration: `npx prisma migrate deploy` applied `20260711125500_add_messaging_foundation`

## Post-Deploy Smoke

- Routes checked:
  - `/nachrichten`: 200
  - standard public smoke routes via `npm run smoke:public`: gruen
- API checks:
  - `/api/messages/conversations` without session: 401
  - `/api/messages/support-contexts` without session: 401
- Result: gruen

## Follow-Ups

- Direct messages with per-user privacy settings.
- Team/group conversations.
- Attachments.
- Moderation controls: melden, stummschalten, blockieren.
- Optional server-side envelope encryption.
- Optional E2EE feasibility spike.
