# CR: Profile Display Name Save Hotfix

Status: Implemented - pending deploy approval
Date: 2026-07-12
Type: hotfix
Risk: low
Owner: S5Evo

## Context

Im Profil wird der Anzeigename zur Pflege angeboten, Speichern wirkt aber nicht dauerhaft.

Ursache nach Codepruefung: `PUT /api/profile` aktualisiert `User.name`, aber `resolveCurrentUser()` synchronisiert bei spaeteren Requests den Namen wieder aus der Authentik-Session zurueck. Damit ueberschreibt die Auth-Identitaet den Portal-Anzeigenamen.

## Scope

- In scope: Portal-Anzeigename dauerhaft speicherbar machen.
- In scope: Session-Name nach erfolgreichem Speichern im Client aktualisieren, soweit NextAuth das unterstuetzt.
- Out of scope: E-Mail-Aenderungen, Authentik-Profilverwaltung, Datenmodell, Account-Merge.

## Affected Flows

- User/API/admin flows touched: `/profile`, `/api/profile`, Auth-Session-Name.
- Data model impact: keiner.
- Auth/permission impact: keine Rollen-/Zugriffsaenderung.
- Production/deploy impact: kleiner App-Hotfix, Deploy nach Freigabe.

## Data / API Design

- Proposed data model: unveraendert.
- Proposed API shape: unveraendert.
- Backward compatibility: vorhandene User bleiben unveraendert; bestehende Sessiondaten bleiben gueltig.
- Migration/data backfill: nicht erforderlich.

## Open Questions

- Keine.

## Acceptance Criteria

- Anzeigename kann im Profil gespeichert werden.
- Ein spaeterer Profil-GET ueberschreibt den gespeicherten Namen nicht wieder mit dem Authentik-Namen.
- Die Profile-UI zeigt nach dem Speichern den gespeicherten Namen.
- Authentik bleibt weiter Quelle fuer E-Mail, Authentik-Sub und Bild.

## Implementation Handoff

- Relevant files:
  - `lib/current-user.ts`
  - `app/profile/page.tsx`
  - `app/api/auth/[...nextauth]/route.ts`
- Current decisions:
  - `resolveCurrentUser()` darf `User.name` nur initial setzen, nicht dauerhaft ueberschreiben.
  - Die Profile-Page setzt den gespeicherten Namen aus der API-Antwort zurueck in den lokalen State.
- Open decisions: keine.
- Non-goals: keine Aenderung an Authentik selbst.
- Expected implementation steps:
  - Name-Sync in `lib/current-user.ts` auf leere DB-Namen beschraenken.
  - Profile-Save API-Antwort auswerten und Session-Update anstossen.
  - NextAuth JWT-Callback fuer `trigger=update` beim Namen beruecksichtigen.
- Required checks:
  - `pnpm exec eslint app/profile/page.tsx app/api/auth/[...nextauth]/route.ts lib/current-user.ts`
  - `npx tsc --noEmit`
  - `git diff --check`
  - `npm run build`
- Risks/assumptions:
  - Authentik-Namensaenderungen ueberschreiben vorhandene Portal-Anzeigenamen nicht mehr automatisch; das passt zur editierbaren Portal-UI.

## Model / Subagent Plan

- Model switch needed: no
- Target model/role: current
- Subagent needed: no
- Subagent role: none
- Handoff source: Code inspection

## Confirmation Gate

- Gate needed: yes
- Reason: Production deploy.
- Approved by:
- Approval timestamp:

## Implementation Notes

- Files changed:
  - `lib/current-user.ts`
  - `app/profile/page.tsx`
  - `app/api/auth/[...nextauth]/route.ts`
- Important decisions during implementation:
  - `resolveCurrentUser()` synchronisiert `User.name` nur noch, wenn lokal noch kein Name gesetzt ist.
  - Nach erfolgreichem Profil-Save setzt die Page den gespeicherten Namen aus der API-Antwort in den lokalen State.
  - NextAuth `jwt` beruecksichtigt `trigger=update` fuer Name-Updates aus `useSession().update`.

## Verification

- Local checks:
  - `pnpm exec eslint app/profile/page.tsx app/api/auth/[...nextauth]/route.ts lib/current-user.ts app/api/admin/pending-changes/route.ts app/components/approval-queue.tsx` gruen mit bestehender Hook-Warnung in `approval-queue.tsx`
  - `npx tsc --noEmit` gruen
  - `git diff --check` gruen
- Build:
  - `npm run build` gruen
- Targeted verification:
  - Codepfad geprueft: Profil-`PUT` speichert DB-Namen; spaeterer Resolver-Call ueberschreibt vorhandene Namen nicht mehr.
- Manual smoke:
  - pending production deploy

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

- None
