# CR: Retire IONOS Static Portal Deploy

Status: Implemented
Date: 2026-07-15
Type: ops
Risk: medium
Owner: S5Evo

## Context

The production portal is deployed through Vercel and served via `https://portal.s5evo.de`. The old IONOS static deploy path for `portal.s5evo.de` is stale and misleading.

## Scope

- In scope:
  - Confirm `portal.s5evo.de` points to Vercel.
  - Retire local stale static artifacts for the old IONOS portal path in a recoverable way.
  - Update workspace deploy notes so Vercel is the canonical production path.
  - Back up the old IONOS `./portal/` remote directory before clearing it.
- Out of scope:
  - Removing IONOS infrastructure globally.
  - Changing Authentik or other IONOS-hosted services.
  - Changing application code or database state.

## Affected Flows

- User/API/admin flows touched:
  - None.
- Data model impact:
  - None.
- Auth/permission impact:
  - None.
- Production/deploy impact:
  - Production remains Vercel.
  - Old non-serving IONOS static content may be backed up and cleared.

## Data / API Design

- Proposed data model:
  - None.
- Proposed API shape:
  - None.
- Backward compatibility:
  - Public portal domain remains unchanged.
- Migration/data backfill:
  - None.

## Open Questions

- None for local cleanup.
- Remote IONOS clear should happen only after backup succeeds.

## Acceptance Criteria

- DNS/HTTP confirms `portal.s5evo.de` is served by Vercel.
- Local stale `build/` and root `deploy.sh` are no longer active working-tree artifacts.
- `TOOLS.md` says Vercel is canonical for `portal.s5evo.de`.
- Remote IONOS `./portal/` is backed up before any clear operation.
- CR records verification and remaining gaps.

## Implementation Handoff

- Relevant files:
  - `TOOLS.md`
  - `docs/cr/2026-07-15-retire-ionos-static-portal.md`
  - local ignored `build/`
  - local ignored root `deploy.sh`
  - IONOS remote `./portal/`
- Current decisions:
  - Keep Vercel as the only canonical production deploy path for `portal.s5evo.de`.
  - Do not remove all IONOS references because other services may still use IONOS.
  - Do not manually edit live skill files; use Skill Workshop for skill updates.
- Open decisions:
  - Skill proposal approval/apply remains separate if needed.
- Non-goals:
  - No production app deploy.
  - No DB mutation.
- Expected implementation steps:
  - Verify production DNS/header.
  - Move local stale files into a backup directory.
  - Update `TOOLS.md`.
  - Back up remote IONOS portal directory via rsync.
  - Clear remote IONOS portal only after backup exists.
  - Run lightweight verification.
- Required checks:
  - DNS/HTTP check for production alias.
  - `git diff --check`.
  - IONOS remote backup file count.
- Risks/assumptions:
  - Remote IONOS `./portal/` is not live for `portal.s5evo.de` because DNS points to Vercel.
  - IONOS shell may be restricted to rsync only.

## Model / Subagent Plan

- Model switch needed: no
- Target model/role: current Codex operator
- Subagent needed: no
- Subagent role: n/a
- Handoff source: this CR and `SESSION_HANDOFF.md`

## Confirmation Gate

- Gate needed: yes
- Reason: remote IONOS file mutation.
- Approved by: Sebastian via Telegram "Bitte deiner Empfehlung folgend umsetzen."
- Approval timestamp: 2026-07-15 18:02 UTC

## Implementation Notes

- Files changed:
  - `TOOLS.md`
  - `docs/cr/2026-07-15-retire-ionos-static-portal.md`
  - ignored local legacy artifacts moved into `backups/retired-ionos-static-20260715T1802Z/`
- Important decisions during implementation:
  - `portal.s5evo.de` production remains Vercel; no app deploy was needed.
  - Local stale root `deploy.sh` and `build/` were moved into backup instead of deleted.
  - IONOS remote `./portal/` was backed up before clearing.
  - Live skill files were not edited directly; Skill Workshop update/apply was used.
  - Initial proposals were applied but were too proposal-like in the live skill content:
    - `s5evo-change-request-20260715-a57f0e768c`
    - `ionos-deploy-20260715-eb833dcb67`
  - Follow-up repair proposals restored complete skill text and are the effective applied updates:
    - `s5evo-change-request-20260715-4e65b087b0`
    - `ionos-deploy-20260715-dd6874691e`
  - Support-file proposal `ionos-deploy-20260715-3f2a8608e9` timed out during apply and remains pending; live skill text still contains the essential retired-target rule.

## Verification

- Local checks:
  - `git diff --check` passed.
- Build:
  - Not needed; no app code change.
- Targeted verification:
  - `dig +short portal.s5evo.de CNAME` returned `c5e58f9b25fcd1da.vercel-dns-017.com.`
  - `curl -sSI https://portal.s5evo.de/zeitnahme` returned HTTP 200 with `server: Vercel`.
  - IONOS remote backup created with 69 files, 2.3 MB.
  - IONOS remote `./portal/` dry-run after clear reported total size `0`.
- Manual smoke:
  - Not needed; production alias stays on Vercel.

## Deploy

- Deployment needed: no
- Deployment ID: n/a
- Deployment URL: n/a
- Production alias: `https://portal.s5evo.de`
- Deployed at: n/a

## Post-Deploy Smoke

- Routes checked:
  - `https://portal.s5evo.de/zeitnahme` -> HTTP 200, `server: Vercel`.
- API checks:
  - Not needed.
- Result:
  - Passed. Clearing stale IONOS static remote did not affect the live Vercel-backed portal alias.

## Follow-Ups

- Optional: decide what to do with pending support-file proposal `ionos-deploy-20260715-3f2a8608e9`; it is not required for the portal deploy rule because the live IONOS skill text now marks `portal.s5evo.de` retired.
