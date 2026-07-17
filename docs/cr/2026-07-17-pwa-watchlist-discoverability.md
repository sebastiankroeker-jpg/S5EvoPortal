# CR: PWA Watchlist Discoverability

Status: Deployed
Date: 2026-07-17
Type: hotfix
Risk: low
Owner: S5Evo

## Context

Nach dem Watchlist-V1-Deploy fragte Sebastian, ob Admins die Funktion testen koennen, weil kein Stern zum Markieren auffindbar war. Ursache: Der leere Watchlist-Tab erklaert zwar die Funktion, bietet aber keinen direkten Weg zur Teamliste, und die Markierungsaktion ist in der Teamkarte zu klein/leicht zu uebersehen.

## Scope

- In scope:
  - Empty-State im Watchlist-Tab mit Button zur Teamliste.
  - Teamkarten-Markierung sichtbarer machen.
- Out of scope:
  - Neue Watchlist-Datenlogik.
  - Neue APIs, DB-Aenderungen, Rollenlogik, Offline-Store-Aenderungen.

## Privacy / Security Review

- Sensitive fields touched: keine neuen Felder.
- Purpose / data minimization: reine UI-Auffindbarkeit; bestehender Watchlist-Store bleibt unveraendert bei Team-IDs.
- Visibility by role/user/API/UI: keine Aenderung der Sichtbarkeit; vorhandene Teamlisten-Berechtigung bleibt fuehrend.
- Persistence locations: keine neue Persistenz.
- Offline/cache behavior: unveraendert.
- Logs/mails/exports/screenshots exposure: keine.
- Negative checks: kein API-/Serializer-/Service-Worker-Change.
- Authenticated smoke plan or explicit gap: Agent hat keine Admin-Session; manueller Admin-Smoke durch Sebastian bleibt Gap.
- Residual risk: UI-Smoke automatisiert nur begrenzt ohne Browser-Session.

## Implementation Handoff

- Relevant files:
  - `app/components/live-screen.tsx`
  - `docs/cr/2026-07-17-pwa-watchlist-discoverability.md`
- Current decisions:
  - Keine Datenlogik anfassen.
  - Markierungsbutton sichtbar beschriften.
  - Empty-State direkt zur Teamliste fuehren.
- Required checks:
  - targeted ESLint
  - `npx tsc --noEmit --incremental false`
  - `git diff --check`
  - `npm run build`

## Confirmation Gate

- Gate needed: yes for production deploy.
- Reason: Live-PWA-UI hotfix.
- Approved by: Implementation follows Sebastian's live feedback; production deploy approved with "Go".
- Approval timestamp: 2026-07-17T14:41:36Z

## Implementation Notes

- Files changed:
  - `app/components/live-screen.tsx`
  - `docs/cr/2026-07-17-pwa-watchlist-discoverability.md`
- Important decisions during implementation:
  - Empty Watchlist state links directly to the `Teams` segment.
  - Team-card action uses the existing star icon plus `Merken`/`Gemerkt` label on larger screens.
  - No Watchlist storage, API, permission, or serializer behavior changed.

## Verification

- Local checks:
  - `npx eslint app/components/live-screen.tsx` -> green
  - `npx tsc --noEmit --incremental false` -> green
  - `git diff --check` -> green
- Build:
  - `npm run build` -> green
- Sensitive-data negative checks:
  - No API, DB, serializer, service-worker, mail, export, or localStorage schema change.
- Authenticated role smoke:
  - Gap: no Admin browser session in agent.

## Deploy

- Deployment needed: yes, completed.
- Deployment ID: `dpl_4CBXBp2qDaxbdv3uujf2FmXg5mGy`
- Deployment URL: `https://s5-evo-portal-p9d4xss2r-sebastiankroeker-2781s-projects.vercel.app`
- Production alias: `https://portal.s5evo.de`
- Deployed at: 2026-07-17T14:44Z

## Post-Deploy Smoke

- Routes checked:
  - `npm run smoke:public` -> green
  - `HEAD https://portal.s5evo.de` -> 200
  - `HEAD https://portal.s5evo.de/teilnehmer` -> 200
- API checks:
  - `/api/teams?competitionId=...&scope=all` without session -> 401
  - `/api/results?competitionId=cmn3a1piz0002l104372yx9yt` -> 200, structured results
  - Production `sw.js` still bypasses `/api/` and `/_next/`
- Result: Production deploy READY and public smoke green.

## Follow-Ups

- None
