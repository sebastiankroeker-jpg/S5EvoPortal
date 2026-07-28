# SESSION HANDOFF

Updated: 2026-07-28 UTC
Purpose: current operational state for the next S5Evo work session. Historical
handoffs are archived; CR documents remain the authoritative implementation
and decision record.

## Read first

- Portal scope is the defined club competition, not modern pentathlon in
  general. Valid discipline codes: `RUN`, `BENCH`, `STOCK`, `ROAD`, `MTB`.
- `MD` means Mannschafts-Dashboard. A start number belongs to `Team`
  (`Team.startNumber` / `team_startnummer`), not to an individual participant.
- Never rely on UI visibility for access control. Tenant and competition
  boundaries must be enforced server-side.
- Deploy the portal only through Vercel production:
  `vercel deploy --prod --yes`, then `npm run smoke:public` and an active API
  route check against `https://portal.s5evo.de`.

## Current repository state

- Branch: `main`; production source commit `6bf9e10` is pushed to
  `origin/main`. Competition-role release is in progress.
- Functional baseline: `6bf9e10 Harden competition-scoped permission guards`.
- Most recent delivered work:
  - sanitized GPX route tracks: `981ce3b`;
  - stock result/detail responsive work: `6113c39` and `889ea5f`;
  - visitor statistics tenant-scope fix: `af46340`;
  - participant/search indexing privacy: `2a15fab`.
  - dynamic permission matrix and Friends map access:
    `docs/cr/2026-07-27-dynamic-permission-role-mapping.md` and
    `docs/cr/2026-07-27-friends-role-map-access.md`.
- Workspace-specific files such as `AGENTS.md`, `HEARTBEAT.md`, `MEMORY.md`
  and `SOUL.md` are intentionally untracked and must not be committed to the
  portal repository.
- The competition-role follow-up CR is versioned at
  `docs/cr/2026-07-28-competition-scoped-role-grants.md`.
- This handoff was consolidated from an append-only document. The complete
  prior version is preserved at
  `docs/handoffs/archive/2026-07-28-session-handoff-pre-consolidation.md`.

## Production / verification

- Production alias: `https://portal.s5evo.de` (Vercel).
- Current functional deployment:
  - ID: `dpl_RfsnagAZeSdP3TZTjSjt8YcZxvGw`
  - URL:
    `https://s5-evo-portal-h2mj8j9qy-sebastiankroeker-2781s-projects.vercel.app`
  - State: `READY`
- Production migrations applied:
  - `20260728043000_add_dynamic_role_permissions`
  - `20260728043100_seed_friends_map_permission`
  - `20260728091500_add_competition_roles`
- Latest verification:
  - public smoke passed;
  - `/api/admin/role-permissions` without session -> 401;
  - `/api/admin/participants?competitionId=invalid` without session -> 401;
  - `/karte` without session -> 307 redirect;
  - authenticated Friends/non-admin and cross-competition timekeeping smokes
    remain documented gaps because no controlled test sessions are available.
- The latest known portal deployment state and smoke evidence belongs in the
  relevant CR; do not treat older deployment IDs as current. Before another
  production change, verify the live alias and run the normal smoke suite.
- For DB changes: prepare schema and migration, deploy application code, run
  `npx prisma migrate deploy`, then run public smoke and targeted protected
  route checks. Do not combine unrelated changes in the same deploy.

## OpenClaw operating state

- OpenClaw: `2026.7.1-2` at last verification; gateway service was active.
- OpenAI auth order: Codex/ChatGPT OAuth first, API-key profile only as
  fallback. Never expose credentials or the gateway token in a handoff/log.
- Default model is configured as `openai/gpt-5.6-terra` with the native Codex
  runtime. `openai/gpt-5.6-sol` remains selectable as `sol`.
- Model selection for the already-running chat can lag the config. Confirm
  effective model with the session status after a new turn/session.
- Configuration backup before the Terra switch:
  `~/.openclaw/openclaw.json.bak-20260728-terra-default`.

## Active CRs — ordered work queue

1. **Competition-scoped permissions audit** — Deployed.
   `docs/cr/2026-07-27-competition-scoped-permissions-audit.md`
   All 78 API routes are classified by the executable inventory in
   `scripts/verify-tenant-scope.ts`. The high-severity cross-scope
   timekeeping-session-ID write path is fixed and deployed in `6bf9e10`.
   Target model: tenant-wide `ADMIN`, additive competition grants for
   `MODERATOR` and `ZEITNAHME`; `FRIENDS` timing remains open.

2. **Competition-scoped role grants** — Release in progress, high risk.
   `docs/cr/2026-07-28-competition-scoped-role-grants.md`
   Adds `CompetitionRole` for `MODERATOR`/`ZEITNAHME`, strict competition and
   entity guards, selected-competition admin UI/messaging, scoped profile/cache
   and a green two-competition negative matrix. The additive production
   migration is applied; source deployment is in progress.
   Aggregate inventory: 2 competitions, 3 legacy tenant-wide timekeeping
   grants, no legacy moderators. Release migration, commit/push and deploy were
   approved on 2026-07-28; role conversion remains separately gated.
   New policy/test/migration files are hidden by local `.git/info/exclude` and
   require explicit `git add -f` when the release package is approved.

3. **Dynamic permission role mapping** — Deployed.
   `docs/cr/2026-07-27-dynamic-permission-role-mapping.md`
   V1 provides tenant-scoped mappings for system roles. Only
   `admin.roles.manage` and `portal.map.view` are active permission consumers;
   legacy route guards remain until the audit.

4. **Friends role with map access** — Deployed.
   `docs/cr/2026-07-27-friends-role-map-access.md`
   `FRIENDS` is tenant-scoped and seeded with `portal.map.view`, without admin,
   participant/contact/export, audit, timekeeping or staging permissions.

5. **Competition clone / 5Kampf 2027 preparation** — Draft, medium risk.
   `docs/cr/2026-07-27-competition-clone-2027-prep.md`
   Clone configuration, map routes and home/news into a new draft competition;
   never clone teams, participants, contacts, results, tokens, messages,
   audits, counters or staging data. Admin-only, source/target tenant checked
   server-side, and production clone execution requires explicit confirmation.

## Working method

- Each product change starts from a CR in `docs/cr/`; use
  `docs/cr/_template.md` and `skills/s5evo-change-request/SKILL.md`.
- CRs own requirements, decisions, risk/privacy analysis, implementation,
  verification evidence and release history. Do not copy them into this file.
- Keep the handoff current-only. Replace superseded facts rather than append
  them. Archive a full previous version only when a material consolidation is
  needed.
- Before a model switch, subagent delegation, production deploy, database
  migration, production-data mutation or external message: ensure the CR has
  an explicit handoff/gate and record the result in that CR.
- Treat PII carefully: no raw production payloads, credentials, claim tokens,
  contact data or screenshots with sensitive data in handoffs or technical
  logs.

## First steps next session

1. Read this file, then open the selected CR only.
2. Re-check `git status --short --branch`, current production reachability and
   any deployment/migration state relevant to that CR.
3. Treat the completed audit and deployed timekeeping scope fix as baseline.
4. Review the locally completed competition-role CR and diff.
5. At the release gate, request one explicit approval covering additive DB
   migration, forced staging of excluded files, commit/push to auto-deploying
   `main` and Vercel production deploy.
6. Apply the additive migration before pushing the application, then verify
   Vercel/alias/smoke. Convert the three legacy timekeeping grants only after
   their target competitions are confirmed.
