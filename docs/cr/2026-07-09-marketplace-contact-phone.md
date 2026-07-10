# CR: Marketplace contact phone

Status: Deployed
Date: 2026-07-09
Type: feature
Risk: low
Owner: S5Evo

## Context

Sportlerboerse and MTC contacts need a phone number for short-notice coordination when things have to move quickly before or during the competition.

The original concept targeted MTC / incomplete teams only. Sebastian later decided that Sportlerboerse single registrations should also collect the same phone number.

## Scope

- In scope: required contact phone for MTC drafts.
- In scope: required contact phone for Sportlerboerse single registrations.
- In scope: persist the value on existing `Team.contactPhone`.
- In scope: anonymous MTC edit link can view and update the value.
- Out of scope: normal team registration phone field.
- Out of scope: participant-level phone logic.
- Out of scope: Prisma schema or migration.

## Affected Flows

- User/API/admin flows touched: `/sportlerboerse`, `/sportlerboerse/mtc`, `/api/teams`, `/mtc-anonym/[token]`, `/api/mtc-anonym/[token]`.
- Data model impact: uses existing `teams.contactPhone`.
- Auth/permission impact: none expected.
- Production/deploy impact: Vercel production deploy required and completed.

## Acceptance Criteria

- MTC draft cannot be saved without `contactPhone`.
- MTC draft with `contactPhone` saves the value on `teams.contactPhone`.
- Sportlerboerse single registration cannot be saved without `contactPhone`.
- Sportlerboerse single registration with `contactPhone` saves the value on `teams.contactPhone`.
- Normal team registration remains without required phone field.
- Anonymous MTC link shows and updates `contactPhone`.
- Production smoke remains green after deploy.

## Implementation Handoff

- Relevant files: `lib/domain/team.ts`, `app/components/team-registration.tsx`, `app/api/teams/route.ts`, `lib/mtc-anonymous-access.ts`, `app/mtc-anonym/[token]/page.tsx`, `scripts/verify-participant-edit-flow.ts`.
- Current decisions: phone is required for MTC and Sportlerboerse single registrations; normal teams stay unchanged.
- Non-goals: no DB migration, no participant phone, no profile phone.
- Expected implementation steps: schema validation, form field, submit payload, API persistence, anonymous MTC payload/update, targeted verify fixture.
- Required checks: `npx tsc --noEmit`, `npm run build`, `npm run verify:participant-edit-flow`, post-deploy `npm run smoke:public`.
- Risks/assumptions: existing `Team.contactPhone` is present in production schema.

## Confirmation Gate

- Gate needed: yes.
- Reason: production deploy.
- Approved by: Sebastian.
- Approval timestamp: 2026-07-09 16:56 UTC.

## Implementation Notes

- Files changed: `lib/domain/team.ts`, `app/components/team-registration.tsx`, `app/api/teams/route.ts`, `lib/mtc-anonymous-access.ts`, `app/mtc-anonym/[token]/page.tsx`, `scripts/verify-participant-edit-flow.ts`.
- `MtcDraftRegistrationSchema.contactPhone` is required.
- `MarketplaceRegistrationSchema.contactPhone` is required.
- Shared `TeamRegistrationSchema.contactPhone` is optional only to support the shared form object.
- `/api/teams` persists phone for MTC and Sportlerboerse marketplace branches.
- Anonymous MTC payload and PATCH now include `contactPhone`.

## Verification

- Local checks: `npx tsc --noEmit` passed.
- Build: `npm run build` passed.
- Targeted verification: `npm run verify:participant-edit-flow` passed after fixture update.
- Manual smoke: route-level production smoke completed after deploy.

## Deploy

- Deployment needed: yes.
- Deployment ID: `dpl_96R91JMx1XuxydoY7qz4WsdhAsLA`.
- Deployment URL: `https://s5-evo-portal-9snaairwa-sebastiankroeker-2781s-projects.vercel.app`.
- Production alias: `https://portal.s5evo.de`.
- Deployed at: 2026-07-09 16:58 UTC.

## Post-Deploy Smoke

- Routes checked: `/`, `/login`, `/anmeldung`, `/aenderungen`, `/sportlerboerse`, `/sportlerboerse/mtc`.
- API checks: `/api/competition`, `/api/results`, `/api/teams` without session, `/api/admin/pending-changes` without session.
- Result: green. Expected unauthorized routes returned 401.

## Follow-Ups

- Consider adding automated CR release checks as a script.
- Consider adding optional review subagent phase for medium/high-risk CRs.
