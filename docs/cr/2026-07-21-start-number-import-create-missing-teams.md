# CR: Startnummern-Import Creates Missing Teams

Status: Implemented locally
Date: 2026-07-21
Type: feature
Risk: high
Owner: S5Evo

## Context

Sebastian has additional teams that were provided outside the portal. He wants to create them through the existing start-number import by leaving the Mannschafts-UID/team ID column empty.

Current behavior in `app/api/admin/start-numbers/import/route.ts`:

- ID-based imports use `team_id`/`team_uid` plus start number.
- If no ID-based assignments are found, the legacy fallback matches existing teams by normalized Mannschaftsname and, for duplicate names, by participant-slot signature.
- Rows that cannot be matched to an existing team are returned as warnings such as `unmatched_team`.
- The import writes only `Team.startNumber`; it does not create teams or participants.

Therefore an empty Mannschafts-UID is a good future signal, but it does not create a team today.

## Scope

- In scope:
  - Extend the existing start-number import so legacy rows with empty Mannschafts-UID can create missing teams in a controlled mode.
  - Keep dry-run preview mandatory before apply.
  - Use the legacy row fields for team name, start number, class, total age, and five discipline-specific participants.
  - Create team and participant records only when the row is unambiguous and passes validation.
  - Audit created teams and assigned start numbers.
- Out of scope:
  - Updating existing participant/team fields for matched teams.
  - Importing payment status.
  - Authentik user creation, claim-link creation, or email sending.
  - Automatic approval of created teams unless explicitly decided.
  - Result import or scoring changes.

## Affected Flows

- User/API/admin flows touched:
  - Admin start-number import.
  - Mannschafts-Dashboard after import.
  - Potentially timekeeping/result workflows because newly created teams receive start numbers.
- Data model impact:
  - No schema change expected; use existing `Team` and `Participant` models.
- Auth/permission impact:
  - ADMIN-only. Must remain competition-scoped.
- Sensitive data impact:
  - Team names, class, total age, participant names, gender, birth year, discipline assignments, start numbers.
- Offline/cache/export/log/mail impact:
  - No offline cache change.
  - No mail.
  - No CSV body or full participant payload in technical logs.
- Production/deploy impact:
  - Production deploy and authenticated admin browser smoke needed.

## Privacy / Security Review

- Sensitive fields touched:
  - Participant names, gender, birth year, team name, team class, total age, start number.
- Purpose / data minimization:
  - Create only the operational fields needed for Wettkampf administration and disciplines.
  - Do not infer contact email/phone or owner identity from the CSV unless a future CR adds explicit columns.
- Visibility by role/user/API/UI:
  - Import and preview ADMIN-only.
  - Created teams become visible according to existing team visibility/admin dashboard rules.
- Persistence locations:
  - DB `teams`, `participants`, `audit_events`.
- Offline/cache behavior:
  - No new offline read model.
- Logs/mails/exports/screenshots exposure:
  - Do not log CSV body or participant details.
  - Dry-run preview can show row/team summary to the authenticated admin.
- Negative checks for unauthorized access or payload leakage:
  - Unauthenticated import remains 401.
  - Non-admin import remains 403.
  - Dry-run must not mutate DB.
- Authenticated smoke plan or explicit gap:
  - Admin browser/API smoke required with a tiny test CSV before production apply.
- Residual risk:
  - Accidental duplicate creation if a row should have matched an existing team but the team name/signature differs.
  - Bad source data can create participants with wrong gender/birth year/discipline.

## Data / API Design

- Proposed data model:
  - Existing `Team` and `Participant`.
  - Existing `AuditEvent` for creation/import audit.
- Proposed API shape:
  - Extend `POST /api/admin/start-numbers/import`.
  - Add explicit request flag, for example `createMissingTeams: true`.
  - Dry-run response should separate:
    - `matchedAssignments`
    - `createCandidates`
    - `skippedRows`
    - `conflicts`
  - Apply mode creates only rows from `createCandidates` that were validated in the same parser path.
- Backward compatibility:
  - Existing imports without `createMissingTeams` keep current behavior.
  - Empty Mannschafts-UID without the explicit flag remains a warning, not a mutation.
- Migration/data backfill:
  - None expected.

## Open Questions

- Decision: Created teams are `approved=true`.
- Decision: Owner/contact is `sebastian.kroeker@proton.me`.
- Decision: No login, claim link, or mail side effects.
- Decision: Created teams use existing `Team` defaults, including `registrationMode = TEAM`.
- Decision: Class and total age are trusted from the CSV in this first slice; no recalculation/auto-correction.
- Decision: Duplicate existing team names and duplicate start numbers block creation for that row.

## Acceptance Criteria

