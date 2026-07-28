# CR: Competition clone and 5Kampf 2027 preparation

Status: Local implementation complete — release approval pending
Date: 2026-07-27
Type: feature
Risk: medium
Owner: S5Evo

## Context

Sebastian wants a clean way to prepare next year's competition without creating
a new tenant. The recommended model is:

- Tenant = organization / event owner.
- Competition = concrete event/year such as `5Kampf 2026` and `5Kampf 2027`.

The practical need is an admin flow to clone a previous competition into a new
draft competition for the next year.

Decision from Sebastian, 2026-07-27:

- Map routes should be copied.
- Home/news content should be copied.

## Scope

- In scope:
  - Add a competition clone flow for admins.
  - Create a new draft competition from an existing source competition.
  - Copy configurable structure and settings.
  - Keep participant/team/result/history data out of the clone by default.
  - Copy map routes and home/news content by default, with the copied content
    staying draft/reviewable where applicable.
- Out of scope:
  - No automatic registration carry-over.
  - No copying teams, participants, results, claim tokens, messages, audit
    events, visitor counters or result staging data by default.
  - No production data mutation without explicit confirmation.
  - No tenant creation.

## Affected Flows

- User/API/admin flows touched:
  - Admin competition management.
  - Competition switcher.
  - Registration setup for next year.
  - Event map route configuration if copied.
- Data model impact:
  - Ideally no schema change for V1.
  - Possible later template model if cloning becomes repeated and complex.
- Auth/permission impact:
  - Admin-only. Must resolve source competition tenant server-side.
- Sensitive data impact:
  - Medium. Clone must avoid copying participant/team/contact/result data.
- Offline/cache/export/log/mail impact:
  - Active competition selection and cached admin/public state may need
    invalidation after clone.
- Production/deploy impact:
  - Feature deploy. Actual production clone execution is a separate data action.

## Privacy / Security Review

- Sensitive fields touched:
  - Source competition settings may reference visibility rules and deadlines.
  - Do not copy participant names, birth data, contact info, claim links,
    messages, results, audit, exports or counters.
- Purpose / data minimization:
  - Copy only what is needed to prepare a new competition efficiently.
- Visibility by role/user/API/UI:
  - Admin-only clone action.
- Persistence locations:
  - New `Competition` row and selected copied setup rows.
- Offline/cache behavior:
  - Competition list caches/localStorage must refresh after clone.
  - Active competition should not switch automatically unless user chooses it.
- Logs/mails/exports/screenshots exposure:
  - No outbound mails.
  - Audit the clone action with source/target competition IDs and selected
    clone options, not sensitive payload dumps.
- Negative checks:
  - Non-admin cannot clone.
  - Clone output contains no teams/participants/results/tokens/messages.
- Authenticated smoke plan or explicit gap:
  - Needs authenticated admin smoke in a safe test/local DB.
- Residual risk:
  - Source settings may contain stale dates or labels; UI should force review.

## Data / API Design

- Proposed data model:
  - V1 can use existing models:
    - `Competition`
    - `Discipline`
    - `Classification`
    - optional home news / route config where appropriate.
  - Later optional model:
    - `CompetitionTemplate`.
- API shape:
  - `POST /api/admin/competitions/[id]/clone`
  - Body:
    - `name`
    - `year`
    - `dryRun` for a non-mutating preview
    - `confirmationText` equal to the target name for the actual write
  - The server resolves the source under the authenticated admin's tenant and
    rejects a target year already used by that tenant.
  - The clone runs in one transaction, writes only configuration rows, and
    emits an ID/count-only `COMPETITION_CLONED` audit event.
- Copy rules:
  - Copy `Competition` configuration, disciplines and classifications.
  - Create a `DRAFT` target; clear dates, deadlines and
    `registrationNotificationEmail`; set the age reference to 31 December of
    the target year.
  - Copy non-archived, competition-scoped home news as `DRAFT` entries with
    the acting admin as creator/updater. Never publish copied news.
  - Map routes are currently static shared app configuration
    (`lib/event-map/course-routes.ts`), not database records. They are
    available to the new competition without a data copy.
- Backward compatibility:
  - Existing competitions remain unchanged.
  - Clone creates a new `DRAFT` competition.
- Migration/data backfill:
  - None for V1 unless route storage needs to move from static source to DB.

## Resolved Decisions

- The admin UI defaults to the active competition's next calendar year; if its
  name contains a four-digit year, that part is advanced as well.
- Static map routes stay static for V1; a map-data migration is not justified
  merely for cloning.
- Non-archived source news is copied only as draft. Archived news is excluded.
- Sebastian confirmed on 2026-07-28 that classifications must be parameterized
  for both 2026 and later competitions. The competition's `year` is the age
  reference year; youth ranges move forward by the same number of years.
- The minimum eligible age remains eight: a birth year later than
  `competition.year - 8` is rejected in the competition-aware validation.
  Structural date parsing stays independent of a hard-coded event year so the
  correct future cohort can reach that validation.

## Resolved Classification Blocker

- Production dry-run evidence shows the 2026 source has five persisted
  disciplines but zero persisted `Classification` rows. The effective class
  rules are instead global code. The code is now competition-aware: the
  selected competition's year drives age totals and youth ranges.
- 2026 remains explicitly reproducible. For 2027 the youth windows are
  `2017–2019` (Schüler A), `2014–2016` (Schüler B), and `2010–2013`
  (Jugend); adults use the same class thresholds with 2027 age totals.
