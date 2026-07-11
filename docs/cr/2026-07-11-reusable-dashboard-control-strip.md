# CR: Reusable Dashboard Control Strip

Status: Implemented
Date: 2026-07-11
Type: feature
Risk: medium
Owner: S5Evo

## Context

Das Mannschafts-Dashboard hat inzwischen ein klares Control-Strip-Muster mit Suche, Statistik, Toolbar-Icons und aufklappbaren Panels. Sebastian wollte dasselbe Prinzip auch fuer Benutzer-, Teilnehmer- und Aenderungs-Dashboard nutzen. Gleichzeitig sollen Copy-Paste-Drift und inkonsistente Open/Closed-States vermieden werden.

## Scope

- In scope:
  - kleine wiederverwendbare Dashboard-Control-Bausteine einfuehren
  - Teilnehmer-, Aenderungs- und Benutzer-Dashboard auf das gemeinsame Muster angleichen
  - pro Dashboard nur die fachlich relevanten Attribute/Filter anzeigen
  - Rollout ohne API-/DB-Aenderungen
- Out of scope:
  - komplette fachliche Vereinheitlichung aller Dashboard-Filterzustände
  - Saved Layouts ausserhalb des Mannschafts-Dashboards
  - grosses visuelles Rebranding einzelner Listen-/Karteninhalte

## Affected Flows

- User/API/admin flows touched:
  - Admin Teilnehmer-Dashboard
  - Admin Aenderungs-Dashboard
  - Admin Benutzer-Dashboard
- Data model impact: keiner
- Auth/permission impact: keiner
- Production/deploy impact: ja, UI-Rollout auf bestehende Admin-Flaechen

## Data / API Design

- Proposed data model: unveraendert
- Proposed API shape: unveraendert
- Backward compatibility: bestehende Dashboard-Fachlogik bleibt erhalten
- Migration/data backfill: nicht erforderlich

## Open Questions

- Benutzer-Dashboard bekommt vorerst nur ein Filterpanel und keine Layout-/Quickfilter-Panels.
- Saved Layouts bleiben vorerst Mannschafts-Dashboard-spezifisch.

## Acceptance Criteria

- Teilnehmer-, Aenderungs- und Benutzer-Dashboard zeigen ein konsistentes Control-Strip-Muster.
- Mobile Reihenfolge ist `Suche -> Stats -> Toolbar -> Panels`.
- Panel-Icons sind nur im offenen Zustand aktiv eingefaerbt; geschlossene Panels zeigen Aktivitaet ueber Badge/Zahl.
- Die Fachlogik der jeweiligen Filter bleibt unveraendert.
- Es gibt wiederverwendbare gemeinsame UI-Bausteine statt reinem Copy-Paste.

## Implementation Handoff

Use before model switch or subagent delegation.

- Relevant files:
  - `app/components/participant-list.tsx`
  - `app/components/approval-queue.tsx`
  - `app/components/user-management.tsx`
  - neuer Shared-UI-Baustein unter `app/components/`
- Current decisions:
  - keine Monster-Abstraktion; nur kleine gemeinsame Control-Bausteine
  - fachliche Filter-States bleiben pro Dashboard lokal
  - Rollout erfolgt direkt auf Teilnehmer, Aenderungen und Benutzer
- Open decisions:
  - ob spaeter Saved Layouts oder Quickfilter als generische Module folgen sollen
- Non-goals:
  - keine API-Neuschnitte
  - keine globale Dashboard-State-Engine
- Expected implementation steps:
  - Shared-Control-Komponenten erstellen
  - Teilnehmer- und Aenderungs-Dashboard auf gemeinsamen Strip umstellen
  - Benutzer-Dashboard auf Such-/Stats-/Toolbar-/Filterpanel-Muster anheben
  - Checks, Deploy, Smoke, Handoff
- Required checks:
  - `pnpm exec eslint app/components/participant-list.tsx app/components/approval-queue.tsx app/components/user-management.tsx`
  - `npx tsc --noEmit`
  - `npm run build`
  - `npm run smoke:public`
- Risks/assumptions:
  - Risiko liegt eher in UI-Regressions als in Daten-/API-Themen

## Model / Subagent Plan

- Model switch needed: no
- Target model/role: Codex implementation
- Subagent needed: no
- Subagent role:
- Handoff source: this CR + `SESSION_HANDOFF.md`

## Confirmation Gate

- Gate needed: no
- Reason: expliziter Umsetzungsauftrag des Nutzers in Telegram
- Approved by: user request in Telegram
- Approval timestamp: 2026-07-11 11:45 UTC

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

- optional spaeter: Saved-Layout-/Quickfilter-Module weiter generalisieren
