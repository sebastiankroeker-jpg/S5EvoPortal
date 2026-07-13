# CR: MTC Owner Finalisierung

Status: Implemented, not deployed
Date: 2026-07-13
Type: feature
Risk: medium
Owner: S5Evo

## Context

Markus Huber hat eine vollstaendige MTC-Mannschaft und soll als Owner die Mannschaft selbst in eine regulaere Mannschaft ueberfuehren koennen. Die Admin-Funktion existiert bereits unter Mannschaft bearbeiten. Auffaellig ist, dass der Owner-Status bei MTC-Mannschaften anders wirkt als bei normalen Mannschaften: MTC zeigt einen Portal-/Owner-Vorzustand, normale Mannschaften zeigen echte Teamchef-/Team-Manager-Rechte.

## Scope

- In scope:
  - Owner-Finalisierung fuer eigene vollstaendige MTC-/Marketplace-Mannschaften serverseitig erlauben.
  - Bestehende Admin-Finalisierung unveraendert weiter unterstuetzen.
  - Beim Finalisieren regulare Teamrechte fuer den Owner nachziehen.
  - MTC-Owner-Status in der Anzeige als Vorzustand klarer unterscheiden.
  - Owner-Button im Mannschafts-Dashboard fuer eigene finalisierbare MTCs anbieten.
- Out of scope:
  - Neue Datenbanktabellen oder Migrationen.
  - Allgemeine MTC-Slotverwaltung fuer Owner.
  - Fremde MTC-Verwaltungsaktionen fuer Nicht-Admins.
  - Produktion-Deploy ohne separates Go.

## Affected Flows

- User/API/admin flows touched:
  - `POST /api/admin/marketplace-matching` Aktion `finalize`
  - Dashboard Mannschaftsliste und MTC-Entwurfsdialog
  - Admin-User/Owner-Statusanzeige
- Data model impact:
  - Keine Schemaaenderung.
  - Bestehende `TeamMemberRole` wird fuer Owner-Rechte verwendet.
- Auth/permission impact:
  - Admin bleibt ueber `canEditAllTeams` berechtigt.
  - Nicht-Admin darf nur `finalize` fuer eigene `team.ownerId`-MTCs im aktiven Tenant/Wettkampf.
  - Nicht-Admin darf keine Matching-Aktionen wie Teilnehmer suchen, zuordnen, verschieben oder entfernen ausfuehren.
- Production/deploy impact:
  - Codeaenderung, spaeter normaler Web-Deploy.

## Data / API Design

- Proposed data model:
  - Keine Migration.
  - Beim Finalisieren wird fuer `targetTeam.ownerId` eine aktive `TEAM_MANAGER`-Rolle auf dem Team sichergestellt.
  - Anschliessend `syncDerivedTeamchefRole` fuer betroffene User.
- Proposed API shape:
  - Bestehender Endpoint bleibt erhalten.
  - Admin-only Auth wird fuer `finalize` durch ein Action-spezifisches Gate erweitert.
  - `GET` und alle Nicht-Finalize-POST-Aktionen bleiben Admin-only.
- Backward compatibility:
  - Bestehende Admin-UI und API-Calls bleiben kompatibel.
- Migration/data backfill:
  - Keine.

## Open Questions

- Decision 1: Owner-Status bei MTC als Vorzustand anzeigen, nicht als regulaere Verknuepfung.
- Decision 2: Owner-Rechte beim Finalisieren ueber `TeamMemberRole TEAM_MANAGER` nachziehen.

## Acceptance Criteria

- Owner einer eigenen vollstaendigen MTC-Mannschaft kann diese ueber das Dashboard finalisieren.
- Owner fremder oder unvollstaendiger MTC-Mannschaften kann nicht finalisieren.
- Owner kann ueber denselben Endpoint keine Admin-Matching-Aktionen ausfuehren.
- Admin-Finalisierung funktioniert unveraendert.
- Nach Finalisierung hat der Owner regulaere Team-Manager-/TEAMCHEF-Rechte.
- MTC-Statusanzeige unterscheidet Owner-Vorzustand von normaler Team-Verknuepfung.

## Implementation Handoff

Use before model switch or subagent delegation.

- Relevant files:
  - `app/api/admin/marketplace-matching/route.ts`
  - `app/components/dashboard.tsx`
  - `app/api/admin/users/route.ts`
  - `lib/teamchef-role.ts`
  - `lib/account-link-status.ts`
- Current decisions:
  - Action-spezifisches Berechtigungsgate statt neuer Route.
  - Kein DB-Schema-Change.
  - Owner-Finalisierung nur fuer `finalize`.
