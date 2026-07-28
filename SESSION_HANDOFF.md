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

- Branch: `main`; production source commit `d2923d4` is pushed to
  `origin/main`.
- Functional baseline: `d2923d4 fix: restrict project status to admins`.
- The completed
  high-risk production-data action is:
  `docs/cr/2026-07-28-competition-classification-configuration.md` makes
  persisted, per-competition classes the rule source for registration,
  changes, results, timekeeping and clone. Its schema/feature and the exact
  reviewed 2026 baseline backfill are deployed.
- Follow-up production-data action (2026-07-28): set the existing 2027 Draft
  in Admin to `PORTAL_USERS` for both portal visibility and registration,
  then run the authenticated Portal-User registration smoke. Sebastian has
  already decided this is the intended configuration; the change itself
  remains a deliberate UI action.
- Most recent delivered work:
  - sanitized GPX route tracks: `981ce3b`;
  - stock result/detail responsive work: `6113c39` and `889ea5f`;
  - visitor statistics tenant-scope fix: `af46340`;
  - participant/search indexing privacy: `2a15fab`.
  - dynamic permission matrix and Friends map access:
    `docs/cr/2026-07-27-dynamic-permission-role-mapping.md` and
    `docs/cr/2026-07-27-friends-role-map-access.md`.
  - competition-scoped operational roles: `104e803`.
  - legacy operational-role compatibility removal: `40d9d7a`.
  - competition clone preparation flow: `d4c7218`.
  - task-oriented navigation and shared menu source: `6999e6f`.
  - combined-class ranking/tiebreak correction and result-list start-number
    visibility: `ee03206`.
  - competition visibility, default selection and explicit registration
    competition context: `f0023cc`.
  - home competition metadata/news hotfix: `ab0fb31`.
  - public default-competition selection fix: `894a358`.
  - admin-only project status and `v0.8.0` release update: `d2923d4`.
- Workspace-specific files such as `AGENTS.md`, `HEARTBEAT.md`, `MEMORY.md`
  and `SOUL.md` are intentionally untracked and must not be committed to the
  portal repository.
- The competition-role follow-up CR is versioned at
  `docs/cr/2026-07-28-competition-scoped-role-grants.md`.
- The legacy operational-role removal CR is deployed in `40d9d7a` and its
  release record was pushed in `b218e37`:
  `docs/cr/2026-07-28-remove-legacy-operational-role-compatibility.md`.
- This handoff was consolidated from an append-only document. The complete
  prior version is preserved at
  `docs/handoffs/archive/2026-07-28-session-handoff-pre-consolidation.md`.

## Production / verification

- Production alias: `https://portal.s5evo.de` (Vercel).
- Current functional deployment:
  - ID: `dpl_ECr7qfu3m7kM1NbR8HHb9E1vRzMn`
  - URL:
    `https://s5-evo-portal-fo40lflrn-sebastiankroeker-2781s-projects.vercel.app`
  - State: `READY`
- Production migrations applied:
  - `20260728043000_add_dynamic_role_permissions`
  - `20260728043100_seed_friends_map_permission`
  - `20260728091500_add_competition_roles`
  - `20260728105000_disallow_tenant_wide_operational_roles`
  - `20260728133000_add_competition_classification_metadata`
  - `20260728162000_add_competition_portal_visibility`
