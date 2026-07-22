# CR: Home News Admin CRUD

Status: Deployed
Date: 2026-07-21
Type: feature
Risk: medium
Owner: S5Evo

## Context

Sebastian wants the Home box "Aktuelles & Neuigkeiten" to be editable by admins.
The Home screen currently renders a static announcement from `app/components/home-screen.tsx`.

## Scope

- In scope:
  - Replace the static Home announcement with admin-managed news entries.
  - Admins can create, edit, publish/unpublish, and archive entries.
  - Public Home shows only active/published entries.
  - Keep the first release scoped to Home news, not a full CMS.
- Out of scope:
  - Push notifications, email/newsletter delivery, or external publishing.
  - Rich media uploads unless explicitly added later.
  - Historical migration beyond preserving the current static announcement as the initial content if useful.

## Affected Flows

- User/API/admin flows touched:
  - Public Home screen.
  - Admin content management flow for news entries.
- Data model impact:
  - Likely new persisted announcement/news model, or a carefully scoped reuse of an existing content model if one fits.
- Auth/permission impact:
  - Write actions admin-only.
  - Public read returns only published, non-archived entries.
- Sensitive data impact:
  - Low direct PII impact, but content is public-facing and can include free text.
- Offline/cache/export/log/mail impact:
  - Home data may be cached client-side by normal browser/PWA behavior.
  - No email/export side effects.
- Production/deploy impact:
  - If a new table is used, schema migration requires a deploy gate.

## Privacy / Security Review

- Sensitive fields touched:
  - Admin identity for audit/created-by if implemented.
  - Public free text entered by admins.
- Purpose / data minimization:
  - Store only title/body/status/timestamps and optional author metadata needed for operations.
- Visibility by role/user/API/UI:
  - Public: published entries only.
  - Admin: active and archived entries.
- Persistence locations:
  - DB for news entries; optional audit events if existing audit pattern is reused.
- Offline/cache behavior, TTL/invalidation/logout clearing:
  - No private cache expected. Public Home data can be browser cached.
- Logs/mails/exports/screenshots exposure:
  - Do not log full announcement body on mutation failures.
- Negative checks for unauthorized access or payload leakage:
  - Unauthenticated/adminless create/edit/archive returns 401/403.
  - Archived entries are not returned by public Home API.
- Authenticated smoke plan or explicit gap:
  - Browser smoke with admin session needed for CRUD.
- Residual risk:
  - Admin-entered public content is visible to all visitors after publication.

## Data / API Design

- Proposed data model:
  - `HomeNewsEntry` or equivalent with tenant/competition scope if needed, title, body, status, publishedAt, archivedAt, createdAt, updatedAt, createdById, updatedById.
- Proposed API shape:
  - Public read endpoint for active Home news.
  - Admin CRUD endpoint for list/create/update/archive.
- Backward compatibility:
  - Keep static fallback if API fails or no entry exists.
- Migration/data backfill:
  - Optional seed/backfill of current static announcement.

## Open Questions

- Decision: Home shows up to 3 published entries.
- Decision: Entries are scoped to the active competition when one is selected.

## Acceptance Criteria

- Admins can create a Home news entry from the portal UI.
- Admins can edit active entries.
- Admins can archive entries without deleting them.
- Public Home only shows published, non-archived entries.
- Non-admin users cannot mutate entries.
- Existing Home layout remains stable on mobile and desktop.

## Implementation Handoff

- Relevant files:
  - `SESSION_HANDOFF.md`
  - `app/components/home-screen.tsx`
  - `app/admin/page.tsx`
  - `app/api/admin/changelog-entries/route.ts` as a permissions/UI pattern reference only
  - `prisma/schema.prisma` if a new model is added
- Current decisions:
  - Admin CRUD, archive instead of hard delete.
  - Public Home read is read-only and filtered.
- Open decisions:
  - Single vs multi-entry public display.
  - Global vs competition-scoped entries.
- Non-goals:
  - Newsletter, push, external CMS.
