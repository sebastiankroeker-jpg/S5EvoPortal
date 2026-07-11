# CR: MD Stats Row And Filter Icon State

Status: Implemented
Date: 2026-07-11
Type: hotfix
Risk: low
Owner: S5Evo

## Context

Sebastian meldete nach dem Deploy des kombinierbaren Klassenpillen-Follow-ups zwei UI-Abweichungen im Mannschafts-Dashboard: Die Trefferstatistik sitzt weiterhin unterhalb der Icon-Leiste statt zwischen Suchfeld und Panel-Icons, und das Filter-Icon verwendet im zugeklappten Zustand noch das geoeffnete Farbschema.

## Scope

- In scope:
  - Reihenfolge im MD-Control-Strip auf `Suchfeld -> Trefferstatistik -> Panel-Icons` korrigieren.
  - Filter-Icon im zugeklappten Zustand wieder mit geschlossenem Farbschema rendern.
  - Produktionsdeploy inklusive Smoke und Handoff-Nachtrag.
- Out of scope:
  - Filterlogik, Datenmodell, API oder Auth aendern.
  - Weitere visuelle Redesigns ausserhalb dieser beiden Hotfix-Punkte.

## Affected Flows

- User/API/admin flows touched: Mannschafts-Dashboard Control Strip und Filter-Toolbar.
- Data model impact: keiner.
- Auth/permission impact: keiner.
- Production/deploy impact: Build/Deploy nach Hotfix-Implementierung.

## Data / API Design

- Proposed data model: kein Datenmodellwechsel.
- Proposed API shape: keine API-Aenderung.
- Backward compatibility: unveraendert, da nur Rendering-/Styling-Fix.
- Migration/data backfill: nicht erforderlich.

## Open Questions

- Keine.

## Acceptance Criteria

- Trefferstatistik steht im MD zwischen Suchfeld und Panel-Icons.
- Trefferstatistik bleibt weiterhin sichtbar, wenn das Filterpanel offen ist.
- Filter-Icon nutzt nur im aufgeklappten Zustand das aktive Farbschema.
- Aktive Filter bleiben weiterhin ueber Badge/Counter erkennbar.

## Implementation Handoff

- Relevant files:
  - `app/components/dashboard.tsx`
- Current decisions:
  - Trefferstatistik bleibt eine eigenstaendige Zeile direkt unter dem Suchfeld.
  - Aktive Filter werden bei geschlossenem Panel ueber Counter-Badge statt ueber aktive Button-Flaeche signalisiert.
- Open decisions:
  - Keine.
- Non-goals:
  - Kein weiterer UX-Umbau im Layout.
- Expected implementation steps:
  - Reihenfolge der Control-Strip-Elemente korrigieren.
  - Filter-Button-Variant an offenen Zustand binden.
  - Checks laufen lassen, deployen, Handoff aktualisieren.
- Required checks:
  - `pnpm exec eslint app/components/dashboard.tsx`
  - `npx tsc --noEmit`
  - `npm run build`
  - `npm run smoke:public`
- Risks/assumptions:
  - Reiner UI-Hotfix ohne API-/DB-Risiko.

## Model / Subagent Plan

- Model switch needed: no
- Target model/role: Codex implementation
- Subagent needed: no
- Subagent role:
- Handoff source: this CR + `SESSION_HANDOFF.md`

## Confirmation Gate

- Gate needed: no
- Reason: Nutzer hat den Hotfix direkt beauftragt.
- Approved by: user request in Telegram
- Approval timestamp: 2026-07-11 09:03 UTC

## Implementation Notes

- Files changed:
  - `app/components/dashboard.tsx`
  - `docs/cr/2026-07-11-md-stats-row-and-filter-icon-state.md`
- Important decisions during implementation:
  - Suchfeld, Trefferstatistik und Icon-Leiste laufen jetzt als klare vertikale Reihenfolge.
  - Das Filter-Icon bleibt bei aktiven Filtern im geschlossenen Zustand `outline`; die Badge zaehlt weiter aktive Filter.

## Verification

- Local checks:
- `pnpm exec eslint app/components/dashboard.tsx` gruen
- `npx tsc --noEmit` gruen
- `git diff --check` gruen
- Build:
- `npm run build` gruen
- Targeted verification:
- `/sportlerboerse-dashboard`: 200
- Manual smoke:
- `npm run smoke:public` gruen gegen `https://portal.s5evo.de`
- `/`: 200
- `/login`: 200
- `/anmeldung`: 200
- `/aenderungen`: 200
- `/api/competition`: 200
- `/api/results`: 200
- `/api/teams` ohne Session: 401 (erwartet)
- `/api/admin/pending-changes` ohne Session: 401 (erwartet)

## Deploy

- Deployment needed: yes, after explicit deploy approval
- Deployment ID: `dpl_9NiKXJytAWZDantdkKDiun3Myarc`
- Deployment URL: `https://s5-evo-portal-ec3r4whu1-sebastiankroeker-2781s-projects.vercel.app`
- Production alias: `https://portal.s5evo.de`
- Deployed at: 2026-07-11 09:08 UTC

## Post-Deploy Smoke

- Routes checked:
  - `/`
  - `/login`
  - `/anmeldung`
  - `/aenderungen`
  - `/sportlerboerse-dashboard`
- API checks:
  - `/api/competition`
  - `/api/results`
  - `/api/teams` ohne Session
  - `/api/admin/pending-changes` ohne Session
- Result:
  - gruen

## Follow-Ups

- None
