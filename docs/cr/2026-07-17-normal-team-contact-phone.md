# CR: Telefonnummer fuer normale Mannschaftsanmeldung

Status: Implemented
Date: 2026-07-17
Type: feature
Risk: medium
Owner: S5Evo

## Context

Sebastian wants normal team registrations to collect a manager phone number as well, analogous to MTC and Sportlerboerse registrations. The existing database already has `Team.contactPhone`; the previous marketplace phone CR intentionally left normal team registration out of scope.

## Scope

- In scope:
  - Require `contactPhone` for normal team registration.
  - Show the phone field for anonymous and logged-in normal team registration.
  - Persist the trimmed value to `teams.contactPhone`.
  - Add targeted verification for the schema rule.
- Out of scope:
  - No new Prisma field or migration.
  - No participant-level phone logic.
  - No profile/user phone logic.
  - No change to existing MTC/Sportlerboerse phone semantics.

## Affected Flows

- User/API/admin flows touched:
  - `/anmeldung` normal team registration.
  - `POST /api/teams` normal team branch.
- Data model impact:
  - Uses existing `Team.contactPhone`.
- Auth/permission impact:
  - None.
- Production/deploy impact:
  - Production deploy required after local checks and explicit deploy approval.

## Data / API Design

- Proposed data model:
  - Reuse existing nullable `teams.contactPhone`.
- Proposed API shape:
  - Existing `POST /api/teams` normal team payload accepts and now requires `contactPhone`.
- Backward compatibility:
  - Existing teams remain valid with nullable historical phone values.
  - New normal registrations must provide the phone number.
- Migration/data backfill:
  - None.

## Business Invariants

- The team manager contact record for a new normal team should contain name, email, and phone.
- `Team.contactPhone` remains contact-level data, not participant identity data.
- Existing historical teams without phone remain untouched.

## Open Questions

- None blocking local implementation.

## Acceptance Criteria

- Anonymous normal team registration cannot advance/submit without phone.
- Logged-in normal team registration cannot advance/submit without phone.
- `POST /api/teams` rejects normal team payloads without `contactPhone`.
- Successful normal team registration persists `contactPhone` on `Team`.
- Existing MTC and Sportlerboerse phone behavior remains unchanged.

## Implementation Handoff

- Relevant files:
  - `lib/domain/team.ts`
  - `app/components/team-registration.tsx`
  - `app/api/teams/route.ts`
  - `scripts/verify-team-draft-evaluation.ts`
- Current decisions:
  - Reuse existing `Team.contactPhone`.
  - Keep phone required for all registration entry types.
- Open decisions:
  - Production deploy approval after checks.
- Non-goals:
  - No DB migration.
  - No participant/profile phone feature.
- Expected implementation steps:
  - Make `TeamRegistrationSchema.contactPhone` required.
  - Show and validate phone in normal registration UI.
  - Persist phone in normal team API branch.
  - Add targeted verify assertions.
- Required checks:
  - Targeted ESLint.
  - `npm run verify:team-draft`.
  - `npx tsc --noEmit --incremental false`.
  - `npm run build`.
  - `git diff --check`.
- Risks/assumptions:
  - Authenticated browser smoke is not available in this environment.

## Model / Subagent Plan

- Model switch needed: no
- Target model/role: current Codex operator
- Subagent needed: no
- Subagent role: n/a
- Handoff source: this CR.

## Confirmation Gate

- Gate needed: yes
- Reason: production deploy and push to auto-deploying main.
- Local implementation approved by: Sebastian via Telegram "Neuer CR ..."
- Local implementation approval timestamp: 2026-07-17 11:50 UTC
- Production deploy approved by:
- Production deploy approval timestamp:

## Implementation Notes

- Files changed:
  - `lib/domain/team.ts`
  - `app/components/team-registration.tsx`
  - `app/api/teams/route.ts`
  - `scripts/verify-team-draft-evaluation.ts`
  - `docs/cr/2026-07-17-normal-team-contact-phone.md`
  - `SESSION_HANDOFF.md`
- Important decisions during implementation:
  - `TeamRegistrationSchema.contactPhone` is now required for normal team registrations.
  - The normal registration UI shows the phone field for both anonymous and logged-in team managers.
  - The normal `POST /api/teams` branch trims and persists the value to `Team.contactPhone`.
  - Existing MTC and Sportlerboerse branches keep their existing required phone behavior.

## Verification

- Local checks:
  - `npm run verify:team-draft`: passed.
  - `npx eslint lib/domain/team.ts app/components/team-registration.tsx app/api/teams/route.ts scripts/verify-team-draft-evaluation.ts`: passed with existing `react-hooks/exhaustive-deps` warning in `team-registration.tsx`.
  - `npx tsc --noEmit --incremental false`: passed.
  - `git diff --check`: passed.
- Build:
  - `npm run build`: passed.
- Targeted verification:
  - Added schema assertion that normal team registration accepts `contactPhone` and rejects an empty phone value.
- Manual smoke:
  - Not run; authenticated browser session is not available in this environment.

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

- None.
