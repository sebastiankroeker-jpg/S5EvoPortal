# CR: Message Admin Free Targets And Reopen

Status: Implemented
Date: 2026-07-13
Type: feature
Risk: medium
Owner: S5Evo

## Context

Sebastian ergaenzte den Messenger-CR:

- Admins sollen selbst einen Thread mit beliebigen Empfaengern aus den verknuepften Usern erstellen koennen.
- Wenn eine Meldung geschlossen ist, sollen beide Adressaten dennoch antworten koennen.
- Eine Antwort auf eine geschlossene Meldung soll den Thread automatisch wieder auf `offen` setzen.

## Scope

- In scope:
  - Admin-Empfaengerauswahl aus verknuepften Portal-Usern im Messenger.
  - API zum datensparsamen Laden moeglicher Admin-Message-Ziele.
  - Admin-Compose kann ohne vorherigen Thread-Kontext gestartet werden.
  - Antworten auf geschlossene Threads sind fuer berechtigte Teilnehmer:innen und Admins erlaubt.
  - Antwort auf geschlossenen Thread entfernt `closedAt`/`closedById` und setzt Status auf die passende offene Wartestufe.
- Out of scope:
  - Freitext-Empfaenger per E-Mail-Adresse.
  - Nachrichten an nicht verknuepfte User.
  - Datenbankmigration.
  - Volltext-/Server-Pagination fuer sehr grosse User-Mengen.

## Affected Flows

- User/API/admin flows touched:
  - `/nachrichten` Admin-Postfach: neue Nachricht an verknuepften User.
  - `/api/messages/admin-targets`: neue Zielauswahl fuer Admin-Composer.
  - `/api/messages/admin-conversations`: weiterhin Erstellung und serverseitige Validierung.
  - `/api/messages/conversations/[id]/messages`: Antworten auf geschlossene Threads.
- Data model impact:
  - Keiner.
- Auth/permission impact:
  - Admin-Zielauswahl nur fuer `ADMIN`/`MODERATOR`.
  - Antwort bleibt auf bestehende Conversation-Mitglieder beschraenkt.
- Production/deploy impact:
  - API-/Frontend-Deploy noetig; keine Migration.

## Data / API Design

- Proposed data model:
  - Keine Aenderung.
- Proposed API shape:
  - `GET /api/messages/admin-targets`
  - Response:
    - `targets[]`: `userId`, `name`, `teamId`, `participantId`, `label`, `description`
  - Keine E-Mail im Response.
- Backward compatibility:
  - Bestehende Message-Endpunkte bleiben kompatibel.
- Migration/data backfill:
  - Nicht erforderlich.

## Open Questions

- Decision 1:
  - Empfaengerliste ist bewusst auf verknuepfte User im aktuellen Tenant beschraenkt.
- Decision 2:
  - Geschlossene Threads werden beim Antworten automatisch wieder geoeffnet; keine separate Rueckfrage.

## Acceptance Criteria

- Admins koennen im Orga-Postfach einen neuen Thread starten und einen verknuepften User aus einer Auswahl waehlen.
- Die Auswahl zeigt keine E-Mail-Adressen.
- Admin-Thread-Erstellung nutzt weiterhin serverseitige Kontextvalidierung.
- Teilnehmer:innen koennen auf geschlossene Threads antworten.
- Admins koennen auf geschlossene Threads antworten.
- Jede Antwort auf einen geschlossenen Thread setzt den Thread wieder auf offen/wartend und entfernt die Schliessmarkierung.
- Keine DB-Migration.

## Implementation Handoff

- Relevant files:
  - `app/components/message-center.tsx`
  - `app/api/messages/admin-targets/route.ts`
  - `app/api/messages/conversations/[id]/messages/route.ts`
  - `docs/cr/2026-07-13-message-admin-free-targets-and-reopen.md`
  - `SESSION_HANDOFF.md`
- Current decisions:
  - Zielauswahl datensparsam ohne E-Mail.
  - Admin-Compose darf ohne aktiven Thread starten.
  - Geschlossene Threads blockieren keine Antworten mehr.
- Open decisions:
  - Keine.
