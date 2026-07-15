# CR: PWA Foundation

Status: Deployed
Date: 2026-07-14
Type: feature
Tier: standard
Risk: low
Owner: S5Evo

## Context

Sebastian asked whether the S5Evo portal could reasonably be provided as a PWA and whether this would help a later manual stopwatch/timekeeping feature. The current direction is to keep the stopwatch/manual timing concept for later, but prepare the portal with a small installable PWA foundation.

Later on 2026-07-14, Sebastian also raised a future event-map direction: maps for multiple venues, MTB/road/run routes, elevation profiles, beer tent/bar, sponsor locations, official announcement timeline, and optional social feeds. This is remembered as a later modular PWA/event-guide extension, not part of the PWA foundation scope.

Current code snapshot checked on 2026-07-14:

- No obvious PWA foundation exists yet.
- `next.config.ts` contains security headers and redirects, but no PWA/service-worker setup.
- No app manifest or service worker was found in `app`, `public`, `package.json`, or `next.config.ts`.

## Scope

- In scope:
  - Make the portal installable as a basic PWA.
  - Add a web app manifest with app name, scope, start URL, display mode, theme/background colors, and icons.
  - Add or generate suitable app icons from existing S5Evo branding or a temporary clean fallback.
  - Add Next metadata for mobile/PWA behavior where appropriate.
  - Add a conservative offline fallback page or static shell fallback if it can be done safely.
  - Keep authenticated/admin/API data online-first.
  - Document the PWA decisions and later stopwatch relationship.
- Out of scope:
  - Building the manual stopwatch/timekeeping module.
  - Building event maps, route layers, elevation profiles, POI management, announcement timelines, or social feed integrations.
  - Making the full portal offline-capable.
  - Caching authenticated admin data or sensitive API responses.
  - Implementing sync queues, IndexedDB event logs, conflict handling, or audit review.
  - Changing registration/team/participant business logic.

## Affected Flows

- User/API/admin flows touched:
  - Browser installability on mobile/desktop.
  - Portal startup behavior when launched from an installed app icon.
  - Optional offline fallback for unauthenticated/static navigation.
- Data model impact:
  - None expected.
- Auth/permission impact:
  - None expected.
  - Authenticated pages remain protected and online-first.
- Production/deploy impact:
  - Requires normal production deploy before available on `portal.s5evo.de`.

## Data / API Design

- Proposed data model:
  - No database changes.
- Proposed API shape:
  - No API changes expected.
- Backward compatibility:
  - Existing browser access must continue unchanged.
  - Unsupported browsers should simply ignore PWA capabilities.
- Migration/data backfill:
  - None.

## Open Questions

- App display name:
  - Default proposal: `S5Evo Portal`.
  - Alternative: `Fuenfkampf Portal`.
- App icon:
  - Use existing final logo if available.
  - Otherwise create a clean temporary S5Evo icon and replace later.
- Offline fallback:
  - Default proposal: simple branded offline page with retry/open-online guidance.
- Service worker strategy:
  - Keep conservative.
  - Cache only static assets/app shell, not authenticated JSON/API data.

## Acceptance Criteria

- Portal exposes a valid web app manifest.
- Portal can be installed from supported Android/desktop browsers.
- iOS receives appropriate metadata/icons where feasible.
- Installed app opens `https://portal.s5evo.de/` within the configured scope.
- Existing routes and auth behavior remain unchanged in normal online use.
- No sensitive authenticated API/admin data is cached by the PWA layer.
- Offline behavior is predictable and does not show misleading stale application data.
- Public smoke checks remain green after deploy.

## Business Invariants

- PWA foundation does not create a second mobile product surface; the installed app opens the existing portal experience.
- Server remains the source of truth for authentication, registrations, teams, participants, admin data, and messages.
- Authenticated/admin/API data remains online-first and must not be cached by the PWA foundation.
- Offline UI must not imply that protected or mutable portal data is complete, current, or editable without connectivity.
- Later offline modules such as stopwatch, event maps, route packs, or timelines require their own CRs and their own explicit local persistence strategy.

## Implementation Handoff

Use before model switch or subagent delegation.

- Relevant files:
  - `app/layout.tsx`
  - `next.config.ts`
  - `public/`
  - Potential new files: `app/manifest.ts`, `public/icon-*.png`, `public/sw.js`, offline fallback route/page if needed.
- Current decisions:
  - Treat this as PWA foundation only.
  - Use the existing portal UI; no separate smartphone UI layer.
  - Use the existing backend/database; no mirrored smartphone persistence layer.
  - Do not implement stopwatch/manual timing in this CR.
  - Do not implement event-map/event-guide functionality in this CR.
  - Do not make authenticated/admin data offline-first.
  - Default app name remains `S5Evo Portal` unless Sebastian changes it.
- Open decisions:
  - Final app name.
  - Final icon/branding source.
  - Exact service worker tooling: minimal custom worker vs. a small established PWA helper.
- Non-goals:
  - No schema changes.
  - No production data mutation.
  - No timekeeping sync implementation.
- Expected implementation steps:
  - Inspect existing Next.js/app-router setup and public asset conventions.
  - Add manifest/metadata/icons.
  - Add conservative offline handling if selected; prefer a small, explicit strategy over broad runtime caching.
  - Verify installability and manifest output locally.
  - Verify that protected API/auth routes are not cached.
  - Run build/type checks and public smoke.
  - Commit locally after checks.
  - Do not push functional code to auto-deploying `main` before Sebastian's explicit Go.
  - Deploy only after explicit production approval.
- Required checks:
  - targeted lint for changed files
  - `npx tsc --noEmit`
  - `npm run build`
  - `git diff --check`
  - Post-deploy: `npm run smoke:public`