- Admin can dry-run a legacy/start-number CSV with empty Mannschafts-UID rows.
- Dry-run clearly shows which rows will create new teams.
- Apply mode requires explicit confirmation and `createMissingTeams: true`.
- Existing matched-team start-number import still works unchanged.
- Rows with enough ambiguity are skipped, not created.
- Created teams have five discipline participants where present in the row.
- No claim links, users, passwords, mails, or Authentik records are created.
- Audit events record team creation/start-number import without storing the full CSV body.

## Implementation Handoff

- Relevant files:
  - `SESSION_HANDOFF.md`
  - `docs/cr/2026-07-19-legacy-stammdaten-csv.md`
  - `app/api/admin/start-numbers/import/route.ts`
  - `app/components/dashboard.tsx`
  - `lib/domain/classification.ts`
  - `lib/domain/team.ts`
  - `prisma/schema.prisma`
- Current decisions:
  - Empty Mannschafts-UID is acceptable as the import signal only if paired with explicit `createMissingTeams`.
  - No Authentik/user/claim/mail side effects.
  - Dry-run first.
- Open decisions:
  - Approval status and owner/contact behavior for created teams.
  - Whether to trust or recalculate class/age.
- Non-goals:
  - Password reset/AuthentiK changes.
  - Result import changes.
- Expected implementation steps:
  - Extend legacy parser to produce create candidates for unmatched rows with empty team ID.
  - Add validation for required team name, start number, class, and participant minimums.
  - Add dry-run preview fields.
  - Add guarded apply path for `createMissingTeams`.
  - Add audit events.
  - Add UI confirmation text for team creation count.
- Required checks:
  - Targeted ESLint.
  - `npx tsc --noEmit --incremental false`.
  - `git diff --check`.
  - `npm run build`.
  - Add or extend targeted import verification for create-candidate behavior.
- Privacy/security checks:
  - Unauthorized import remains 401/403.
  - No CSV body in logs/audit.
  - Dry-run no DB mutation.
- Risks/assumptions:
  - Source CSV contains enough participant/class data to create valid teams.
  - Owner/contact remains unresolved unless Sebastian decides otherwise.
- Context read before implementation:
  - `SESSION_HANDOFF.md` top block: yes
  - Relevant prior CR(s): `2026-07-19-legacy-stammdaten-csv.md`
  - Relevant source files: start-number import route and dashboard import UI

## Model / Subagent Plan

- Model switch needed: no
- Target model/role: Codex implementation after gate
- Subagent needed: no
- Subagent role:
- Handoff source: this CR

## Confirmation Gate

- Gate needed: yes
- Reason: Creates teams and participant records from imported sensitive CSV data.
- Sensitive-data/production-data reason: Persistent team/participant mutation and start-number assignment.
- Approved by:
- Approval timestamp:

## Implementation Notes

- Files changed:
  - `app/api/admin/start-numbers/import/route.ts`
  - `app/components/dashboard.tsx`
- Important decisions during implementation:
  - Added explicit `createMissingTeams` request flag.
  - Dashboard sends `createMissingTeams: true` for the legacy start-number import path and shows the new team count in the confirmation dialog.
  - Empty `team_id` rows become create candidates only when `createMissingTeams` is true.
  - Existing team assignment logic remains unchanged.
  - Created teams are approved immediately, owned by `sebastian.kroeker@proton.me`, and get no Authentik/user/claim/mail side effects.
  - Created participants use the five discipline slots from the legacy Stammdaten row.
  - Audit events store creation summary metadata, not the CSV body.

## Verification

- Local checks:
  - `npx eslint app/api/admin/start-numbers/import/route.ts app/components/dashboard.tsx`
  - `npx tsc --noEmit --incremental false`
  - `git diff --check -- app/api/admin/start-numbers/import/route.ts app/components/dashboard.tsx docs/cr/2026-07-21-start-number-import-create-missing-teams.md SESSION_HANDOFF.md`
- Build:
  - `npm run build`
- Targeted verification:
  - TypeScript covers the Prisma create path and response shapes.
  - Read-only DB check confirmed owner user `sebastian.kroeker@proton.me` exists.
- Sensitive-data negative checks:
  - No password, Authentik, claim, or mail code added.
  - Audit stores row number, team summary, owner email, start number, and participant count, not the full CSV body.
- Authenticated role smoke:
  - Not run locally; needs admin browser/API session.
- Manual smoke:
  - Pending.

## Deploy

- Deployment needed: yes
- Deployment ID:
- Deployment URL:
- Production alias:
- Deployed at:

## Post-Deploy Smoke

- Routes checked:
- API checks:
- Sensitive-data/API leakage checks:
- Result:

## Follow-Ups

- Decide whether a later workflow should generate claim links for imported teams.
