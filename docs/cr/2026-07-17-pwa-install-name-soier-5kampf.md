# CR: PWA Install Name Soier 5Kampf

Status: Deployed
Date: 2026-07-17
Type: content
Risk: low
Owner: S5Evo

## Context

Sebastian requested the default text shown when installing the app to be `Soier 5Kampf`.

## Scope

- In scope:
  - Update PWA manifest install names to `Soier 5Kampf`.
  - Update iOS/apple web app title to `Soier 5Kampf`.
- Out of scope:
  - No icon redesign.
  - No route, API, DB, auth, service worker, or offline-cache behavior change.
  - No broad copy rebrand across emails or admin UI.

## Affected Flows

- User/API/admin flows touched:
  - PWA install prompt and installed app label.
  - iOS add-to-home-screen app title metadata.
- Data model impact: none.
- Auth/permission impact: none.
- Sensitive data impact: none.
- Offline/cache/export/log/mail impact: no new data; only manifest/metadata text.
- Production/deploy impact: deploy needed for live install metadata.

## Privacy / Security Review

- Sensitive fields touched: none.
- Purpose / data minimization: branding-only text change.
- Visibility by role/user/API/UI: public app metadata only.
- Persistence locations (DB, localStorage/IndexedDB, files, logs, audit, external services): no user data persistence; browser may cache manifest metadata.
- Offline/cache behavior, TTL/invalidation/logout clearing: no offline data change; users may need to refresh/reinstall/update PWA for label changes depending on OS.
- Logs/mails/exports/screenshots exposure: none.
- Negative checks for unauthorized access or payload leakage: not applicable; no API or serializer changed.
- Authenticated smoke plan or explicit gap: not needed; public metadata.
- Residual risk: installed OS shortcuts may keep the old label until refresh/reinstall.

## Data / API Design

- Proposed data model: none.
- Proposed API shape: none.
- Backward compatibility: compatible.
- Migration/data backfill: none.

## Acceptance Criteria

- `manifest.webmanifest` reports `name` as `Soier 5Kampf`.
- `manifest.webmanifest` reports `short_name` as `Soier 5Kampf`.
- Root metadata uses `applicationName` and `appleWebApp.title` as `Soier 5Kampf`.
- No API, DB, service worker, or sensitive-data behavior changes.

## Implementation Handoff

- Relevant files:
  - `app/manifest.ts`
  - `app/layout.tsx`
- Current decisions:
  - Use exact requested text: `Soier 5Kampf`.
  - Keep longer browser document title descriptive for normal tabs unless install metadata needs exact text.
- Open decisions: none.
- Non-goals:
  - no icon/logo work.
  - no full rebrand.
- Expected implementation steps:
  - Update manifest `name` and `short_name`.
  - Update root metadata `applicationName` and `appleWebApp.title`.
  - Verify manifest output.
- Required checks:
  - targeted ESLint
  - `npx tsc --noEmit --incremental false`
  - `git diff --check`
  - `npm run build`
- Privacy/security checks:
  - confirm no API/DB/offline cache changes.
- Risks/assumptions:
  - Existing installed apps may require refresh/reinstall for OS label update.
- Context read before implementation:
  - `SESSION_HANDOFF.md` top block: read.
  - Relevant prior CR(s): current PWA Watchlist/Offline context from handoff.
  - Relevant source files: `app/manifest.ts`, `app/layout.tsx`.

## Model / Subagent Plan

- Model switch needed: no
- Target model/role: current Codex implementation
- Subagent needed: no
- Subagent role: none
- Handoff source: this CR

## Confirmation Gate

- Gate needed: yes for production deploy only
- Reason: production deploy changes public PWA metadata.
- Sensitive-data/production-data reason: none.
- Approved by: Sebastian (`Go`)
- Approval timestamp: 2026-07-17T19:07:12Z

## Implementation Notes

- Files changed:
  - `app/manifest.ts`
  - `app/layout.tsx`
  - `docs/cr/2026-07-17-pwa-install-name-soier-5kampf.md`
- Important decisions during implementation:
  - `manifest.name` and `manifest.short_name` both use the exact requested install label `Soier 5Kampf`.
  - `metadata.applicationName` and `appleWebApp.title` also use `Soier 5Kampf` for iOS/home-screen surfaces.
  - The browser tab title remains `S5Evo Portal – Mannschaftsfünfkampf`; this CR only changes install/app-shell metadata.

## Verification

- Local checks:
  - `npx eslint app/manifest.ts app/layout.tsx` -> green
  - `npx tsc --noEmit --incremental false` -> green
  - `git diff --check` -> green
- Build:
  - `npm run build` -> green
- Targeted verification:
  - Source check confirms `app/manifest.ts` has `name` and `short_name` set to `Soier 5Kampf`.
  - Source check confirms `app/layout.tsx` has `applicationName` and `appleWebApp.title` set to `Soier 5Kampf`.
  - Built Next manifest route chunk contains `name:"Soier 5Kampf"` and `short_name:"Soier 5Kampf"`.
- Sensitive-data negative checks:
  - No API, DB, serializer, mail, export, log, service worker, localStorage, or IndexedDB change.
- Authenticated role smoke:
  - Not needed; public PWA metadata only.
- Manual smoke:
  - Pending live deploy; after deploy, fetch `/manifest.webmanifest` and check install labels.

## Deploy

- Deployment needed: yes, completed after explicit Go.
- Deployment ID: `dpl_BzBt3bxJ3fUeDmqRaQTJnKmtmQRS`
- Deployment URL: `https://s5-evo-portal-glw36n2lx-sebastiankroeker-2781s-projects.vercel.app`
- Production alias: `https://portal.s5evo.de`
- Deployed at: 2026-07-17T19:09:30Z

## Post-Deploy Smoke

- Routes checked:
  - `npm run smoke:public` -> green
  - `https://portal.s5evo.de/` -> 200
  - `https://portal.s5evo.de/manifest.webmanifest` -> 200, `content-type: application/manifest+json`
- API checks:
  - Public smoke kept `/api/teams` without session -> 401
  - Public smoke kept `/api/admin/pending-changes` without session -> 401
- Sensitive-data/API leakage checks:
  - No API changed.
  - No API payload checked or broadened for this content-only deploy.
- Result:
  - Live manifest reports `name: "Soier 5Kampf"` and `short_name: "Soier 5Kampf"`.

## Follow-Ups

- None