- Expected implementation steps:
  - Choose data model and scope.
  - Add admin API and public read path.
  - Add admin UI for create/edit/archive.
  - Replace static Home announcement with DB-backed data and fallback.
  - Add focused verification.
- Required checks:
  - Targeted ESLint.
  - `npx tsc --noEmit --incremental false`.
  - `git diff --check`.
  - `npm run build`.
- Privacy/security checks:
  - Unauthorized admin API calls return 401/403.
  - Archived/unpublished entries do not appear publicly.
- Risks/assumptions:
  - Schema migration may be needed.
  - Admin content publication is operationally sensitive but not auth-critical.
- Context read before implementation:
  - `SESSION_HANDOFF.md` top block: yes
  - Relevant prior CR(s): none found for Home news CRUD
  - Relevant source files: `app/components/home-screen.tsx`, admin/API patterns

## Model / Subagent Plan

- Model switch needed: no
- Target model/role: Codex implementation
- Subagent needed: no
- Subagent role:
- Handoff source: this CR

## Confirmation Gate

- Gate needed: yes
- Reason: Public-facing content management and possible DB schema migration.
- Sensitive-data/production-data reason: Admin-only write surface; public content exposure.
- Approved by:
- Approval timestamp:

## Implementation Notes

- Files changed:
  - `prisma/schema.prisma`
  - `prisma/migrations/20260721211500_add_home_news_entries/migration.sql`
  - `app/api/home-news/route.ts`
  - `app/api/admin/home-news/route.ts`
  - `app/api/admin/home-news/[entryId]/route.ts`
  - `app/components/home-news-management.tsx`
  - `app/components/home-screen.tsx`
  - `app/admin/page.tsx`
  - `app/components/sidebar.tsx`
  - `lib/navigation-menu.ts`
  - `app/components/search-overlay.tsx`
  - `app/components/command-pill.tsx`
- Important decisions during implementation:
  - New `HomeNewsEntry` model instead of overloading `ChangelogEntry`.
  - Public API returns only `PUBLISHED` entries with `archivedAt = null`.
  - Admin UI supports create, edit, publish, and archive.
  - Existing static announcement remains fallback if no published DB entry exists.

## Verification

- Local checks:
  - `npx eslint app/components/home-news-management.tsx app/components/home-screen.tsx app/admin/page.tsx app/api/home-news/route.ts app/api/admin/home-news/route.ts app/api/admin/home-news/[entryId]/route.ts lib/navigation-menu.ts app/components/sidebar.tsx app/components/search-overlay.tsx app/components/command-pill.tsx`
  - `npx prisma validate`
  - `git diff --check -- ...`
- Build:
  - `npx tsc --noEmit --incremental false`
  - `npm run build`
- Targeted verification:
  - Build includes `/api/home-news`, `/api/admin/home-news`, and `/api/admin/home-news/[entryId]`.
- Sensitive-data negative checks:
  - Admin mutation routes use `requireTenantRoles(session, ["ADMIN"])`.
  - Public route omits author/admin metadata.
- Authenticated role smoke:
  - Not run locally; needs browser/admin session after migration.
- Manual smoke:
  - Pending.

## Deploy

- Deployment needed: yes, after migration gate
- Deployment ID: `dpl_AuuSHhAjmqZDReQWt1Nc1NkD3pUY`
- Deployment URL: `https://s5-evo-portal-rngodacmx-sebastiankroeker-2781s-projects.vercel.app`
- Production alias: `https://portal.s5evo.de`
- Deployed at: 2026-07-21 21:23 UTC

## Post-Deploy Smoke

- Routes checked:
  - `/` on alias: 200
  - `/admin?tab=news` on alias: 200
  - `npm run smoke:public`: passed
- API checks:
  - `GET /api/home-news`: 200 with `{"entries":[]}` before any published entries.
  - Unauthenticated `GET /api/admin/home-news`: 401.
- Sensitive-data/API leakage checks:
  - Public Home news endpoint returns no author/admin metadata.
  - Admin API is protected without session.
- Result: Passed.

## Follow-Ups

- Decide whether Home news should later support images or scheduling.
