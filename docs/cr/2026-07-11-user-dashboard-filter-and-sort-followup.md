# CR: User Dashboard Filter And Sort Follow-Up

Status: Implemented
Date: 2026-07-11
Type: feature
Risk: low
Owner: S5Evo

## Context

Nach dem Rollout des wiederverwendbaren Dashboard-Control-Strips fiel im Benutzer-Dashboard auf, dass nicht alle Statistik-Pillen als Filter funktionieren, konkret z. B. `Adm.`. Sebastian wollte ausserdem zusaetzliche Filter fuer Mail- und Portal-Verknuepfungsstatus sowie eine aenderbare Sortierung, um `zuletzt aktiv` gezielt nach oben holen zu koennen.

## Scope

- In scope:
  - klickbare Statistik-Pillen fuer relevante Benutzersegmente
  - Filterpanel um Mail- und Portal-Verknuepfungsstatus erweitern
  - Sortierauswahl fuer Ergebnisliste einfuehren
  - Produktionsdeploy, Smoke, Handoff
- Out of scope:
  - Aenderungen an Backend/API oder Datenmodell
  - neue Saved-Layout-Logik fuer das Benutzer-Dashboard

## Affected Flows

- User/API/admin flows touched:
  - Admin Benutzer-Dashboard
- Data model impact: keiner
- Auth/permission impact: keiner
- Production/deploy impact: ja, UI-Follow-up auf Admin-Flaeche

## Data / API Design

- Proposed data model: unveraendert
- Proposed API shape: unveraendert
- Backward compatibility: bestehende User-Liste und Rollenbearbeitung bleiben unveraendert
- Migration/data backfill: nicht erforderlich

## Open Questions

- Portal-Verknuepfungsstatus wird vorerst als fachlich sinnvolle Buckets angeboten:
  - `linked`
  - `portal_account`
  - `invitation_open`
  - `placeholder_user`
  - `needs_attention`

## Acceptance Criteria

- `Admins`, `Moderatoren`, `Teamchef:innen` und `Online` sind im Benutzer-Dashboard als Filter-Pillen klickbar.
- Filterpanel enthaelt sinnvolle Optionen fuer Mail-Status und Portal-Verknuepfungsstatus.
- Ergebnisliste kann nach `zuletzt aktiv` und weiteren sinnvollen Kriterien sortiert werden.
- Standard- und offene/geschlossene Panel-Semantik bleibt konsistent mit dem neuen Dashboard-Control-Strip.

## Implementation Handoff

- Relevant files:
  - `app/components/user-management.tsx`
  - `docs/cr/2026-07-11-user-dashboard-filter-and-sort-followup.md`
- Current decisions:
  - Sortierung wird lokal im Dashboard-State gehalten
  - Mail-Status wird als `mit E-Mail` / `ohne E-Mail` modelliert
  - Portal-Link-Status wird ueber zusammengefasste fachliche Buckets gefiltert
- Open decisions:
  - keine
- Non-goals:
  - keine API-Erweiterung
  - kein Saved-Layout-Modul
- Expected implementation steps:
  - neue Filter-States und Sort-States einfuehren
  - Stats-Pillen klickbar machen
  - Filterpanel und Sortauswahl einbauen
  - Checks, Deploy, Smoke, Handoff
- Required checks:
  - `pnpm exec eslint app/components/user-management.tsx`
  - `npx tsc --noEmit`
  - `npm run build`
  - `npm run smoke:public`
- Risks/assumptions:
  - reine Frontend-Logik; Risiko liegt in UI-/Filterregressionen

## Model / Subagent Plan

- Model switch needed: no
- Target model/role: Codex implementation
- Subagent needed: no
- Subagent role:
- Handoff source: this CR + `SESSION_HANDOFF.md`

## Confirmation Gate

- Gate needed: no
- Reason: expliziter Umsetzungswunsch des Nutzers in Telegram
- Approved by: user request in Telegram
- Approval timestamp: 2026-07-11 12:08 UTC

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

- optional spaeter: dieselbe Sortierlogik auch auf Teilnehmer-/Aenderungs-Dashboard verallgemeinern
