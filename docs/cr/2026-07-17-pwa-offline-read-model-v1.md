# CR: PWA Offline Read Model V1

Status: Local checks passed, pending deploy approval
Date: 2026-07-17
Type: feature
Risk: medium
Owner: S5Evo

## Context

Sebastian wants the PWA to be useful for participants and team managers when mobile connectivity is weak during the event. The first focus is Mannschafts-Dashboard, start lists, and result lists. This follows the existing conservative PWA foundation: do not broadly cache authenticated APIs; persist only role-filtered read models that the server already returned to the current user.

## Scope

- In scope:
  - Cache the current user's team dashboard read model locally after a successful online load.
  - Cache live/team/start-list data locally after a successful online load.
  - Cache published results locally after a successful online load.
  - Show local data state and offline fallback hints.
  - Add explicit `Daten aktualisieren` actions for affected read views.
  - Add a small PWA app-update banner when a new service worker version is available.
- Out of scope:
  - No offline team edits, participant edits, registration, approvals, or admin mutations.
  - No background sync or push.
  - No IndexedDB migration in V1; localStorage is sufficient for this narrow first read-model cache.
  - No changes to server-side authorization or privacy rules.
  - No caching of raw `/api/*` responses by the service worker.

## Affected Flows

- User/API/admin flows touched:
  - Dashboard can fall back to the latest locally cached team list if online loading fails.
  - Live view can fall back to the latest locally cached team/start list if online loading fails.
  - Results view can fall back to the latest locally cached results if online loading fails.
  - PWA users can refresh data manually and apply an app update manually.
- Data model impact:
  - None.
- Auth/permission impact:
  - None server-side; local caches only persist data already returned through authenticated or public APIs.
- Production/deploy impact:
  - Production deploy required after local checks and explicit deploy approval.

## Data / API Design

- Proposed data model:
  - Browser-local cache envelope in `localStorage`: `{ version, storedAt, data }`.
- Proposed API shape:
  - No new API endpoint in V1.
  - Existing `/api/teams` and `/api/results` remain source of truth.
- Backward compatibility:
  - Online behavior remains unchanged.
  - Browsers without localStorage/service worker continue to behave online-only.
- Migration/data backfill:
  - None.

## Business Invariants

- Offline data must never contain more than the server returned to the same user online.
- `hideForeignTeams` remains server-leading: if the online view hides foreign teams/counts, the cached offline view can only contain that restricted response.
- Offline V1 is read-only. It must not queue team or participant changes for later mutation.
- Cached data must show a visible timestamp so stale data is not mistaken for live state.

## Open Questions

- IndexedDB should replace localStorage if offline packages grow beyond dashboard/start/results V1.
- A future dedicated `/api/offline-package` can consolidate server-generated packages once V1 UX is proven.

## Acceptance Criteria

- Dashboard stores successful `/api/teams` responses and can render cached teams when the online load fails.
- Live/start list stores successful `/api/teams` responses and can render cached live/start data when the online load fails.
- Results stores successful `/api/results` responses and can render cached results when the online load fails.
- Each affected view shows whether data is live or local and includes the cached data timestamp.
- Each affected view has a clear refresh action.
- Service worker can notify the user that a new app version is ready and reload after confirmation.
- Service worker still does not cache `/api/*` or `/_next/*` responses.

## Implementation Handoff

- Relevant files:
  - `app/components/dashboard.tsx`
  - `app/components/live-screen.tsx`
  - `app/components/results-view.tsx`
  - `app/components/pwa-service-worker.tsx`
  - `public/sw.js`
  - New helper under `lib/`
- Current decisions:
  - Keep V1 client-side and additive.
  - Use per-view localStorage keys scoped by competition, role/user, and view where needed.
  - Show local fallback only after online load failure.
- Open decisions:
  - Production deploy approval after checks.
- Non-goals:
  - No offline writes.
  - No service-worker API caching.
  - No DB migration.
- Expected implementation steps:
  - Add a small typed offline-cache helper.
  - Wire dashboard/team cache.
  - Wire live/start-list cache.
  - Wire results cache.
  - Enhance service-worker registration with update banner.
  - Run targeted lint, TypeScript, build, and diff check.
- Required checks:
  - `npx eslint` on touched files.
  - `npx tsc --noEmit --incremental false`.
  - `npm run build`.
  - `git diff --check`.
- Risks/assumptions:
  - localStorage quota should be sufficient for V1 but may be exceeded if team/result payloads grow substantially.
  - Authenticated role smoke remains manual without session cookies.

## Model / Subagent Plan

- Model switch needed: no
- Target model/role: current Codex operator
- Subagent needed: no
- Subagent role: n/a
- Handoff source: this CR and `SESSION_HANDOFF.md`

## Confirmation Gate

- Gate needed: yes
- Reason: production deploy and push to auto-deploying `main`.
- Local implementation approved by: Sebastian via Telegram "Bitte CR draus machen und umsetzen"
- Local implementation approval timestamp: 2026-07-17 09:25 UTC
- Production deploy approved by:
- Production deploy approval timestamp:

## Implementation Notes

- Files changed:
  - `lib/pwa-offline-cache.ts`
  - `app/components/dashboard.tsx`
  - `app/components/live-screen.tsx`
  - `app/components/results-view.tsx`
  - `app/components/pwa-service-worker.tsx`
  - `public/sw.js`
- Important decisions during implementation:
  - Used a small `localStorage` cache envelope `{ version, storedAt, data }` for V1 instead of IndexedDB.
  - Dashboard cache key is scoped by competition, user email, active role, focus, and own/all scope.
  - Live/start-list cache key is scoped by competition and active role.
  - Results cache key is scoped by competition because `/api/results` is already the publication-shaped response.
  - All caches are written only after successful online API responses.
  - Offline fallback is used only when online loading fails.
  - Service worker still bypasses `/api/*` and `/_next/*`; it only gained a `SKIP_WAITING` message hook for app updates.

## Verification

- Local checks:
  - `npx eslint lib/pwa-offline-cache.ts app/components/dashboard.tsx app/components/live-screen.tsx app/components/results-view.tsx app/components/pwa-service-worker.tsx public/sw.js`: passed.
  - `npx tsc --noEmit --incremental false`: passed.
  - `git diff --check`: passed.
- Build:
  - `npm run build`: passed.
- Targeted verification:
  - Static review confirms `public/sw.js` still returns early for `/api/*` and `/_next/*`.
  - Static review confirms dashboard/live/results caches persist only successful server responses and do not introduce offline mutations.
- Manual smoke:
  - Not run; authenticated browser session is not available in this environment.

## Deploy

- Deployment needed: yes
- Deployment ID:
- Deployment URL:
- Production alias: `https://portal.s5evo.de`
- Deployed at:

## Post-Deploy Smoke

- Routes checked:
- API checks:
- Result:

## Follow-Ups

- Evaluate IndexedDB and a dedicated server-side offline package endpoint after V1 usage feedback.
