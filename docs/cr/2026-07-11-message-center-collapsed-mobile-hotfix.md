# CR: Message Center Collapsed Mobile Hotfix

Status: Deployed
Date: 2026-07-11
Type: hotfix
Risk: low
Owner: S5Evo

## Context

Im mobilen Nachrichtencenter ist das zugeklappte linke Thread-Panel als sehr hohe Rail gerendert. Dadurch steht der Inhalt weit unten und der Thread-Zaehler kippt unpassend vertikal.

## Scope

- In scope: Mobile Darstellung des zugeklappten Thread-Panels im Nachrichtencenter korrigieren.
- Out of scope: Messaging-API, Datenmodell, Thread-Listenlogik, Performance-Pagination.

## Affected Flows

- User/API/admin flows touched: `/nachrichten` UI, zugeklappte Threadliste.
- Data model impact: keiner.
- Auth/permission impact: keiner.
- Production/deploy impact: kleiner Frontend-Hotfix.

## Data / API Design

- Proposed data model: unveraendert.
- Proposed API shape: unveraendert.
- Backward compatibility: vollstaendig kompatibel.
- Migration/data backfill: nicht erforderlich.

## Open Questions

- Keine.

## Acceptance Criteria

- Auf Mobile ist das zugeklappte Panel kompakt und horizontal lesbar.
- Auf Desktop bleibt die schmale Rail-Darstellung erhalten.
- Thread-Zahl wird auf Mobile nicht vertikal gedreht.

## Implementation Handoff

- Relevant files: `app/components/message-center.tsx`
- Current decisions: Mobile nutzt eine kompakte horizontale collapsed row, Desktop weiter die vertikale Rail.
- Open decisions: keine.
- Non-goals: keine fachliche Messaging-Aenderung.
- Expected implementation steps: Tailwind-Klassen fuer collapsed sidebar responsiv trennen.
- Required checks: targeted eslint, `npx tsc --noEmit`, `git diff --check`, build/smoke vor Deploy.
- Risks/assumptions: reine CSS-/Layout-Aenderung mit niedrigem Risiko.

## Model / Subagent Plan

- Model switch needed: no
- Target model/role: current
- Subagent needed: no
- Subagent role: none
- Handoff source: screenshots + current code

## Confirmation Gate

- Gate needed: yes
- Reason: Production deploy.
- Approved by: Sebastian
- Approval timestamp: 2026-07-11 19:35 UTC

## Implementation Notes

- Files changed:
  - `app/components/message-center.tsx`
- Important decisions during implementation:
  - `lg:` Breakpoint trennt Mobile-Row von Desktop-Rail.

## Verification

- Local checks:
  - `pnpm exec eslint app/components/message-center.tsx` gruen
  - `npx tsc --noEmit` gruen
  - `git diff --check` gruen
- Build:
  - `npm run build` gruen
- Targeted verification:
  - Collapsed sidebar CSS trennt Mobile-Row und Desktop-Rail ueber `lg:` Klassen.
- Manual smoke:
  - `npm run smoke:public` gegen Production-Alias gruen
  - `/nachrichten`: 200
  - `/admin`: 200
  - `/api/messages/conversations` ohne Session: 401
  - `/api/messages/unread-count` ohne Session: 401

## Deploy

- Deployment needed: yes
- Deployment ID: `dpl_9kUFoBDKWggk6ugNrS3LCQVMtsiT`
- Deployment URL: `https://s5-evo-portal-rcrh70cfm-sebastiankroeker-2781s-projects.vercel.app`
- Production alias: `https://portal.s5evo.de`
- Deployed at: 2026-07-12 07:34 UTC

## Post-Deploy Smoke

- Routes checked:
  - `/nachrichten`: 200
  - `/admin`: 200
- API checks:
  - `/api/messages/conversations` without session: 401
  - `/api/messages/unread-count` without session: 401
- Result: green

## Follow-Ups

- None
