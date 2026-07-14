# CR: User-Teamliste zeigt Klassenkuerzel

Status: Deployed
Date: 2026-07-14
Type: hotfix
Risk: low
Owner: S5Evo

## Context

Sebastian zeigte die mobile Orga-Useransicht von Markus Huber. `Huber Cars, Team 3` ist mittlerweile von MTC in eine regulaere Mannschaft ueberfuehrt, in der User-Teamliste fehlt dort aber weiterhin die Klassen-Abkuerzung vor dem Mannschaftsnamen.

## Scope

- In scope:
  - Admin-User-API liefert fuer verbundene Teams die gespeicherte `classificationCode`.
  - User-Management-Teamliste zeigt bei regulaeren Mannschaften ein kompaktes Klassen-Badge vor dem Mannschaftsnamen.
  - MTC-/Marketplace-Teamlisten behalten das bestehende `MTC x/5`-Badge.
- Out of scope:
  - Keine Aenderung an MTC-Finalisierung, Rollen, Claim-Links oder Teamklassifikation.
  - Kein Datenmodell- oder Datenkorrektur-Eingriff.

## Affected Flows

- User/API/admin flows touched: Admin-Userverwaltung, verbundene Teams pro User.
- Data model impact: keiner.
- Auth/permission impact: keiner.
- Production/deploy impact: UI/API-Hotfix, deploy nach Freigabe sinnvoll.

## Data / API Design

- Proposed data model: unveraendert.
- Proposed API shape: `teamScopes[]` enthaelt zusaetzlich `classificationCode`.
- Backward compatibility: additive API-Erweiterung.
- Migration/data backfill: nicht erforderlich.

## Open Questions

- Keine.

## Acceptance Criteria

- Regulaere Mannschaften in der User-Teamliste zeigen vor dem Namen die Klassen-Abkuerzung, z.B. `HB Huber Cars, Team 3`.
- MTC-/Marketplace-Teams zeigen weiter `MTC x/5`.
- Die mobile Darstellung bleibt kompakt und bricht nicht unnoetig um.

## Implementation Handoff

- Relevant files:
  - `app/api/admin/users/route.ts`
  - `app/components/user-management.tsx`
- Current decisions:
  - Badge-Labels folgen den bestehenden Dashboard-Kuerzeln: SA, SB, J, DA, DB, HA, HB, HC.
  - Fallback fuer unbekannte Klassen ist der rohe `classificationCode`.
- Open decisions: keine.
- Non-goals: keine Berechtigungs-/Datenmutation.
- Expected implementation steps:
  - `classificationCode` in `teamScopeSelect` und `TeamScope` ergaenzen.
  - Kompaktes Klassen-Badge in `user-management.tsx` rendern.
  - Targeted ESLint, TypeScript und Diff-Check ausfuehren.
- Required checks:
  - `npx eslint app/api/admin/users/route.ts app/components/user-management.tsx`
  - `npx tsc --noEmit`
  - `git diff --check`
- Risks/assumptions:
  - Teams ohne `classificationCode` zeigen kein Klassen-Badge.

## Model / Subagent Plan

- Model switch needed: no
- Target model/role: current Codex implementation
- Subagent needed: no
- Subagent role:
- Handoff source: this CR

## Confirmation Gate

- Gate needed: no
- Reason: kleiner UI/API-Hotfix ohne Produktionseingriff bis zum Deploy.
- Approved by: Sebastian request in Telegram
- Approval timestamp: 2026-07-14T18:13:51Z

## Implementation Notes

- Files changed:
  - `app/api/admin/users/route.ts`
  - `app/components/user-management.tsx`
  - `lib/account-link-status.ts`
- Important decisions during implementation:
  - `classificationCode` wird additiv in `teamScopes[]` geliefert.
  - MTC-/Marketplace-Scopes zeigen weiter nur das bestehende `MTC x/5`-Badge.
  - Regulaere Teams mit bekannter Klassifizierung zeigen ein kompaktes Kuerzel-Badge vor dem Teamnamen.
  - Der Status `Portal-Konto vorhanden` wurde in `Portal-Konto ohne Link` umbenannt, damit der Badge konsistent zum Filter `Konto ohne Link` ist und nicht wie eine fertige Verknuepfung wirkt.

## Verification

- Local checks:
  - `npx eslint app/api/admin/users/route.ts app/components/user-management.tsx` -> gruen
  - `git diff --check` -> gruen
- Build:
  - `npx tsc --noEmit` -> gruen
- Targeted verification:
  - Diff geprueft: API liefert `classificationCode`; UI rendert Klassenbadge nur fuer Nicht-MTC-Scopes.
- Manual smoke:
  - Nicht lokal im Browser ausgefuehrt.

## Deploy

- Deployment needed: yes
- Deployment ID: `dpl_BvYpNXZGLh3f2xSaKVicKRvnFGoZ`
- Deployment URL: `https://s5-evo-portal-d79b1ldjt-sebastiankroeker-2781s-projects.vercel.app`
- Production alias: `https://portal.s5evo.de`
- Deployed at: 2026-07-14T19:01:12Z

## Post-Deploy Smoke

- Routes checked: `/`, `/login`, `/anmeldung`, `/aenderungen`
- API checks: `/api/competition` -> 200, `/api/results` -> 200, `/api/teams` without session -> 401, `/api/admin/pending-changes` without session -> 401, `/api/admin/users` without session -> 401
- Result: gruen (`npm run smoke:public` gegen `https://portal.s5evo.de`)

## Follow-Ups

- None
