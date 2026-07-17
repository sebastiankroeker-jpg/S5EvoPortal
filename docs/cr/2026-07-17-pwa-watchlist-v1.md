# CR: PWA Watchlist V1

Status: Implemented locally
Date: 2026-07-17
Type: feature
Risk: medium
Owner: S5Evo

## Context

Sebastian moechte Zuschauer:innen und Teilnehmer:innen staerker durch den Wettkampftag fuehren. Aus dem Feature-Brainstorm wurde die Watchlist als emotionaler Kern priorisiert: eigene Lieblingsmannschaften merken, deren Starts schneller finden und Ergebnisse fokussiert verfolgen.

## Scope

- In scope:
  - Lokale Team-Watchlist fuer die PWA/Live-Ansicht.
  - Favoriten als Browser-lokale Team-IDs pro Wettkampf speichern.
  - Favoriten-Segment mit kompaktem Team- und Startlisten-Fokus.
  - Ergebnisliste optional auf Watchlist-Teams filtern.
  - Keine Server-Persistenz und keine neuen APIs.
- Out of scope:
  - Push Notifications.
  - Account-uebergreifende Synchronisierung.
  - Participant-level Watchlist.
  - Public Team Discovery ohne Login/Teamlisten-Berechtigung.
  - Event Map, Live-Ticker, Timeline.

## Affected Flows

- User/API/admin flows touched: Live/PWA-Ansicht, Ergebnisse-Komponente.
- Data model impact: keiner.
- Auth/permission impact: keiner; vorhandene Sichtbarkeit bleibt fuehrend.
- Sensitive data impact: vorhandene Live-Daten enthalten Namen/Teilnehmerbezug je nach Berechtigung; neuer Watchlist-Store speichert nur Team-IDs.
- Offline/cache/export/log/mail impact: neuer `localStorage`-Eintrag fuer Watchlist-IDs; keine Exporte, Logs oder Mails.
- Production/deploy impact: funktionaler Frontend-Code; Production-Deploy erst nach explizitem Go.

## Privacy / Security Review

- Sensitive fields touched: keine neuen sensitiven Felder; vorhandene Live-/Results-Responses werden nur clientseitig gefiltert. Team-IDs koennen personenbeziehbar werden, wenn sie lokal mit sichtbaren Teamdaten verbunden sind.
- Purpose / data minimization: Watchlist speichert ausschliesslich Team-IDs, keine Teamnamen, Teilnehmernamen, Geburtstage, E-Mails, Telefonnummern, Claim-Links oder Rollen.
- Visibility by role/user/API/UI: nur im aktuellen Browserprofil. UI zeigt nur Daten, die die bestehende Live-/Results-Ansicht bereits geladen hat.
- Persistence locations (DB, localStorage/IndexedDB, files, logs, audit, external services): `localStorage` mit Key pro Wettkampf; keine DB, keine Dateien, keine externen Services.
- Offline/cache behavior, TTL/invalidation/logout clearing: lokale Watchlist hat keine TTL; sie enthaelt nur IDs. Nicht mehr vorhandene Teams werden beim Rendern ignoriert. Logout-Clear ist Follow-up, weil bisherige PWA-Offline-Read-Modelle ebenfalls lokal bleiben.
- Logs/mails/exports/screenshots exposure: keine Logs, Mails oder Exporte.
- Negative checks for unauthorized access or payload leakage: kein API-/Serializer-Change; `/api/teams` bleibt fuer unautorisierte Requests geschuetzt. Watchlist erzeugt keine neuen Payloads.
- Authenticated smoke plan or explicit gap: lokaler automatischer Check ohne Session; echter PWA-Smoke mit eingeloggtem Handy bleibt manueller Gap.
- Residual risk: lokale Team-IDs bleiben auf geteilten Geraeten sichtbar, bis Browserdaten geloescht werden. Ein spaeterer Privacy-Audit sollte Logout-/Clear-Verhalten fuer alle PWA-Caches zusammen behandeln.

## Data / API Design

- Proposed data model: `localStorage` Envelope `{ version: 1, storedAt, data: { teamIds: string[] } }`.
- Proposed API shape: keine neue API.
- Backward compatibility: additiv; fehlender/defekter Watchlist-Store ergibt leere Liste.
- Migration/data backfill: keine.

## Open Questions

- Decision 1: Public Watchlist ohne Login braucht spaeter eine bewusst minimierte Public-Team-Discovery oder Ergebnis-basierte Auswahl.
- Decision 2: Logout-/Cache-Clear sollte in einem separaten PWA Privacy Audit gesamthaft geloest werden.

## Acceptance Criteria

- Teams koennen in der Live-Teamliste als Favorit markiert und wieder entfernt werden.
- Favoriten bleiben nach Reload lokal fuer den Wettkampf erhalten.
- Watchlist-Segment zeigt nur gemerkte Teams und deren Starter:innen aus der bestehenden Live-Sicht.
- Ergebnisse koennen auf Watchlist-Teams gefiltert werden.
- Neuer Watchlist-Store persistiert nur Team-IDs.
- Keine API-/DB-/Serializer-Aenderung.

