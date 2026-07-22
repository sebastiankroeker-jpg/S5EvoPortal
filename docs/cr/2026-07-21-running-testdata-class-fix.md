# CR: Running Test Data Class Fix

Status: Applied
Date: 2026-07-21
Type: ops
Risk: high
Owner: S5Evo

## Context

Sebastian reported inconsistent uploaded running test data and suspected class
assignment issues. Read-only DB checks against the active 2026 competition
confirmed that the portal team classifications are internally consistent, but
the staged Legacy running drafts carry Legacy class metadata that diverges from
the current portal class for a subset of teams.

Relevant production context:

- Active competition: `cmn3a1piz0002l104372yx9yt`
- Current staged batch: `cmruq55xj0005jr04nnvizbcx`
- Batch label: `Legacy Laufen CSV 2026-07-21`
- Batch purpose/status: `PROD_TEST` / `STAGED`
- Drafts: 74 matched RUN drafts

Read-only diagnosis:

- Active teams: 80
- RUN test drafts: 74
- Distinct draft teams: 74
- Team class vs freshly recalculated class mismatches: 4 Sportlerboerse
  one-person teams without start number; not part of the 74 RUN drafts.
- Staged Legacy class vs portal team class mismatches: 28 of 74 RUN drafts.

Stored portal class counts for the 80 active teams:

- `schueler-a`: 7
- `schueler-b`: 17
- `jugend`: 6
- `damen-a`: 7
- `damen-b`: 12
- `jungsters`: 4
- `herren`: 18
- `masters`: 5
- `sportlerboerse`: 4

Legacy class counts inside the uploaded RUN batch:

- `schueler-a`: 7
- `schueler-b`: 17
- `jugend`: 11
- `damen-a`: 8
- `damen-b`: 5
- `jungsters`: 6
- `herren`: 19
- `masters`: 1

## Scope

- In scope:
  - Correct the existing `PROD_TEST` RUN staging data for the current batch so
    it uses the current portal team class.
  - Preserve raw RUN times, start numbers, team/participant matches, batch, raw
    records, and validation status.
  - Recalculate RUN rank and RUN points per current portal class for the staged
    test drafts only.
  - Re-run read-only consistency checks afterwards.
- Out of scope:
  - Official `DisciplineResult` publication or mutation.
  - Team, participant, start-number, registration, or classification rule
    changes.
  - DB schema changes or migrations.
  - Production deploy.
  - Re-importing the source CSV unless the targeted staging fix is rejected.

## Affected Flows

- User/API/admin flows touched:
  - Admin `Live -> Ergebnis -> Staging-Testdaten -> Laufen` preview.
- Data model impact:
  - No schema change. Updates existing `ResultDraft.proposedResultSnapshot`,
    `normalizedValue`, `rawValue`, `netElapsedMs`, and point/rank fields already
    present in the snapshot.
- Auth/permission impact:
  - No auth code change.
- Sensitive data impact:
  - Result data remains tied to start numbers, teams, participants, and classes.
- Offline/cache/export/log/mail impact:
  - No offline cache, export, mail, or technical log change.
- Production/deploy impact:
  - Production DB staging data mutation only; no deploy.

## Privacy / Security Review

- Sensitive fields touched:
  - Start numbers, team IDs, participant IDs, RUN result times, class code,
    points, ranks.
- Purpose / data minimization:
  - Only fields needed for the admin-only staged RUN preview are touched.
    Names, emails, phones, birth dates, claim data, and public serializers are
    not modified.
- Visibility by role/user/API/UI:
  - The corrected drafts remain visible only through the existing admin staging
    test mode.
- Persistence locations:
  - Existing production DB staging tables `result_drafts` and JSON snapshot
    payloads.
- Offline/cache behavior, TTL/invalidation/logout clearing:
  - Not affected.
- Logs/mails/exports/screenshots exposure:
  - Correction script/checks should print only aggregate counts, start numbers,
    class codes, and internal IDs when needed; no participant names or contact
    data.
- Negative checks for unauthorized access or payload leakage:
  - No API route changes; existing unauthenticated `includeStagingTest=true`
    guard remains relevant.
- Authenticated smoke plan or explicit gap:
  - Automated authenticated browser smoke remains unavailable without
    Sebastian's session. Post-fix DB checks and Sebastian's admin UI check are
    required.
- Residual risk:
  - Because Legacy points were originally imported from a differently grouped
    class snapshot, recalculated test ranks/points are fit for portal test
    preview but no longer represent the original Legacy scoring file exactly.

## Data / API Design

- Proposed data model:
  - No new model.
- Proposed API shape:
  - No API change.
