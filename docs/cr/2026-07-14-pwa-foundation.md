# CR: PWA Foundation

Status: Draft
Date: 2026-07-14
Type: feature
Risk: low
Owner: S5Evo

## Context

Sebastian asked whether the S5Evo portal could reasonably be provided as a PWA and whether this would help a later manual stopwatch/timekeeping feature. The current direction is to keep the stopwatch/manual timing concept for later, but prepare the portal with a small installable PWA foundation.

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

## Implementation Handoff

Use before model switch or subagent delegation.

- Relevant files:
  - `app/layout.tsx`
  - `next.config.ts`
  - `public/`
  - Potential new files: `app/manifest.ts`, `public/icon-*.png`, `public/sw.js`, offline fallback route/page if needed.
- Current decisions:
  - Treat this as PWA foundation only.
  - Do not implement stopwatch/manual timing in this CR.
  - Do not make authenticated/admin data offline-first.
- Open decisions:
  - Final app name.
  - Final icon/branding source.
  - Exact service worker tooling: minimal custom worker vs. a small established PWA helper.
- Non-goals:
  - No schema changes.
  - No production data mutation.
  - No timekeeping sync implementation.
- Expected implementation steps:
  - Add manifest/metadata/icons.
  - Add conservative offline handling if selected.
  - Verify installability and manifest output locally.
  - Run build/type checks and public smoke.
  - Deploy only after explicit approval.
- Required checks:
  - `npx tsc --noEmit`
  - `npm run build`
  - `git diff --check`
  - Post-deploy: `npm run smoke:public`
- Risks/assumptions:
  - Low application risk if caching remains conservative.
  - Medium UX risk if offline behavior overpromises; copy must make online requirement clear for authenticated work.

## Model / Subagent Plan

- Model switch needed: no
- Target model/role: current Codex implementation
- Subagent needed: no
- Subagent role: n/a
- Handoff source: this CR and `SESSION_HANDOFF.md`

## Confirmation Gate

- Gate needed: yes
- Reason: Implementation changes production app behavior and requires deploy.
- Approved by:
- Approval timestamp:

## Implementation Notes

- Files changed:
- Important decisions during implementation:

## Verification

- Local checks:
- Build:
- Targeted verification:
- Manual smoke:

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

- Later CR: manual stopwatch/timekeeping as offline-capable PWA module with local event log, sync queue, conflict handling, and admin review.