- Registration, team edits, direct participant edits, participant-change
  recalculation, marketplace matching and anonymous MTC flows now propagate
  the competition year. A 2019 cohort is accepted for 2027 but rejected for
  2026 as too young.

## Acceptance Criteria

- Admin can create a draft 2027 competition from the 2026 competition.
- New competition has copied disciplines, classifications and selected settings.
- New competition has copied map routes and home/news content for review.
- No teams, participants, results, claim tokens, messages, audit logs, visitor
  counters, result staging data or publications are copied by default.
- New competition appears in admin competition switcher.
- Public default competition remains unchanged unless explicitly changed.
- Clone action is audited.

## Implementation Handoff

- Relevant files:
  - `prisma/schema.prisma`
  - `app/api/admin/competitions/**`
  - admin competition management UI
  - `lib/competition-context.tsx`
  - event map route source if routes are copied
- Current decisions:
  - 2027 should be a new `Competition`, not a new `Tenant`.
  - Clone must default to draft/readiness, not live.
  - Map routes and home/news content should be copied.
- Non-goals:
  - No participant/team/result carry-over.
  - No automatic production clone without explicit approval.
- Expected implementation steps:
  - Add clone API with server-side admin/tenant auth.
  - Add clone service that copies only allowed setup data.
  - Add admin UI action/form.
  - Add audit event.
  - Add targeted tests/checks for excluded sensitive tables.
- Required checks:
  - targeted ESLint
  - `npx tsc --noEmit --incremental false`
  - `npm run build`
  - `git diff --check`
  - targeted clone dry-run/test script where feasible
- Privacy/security checks:
  - Verify excluded tables remain empty for target competition.
  - Protected clone API without session returns 401.
- Risks/assumptions:
  - Static map routes may not yet be cleanly cloneable per competition.
  - Authenticated smoke may need Sebastian or a reusable admin session.
- Context read before implementation:
  - `SESSION_HANDOFF.md` top block: required.
  - Relevant prior CR(s):
    - `docs/cr/2026-07-27-event-map-gpx-route-update.md`
    - tenant/permission audit CRs if implemented first.
  - Relevant source files:
    - competition APIs/UI
    - schema relations from `Competition`.

## Model / Subagent Plan

- Model switch needed: no
- Target model/role: Codex implementation after approval
- Subagent needed: optional
- Subagent role: test/data review
- Handoff source: this CR.

## Confirmation Gate

- Gate needed: yes
- Reason: admin data creation and potentially production data mutation.
- Sensitive-data/production-data reason: clone must avoid copying participant
  and result data.
- Local implementation approved by: Sebastian, “Dann bitte den nächsten CR :)”.
- Local implementation approval timestamp: 2026-07-28 11:27 UTC.
- Not approved: functional commit/push to auto-deploying `main`, Vercel
  production deploy, or invoking the clone against production data.
- Required release evidence: local scope/API tests, TypeScript/build,
  unauthenticated API check after deploy, and a manual authenticated admin
  dry-run before any production clone.

## Implementation Notes

- Files changed:
  - `lib/competition-clone.ts`
  - `app/api/admin/competitions/[id]/clone/route.ts`
  - `app/admin/page.tsx`
  - `scripts/verify-competition-clone.ts`
  - `scripts/verify-tenant-scope.ts`
- Important decisions during implementation:
  - The write action requires the target name as confirmation text and is
    never called automatically after feature deployment.
  - The clone excludes teams, participants, results, claim tokens, messages,
    audit history, visitor counters, timekeeping and result staging by design
    and by targeted static guard.
  - Contact-bearing registration notifications and all time-bound operational
    values are deliberately cleared for review.
  - The production dry-run is read-only and confirms five disciplines, zero
    persisted classifications, one draftable news entry and six shared map
    routes. It did not create a 2027 target.
  - Classification has no schema migration: its source of truth remains code,
    but `classifyTeam`, `evaluateTeamState`, and `evaluateTeamDraft` now take
    the selected competition year. Legacy callers default explicitly to 2026.
  - The API resolves the target competition before it evaluates a registration;
    this avoids rejecting a valid future cohort against a stale default year.

## Verification

- Local checks: `git diff --check`, Prisma validation, competition clone,
  tenant scope (79 API routes), admin competition scope and TypeScript pass.
- Build: `npm run build` passes with the new clone route and parameterized
  classification. Targeted ESLint has no errors; it retains one existing
  `react-hooks/exhaustive-deps` warning in `team-registration.tsx`.
- Targeted verification:
  - `npm run verify:competition-clone` passes;
  - `npm run verify:tenant-scope` passes with 79 classified API routes;
  - `npm run verify:team-draft` proves 2026 parity, 2027 shifted youth
    classifications, and the 2019 cohort allow/deny boundary;
  - `npx tsc --noEmit --incremental false` passes.
- Sensitive-data negative checks: the clone guard asserts that no nested create
  exists for teams, participants, timekeeping sessions or result batches; the
  service's explicit excluded list also covers results, claims, messages,
  audit history and counters.
- Authenticated role smoke: after deploy, use the admin dry-run first; do not
  create a production target without a separate confirmation.
- Manual smoke: pending feature deploy.

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

- Add `CompetitionTemplate` if clone options grow too complex.
- Add route/map DB-backed configuration per competition.
