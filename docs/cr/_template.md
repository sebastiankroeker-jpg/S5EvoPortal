# CR: <title>

Status: Draft
Date: YYYY-MM-DD
Type: feature | hotfix | schema | ops | content
Risk: low | medium | high
Owner: S5Evo

## Context

What triggered this change?

## Scope

- In scope:
- Out of scope:

## Affected Flows

- User/API/admin flows touched:
- Data model impact:
- Auth/permission impact:
- Sensitive data impact:
- Offline/cache/export/log/mail impact:
- Production/deploy impact:

## Privacy / Security Review

Use for any CR touching birth dates, names tied to participants, e-mail, phone, claim tokens/links, account-link state, roles, audit trails, private marketplace/MTC data, exports, mails, logs, or offline caches.

- Sensitive fields touched:
- Purpose / data minimization:
- Visibility by role/user/API/UI:
- Persistence locations (DB, localStorage/IndexedDB, files, logs, audit, external services):
- Offline/cache behavior, TTL/invalidation/logout clearing:
- Logs/mails/exports/screenshots exposure:
- Negative checks for unauthorized access or payload leakage:
- Authenticated smoke plan or explicit gap:
- Residual risk:

## Data / API Design

- Proposed data model:
- Proposed API shape:
- Backward compatibility:
- Migration/data backfill:

## Open Questions

- Decision 1:
- Decision 2:

## Acceptance Criteria

- Criterion 1
- Criterion 2

## Implementation Handoff

Use before model switch or subagent delegation.

- Relevant files:
- Current decisions:
- Open decisions:
- Non-goals:
- Expected implementation steps:
- Required checks:
- Privacy/security checks:
- Risks/assumptions:
- Context read before implementation:
  - `SESSION_HANDOFF.md` top block:
  - Relevant prior CR(s):
  - Relevant source files:

## Model / Subagent Plan

- Model switch needed: yes | no
- Target model/role:
- Subagent needed: yes | no
- Subagent role:
- Handoff source:

## Confirmation Gate

- Gate needed: yes | no
- Reason:
- Sensitive-data/production-data reason:
- Approved by:
- Approval timestamp:

## Implementation Notes

- Files changed:
- Important decisions during implementation:

## Verification

- Local checks:
- Build:
- Targeted verification:
- Sensitive-data negative checks:
- Authenticated role smoke:
- Manual smoke:

## Deploy

- Deployment needed: yes | no
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

- None