- Latest verification:
  - public smoke passed;
  - `/api/admin/users?competitionId=invalid` without session -> 401;
  - `/api/timekeeping/snapshot` for the active competition without session
    -> 401; without a competition ID -> 400 validation failure;
  - `/api/profile/roles` without session -> 200 with only `ZUSCHAUER`;
  - `/karte` without session -> 307 redirect;
  - post-conversion aggregate inventory: three competition-scoped
    `ZEITNAHME` grants for the active competition, zero legacy tenant-wide
    `ZEITNAHME` rows and zero legacy tenant-wide moderators;
  - authenticated cross-competition smokes remain a documented gap because no
    controlled test sessions are available.
  - result-hotfix smoke: `/api/results` for 2026 is public as before and its
    payload includes persisted start numbers; combined classes recompute their
    rank from raw values instead of source-class published ranks.
  - competition visibility smoke: anonymous `/api/competitions` does not list
    the 2027 Draft, its direct `/api/competition?id=` read returns `404`, and
    an anonymous registration write is rejected. The authenticated
    Portal-User success path remains pending the deliberate 2027 UI setting.
  - clone feature deployment: public smoke is green; the new clone API
    returns `401` without a session and did not create any production data.
  - `v0.8.0` project-status release: public smoke is green; Changelog
    read/write API both return `401` without a session. A controlled
    authenticated non-admin role smoke is still pending.
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
   All 80 API routes are classified by the executable inventory in
   `scripts/verify-tenant-scope.ts`. The high-severity cross-scope
   timekeeping-session-ID write path is fixed and deployed in `6bf9e10`.
   Target model: tenant-wide `ADMIN`, additive competition grants for
   `MODERATOR` and `ZEITNAHME`; `FRIENDS` timing remains open.

2. **Competition-scoped role grants** — Deployed, high risk.
   `docs/cr/2026-07-28-competition-scoped-role-grants.md`
   Adds `CompetitionRole` for `MODERATOR`/`ZEITNAHME`, strict competition and
   entity guards, selected-competition admin UI/messaging, scoped profile/cache
   and a green two-competition negative matrix. Migration, source and Vercel
   production deployment are complete in `104e803`.
   Aggregate inventory after the explicit UI conversion: 2 competitions, 3
   scoped timekeeping grants for the active competition, no tenant-wide
   operational grants. The role conversion is complete.

3. **Remove legacy operational-role compatibility** — Deployed, high risk.
   `docs/cr/2026-07-28-remove-legacy-operational-role-compatibility.md`
   Removes effective tenant-wide `MODERATOR`/`ZEITNAHME` fallback paths and
   adds a database constraint preventing their future creation. Local scope
   matrix, route inventory, ESLint, TypeScript, production build and
   post-deploy smoke are green. Constraint migration is applied in `40d9d7a`,
   deployment `dpl_HSDTjtAdyEaxxSwdDfgstM5WCS2S` is READY. The only remaining
   test gap is a controlled authenticated production cross-competition smoke.

4. **Dynamic permission role mapping** — Deployed.
   `docs/cr/2026-07-27-dynamic-permission-role-mapping.md`
   V1 provides tenant-scoped mappings for system roles. Only
   `admin.roles.manage` and `portal.map.view` are active permission consumers;
   legacy route guards remain until the audit.

5. **Friends role with map access** — Deployed.
   `docs/cr/2026-07-27-friends-role-map-access.md`
   `FRIENDS` is tenant-scoped and seeded with `portal.map.view`, without admin,
   participant/contact/export, audit, timekeeping or staging permissions.

6. **Tenant context resolution hardening** — Deployed, high risk.
   `docs/cr/2026-07-28-tenant-context-resolution-hardening.md`
   The historical closed 2024 event remains in a second tenant; intended model
   is one club tenant with multiple competitions. Direct tenant auth now needs
   an explicit tenant ID, competition/entity routes resolve their own target,
   and portal-global routes opt into any-tenant admin access. Commit `7414bb4`
   and deployment `dpl_BnrF18c3TrPWfuTnXNa8dSqKntjD` are READY on the portal
   alias. Scope, clone, admin-scope, TypeScript, production build and public
   smoke are green. No DB migration or data mutation. Authenticated two-tenant
   smoke remains a gap.