- Risks/assumptions:
  - Low application risk if caching remains conservative.
  - Medium UX risk if offline behavior overpromises; copy must make online requirement clear for authenticated work.
  - Medium browser-compatibility risk around install prompts/iOS behavior; verify metadata rather than promising identical UX on all devices.

## Model / Subagent Plan

- Model switch needed: yes
- Target model/role: Codex implementation
- Subagent needed: no
- Subagent role: n/a
- Handoff source: this CR and `SESSION_HANDOFF.md`

## Confirmation Gate

- Gate needed: yes
- Reason: Implementation changes browser install/offline behavior and production deploy requires explicit approval. Functional push to auto-deploying `main` is deploy-relevant and also requires explicit approval.
- Approved by: Sebastian requested local Codex implementation in Telegram before sleeping.
- Approval timestamp: 2026-07-14 22:20 UTC
- Remaining gate: push to `origin/main` / production deploy still requires explicit Go.

## Implementation Notes

- Files changed:
  - `app/layout.tsx`
  - `app/manifest.ts`
  - `app/components/pwa-service-worker.tsx`
  - `app/offline/page.tsx`
  - `public/sw.js`
  - `public/offline.html`
  - `public/icon-192.png`
  - `public/icon-512.png`
  - `public/icon-maskable-512.png`
  - `public/apple-touch-icon.png`
- Important decisions during implementation:
  - Used Next app-router metadata route `app/manifest.ts` for `/manifest.webmanifest`.
  - Added app metadata/iOS metadata in `app/layout.tsx`.
  - Added a tiny client component to register `/sw.js` only in secure contexts or localhost.
  - Service worker is intentionally conservative:
    - navigation requests use network-first and fall back to cached `/offline.html`;
    - `/api/*` and `/_next/*` requests are not intercepted or cached;
    - only manifest, icons and offline fallback are pre-cached.
  - Added both a normal `/offline` route and a static `public/offline.html`; service worker uses the static file so offline fallback has no Next runtime dependency.
  - Temporary generated PNG icons are in place until final designer assets are available.

## Verification

- Local checks:
  - `npx eslint app/layout.tsx app/manifest.ts app/components/pwa-service-worker.tsx app/offline/page.tsx` -> pass
  - `node --check public/sw.js` -> pass
  - `git diff --check` -> pass
  - `npx tsc --noEmit` -> pass
- Build:
  - `npm run build` -> pass
- Targeted verification:
  - Local production server `next start --hostname 127.0.0.1 --port 3100`
  - `/manifest.webmanifest` -> 200, valid JSON with `S5Evo Portal`, standalone display and PNG icons.
  - `/sw.js` -> 200 and contains `/api/` / `/_next/` bypass.
  - `/offline.html` -> 200 static fallback.
  - `/offline` -> 200.
  - `/icon-192.png`, `/icon-512.png`, `/icon-maskable-512.png`, `/apple-touch-icon.png` -> 200.
- Manual smoke:
  - Temporary icon visually inspected locally.

## Smoke Matrix

- Public smoke:
  - `npm run smoke:public`
  - `/`, `/login`, `/anmeldung`, `/aenderungen`
  - `/api/competition`, `/api/results`
- Unauthenticated API smoke:
  - Protected APIs should keep returning expected 401/403 responses, e.g. `/api/teams`, `/api/admin/users`, `/api/admin/pending-changes`.
- Authenticated role smoke:
  - Not required for PWA foundation unless implementation touches authenticated UI behavior.
  - If unavailable, document as explicit gap rather than implying coverage through public smoke.
- Manual/browser smoke:
  - Inspect manifest output.
  - Check installability in at least one Chromium browser.
  - Check iOS metadata/icons as far as feasible.
  - Simulate offline behavior and verify the fallback does not show stale protected data.
- Gaps:
  - Device-specific install prompt behavior can vary by browser/OS and may require Sebastian-side real-device confirmation.

## Deploy

- Deployment needed: yes
- Deployment ID: `dpl_7ZAAEVkh4A8YpwFL53QULKm5WMnY`
- Deployment URL: `https://s5-evo-portal-40zxpjoi7-sebastiankroeker-2781s-projects.vercel.app`
- Production alias: `https://portal.s5evo.de`
- Deployed at: 2026-07-15 06:05 UTC
- Status: deployed after Sebastian Go; commit `2c5eb29 Add PWA foundation` pushed to `origin/main`.

## Post-Deploy Smoke

- Routes checked:
  - `npm run smoke:public` against `https://portal.s5evo.de` -> pass
  - `/manifest.webmanifest` -> 200
  - `/sw.js` -> 200
  - `/offline.html` -> 200
  - `/offline` -> 200
  - `/icon-192.png`, `/icon-512.png`, `/icon-maskable-512.png`, `/apple-touch-icon.png` -> 200
- API checks:
  - `/api/teams` without session -> 401
  - `/api/admin/users` without session -> 401
  - `/api/admin/pending-changes` without session -> 401
  - `/sw.js` contains `/api/` and `/_next/` bypass markers
- Result: pass

## Follow-Ups

- Later CR: manual stopwatch/timekeeping as offline-capable PWA module with local event log, sync queue, conflict handling, and admin review.
- Later CR: modular event-map/event-guide PWA extension:
  - MapLibre foundation with route and POI layers.
  - GPX/GeoJSON routes for Lauf, MTB, Rennrad.
  - Optional elevation profiles when GPX height data or a DEM/elevation source is available.
  - POIs for Bierzelt, Bar, Sponsoren, Start/Ziel, Parken, WC, Erste Hilfe.
  - Offline strategy staged as app shell plus routes/POIs first; optional PMTiles/offline basemap later.
  - Official announcement timeline as portal-owned feed; social integrations later and dependent on API accounts/keys or public RSS/Mastodon feeds.