- Non-goals:
  - Keine freien externen Empfaenger.
  - Keine Server-Drafts.
- Expected implementation steps:
  - Admin-Targets API bauen.
  - Message-Center Admin-Dialog um Empfaengerauswahl erweitern.
  - Geschlossen-Block in Message-Reply-API entfernen und Status-Reopen sicherstellen.
  - CR/Handoff/Checks aktualisieren.
- Required checks:
  - `pnpm exec eslint app/components/message-center.tsx app/api/messages/admin-targets/route.ts app/api/messages/conversations/[id]/messages/route.ts`
  - `npx tsc --noEmit`
  - `git diff --check`
  - `npm run build`
- Risks/assumptions:
  - Empfaengerliste ist fuer aktuelle Tenant-Groesse ausreichend ohne Pagination.

## Model / Subagent Plan

- Model switch needed: no
- Target model/role: current Codex implementation
- Subagent needed: no
- Subagent role: n/a
- Handoff source: this CR + current code

## Confirmation Gate

- Gate needed: no
- Reason: User requested implementation; production deploy still needs explicit Go.
- Approved by: Sebastian request
- Approval timestamp: 2026-07-13 00:22 UTC

## Implementation Notes

- Files changed:
  - `app/api/messages/admin-targets/route.ts`
  - `app/api/messages/conversations/[id]/messages/route.ts`
  - `app/components/message-center.tsx`
  - `docs/cr/2026-07-13-message-admin-free-targets-and-reopen.md`
  - `SESSION_HANDOFF.md`
- Important decisions during implementation:
  - Neue Admin-Targets-API sammelt verknuepfte User aus:
    - Tenant-Rollen im aktuellen Mandanten.
    - verknuepften Teilnehmer:innen.
    - Teamkontakten, Teamchef:innen und Team-Manager:innen.
  - API-Response enthaelt keine E-Mail-Adressen.
  - Orga-Header-Button oeffnet jetzt freie Empfaengerauswahl; aktiver Thread-Kontakt bleibt Vorauswahl.
  - Admin-Dialog nutzt einen nativen Select fuer mobile Robustheit.
  - Teilnehmer:innen werden beim Antworten auf geschlossene Threads nicht mehr mit `409` geblockt.
  - Jede Antwort setzt weiterhin den Status auf `WAITING_FOR_ADMIN` oder `WAITING_FOR_USER` und loescht `closedAt`/`closedById`.

## Verification

- Local checks:
  - `pnpm exec eslint app/components/message-center.tsx app/api/messages/admin-targets/route.ts app/api/messages/conversations/[id]/messages/route.ts` gruen
  - `npx tsc --noEmit` gruen
  - `git diff --check` gruen
- Build:
  - `npm run build` gruen
- Targeted verification:
  - Next.js Build enthaelt neue Route `/api/messages/admin-targets`.
  - Keine Prisma-Migration erzeugt.
- Manual smoke:
  - Nicht lokal im Browser ausgefuehrt.

## Deploy

- Deployment needed: yes
- Deployment ID: `dpl_EUkVf6NsqXbpb1qwbFzPV9F2wey9`
- Deployment URL: `https://s5-evo-portal-hasgiaj0p-sebastiankroeker-2781s-projects.vercel.app`
- Production alias: `https://portal.s5evo.de`
- Deployed at: 2026-07-13 00:34 UTC

## Post-Deploy Smoke

- Routes checked:
  - `https://portal.s5evo.de`: 200
  - `https://portal.s5evo.de/nachrichten`: 200
  - `npm run smoke:public`: gruen
- API checks:
  - `GET /api/messages/conversations` ohne Session: 401
  - `POST /api/messages/admin-conversations` ohne Session: 401
  - `GET /api/messages/admin-targets` ohne Session: 401
- Result: gruen

## Follow-Ups

- Nach Deploy als Admin `/nachrichten` oeffnen:
  - Orga-Postfach Header-Send-Icon oeffnen.
  - Empfaengerauswahl mit verknuepften Usern pruefen.
  - Geschlossenen Thread als Teilnehmer:in beantworten und Reopen pruefen.
  - Geschlossenen Thread als Admin beantworten und Reopen pruefen.