## Implementation Handoff

- Relevant files:
  - `app/components/live-screen.tsx`
  - `app/components/results-view.tsx`
  - `lib/pwa-watchlist.ts`
  - `docs/cr/2026-07-17-pwa-watchlist-v1.md`
- Current decisions:
  - Team-level Watchlist, nicht participant-level.
  - Lokaler Browser-Store, keine Server-Synchronisierung.
  - Minimierter Store mit Team-IDs.
- Open decisions:
  - Public Watchlist-Auswahl ohne Login bleibt spaeterer CR.
  - Globales Logout-/Cache-Clear bleibt spaeterer Privacy-Audit.
- Non-goals:
  - Push, Timeline, Event Map, Live-Ticker.
  - Neue API oder DB-Migration.
- Expected implementation steps:
  - Lokale Watchlist-Helfer anlegen.
  - Live-Teamkarten mit Favoriten-Button erweitern.
  - Watchlist-Segment mit Team-/Start-Fokus ergaenzen.
  - ResultsView um Watchlist-Filter ergaenzen.
  - Checks laufen lassen und CR aktualisieren.
- Required checks:
  - targeted ESLint fuer geaenderte Dateien.
  - `npx tsc --noEmit --incremental false`
  - `git diff --check`
  - `npm run build`
- Privacy/security checks:
  - Watchlist-Store enthaelt nur Team-IDs.
  - Kein `/api/*`-/Serializer-Change.
  - Kein Service-Worker-API-Caching.
- Risks/assumptions:
  - Watchlist ist auf Geraet/Browser begrenzt.
  - Teamlisten-Favorisieren braucht bestehende Berechtigung fuer Teamlisten.
- Context read before implementation:
  - `SESSION_HANDOFF.md` top block: gelesen am 2026-07-17.
  - Relevant prior CR(s): PWA Offline Read Model V1, Privacy Guardrail Methodology.
  - Relevant source files: `live-screen.tsx`, `results-view.tsx`, `team-screen.tsx`, `pwa-offline-cache.ts`.

## Model / Subagent Plan

- Model switch needed: no
- Target model/role: Codex implementation
- Subagent needed: no
- Subagent role:
- Handoff source: this CR

## Confirmation Gate

- Gate needed: yes
- Reason: Frontend feature touches local offline/browser persistence.
- Sensitive-data/production-data reason: new localStorage persistence adjacent to PII-bearing Live-Daten; minimized to Team-IDs only.
- Approved by: Sebastian requested "bitte ... mit den vorgeschlagenen Prios fuer PWA beginnen"
- Approval timestamp: 2026-07-17T13:21:58Z

## Implementation Notes

- Files changed:
  - `lib/pwa-watchlist.ts`
  - `app/components/live-screen.tsx`
  - `app/components/results-view.tsx`
  - `docs/cr/2026-07-17-pwa-watchlist-v1.md`
- Important decisions during implementation:
  - Watchlist uses `s5evo.watchlist.teams.v1.${competitionId}` and stores only normalized Team-IDs.
  - Live team cards get an icon-only star toggle.
  - Watchlist segment reuses already loaded, authorized Live-Daten and renders watched teams plus their start-list grouping.
  - ResultsView accepts `watchlistTeamIds` and can filter existing results client-side without changing `/api/results`.

## Verification

- Local checks:
  - `npx eslint app/components/live-screen.tsx app/components/results-view.tsx lib/pwa-watchlist.ts` -> green
  - `npx tsc --noEmit --incremental false` -> green
  - `git diff --check` -> green
- Build:
  - `npm run build` -> green
- Targeted verification:
  - `npx tsx -e "...writeTeamWatchlist/readTeamWatchlist..."` -> stored envelope contained only `data.teamIds`.
  - `rg "api|_next|SKIP_WAITING" public/sw.js` -> Service Worker still bypasses `/api/` and `/_next/`.
- Sensitive-data negative checks:
  - New Watchlist helper writes only `teamIds`; no `contactEmail`, `contactPhone`, `birthDate`, `participant`, `firstName`, or `lastName` in the targeted store payload.
  - No API route, serializer, DB model, mail, export, log, or service-worker API cache changed.
- Authenticated role smoke:
  - Gap: no live authenticated browser session in agent.
- Manual smoke:
  - Pending Sebastian/device smoke after deploy: mark team, reload PWA, filter results to Watchlist.

## Deploy

- Deployment needed: no, until Sebastian gives explicit deploy Go.
- Deployment ID:
- Deployment URL:
- Production alias:
- Deployed at:

## Post-Deploy Smoke

- Routes checked:
- API checks:
- Sensitive-data/API leakage checks:
- Result:

## Follow-Ups

- Public Watchlist-Auswahl ohne Login konzipieren.
- Logout-/Cache-Clear fuer PWA-Offline-Caches gesamthaft pruefen.
- Live-Ticker, Heute-Zeitplan und Event Map light als Folge-CRs.
- Deploy erst nach explizitem Go.
