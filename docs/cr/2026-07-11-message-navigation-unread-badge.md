# CR: Message Navigation Unread Badge

Status: Implemented locally
Date: 2026-07-11
Type: hotfix
Risk: low
Owner: S5Evo

## Context

Die neue Nachrichtenfunktion ist aktuell nur über das Profil-/Konto-Menü auffindbar. Zusätzlich soll sie über das Lupen-Menü erreichbar sein. Am Profil-/Konto-Icon soll ein roter Badge die Anzahl ungelesener Nachrichten anzeigen.

## Scope

- In scope:
  - `Nachrichten` als Menüpunkt in der globalen Suche/Lupe.
  - Unread-Count-API für Nachrichten.
  - Roter Badge am Profil-/Konto-Icon bei ungelesenen Nachrichten.
  - Badge im mobilen Konto-Menü neben `Nachrichten`.
- Out of scope:
  - Push Notifications.
  - Echtzeit-Websocket.
  - Bottom-Tab-Bar-Erweiterung.
  - Authenticated Browser-Smoke mit echtem Testkonto.

## Affected Flows

- User/API/admin flows touched:
  - Navigation / Konto-Menü
  - Search Overlay / Lupen-Menü
  - `/api/messages/unread-count`
- Data model impact:
  - none
- Auth/permission impact:
  - Unread count basiert nur auf eigenen `ConversationParticipant`-Mitgliedschaften.
- Production/deploy impact:
  - App-only deploy, keine Migration.

## Data / API Design

- Proposed data model:
  - unverändert
- Proposed API shape:
  - `GET /api/messages/unread-count` returns `{ unreadCount }`
- Backward compatibility:
  - additive navigation-only change
- Migration/data backfill:
  - none

## Open Questions

- None

## Acceptance Criteria

- Lupen-Suche findet `Nachrichten` über Begriffe wie `nachrichten`, `postfach`, `brief`, `support`, `admin kontaktieren`.
- Klick auf das Suchergebnis öffnet `/nachrichten`.
- Profil-/Konto-Icon zeigt bei `unreadCount > 0` einen roten Badge.
- Mobiles Konto-Menü zeigt die Anzahl neben `Nachrichten`.
- Unauthenticated request auf `/api/messages/unread-count` gibt 401 zurück.

## Implementation Handoff

- Relevant files:
  - `app/components/nav-bar.tsx`
  - `app/components/search-overlay.tsx`
  - `lib/navigation-menu.ts`
  - `lib/messaging.ts`
  - `app/api/messages/unread-count/route.ts`
- Current decisions:
  - Badge pollt alle 60 Sekunden und zusätzlich bei Window-Focus.
  - Kein Echtzeit-Mechanismus im Hotfix.
- Open decisions:
  - none
- Non-goals:
  - keine UI-Umstrukturierung
  - kein Push/E-Mail
- Expected implementation steps:
  1. Unread-Count-Helper ergänzen.
  2. API-Route ergänzen.
  3. NavBar-Badge ergänzen.
  4. `Nachrichten` in Navigation-Menü registrieren.
  5. SearchOverlay-Routing ergänzen.
  6. Checks, Deploy, Smoke.
- Required checks:
  - targeted eslint
  - `npx tsc --noEmit`
  - `npm run build`
  - `npm run smoke:public`
- Risks/assumptions:
  - Authenticated Count kann lokal ohne Session-Cookie nicht vollständig produktiv gesmoket werden.

## Model / Subagent Plan

- Model switch needed: no
- Target model/role: current S5Evo agent
- Subagent needed: no
- Subagent role:
- Handoff source: this CR plus `SESSION_HANDOFF.md`

## Confirmation Gate

- Gate needed: no
- Reason: low-risk app-only navigation hotfix, no schema or production data mutation.
- Approved by: Sebastian
- Approval timestamp: 2026-07-11 16:46 UTC

## Implementation Notes

- Files changed:
  - `app/components/nav-bar.tsx`
  - `app/components/search-overlay.tsx`
  - `lib/navigation-menu.ts`
  - `lib/messaging.ts`
  - `app/api/messages/unread-count/route.ts`
- Important decisions during implementation:
  - Count is per `ConversationParticipant`; admin global support visibility without participant membership is not counted until the admin is a participant, consistent with current read-state model.

## Verification

- Local checks:
  - `pnpm exec eslint app/components/nav-bar.tsx app/components/search-overlay.tsx lib/navigation-menu.ts lib/messaging.ts app/api/messages/unread-count/route.ts` gruen
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

- Optional: Bottom-Tab `Nachrichten` nur anzeigen, wenn ungelesene Nachrichten existieren oder Messaging stärker genutzt wird.
- Optional: Count auch für neue Admins ohne ConversationParticipant über tenantweiten Support-Query erweitern.
