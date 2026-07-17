# CR: Privacy Guardrails in CR-Methodik

Status: Implemented
Date: 2026-07-17
Type: ops
Risk: medium
Owner: S5Evo

## Context

Sebastian raised a valid concern after adding manager phone numbers to normal team registrations: the portal handles sensitive data such as birth dates, e-mail addresses, phone numbers, claim/account-link state, and PWA offline read models. The existing CR workflow covered release/deploy discipline well, but PII/privacy checks were not explicit enough.

## Scope

- In scope:
  - Add a `Privacy / Security Review` block to the CR template.
  - Make sensitive-data impact, offline/cache/export/log/mail impact, negative checks, authenticated-smoke gaps, and context-read evidence visible in every new CR.
  - Create a Skill Workshop update proposal for `s5evo-change-request` with durable PII/privacy workflow rules.
  - Record the pending skill proposal and guardrail state in `SESSION_HANDOFF.md`.
- Out of scope:
  - No production app behavior change.
  - No database or API change.
  - No immediate audit of every existing serializer/cache/export.
  - No direct manual edit to the live skill file.

## Affected Flows

- User/API/admin flows touched:
  - None at runtime.
- Data model impact:
  - None.
- Auth/permission impact:
  - None.
- Sensitive data impact:
  - Future CRs must explicitly review sensitive data touched.
- Offline/cache/export/log/mail impact:
  - Future CRs must explicitly document and verify these paths when relevant.
- Production/deploy impact:
  - None.

## Privacy / Security Review

- Sensitive fields touched:
  - Methodology only; no live data touched.
- Purpose / data minimization:
  - Add a durable checklist so future changes avoid unnecessary collection, exposure, logging, export, or offline caching.
- Visibility by role/user/API/UI:
  - No runtime visibility change.
- Persistence locations:
  - `docs/cr/_template.md`, `SESSION_HANDOFF.md`, pending Skill Workshop proposal.
- Offline/cache behavior, TTL/invalidation/logout clearing:
  - No runtime cache change; checklist now forces explicit review for future offline-cache changes.
- Logs/mails/exports/screenshots exposure:
  - No runtime exposure change; checklist now forces explicit review for future changes.
- Negative checks for unauthorized access or payload leakage:
  - Not applicable to this methodology-only CR.
- Authenticated smoke plan or explicit gap:
  - Not applicable.
- Residual risk:
  - The Skill Workshop proposal is pending until explicitly applied.

## Data / API Design

- Proposed data model:
  - No change.
- Proposed API shape:
  - No change.
- Backward compatibility:
  - Existing CRs remain as-is; new CRs use the enriched template.
- Migration/data backfill:
  - None.

## Open Questions

- Whether to apply Skill Workshop proposal `s5evo-change-request-20260717-3cf3ed0e22` immediately or after Sebastian explicitly confirms applying the pending proposal.

## Acceptance Criteria

- New CR template contains explicit privacy/security review prompts.
- New CR template asks for sensitive-data negative checks and authenticated-smoke coverage/gaps.
- `SESSION_HANDOFF.md` records the pending skill update proposal and current guardrail state.
- Live skill file is not edited manually.

## Implementation Handoff

- Relevant files:
  - `docs/cr/_template.md`
  - `SESSION_HANDOFF.md`
  - Skill Workshop proposal `s5evo-change-request-20260717-3cf3ed0e22`
- Current decisions:
  - Update CR template directly in repo.
  - Use Skill Workshop for the reusable skill update.
- Open decisions:
  - Apply pending skill proposal after explicit approval.
- Non-goals:
  - No runtime app change.
- Expected implementation steps:
  - Create Skill Workshop update proposal.
  - Patch CR template.
  - Patch handoff.
  - Commit docs.
- Required checks:
  - `git diff --check`.
- Privacy/security checks:
  - Verify no live skill file was manually edited.
- Risks/assumptions:
  - The template is active immediately for future CRs, but the skill update remains pending.
- Context read before implementation:
  - `SESSION_HANDOFF.md` top block: yes.
  - Relevant prior CR(s): `docs/cr/2026-07-17-normal-team-contact-phone.md`.
  - Relevant source files: `skills/s5evo-change-request/SKILL.md`, `docs/cr/_template.md`.

## Model / Subagent Plan

- Model switch needed: no
- Target model/role: current Codex operator
- Subagent needed: no
- Subagent role: n/a
- Handoff source: this CR and `SESSION_HANDOFF.md`.

## Confirmation Gate

- Gate needed: no
- Reason: documentation/methodology-only repo guardrail plus pending skill proposal; no production deploy or live skill apply.
- Sensitive-data/production-data reason: no live data touched.
- Approved by: Sebastian via Telegram "Bitte guardrail & skill updaten"
- Approval timestamp: 2026-07-17 12:31 UTC

## Implementation Notes

- Files changed:
  - `docs/cr/_template.md`
  - `SESSION_HANDOFF.md`
  - `docs/cr/2026-07-17-privacy-guardrail-methodology.md`
- Important decisions during implementation:
  - Skill update was created through Skill Workshop, not by manually editing the live skill file.
  - Skill proposal remains pending until explicitly applied.

## Verification

- Local checks:
  - Pending.
- Build:
  - Not required.
- Targeted verification:
  - Pending.
- Sensitive-data negative checks:
  - Not applicable; no runtime behavior.
- Authenticated role smoke:
  - Not applicable.
- Manual smoke:
  - Not applicable.

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
- Result: not applicable.

## Follow-Ups

- Apply Skill Workshop proposal `s5evo-change-request-20260717-3cf3ed0e22` after explicit approval.
- Add a dedicated runtime privacy audit CR for PWA offline cache minimization and serializer payload shape.