- Open decisions:
  - Keine.
- Non-goals:
  - Keine Owner-Slotverwaltung.
  - Kein Deploy in diesem Schritt.
- Expected implementation steps:
  - Auth-Gate in `marketplace-matching` fuer Admin oder MTC-Owner-Finalize umbauen.
  - Finalize-Transaktion um Owner-TeamMemberRole und Teamchef-Sync erweitern.
  - Dashboard-Capabilities/Button so erweitern, dass Owner nur Finalize-Dialog bekommt.
  - MTC-Statuslabels in User-/Dashboard-Anzeige schaerfen.
  - Checks ausfuehren und CR aktualisieren.
- Required checks:
  - `pnpm exec eslint app/api/admin/marketplace-matching/route.ts app/components/dashboard.tsx app/api/admin/users/route.ts`
  - `npx tsc --noEmit`
  - `npm run verify:team-draft`
  - `npm run verify:account-link-status`
  - `git diff --check`
- Risks/assumptions:
  - Markus Huber muss als `ownerId` am MTC-Team haengen und einen bestaetigten Portal-Login haben.
  - Der bestehende Dialog laedt Admin-only Teilnehmer-Suche; fuer Owner muss der Load verhindert oder toleriert werden.

## Model / Subagent Plan

- Model switch needed: no
- Target model/role: current Codex implementation
- Subagent needed: no
- Subagent role: none
- Handoff source: this CR and `SESSION_HANDOFF.md`

## Confirmation Gate

- Gate needed: yes
- Reason: Auth/permission change
- Approved by: Sebastian, "Go"
- Approval timestamp: 2026-07-13 08:39 UTC

## Implementation Notes

- Files changed:
  - `app/api/admin/marketplace-matching/route.ts`
  - `app/api/teams/route.ts`
  - `app/api/teams/[id]/route.ts`
  - `app/components/dashboard.tsx`
  - `app/api/admin/users/route.ts`
  - `app/components/user-management.tsx`
- Important decisions during implementation:
  - `GET /api/admin/marketplace-matching` und Nicht-Finalize-Aktionen bleiben Admin-only.
  - `POST /api/admin/marketplace-matching` erlaubt `finalize` fuer Admins oder den eingeloggten Owner des Ziel-MTCs mit bestaetigtem Portal-Login.
  - Der Owner bekommt beim Finalisieren per `TeamMemberRole TEAM_MANAGER` regulaere Mannschaftsrechte; danach laeuft `syncDerivedTeamchefRole`.
  - Eigene MTCs werden in `/api/teams` auch ueber `ownerId` sichtbar, ohne dadurch allgemeine Edit-Rechte zu geben.
  - Owner sieht im Dashboard nur den Uebernehmen-Pfad; Admin-Slotverwaltung, freie Teilnehmersuche und Entwurf-Metadaten bleiben Admin-only.
  - In der Benutzerverwaltung wird ein MTC-Owner ohne regulaere Managerrolle als `MTC-Owner` statt `Team Manager:in` angezeigt.

## Verification

- Local checks:
  - `pnpm exec eslint app/api/admin/marketplace-matching/route.ts app/components/dashboard.tsx app/api/admin/users/route.ts app/components/user-management.tsx app/api/teams/route.ts app/api/teams/[id]/route.ts`
  - `npx tsc --noEmit`
  - `git diff --check`
- Build:
  - `npm run build`
- Targeted verification:
  - `npm run verify:team-draft`
  - `npm run verify:account-link-status`
- Manual smoke:
  - Nicht lokal mit Echtdaten ausgefuehrt; sinnvoll nach Deploy mit Markus-Huber-Login oder Admin-Impersonation pruefen.

## Deploy

- Deployment needed: completed
- Deployment ID: `dpl_5hkMD2RqyPZsUT3k5QprqCQiFxKG`
- Deployment URL: `https://s5-evo-portal-a0rh7smxt-sebastiankroeker-2781s-projects.vercel.app`
- Production alias: `https://portal.s5evo.de`
- Deployed at: 2026-07-13 08:58 UTC

## Post-Deploy Smoke

- Routes checked:
  - `https://portal.s5evo.de/` -> 200
  - `https://portal.s5evo.de/sportlerboerse-dashboard` -> 200
  - `npm run smoke:public` -> green
- API checks:
  - `GET https://portal.s5evo.de/api/teams` without session -> 401
  - `GET https://portal.s5evo.de/api/admin/marketplace-matching` without session -> 401
- Result: Production deploy ready and public smoke green. Authenticated Markus-Huber real-smoke still recommended.

## Follow-Ups

- None
