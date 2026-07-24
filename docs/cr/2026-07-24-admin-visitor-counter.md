# CR: Admin-only visitor counter

Status: Deployed
Date: 2026-07-24
Type: feature
Risk: medium
Owner: S5Evo

## Context

Sebastian requested an internal visitor counter for admins.

Because visitor counting can become tracking, the first version should be
privacy-preserving and intentionally small.

## Scope

- In scope:
  - Admin-only visitor/page-view counter.
  - Aggregate counts per day and coarse page area.
  - No external analytics provider.
  - No client-side tracking cookies or visitor identifiers.
  - Admin UI summary with today / last 7 days / total and route breakdown.
- Out of scope:
  - Unique visitor counting.
  - IP address storage.
  - User-agent storage.
  - Geo/location/device/browser analytics.
  - Per-user tracking or session replay.
  - Marketing analytics integrations.

## Affected Flows

- User/API/admin flows touched:
  - Public page visits would increment aggregate counters.
  - Admins would see summary counters in an internal admin surface.
- Data model impact:
  - New aggregate counter table or equivalent storage.
- Auth/permission impact:
  - Read access admin-only.
  - Write/increment endpoint public but should only accept coarse route keys and
    no user-submitted PII.
- Sensitive data impact:
  - Avoided by design: no IP, no user agent, no cookie, no user id, no
    participant/team id.
- Offline/cache/export/log/mail impact:
  - No offline cache, no export, no mail.
  - Technical logs should not print visitor details.
- Production/deploy impact:
  - Requires schema migration and production deploy.

## Privacy / Security Review

- Sensitive fields touched:
  - None intended.
- Purpose / data minimization:
  - Operational insight only: rough usage counts.
  - Store only date, route bucket, count, timestamps.
- Visibility by role/user/API/UI:
  - Aggregate read endpoint admin-only.
  - Increment endpoint public, but accepts only a whitelisted page area.
- Persistence locations:
  - Database aggregate table.
  - No localStorage/IndexedDB/cookies.
  - No raw request details in application logs.
- Offline/cache behavior, TTL/invalidation/logout clearing:
  - No offline cache.
- Logs/mails/exports/screenshots exposure:
  - No mails/exports.
  - Smoke output should include only aggregate shape, not request metadata.
- Negative checks for unauthorized access or payload leakage:
  - Admin stats endpoint must return 401/403 without admin session.
  - Increment endpoint must reject arbitrary route labels outside whitelist.
- Authenticated smoke plan or explicit gap:
  - Public smoke can check increment endpoint and unauthorized stats access.
  - Authenticated admin UI smoke remains manual unless admin cookie is available.
- Residual risk:
  - Page-view counts are not unique visitors.
  - Counts can be inflated by reloads or bots.

## Data / API Design

- Proposed data model:
  - `VisitorCounter` or `PageViewCounter` with:
    - `id`
    - `tenantId`
    - `competitionId`
    - `day`
    - `surface`
    - `routeKey`
    - `count`
    - `createdAt`
    - `updatedAt`
  - Unique key on tenant/competition/day/surface/routeKey.
- Proposed API shape:
  - `POST /api/visitor-counter`
    - Public, accepts whitelisted `{ routeKey, surface }`.
    - Increments aggregate count only.
  - `GET /api/admin/visitor-counter`
    - Admin-only aggregate summary.
- Backward compatibility:
  - New API/table only.
- Migration/data backfill:
  - New migration, no backfill.

## Open Questions

- Placement:
  - Admin overview tile, `/admin/logs`, or own admin card?
- Route buckets:
  - Suggested V1: `home`, `live`, `results`, `teams`, `startlists`,
    `registration`, `map`, `marketplace`.
- Bot/reload handling:
  - V1 counts page views, not unique visitors.

## Acceptance Criteria

- Admins can see aggregate visitor/page-view counts.
- Non-admins cannot read counters.
- Public visits do not store IP, user agent, user id, participant id, team id,
  or cookie/session identifiers.
- Public increment endpoint accepts only whitelisted route keys.
- Production migration/deploy has rollback notes.

## Implementation Handoff

- Relevant files:
  - `prisma/schema.prisma`
  - `app/api/visitor-counter/route.ts`
  - `app/api/admin/visitor-counter/route.ts`
  - Admin UI target TBD
  - Public page/provider hook TBD
- Current decisions:
  - V1 aggregates page views, not unique visitors.
  - No cookies or identifiers.
- Open decisions:
  - Admin UI placement.
  - Exact route bucket list.
- Non-goals:
  - No unique visitors.
  - No external analytics.
  - No raw request tracking.
