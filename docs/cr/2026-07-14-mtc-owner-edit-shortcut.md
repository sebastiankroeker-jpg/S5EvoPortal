# CR: MTC-Owner koennen eigene Entwuerfe bearbeiten

Status: Deployed
Date: 2026-07-14
Type: hotfix
Risk: low
Owner: S5Evo

## Context

Sebastian meldete, dass Markus Huber seinen MTC nicht selbststaendig bearbeiten kann. Der aktuelle Portal-Dashboard-Pfad zeigt eigene MTCs zwar an, behandelt MTC-Slot-Pflege aber historisch als Admin-Matching-Funktion. Die bestehende anonyme MTC-Maske kann eigene Slots bereits pflegen, ist aber nur ueber den vertraulichen Bearbeitungslink erreichbar.

## Scope

- In scope:
  - Portal-Owner eigener MTC-Entwuerfe erhalten einen direkten Button `MTC bearbeiten`.
  - Der Button erzeugt fuer berechtigte Owner einen frischen MTC-Bearbeitungslink und leitet auf die bestehende `/mtc-anonym/[token]`-Maske.
  - Berechtigung nur fuer eigene `MARKETPLACE`/`MATCHING`-MTCs mit bestaetigtem Portal-Login oder bestehendem Teamzugriff.
- Out of scope:
  - Keine Freigabe der Admin-Suche nach fremden Sportlerboersen-Meldungen fuer Owner.
  - Keine Aenderung der Finalisierung in echte Mannschaft ausser bestehendem Owner-Finalisieren.
  - Keine Datenmigration.

## Affected Flows

- User/API/admin flows touched: eigenes MTC im Dashboard, MTC-Bearbeitungslink-Erzeugung.
- Data model impact: keiner.
- Auth/permission impact: neuer Owner-only API-Endpunkt fuer Bearbeitungslink.
- Production/deploy impact: Hotfix nach Freigabe.

## Data / API Design

- Proposed data model: unveraendert, nutzt bestehende `RegistrationClaimToken`.
- Proposed API shape: `POST /api/teams/[id]/mtc-edit-link` -> `{ mtcAnonymousUrl }`.
- Backward compatibility: additive Route und UI-Aktion.
- Migration/data backfill: nicht erforderlich.

## Open Questions

- Keine fuer V1.

## Acceptance Criteria

- Eigene MTC-Entwuerfe zeigen im Dashboard einen klaren `MTC bearbeiten`-Button.
- Klick erzeugt nur fuer berechtigte Owner/Teamzugriff einen Link zur bestehenden MTC-Bearbeitungsmaske.
- Nicht berechtigte User bekommen 403.
- Owner erhalten keine Admin-Slot-Suche fuer fremde Sportlerboersen-Meldungen.

## Implementation Handoff

- Relevant files:
  - `app/components/dashboard.tsx`
  - `app/api/teams/[id]/mtc-edit-link/route.ts`
  - `lib/registration-claim.ts`
- Current decisions:
  - Bestehende anonyme MTC-Maske wiederverwenden statt neue Portal-MTC-Editor-UI zu bauen.
  - Beim Erzeugen eines neuen Links bestehende aktive, nicht eingelöste Team-Claim-Tokens fuer diesen MTC widerrufen, analog Claim-Link-Dashboard.
  - Nur `MARKETPLACE`/`MATCHING`-Teams duerfen darueber bearbeitet werden.
- Open decisions: keine.
- Non-goals: keine Admin-Matching-Rechte fuer Owner.
- Expected implementation steps:
  - Owner-only API-Route fuer MTC-Edit-Link anlegen.
  - Dashboard-Button fuer eigene MTCs verdrahten.
  - Targeted ESLint, TypeScript, Diff-Check.
- Required checks:
  - `npx eslint app/components/dashboard.tsx app/api/teams/[id]/mtc-edit-link/route.ts`
  - `npx tsc --noEmit`
  - `git diff --check`
- Risks/assumptions:
  - Link ist weiterhin vertraulich; wer den Link hat, kann den MTC bearbeiten.
  - Neue Link-Erzeugung kann alte offene Bearbeitungslinks widerrufen.

## Model / Subagent Plan

- Model switch needed: no
- Target model/role: current Codex implementation
- Subagent needed: no
- Subagent role:
- Handoff source: this CR

## Confirmation Gate

- Gate needed: yes
- Reason: Production deploy erst nach Sebastian-Go.
- Approved by: Sebastian fachlicher Hinweis in Telegram, Deploy offen
- Approval timestamp: 2026-07-14T20:15:38Z

## Implementation Notes

- Files changed:
  - `app/api/teams/[id]/mtc-edit-link/route.ts`
  - `app/components/dashboard.tsx`
  - `SESSION_HANDOFF.md`
  - `docs/cr/2026-07-14-mtc-owner-edit-shortcut.md`
- Important decisions during implementation:
  - Neuer API-Endpunkt erstellt frische MTC-Bearbeitungslinks nur fuer eigene offene MTC-Entwuerfe.
  - Bestehende offene, nicht eingeloeste MTC-Links fuer das Team werden widerrufen, bevor ein neuer Link erstellt wird.
  - Dashboard zeigt fuer eigene MTCs einen `MTC bearbeiten`-Shortcut; Admin-Matching und Owner-Finalisieren bleiben getrennt.
  - Owner erhalten weiterhin keinen Zugriff auf die Admin-Suche nach fremden Sportlerboersen-Meldungen.

## Verification

- Local checks:
  - `npx eslint app/components/dashboard.tsx app/api/teams/[id]/mtc-edit-link/route.ts` -> gruen
  - `git diff --check` -> gruen
- Build:
  - `npx tsc --noEmit` -> gruen
- Targeted verification:
  - Codepfad geprueft: nicht angemeldet -> 401, nicht eigenes MTC -> 403, falscher Teamtyp/Status -> 409, eigener offener MTC -> neuer Link zur bestehenden MTC-Maske.
- Manual smoke:
  - Nicht im Browser ausgefuehrt.

## Deploy

- Deployment needed: yes
- Deployment ID: `dpl_3iFYRehRNNfU9F4scczSYvE4rgS4`
- Deployment URL: `https://s5-evo-portal-fo4yfa9ut-sebastiankroeker-2781s-projects.vercel.app`
- Production alias: `https://portal.s5evo.de`
- Deployed at: 2026-07-14T20:24:21Z

## Post-Deploy Smoke

- Routes checked: `/`, `/login`, `/anmeldung`, `/aenderungen`
- API checks: `/api/competition` -> 200, `/api/results` -> 200, `/api/teams` without session -> 401, `/api/admin/pending-changes` without session -> 401, `/api/teams/nonexistent/mtc-edit-link` without session -> 401
- Result: gruen (`npm run smoke:public` gegen `https://portal.s5evo.de`)

## Follow-Ups

- None