7. **Competition clone / 5Kampf 2027 preparation** — 2027 DRAFT created and
   verified, medium risk.
   `docs/cr/2026-07-27-competition-clone-2027-prep.md`
   Admin-only, transactional clone of configuration, persisted disciplines and
   non-archived competition news into a reviewed draft;
   no team/person/result/contact/token/message/audit/counter/staging data is
   copied. Maps remain shared static configuration. Target dates, deadlines and
   registration notification mail are cleared. The feature has a dry-run and
   a typed target-name confirmation. Sebastian performed the reviewed UI clone
   after the green preview. The target is a DRAFT with five disciplines, ten
   persisted classes and one draft news entry; dates/deadlines/notification
   address are cleared and its age reference is 2027. No team, participant,
   result, token, message, role, timekeeping, result-staging, layout, consent
   or counter data was copied. The single target audit event records the clone
   action itself; it is not copied history. Sebastian confirmed the class policy:
   the selected competition year drives age totals and youth cohorts, while
   2026 remains reproducible. The 2027 matrix and the 2019 cohort boundary
   are covered locally and the feature is deployed in `d4c7218`. The first
   authenticated preview exposed a source-tenant resolution regression; its
   narrower competition-specific admin guard is deployed in the broader
   tenant-context hardening release. The authenticated admin dry-run and the
   aggregate production target audit are green. Review the DRAFT before any
   publication or registration opening.

8. **Wettkampfspezifische Klassenkonfiguration** — Feature and 2026 baseline
   backfill deployed, high risk.
   `docs/cr/2026-07-28-competition-classification-configuration.md`
   The 2026 OPEN competition now has the exact ten reviewed persisted class
   rows, so clone preview reports ten source classes. The 2024 CLOSED
   competition's ten historic rows were not modified. The 2026 transaction
   verified unchanged team, participant and result counts; public config
   returns only non-sensitive rule metadata. Local classification regressions
   and public smoke are green. Authenticated Admin/registration/timekeeping/
   results smoke remains a manual gap before any custom class-rule change.

9. **Navigation und Informationsarchitektur** — Deployed, standard risk.
   `docs/cr/2026-07-28-navigation-information-architecture.md`
   Sidebar, Suche und mobile Command-Pill derive their allowed destinations
   from one task-oriented source: Wettkampf, Arbeiten, Verwalten and Konto.
   Old mobile placeholders are removed; Karte uses `portal.map.view` across
   all menu surfaces. Commit `6999e6f`, deployment
   `dpl_32dBxsazMw6LcPj8vh3WHPXLUAFU` is READY. Public and unauthenticated
   smokes are green. Manual role navigation smoke (ZUSCHAUER, TEAMCHEF,
   ZEITNAHME, ADMIN; Friends if available) remains pending.

10. **Admin-only Projektstand und Release-Update** — Deployed, standard risk.
    `docs/cr/2026-07-28-admin-project-status-access-and-update.md`
    Version, Changelog, Header, Suche, Command-Pill und Orga-Links verwenden
    die reale `ADMIN`-Rolle. Die Seite wartet auf die Rollenauflösung und
    zeigt Nicht-Admins keine Projektstands-/Feedback-Inhalte; die POST-API
    verwendet nun die serverseitige Tenant-Admin-Prüfung. Commit `d2923d4`,
    deployment `dpl_ECr7qfu3m7kM1NbR8HHb9E1vRzMn` is READY. Public smoke and
    unauthenticated GET/POST negatives are green; an authenticated
    non-admin smoke remains pending.

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
3. Treat the completed audit and deployed competition-role model as baseline.
4. Retain the authenticated cross-competition smoke gap in the security
   release record; create controlled role test sessions before the next
   permission-sensitive release where feasible.
5. For the deployed class-configuration CR, record an authenticated Admin,
   registration, timekeeping and result smoke before any custom 2026 rule
   change. Keep actual 2027 production target creation behind its own
   data-mutation gate.
6. Record the manual navigation smoke for the four operational role views;
   this does not block normal portal use but should precede another
   navigation-information-architecture change.
7. The 2027 competition exists as a DRAFT. Review dates, registration settings
   and the copied news before a separate decision to publish/open it.
8. For the project-status access change, perform one controlled authenticated
   non-admin direct-route/API smoke before treating the role coverage as
   complete.
