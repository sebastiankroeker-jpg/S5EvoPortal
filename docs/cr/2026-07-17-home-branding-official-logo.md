# CR: Home Branding Official Logo

Status: Deployed
Date: 2026-07-17
Type: content
Risk: low
Owner: S5Evo

## Context

Sebastian requested the browser tab title to match the new PWA name and asked for official 5Kampf branding in the navigation header and Home screen.

## Scope

- In scope:
  - Browser tab title uses `Soier 5Kampf`.
  - Sidebar header replaces medal + `S5Evo` text with the official 5Kampf logo asset.
  - Home screen replaces the trophy icon with the official 5Kampf logo.
  - Home headline uses `Bad Bayersoier Fünfkampf für Mannschaften 2026`, same large bold treatment.
  - Remove explicit location from Home header.
  - Move competition status to the bottom of the Home page.
- Out of scope:
  - No new logo design or generated asset.
  - No PWA icon replacement.
  - No API, DB, auth, service worker, offline cache, mail, export, or privacy change.

## Affected Flows

- User/API/admin flows touched:
  - Browser tab metadata.
  - Sidebar/header branding.
  - Home page hero/header layout for logged-out and logged-in views.
- Data model impact: none.
- Auth/permission impact: none.
- Sensitive data impact: none.
- Offline/cache/export/log/mail impact: no data change; static image metadata only.
- Production/deploy impact: deploy needed for visible branding.

## Privacy / Security Review

- Sensitive fields touched: none.
- Purpose / data minimization: branding-only UI copy/image change.
- Visibility by role/user/API/UI: public UI metadata and static public asset.
- Persistence locations (DB, localStorage/IndexedDB, files, logs, audit, external services): source files only; browser/CDN may cache static assets and metadata.
- Offline/cache behavior, TTL/invalidation/logout clearing: no offline read-model change.
- Logs/mails/exports/screenshots exposure: none.
- Negative checks for unauthorized access or payload leakage: not applicable; no API changed.
- Authenticated smoke plan or explicit gap: public/visual route smoke sufficient; authenticated browser visual smoke remains manual.
- Residual risk: visual preference may need small follow-up after device review.

## Data / API Design

- Proposed data model: none.
- Proposed API shape: none.
- Backward compatibility: compatible.
- Migration/data backfill: none.

## Acceptance Criteria

- Browser tab metadata title is `Soier 5Kampf`.
- Sidebar expanded header shows the official logo instead of medal + `S5Evo`.
- Sidebar collapsed header uses the compact official 5Kampf mark.
- Home screen top shows official logo centered instead of trophy.
- Home headline says `Bad Bayersoier Fünfkampf für Mannschaften 2026` in bold, large type.
- Home top header no longer shows location.
- Competition status is shown at the bottom of the Home page.

## Implementation Handoff

- Relevant files:
  - `app/layout.tsx`
  - `app/components/nav-bar.tsx`
  - `app/components/sidebar.tsx`
  - `app/components/home-screen.tsx`
  - `lib/brand-assets.ts`
- Current decisions:
  - Reuse existing `/brand/5kampf/banner.webp` and `/brand/5kampf/mark.webp`.
  - Keep data/API behavior unchanged.
- Open decisions: none.
- Non-goals:
  - no icon replacement.
  - no full copy rewrite.
- Expected implementation steps:
  - Update metadata title.
  - Replace sidebar header branding with `next/image` using brand assets.
  - Replace Home trophy areas with reusable logo/title block.
  - Move status rendering below existing Home content.
- Required checks:
  - targeted ESLint
  - `npx tsc --noEmit --incremental false`
  - `git diff --check`
  - `npm run build`
- Privacy/security checks:
  - confirm no API/DB/offline/cache changes.
- Risks/assumptions:
  - Existing banner asset is the official logo requested.
- Context read before implementation:
  - `SESSION_HANDOFF.md` top block: read.
  - Relevant prior CR(s): PWA install name from handoff.
  - Relevant source files: `app/layout.tsx`, `app/components/sidebar.tsx`, `app/components/home-screen.tsx`, `lib/brand-assets.ts`.

## Model / Subagent Plan

- Model switch needed: no
- Target model/role: current Codex implementation
- Subagent needed: no
- Subagent role: none
- Handoff source: this CR

## Confirmation Gate

- Gate needed: yes for production deploy only
- Reason: visible production branding deploy.
- Sensitive-data/production-data reason: none.
- Approved by: Sebastian (`Bitte ausliefern`)
- Approval timestamp: 2026-07-17T23:43:21Z

## Implementation Notes

- Files changed:
  - `app/layout.tsx`
  - `app/components/nav-bar.tsx`
  - `app/components/sidebar.tsx`
  - `app/components/home-screen.tsx`
  - `docs/cr/2026-07-17-home-branding-official-logo.md`
- Important decisions during implementation:
  - Top navigation and desktop sidebar both use the existing official 5Kampf banner asset.
  - Collapsed desktop sidebar uses the existing official 5Kampf mark asset.
  - Home screen uses the banner logo above the requested headline.
  - The explicit location line was removed from both Home hero and the top flyer info block.
  - Competition status is only rendered at the bottom of the authenticated Home screen.

## Verification

- Local checks:
  - `npx eslint app/layout.tsx app/components/nav-bar.tsx app/components/sidebar.tsx app/components/home-screen.tsx` -> green
  - `npx tsc --noEmit --incremental false` -> green
  - `git diff --check` -> green
- Build:
  - `npm run build` -> green
- Targeted verification:
  - Static source check: no remaining `S5Evo Portal`, medal header text, trophy Home headline, or `Ort:` in touched files.
  - Local `next start` HTTP smoke: `/` includes `<title>Soier 5Kampf</title>`.
  - Local `next start` HTTP smoke: `/brand/5kampf/banner.webp` -> 200 `image/webp`.
  - Local `next start` HTTP smoke: `/brand/5kampf/mark.webp` -> 200 `image/webp`.
- Sensitive-data negative checks:
  - No API, DB, serializer, mail, export, log, service worker, localStorage, or IndexedDB change.
- Authenticated role smoke:
  - No authenticated agent session. Authenticated visual smoke remains manual.
- Manual smoke:
  - Local HTTP smoke covered metadata and assets; no Playwright/Puppeteer installed for pixel screenshot.

## Deploy

- Deployment needed: yes, after explicit Go.
- Deployment ID: `dpl_D5dijDSZuadfHRBczpyGu1vuoNUq`
- Deployment URL: `https://s5-evo-portal-q46fww3m8-sebastiankroeker-2781s-projects.vercel.app`
- Production alias: `https://portal.s5evo.de`
- Deployed at: 2026-07-17T23:46:02Z

## Post-Deploy Smoke

- Routes checked:
  - `npm run smoke:public` -> green
  - `https://portal.s5evo.de/` -> 200, `<title>Soier 5Kampf</title>`
  - `https://portal.s5evo.de/brand/5kampf/banner.webp` -> 200 `image/webp`
  - `https://portal.s5evo.de/brand/5kampf/mark.webp` -> 200 `image/webp`
- API checks:
  - public smoke covered `/api/competition` -> 200 and `/api/results?...` -> 200
  - protected API checks remain 401 without session: `/api/teams?...`, `/api/admin/pending-changes?...`
- Sensitive-data/API leakage checks:
  - no API, DB, serializer, mail, export, log, service worker, localStorage, or IndexedDB change
  - protected routes remain unauthorized without session in public smoke
- Result: green

## Follow-Ups

- Sebastian will manually check logo sizing on device.