- Backward compatibility:
  - Existing staging preview remains compatible.
- Migration/data backfill:
  - One targeted production DB staging-data update for batch
    `cmruq55xj0005jr04nnvizbcx`.

## Open Questions

- None blocking if Sebastian approves a staging-only correction.

## Acceptance Criteria

- All 74 RUN drafts remain matched to a team and RUN participant.
- Staged RUN draft class code equals current `Team.classificationCode` for all
  74 drafts.
- RUN rank and RUN points are recalculated per current portal class from the
  staged RUN times.
- Official results, team records, participants, and start numbers are unchanged.
- Admin-only staging-test visibility remains unchanged.

## Implementation Handoff

- Relevant files:
  - `SESSION_HANDOFF.md`
  - `docs/cr/2026-07-20-legacy-running-result-import.md`
  - `app/api/results/route.ts`
  - `lib/domain/scoring.ts`
  - `lib/domain/classification.ts`
  - `lib/legacy-running-result-import.ts`
- Current decisions:
  - The active inconsistency is in staged RUN test data, not in portal team
    classification rules.
  - Correcting the staged batch is less risky than changing the production
    result display behavior before the competition.
- Open decisions:
  - Needs Sebastian approval before mutating production staging data.
- Non-goals:
  - No deploy, no official result write, no Team/Participant mutation.
- Expected implementation steps:
  - Re-read current drafts and current team classes.
  - Group staged RUN drafts by current portal class.
  - Sort valid times ascending, DNF/manual-check rows last.
  - Assign ranks with ties and points as `class size - rank + 1`; DNF/manual
    check gets 0 points.
  - Update each draft snapshot `classScoring.classCode`, label, rank, and
    points, preserving raw Legacy metadata.
  - Re-run the mismatch query.
- Required checks:
  - Read-only precheck already run.
  - Post-update mismatch query.
  - `git diff --check` for CR/documentation if changed.
- Privacy/security checks:
  - No names/contact data in command output.
  - No public API or serializer changes.
- Risks/assumptions:
  - The test preview should follow current portal classes rather than the
    mismatched Legacy class assignment.
- Context read before implementation:
  - `SESSION_HANDOFF.md` top block: yes
  - Relevant prior CR(s): `2026-07-20-legacy-running-result-import.md`,
    `2026-07-21-road-timekeeping-monitor.md`
  - Relevant source files: listed above

## Model / Subagent Plan

- Model switch needed: no
- Target model/role: current Codex implementation
- Subagent needed: no
- Subagent role: n/a
- Handoff source: this CR

## Confirmation Gate

- Gate needed: yes
- Reason: production DB staging-data mutation.
- Sensitive-data/production-data reason:
  - RUN result data is tied to teams, participants, start numbers, and classes.
- Approved by: Sebastian via "go" in chat
- Approval timestamp: 2026-07-21

## Implementation Notes

- Files changed:
  - `docs/cr/2026-07-21-running-testdata-class-fix.md`
- Important decisions during implementation:
  - Approval received; executed targeted staging-data correction for batch
    `cmruq55xj0005jr04nnvizbcx`.
  - Updated 74 RUN `ResultDraft.proposedResultSnapshot.classScoring` entries to
    the current portal team class.
  - Recalculated RUN rank and points per current portal class using the same
    `rankDiscipline` semantics as the app.
  - Preserved original Legacy class scoring metadata in
    `classScoring.correctedFromLegacy` and `legacy.originalClassScoring`.
  - Added a `portalClassCorrection` marker to the batch summary and validation
    summary.

## Verification

- Local checks:
  - Read-only precheck found 28 staged Legacy class vs portal team class
    mismatches.
  - Post-update DB check found 0 snapshot-vs-team class mismatches.
  - Post-update DB check found 0 team-vs-recalculated class mismatches for the
    74 staged RUN drafts.
- Build:
  - Not needed unless code changes are introduced.
- Targeted verification:
  - 74 RUN drafts remain present and corrected.
  - Corrected class counts:
    `schueler-a=7`, `schueler-b=17`, `jugend=5`, `damen-a=7`,
    `damen-b=12`, `jungsters=4`, `herren=17`, `masters=5`.
- Sensitive-data negative checks:
  - No code/API change planned.
- Authenticated role smoke:
  - Gap: Sebastian should check `Live -> Ergebnis -> Staging-Testdaten ->
    Laufen` in the browser after correction.
- Manual smoke:
  - Pending Sebastian browser check:
    `Live -> Ergebnis -> Staging-Testdaten -> Laufen`.

## Deploy

- Deployment needed: no
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

- Decide later whether the import preview should optionally warn when Legacy
  class metadata differs from the matched portal team class.
