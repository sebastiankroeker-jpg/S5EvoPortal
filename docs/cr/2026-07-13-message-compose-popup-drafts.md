# CR: Message Compose Popup Drafts

Status: Implemented
Date: 2026-07-13
Type: feature
Risk: low
Owner: S5Evo

## Context

Sebastian meldete nach dem Messenger-Filter-Deploy:

- Im Orga-Postfach ist der Button zum Mail verfassen verloren gegangen.
- Auch im persoenlichen Postfach soll `Neue Nachricht` als Popup erscheinen.
- Geschriebene Nachrichten sollen gemerkt werden, falls man zwischenzeitlich woanders hin navigiert.
- Die Loesung soll nicht ressourcenfressend sein.

## Scope

- In scope:
  - Compose-Einstieg in der Threadlisten-Box fuer persoenliches Postfach erhalten.
  - Compose-Einstieg im Orga-Postfach wieder anbieten, wenn ein fachlicher Kontakt aus dem ausgewaehlten Thread bekannt ist.
  - Persoenlichen Composer und Admin-Composer als Dialog/Popup darstellen.
  - Entwuerfe clientseitig in `localStorage` speichern und nach erfolgreichem Versand loeschen.
- Out of scope:
  - Freie Admin-Empfaengersuche im Messenger.
  - Server-seitige Drafts, DB-Aenderungen oder API-Erweiterungen.
  - E-Mail-Versandlogik aendern.

## Affected Flows

- User/API/admin flows touched:
  - `/nachrichten` persoenliches Postfach: neue Nachricht an Orga-Team.
  - `/nachrichten` Orga-Postfach: neue Admin-Nachricht an den fachlichen Kontakt des aktiven Threads.
- Data model impact:
  - Keiner.
- Auth/permission impact:
  - Keine neue Berechtigung; Admin-Compose nutzt weiterhin `/api/messages/admin-conversations`.
- Production/deploy impact:
  - Frontend-only Change, Production-Deploy nach Go.

## Data / API Design

- Proposed data model:
  - Keine Aenderung.
- Proposed API shape:
  - Keine Aenderung.
- Backward compatibility:
  - Bestehende Endpunkte bleiben unveraendert.
- Migration/data backfill:
  - Nicht erforderlich.

## Open Questions

- Decision 1:
  - Admin-Compose ohne Kontext bleibt bewusst nicht als freie Empfaengersuche umgesetzt.
- Decision 2:
  - Drafts bleiben lokal im Browser; das ist ressourcenschonend und vermeidet Serverlast.

## Acceptance Criteria

- In `Mein Postfach` oeffnet der Header-Button den Composer als Popup.
- Im `Orga-Team` Postfach ist ein Compose-Button sichtbar, wenn aus dem aktiven Thread eine Zielperson ableitbar ist.
- Betreff, Kontext und Nachrichtentext im persoenlichen Composer bleiben nach Navigation erhalten.
- Admin-Betreff und Admin-Nachricht bleiben fuer dieselbe Zielperson nach Navigation erhalten.
- Nach erfolgreichem Versand werden die jeweiligen Drafts geloescht.
- Keine API-/DB-Aenderung.

## Implementation Handoff

- Relevant files:
  - `app/components/message-center.tsx`
  - `docs/cr/2026-07-13-message-compose-popup-drafts.md`
  - `SESSION_HANDOFF.md`
- Current decisions:
  - Draft-Persistence per `localStorage`.
  - Popup per bestehender `components/ui/dialog.tsx`.
  - Orga-Button erstellt einen Admin-Compose fuer den Kontakt des aktuell selektierten Threads.
- Open decisions:
  - Keine.
- Non-goals:
  - Keine globale Admin-Empfaengersuche.
  - Keine Server-Drafts.
- Expected implementation steps:
  - Dialog-Komponenten importieren.
  - Compose-Card in Dialog ueberfuehren.
  - Header-Button fuer Admin-Kontext ergaenzen.
  - Draft-Effekte fuer persoenlichen und Admin-Composer ergaenzen.
  - Checks ausfuehren.
- Required checks:
  - `pnpm exec eslint app/components/message-center.tsx`
  - `npx tsc --noEmit`
  - `git diff --check`
  - `npm run build`
- Risks/assumptions:
  - Lokale Drafts sind browser-/geraetebezogen und nicht konto-uebergreifend.

## Model / Subagent Plan

- Model switch needed: no
- Target model/role: current Codex implementation
- Subagent needed: no
- Subagent role: n/a
- Handoff source: this CR + `SESSION_HANDOFF.md`

## Confirmation Gate

- Gate needed: no
- Reason: User asked for implementation; production deploy will still require separate Go.
- Approved by: Sebastian request
- Approval timestamp: 2026-07-13 00:08 UTC

## Implementation Notes

- Files changed:
  - `app/components/message-center.tsx`
  - `docs/cr/2026-07-13-message-compose-popup-drafts.md`
  - `SESSION_HANDOFF.md`
- Important decisions during implementation:
  - Der persoenliche Composer und der Admin-Composer rendern jetzt als Dialoge statt als Karte am Seitenende.
  - Der persoenliche Header-Button oeffnet den Orga-Composer direkt als Popup.
  - Der Orga-Header-Button oeffnet einen Admin-Composer fuer den fachlichen Kontakt des aktuell selektierten Threads.
  - Entwuerfe werden in `localStorage` gespeichert:
    - `s5evo.messages.composeDraft.v1` fuer persoenliche Nachrichten.
    - `s5evo.messages.adminComposeDrafts.v1` pro Admin-Zielperson/Kontext.
  - `Abbrechen` schliesst nur den Dialog; der Entwurf bleibt lokal erhalten.
  - Erfolgreicher Versand loescht den passenden lokalen Entwurf.

## Verification

- Local checks:
  - `pnpm exec eslint app/components/message-center.tsx` gruen
  - `npx tsc --noEmit` gruen
  - `git diff --check` gruen
- Build:
  - `npm run build` gruen
- Targeted verification:
  - Keine API-/DB-Aenderung; Compose-Drafts bleiben im Browser.
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
  - Im Orga-Postfach aktiven Thread waehlen und Header-Send-Icon pruefen.
  - Im persoenlichen Postfach Header-Send-Icon pruefen.
  - Entwurf schreiben, weg navigieren/zurueckkommen, Draft-Persistenz pruefen.