- Expected implementation steps:
  - Add Prisma model and migration.
  - Add public aggregate increment endpoint.
  - Add admin aggregate read endpoint.
  - Add tiny client-side page-view reporter with route whitelist.
  - Add admin summary UI.
- Required checks:
  - `npx prisma generate`
  - targeted ESLint
  - `npx tsc --noEmit`
  - `npm run build`
  - `git diff --check`
  - `npx prisma migrate deploy` on production after approval
  - `npm run smoke:public`
- Privacy/security checks:
  - Verify no raw IP/UA/cookie/user/session data is stored.
  - Verify admin stats endpoint unauthorized access is rejected.
  - Verify increment endpoint route whitelist.
- Risks/assumptions:
  - Page views can be inflated; this is acceptable for V1.
  - Schema migration requires explicit deploy approval.
- Context read before implementation:
  - `SESSION_HANDOFF.md` top block: pending before implementation
  - Relevant source files: partially inspected

## Confirmation Gate

- Gate needed: yes
- Reason: schema migration, production deploy, analytics/privacy behavior.
- Sensitive-data/production-data reason:
  - Visitor tracking can become personal-data processing if implemented
    carelessly; V1 explicitly avoids identifiers.
- Approved by: Sebastian ("Ja, V1 bitte implementieren")
- Approval timestamp: 2026-07-24 20:18 UTC
- Production migration/deploy approved by: Sebastian ("Go")
- Production migration/deploy approval timestamp: 2026-07-24 20:29 UTC

## Implementation Notes

- Files changed:
  - `prisma/schema.prisma`
  - `prisma/migrations/20260724202000_add_page_view_counters/migration.sql`
  - `lib/visitor-counter.ts`
  - `lib/server-visitor-counter.ts`
  - `app/api/visitor-counter/route.ts`
  - `app/api/admin/visitor-counter/route.ts`
  - `app/components/visitor-counter-reporter.tsx`
  - `app/providers.tsx`
  - `app/admin/logs/page.tsx`
- Important decisions during implementation:
  - Admin stats endpoint is ADMIN-only.
  - Public increment endpoint stores only whitelisted route keys.
  - Route changes and main-tab switches count as page views.
  - The Live top-level tab is counted as `live`; fine-grained Live subtabs are
    left as optional follow-up.

## Verification

- Local checks:
  - `npx prisma generate` -> pass
  - `npx prisma validate` -> pass
  - `npx eslint app/admin/logs/page.tsx app/api/visitor-counter/route.ts app/api/admin/visitor-counter/route.ts app/components/visitor-counter-reporter.tsx app/providers.tsx lib/visitor-counter.ts lib/server-visitor-counter.ts` -> pass
  - `npx tsc --noEmit` -> pass
  - `git diff --check` -> pass
- Build:
  - `npm run build` -> pass
- Targeted verification:
  - Code review: public increment endpoint accepts only whitelisted route keys.
  - Code review: admin read endpoint requires `ADMIN`.
  - Code review: reporter posts only `{ routeKey }`.
- Sensitive-data negative checks:
  - Targeted search found no IP, user-agent, cookie, localStorage,
    participant/team/user identifiers in the new counter write path.
  - Existing schema hits for IP/user-agent belong to claim audit models, not this
    counter.
- Authenticated role smoke:
  - Pending; requires deployed admin session.
- Manual smoke:
  - Pending.

## Deploy

- Deployment needed: yes
- Migration:
  - `npx prisma migrate deploy` applied
    `20260724202000_add_page_view_counters`.
- Deployment ID: `dpl_E5nqkySY3iuR2S8j5T1YKsBvnyKR`
- Deployment URL: `https://s5-evo-portal-in1qr6qzd-sebastiankroeker-2781s-projects.vercel.app`
- Production alias: `https://portal.s5evo.de`
- Deployed at: 2026-07-24 20:31 UTC

## Post-Deploy Smoke

- Routes checked:
  - `HEAD https://portal.s5evo.de` -> 200
- API checks:
  - `npm run smoke:public` -> pass
  - `POST /api/visitor-counter` with `{ "routeKey": "home" }` -> 204,
    empty body
  - `POST /api/visitor-counter` with invalid route key -> 400
  - `GET /api/admin/visitor-counter` without session -> 401
  - Production aggregate check: `homeRows=1`, `homeCount=1`
- Sensitive-data/API leakage checks:
  - Public increment response has no body.
  - Admin stats endpoint rejects anonymous access.
- Result:
  - Production migration and deploy succeeded; public smoke passed.

## Follow-Ups

- Optional V2: unique visitors with explicit privacy concept and consent/legal
  decision.
