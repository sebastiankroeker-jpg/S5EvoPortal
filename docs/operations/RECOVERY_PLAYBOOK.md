# Recovery Playbook

This playbook minimizes risk when recovering features after incidents.

## Rules

1. `main` is the only production source branch.
2. Recovery changes must be shipped in small, isolated packages.
3. Every package must include explicit "in scope" and "not in scope".
4. No direct push to `main` (enforce in GitHub branch protection).

## Required Checks per Package

Run all checks locally and in CI:

- `npm run verify:recovery-guardrails`
- `npm run verify:team-draft`
- `npm run verify:participant-edit-flow`
- `npm run build`

## Deploy Policy

1. Merge PR into `main`.
2. Deploy production from `main` only.
3. Run post-deploy smoke:
   - public routes: `200`
   - protected routes without session: `401`
   - known endpoint validation/method expectations: `400`/`405`

## Fast Rollback

If regression is detected:

1. Revert the offending commit on `main`.
2. Push revert commit.
3. Redeploy production from updated `main`.
4. Re-run smoke checks.
5. Post short incident summary in project channel/ticket.

## Incident Template

- Impact:
- Started at:
- Detected at:
- Affected paths/features:
- Mitigation:
- Recovery package(s):
- Follow-up guardrail improvement:

