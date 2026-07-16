# CR: Wettkampf-Privacy fuer fremde Mannschaften

Status: Deployed
Date: 2026-07-16
Type: hotfix
Risk: medium
Owner: S5Evo

## Context

Sebastian braucht kurzfristig einen Wettkampf-Switch, der die Sichtbarkeit fremder Mannschaften abschaltet. Dabei duerfen auch Gesamtzahlen fuer Mannschaften und Teilnehmer nicht sichtbar sein, inklusive Home Screen.

## Scope

- In scope: Competition-Privacy-Switch, Admin-UI, public Competition-Payload, Home-Screen-Zahlen, serverseitiger Teamlisten-Scope.
- Out of scope: Ergebnis-/Ranglisten-Privacy, Sportlerboerse-Grundlogik, bestehende Admin/Moderator/Zeitnahme-Vollsicht.

## Affected Flows

- User/API/admin flows touched: Admin Wettkampf-Konfiguration, Home Screen, `/api/competition`, `/api/teams`.
- Data model impact: neues Competition-Boolean mit Default false.
- Auth/permission impact: normale Nutzer/Zuschauer sehen bei aktivem Switch keine fremden Teams und keine Gesamtzahlen; Admin/Moderator bleiben voll berechtigt.
- Production/deploy impact: Prisma Migration + Vercel Production Deploy.

## Data / API Design

- Proposed data model: `Competition.hideForeignTeams Boolean @default(false)`.
- Proposed API shape: Competition-Payload enthaelt `hideForeignTeams`; `teamCount` wird bei aktivem Switch oeffentlich `null`.
- Backward compatibility: Default false haelt bisheriges Verhalten.
- Migration/data backfill: keine Backfill-Daten erforderlich.

## Open Questions

- Ergebnis-/Ranglisten-Privacy bleibt separat zu entscheiden.
- Ob Zeitnahme/Result-Staging fremde Namen fuer Nicht-Orga ausblenden muss, ist nicht Teil dieses Hotfixes.

## Acceptance Criteria

- Admin kann am Wettkampf "Fremde Mannschaften verbergen" setzen.
- Bei aktivem Switch liefert `/api/competition` oeffentlich keine Teamanzahl.
- Home Screen zeigt keine Team-/Teilnehmer-/Klassen-Statistik fuer normale Nutzer.
- `/api/teams?scope=all` ist fuer Teilnehmer/Teamchefs bei aktivem Switch verboten; eigene Teams bleiben sichtbar.
- Admin/Moderator koennen weiterhin alle Teams sehen.

## Implementation Handoff

Use before model switch or subagent delegation.

- Relevant files: `prisma/schema.prisma`, `app/api/competition/route.ts`, `app/api/admin/competition/route.ts`, `app/api/admin/competitions/route.ts`, `lib/team-access-config.ts`, `lib/competition-context.tsx`, `app/components/home-screen.tsx`, `app/api/teams/route.ts`, `app/admin/page.tsx`.
- Current decisions: eigener Boolean `hideForeignTeams`; Default false; Switch overruled Teilnehmer-/Zuschauer-Vollsicht.
- Open decisions: Ergebnis-/Ranglisten-Privacy spaeter.
- Non-goals: keine Produktionsdaten umstellen; Switch bleibt erstmal default false.
- Expected implementation steps: Migration, API-Felder, Access-Config, Home-Ausblendung, Admin-UI, Tests/Build, deploy.
- Required checks: `npx tsc --noEmit`, targeted ESLint, `npm run build`, public smoke after deploy.
- Risks/assumptions: Authenticated role smoke lokal ohne echte Session nur begrenzt automatisierbar.

## Model / Subagent Plan

- Model switch needed: no
- Target model/role: Codex implementation
- Subagent needed: no
- Subagent role: none
- Handoff source: this CR and Telegram request

## Confirmation Gate

- Gate needed: yes
- Reason: schema/API change plus production deploy.
- Approved by: Sebastian ("Go")
- Approval timestamp: 2026-07-16T18:19:26Z

## Implementation Notes

- Files changed: `prisma/schema.prisma`, `prisma/migrations/20260716182000_add_competition_hide_foreign_teams/migration.sql`, `lib/team-access-config.ts`, `lib/competition-context.tsx`, `app/api/competition/route.ts`, `app/api/admin/competition/route.ts`, `app/api/teams/route.ts`, `app/api/teams/[id]/route.ts`, `app/admin/page.tsx`, `app/components/home-screen.tsx`, `app/components/team-registration.tsx`.
- Important decisions during implementation: existing default behavior remains open while `hideForeignTeams=false`; when true, `TEAMCHEF` and `TEILNEHMER` lose all-team scope, while `ADMIN`/`MODERATOR` keep it. Own-team access also matches participant email, not only linked `userId`.

## Verification

- Local checks: `npx prisma generate`, `npx prisma migrate deploy`, `npx tsc --noEmit`, targeted ESLint, `git diff --check`.
- Build: `npm run build` green.
- Targeted verification: `canRoleViewAllTeams` check confirms Teamchef/Teilnehmer false and Admin true when `hideForeignTeams=true`; DB read confirms current 2026 competition has `hideForeignTeams=false`.
- Manual smoke: public smoke only; authenticated role smoke was not automated because no session cookies are configured in this agent environment.

## Deploy

- Deployment needed: yes
- Deployment ID: `dpl_CWrZFbfDXfxp8bTJxLvKqU2qxxZD`
- Deployment URL: `https://s5-evo-portal-jhkhhgc5c-sebastiankroeker-2781s-projects.vercel.app`
- Production alias: `https://portal.s5evo.de`
- Deployed at: 2026-07-16T18:40Z

## Post-Deploy Smoke

- Routes checked: `npm run smoke:public` (`/`, `/login`, `/anmeldung`, `/aenderungen`, `/api/competition`, `/api/results`, protected API 401 checks), `/admin` -> 200.
- API checks: `/api/competition` -> OPEN competition with `hideForeignTeams=false` and `teamCount=43`; `/api/teams?competitionId=...&scope=all` without session -> 401; `/api/admin/competition?id=...` without session -> 401.
- Result: production alias healthy. The active 2026 competition remains open-visible until an admin turns the new switch on.

## Follow-Ups

- Decide whether public results/rankings need the same privacy switch.
