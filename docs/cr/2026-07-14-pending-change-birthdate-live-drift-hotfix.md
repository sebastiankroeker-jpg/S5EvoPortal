# CR: Pending-Change BirthDate Live Drift Hotfix

Status: Deployed
Date: 2026-07-14
Type: hotfix
Risk: low
Owner: S5Evo

## Context

Sebastian reported that the upper of two old pending changes showed `Geburtsdatum: ... -> leer` in the live-state drift details, while the participant inside the team still had a birth date.

Production read-only check for Markus Huber's two open requests in `Huber Cars Team 4, Family Edition`:

- `cmrkkd0y5000dju04bg32e4ua`: Tobias Reichart -> Seppi Bertl, live `birthDate=2004-04-27`, no real drift when `birthDate` is loaded.
- `cmrkkbnuw0003ju040vpsvhls`: Seppi Bertl -> Jordy Schneider, live `birthDate=1993-10-14`, no real drift when `birthDate` is loaded.

Root cause: admin pending-change read models selected `birthYear` but not `birthDate`, then called `toParticipantSnapshot()`. That made the live snapshot look like `birthDate=null`, causing false `Live-Stand abweichend` badges and potentially blocking approval.

## Scope

- In scope:
  - Include `birthDate` in admin pending-change participant selects.
  - Include `birthDate` in participant bundle detail selects.
  - Keep existing drift logic unchanged.
- Out of scope:
  - Data migration or production data mutation.
  - Changing participant/team edit semantics.
  - Auto-approving or deleting old requests.

## Affected Flows

- User/API/admin flows touched:
  - Orga pending-change queue `/api/admin/pending-changes`.
  - Bundle detail `/api/admin/participant-change-bundles/[id]`.
- Data model impact:
  - None.
- Auth/permission impact:
  - None.
- Production/deploy impact:
  - Deployed to `portal.s5evo.de`.

## Data / API Design

- Proposed data model:
  - No schema change.
- Proposed API shape:
  - Existing response shape, but internal snapshot generation now has the stored `birthDate`.
- Backward compatibility:
  - Fully backward compatible.
- Migration/data backfill:
  - None.

## Open Questions

- None.

## Acceptance Criteria

- Huber's two open participant-change requests no longer report false live drift from `birthDate`.
- Admin pending-change queue does not show `Live-Stand abweichend` when live state equals the original request basis.
- TypeScript and targeted lint pass.

## Implementation Handoff

- Relevant files:
  - `app/api/admin/pending-changes/route.ts`
  - `app/api/admin/participant-change-bundles/[id]/route.ts`
- Current decisions:
  - Fix the read model, not the drift comparator.
- Open decisions:
  - None.
- Non-goals:
  - No DB writes.
  - No pending-change status changes.
- Expected implementation steps:
  - Add `birthDate: true` beside `birthYear: true`.
  - Add `birthDate` to `ParticipantForApproval`.
  - Verify against real Huber pending-change IDs read-only.
- Required checks:
  - Targeted ESLint.
  - `npx tsc --noEmit`.
  - `git diff --check`.
- Risks/assumptions:
  - Low risk; only additional selected scalar field.

## Model / Subagent Plan

- Model switch needed: no
- Target model/role: current Codex implementation
- Subagent needed: no
- Subagent role: n/a
- Handoff source: this CR and `SESSION_HANDOFF.md`

## Confirmation Gate

- Gate needed: yes
- Reason: Production deploy.
- Approved by:
  - Sebastian
- Approval timestamp:
  - 2026-07-14 12:35 UTC

## Implementation Notes

- Files changed:
  - `app/api/admin/pending-changes/route.ts`
  - `app/api/admin/participant-change-bundles/[id]/route.ts`
- Important decisions during implementation:
  - Real production data proved both Huber requests have live birth dates and zero drift when `birthDate` is loaded.
  - `app/api/admin/pending-changes/[id]/route.ts` already loads full participant records for decision handling, so no change was needed there.

## Verification

- Local checks:
  - `npx eslint app/api/admin/pending-changes/route.ts app/api/admin/participant-change-bundles/[id]/route.ts` passed.
  - `git diff --check` passed.
- Build:
  - `npx tsc --noEmit` passed.
- Targeted verification:
  - Read-only production query for `cmrkkd0y5000dju04bg32e4ua`: `liveBirthDate=2004-04-27`, `drift=[]`.
  - Read-only production query for `cmrkkbnuw0003ju040vpsvhls`: `liveBirthDate=1993-10-14`, `drift=[]`.
- Manual smoke:
  - Production smoke passed.

## Deploy

- Deployment needed: yes
- Deployment ID: `dpl_7fJ2g8rCEPhRisEQ7ihCVBUgD4ME`
- Deployment URL: `https://s5-evo-portal-qhry98nkm-sebastiankroeker-2781s-projects.vercel.app`
- Production alias: `https://portal.s5evo.de`
- Deployed at: 2026-07-14 12:42 UTC

## Post-Deploy Smoke

- Routes checked:
  - `/` -> 200
  - `/aenderungen` -> 200
  - `npm run smoke:public` -> passed
- API checks:
  - `/api/competition` -> 200
  - `/api/results` -> 200
  - `/api/teams` without session -> 401
  - `/api/admin/pending-changes` without session -> 401
  - `/api/admin/participant-change-bundles` without session/wrong method -> 405
- Result: passed

## Follow-Ups

- Authenticated admin reload of `/aenderungen` can visually confirm both Huber requests no longer show false `Live-Stand abweichend`.
