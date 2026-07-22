# CR: Interaktive Event-Map

Status: In Progress
Date: 2026-07-22
Type: feature
Risk: medium
Owner: S5Evo

## Context

Sebastian wants an interactive map for the 5-Kampf portal with the official
sponsors from the Ausschreibung/Flyer as the first layer. The solution should
need as little manual input as possible, be modern, support later route and
infrastructure layers, and keep a credible self-hosting path open. After the
first local MVP, Sebastian narrowed the initial visibility to admins only.

Existing context:

- `docs/cr/2026-07-14-pwa-foundation.md` already lists an event-map/event-guide
  as a later PWA extension.
- The intended foundation there is MapLibre, GeoJSON/GPX layers, sponsor/POI
  layers, and optional PMTiles/offline basemap later.
- `SESSION_HANDOFF.md` repeats the same later-CR direction and says the Event
  Map was not part of the PWA foundation.

## Scope

- In scope:
  - Admin-visible `/karte` or equivalent event-map page in the existing Next.js
    portal.
  - MapLibre GL JS client map with MapTiler Cloud as the first production tile
    provider.
  - Sponsor POI layer in Bad Bayersoien and nearby relevant addresses.
  - Sponsor cards/list with logo/name/address/website when available.
  - Map marker focus from sponsor card and marker popup focus back to sponsor
    details.
  - Subtle visual link/leader line between selected sponsor card and map marker
    when both are visible in the viewport.
  - Layer model prepared for later `sponsors`, `infrastructure`, and `routes`.
  - Static seed data first, so MVP does not need DB/admin CRUD.
  - Basic source attribution and external map provider attribution.
  - MapTiler production env key configured outside source code.
- Out of scope:
  - GPX/route drawing for Lauf/MTB/Rennrad.
  - Infrastructure POIs beyond placeholder layer plumbing.
  - Admin UI for maintaining map POIs.
  - Offline basemap tiles/PMTiles production setup.
  - Live geocoding/search box for end users.
  - Sponsor contract/legal validation beyond using already public sponsor
    information and official flyer-derived logos/names.

## Affected Flows

- User/API/admin flows touched:
  - Admin-only portal navigation/page for first MVP.
  - No admin edit/write flow in MVP.
- Data model impact:
  - No DB migration planned for MVP.
  - Sponsor/POI data stored as typed static source/GeoJSON in the repo.
- Auth/permission impact:
  - Admin-only read-only feature, guarded like existing admin pages with
    `can("config.edit")`.
  - No role changes.
- Sensitive data impact:
  - No participant/team/account personal data.
  - Sponsor business names, public business addresses, websites, and public
    phone/contact values only when already public and relevant.
- Offline/cache/export/log/mail impact:
  - Existing PWA app shell may cache static app assets.
  - No `/api/*` cache changes.
  - MapTiler tile requests go to MapTiler when online.
  - No exports, mails, or technical logs with sponsor data planned.
- Production/deploy impact:
  - Requires adding a public env var for the MapTiler key, then normal Vercel
    production deploy after approval.

## Privacy / Security Review

- Sensitive fields touched:
  - None of the S5Evo sensitive participant/account/team fields.
  - Public sponsor business data only.
- Purpose / data minimization:
  - Store only sponsor display name, address, approximate coordinates, website,
    optional public route/search link, and logo reference when available.
  - Do not store private contact persons or non-public contact details.
- Visibility by role/user/API/UI:
  - Admin UI only for MVP. No private API.
- Persistence locations:
  - Repo static source files and deployed static bundle, reachable in the
    browser only after the admin UI gate.
  - MapTiler API key exposed as a public browser key, restricted by MapTiler
    account/domain settings where available.
- Offline/cache behavior:
  - No offline tile storage in MVP.
  - Existing service worker must continue to avoid `/api/*` and `/_next/*`
    special caching.
- Logs/mails/exports/screenshots exposure:
  - No technical logs, mails, or exports.
  - Manual screenshots may include public sponsor data.
- Negative checks:
  - Verify no participant/team private fields are introduced to the page data.
  - Verify protected APIs still return 401 unauthenticated in normal smoke.
- Authenticated smoke plan or explicit gap:
  - No authenticated flow required for MVP.
- Residual risk:
  - Incorrect sponsor address/coordinates from public research; mitigate with a
    quick Sebastian plausibility check before or after first deploy.
  - Public browser tile key quota/cost exposure; mitigate via domain restriction
    and usage limits in MapTiler.

## Data / API Design

- Proposed data model:
  - `MapPoi` / `SponsorPoi` typed static data:
    - `id`
    - `layer: "sponsors" | "infrastructure" | "routes"`
    - `name`
    - `category`
    - `address`
    - `coordinates: [lng, lat]`
    - `websiteUrl`
    - `routeUrl`
    - `logoSrc`
    - `sourceNote`
    - `confidence: "verified" | "needs_review"`
  - GeoJSON derived client-side from the typed source.
- Proposed API shape:
  - No API for MVP.
  - Later admin-managed map data can become `/api/map/pois` with public read
    serializer and admin write endpoints.
- Backward compatibility:
  - New page/component only.
- Migration/data backfill:
  - None.

## Open Questions

- MapTiler account:
  - Sebastian should create/provide a MapTiler Cloud API key unless we start
    with a local development fallback.
- Sponsor validation:
  - S5Evo will derive names from the official flyer PDFs and public websites;
    Sebastian only needs to sanity-check uncertain matches.

## Acceptance Criteria

- Admin event-map page loads on desktop and mobile.
- Non-admins do not get the map UI and see an access-denied state.
- Map centers around Bad Bayersoien and has fitting zoom/bounds.
- Sponsor layer can be toggled and is enabled by default.
- Sponsor markers and sponsor list/cards stay in sync on click/tap/keyboard
  selection.
- Selected sponsor shows name, address, and website/route link where available.
- A subtle line visually connects selected sponsor card and marker when
  practical on the current viewport; fallback is clear selected state when not.
- Infrastructure and routes layer slots are present in data/control structure
  but not filled with fake data.
- No participant/team/account private data is exposed.
- Build, typecheck, targeted lint, and public smoke pass before deploy.

## Implementation Handoff

- Relevant files:
  - `package.json`
  - `app/karte/page.tsx` or equivalent route
  - `app/components/admin-event-map-page.tsx`
  - `app/components/*map*.tsx`
  - `lib/event-map/*`
  - `public/` or `assets/` for sponsor logo assets if extracted/available
  - `docs/cr/2026-07-22-interaktive-event-map.md`
- Current decisions:
  - Use MapLibre GL JS for the browser map.
  - Use MapTiler Cloud for production tiles under time pressure.
  - Use typed static sponsor data first, not DB/admin maintenance.
  - Keep self-hosting path open through MapLibre-compatible vector tiles and
    later PMTiles.
- Open decisions:
  - Exact MapTiler API key and plan.
  - Final sponsor address/coordinate validation.
- Non-goals:
  - Route/GPX layer implementation.
  - Infrastructure POI content.
  - Offline basemap.
  - Admin CRUD.
- Expected implementation steps:
  - Install MapLibre dependency.
  - Add admin-gated map route and client component.
  - Add sponsor seed data and GeoJSON conversion.
  - Add layer controls and sponsor/card-marker interactions.
  - Add selected-card-to-marker leader line or polished fallback.
  - Add nav entry if the existing portal navigation pattern supports it.
  - Configure `NEXT_PUBLIC_MAPTILER_KEY` locally/Vercel before deploy.
  - Keep `/karte` hidden/gated for admins until Sebastian expands visibility.
- Required checks:
  - Targeted ESLint for changed map/page/navigation files.
  - `npx tsc --noEmit --incremental false`
  - `npm run build`
  - `git diff --check`
  - `npm run smoke:public` after deploy.
- Privacy/security checks:
  - Confirm no protected API serializer changed.
  - Confirm no service-worker API cache broadening.
  - Confirm only public sponsor data is bundled.
- Risks/assumptions:
  - Browser map rendering requires WebGL; provide graceful fallback text/list.
  - Public tile key should be domain-restricted in MapTiler.
  - Some sponsor names from PDF metadata are not yet human-verified.
- Context read before implementation:
  - `SESSION_HANDOFF.md` top block: read 2026-07-22 before CR creation.
  - Relevant prior CR(s): `docs/cr/2026-07-14-pwa-foundation.md`,
    `docs/cr/2026-07-17-pwa-watchlist-v1.md`.
  - Relevant source files: to be read before code edits.

## Model / Subagent Plan

- Model switch needed: no
- Target model/role: current Codex implementation agent
- Subagent needed: no
- Subagent role: none
- Handoff source: this CR plus `SESSION_HANDOFF.md`

## Confirmation Gate

- Gate needed: yes
- Reason:
  - Functional public feature, new external map tile service, Vercel env var,
    and production deploy after implementation.
- Sensitive-data/production-data reason:
  - No S5Evo sensitive data or production DB mutation planned.
  - Public browser API key must be quota/domain controlled.
- Approved by:
  - Sebastian approved Option 1 in Telegram on 2026-07-22.
  - Sebastian approved starting implementation before MapTiler key arrives in
    Telegram on 2026-07-22.
  - Sebastian requested admin-only visibility and supplied a MapTiler key
    restricted to `portal.s5evo.de` in Telegram on 2026-07-22.
  - Production deploy approval still pending after account/key setup.
- Approval timestamp:
  - 2026-07-22 16:49 UTC for solution direction.
  - 2026-07-22 17:28 UTC for local implementation start.
  - 2026-07-22 17:49 UTC for admin-only scope and env key setup.

## Implementation Notes

- Files changed:
  - `package.json`
  - `package-lock.json`
  - `app/karte/page.tsx`
  - `app/components/admin-event-map-page.tsx`
  - `app/components/event-map.tsx`
  - `app/components/nav-bar.tsx`
  - `app/components/sidebar.tsx`
  - `app/globals.css`
  - `lib/event-map/sponsor-pois.ts`
  - `docs/cr/2026-07-22-interaktive-event-map.md`
- Important decisions during implementation:
  - Installed `maplibre-gl` v6 via npm.
  - Implemented the MVP as an admin-gated static route `/karte`.
  - Added top-nav and authenticated sidebar entries for the map.
  - Restricted `/karte` and map navigation to admin permission
    `can("config.edit")`.
  - Set `NEXT_PUBLIC_MAPTILER_KEY` locally in `.env.local`.
  - Added `NEXT_PUBLIC_MAPTILER_KEY` to Vercel Production env; Vercel stores it
    encrypted, but it remains a public browser key at runtime.
  - Kept sponsor data as typed static repo data, with `verified` vs
    `needs_review` confidence.
  - Added a MapTiler production style when `NEXT_PUBLIC_MAPTILER_KEY` is set.
  - Added a MapLibre demo-style fallback when no key is present so the page can
    be locally reviewed while Sebastian organizes the key.
  - Implemented sponsor markers, layer controls, selected sponsor detail, route
    links, website links, and a subtle card-to-marker leader line.

## Verification

- Local checks:
  - `npx eslint app/components/admin-event-map-page.tsx app/components/event-map.tsx app/karte/page.tsx app/components/nav-bar.tsx app/components/sidebar.tsx lib/event-map/sponsor-pois.ts` -> pass
  - `npx tsc --noEmit --incremental false` -> pass
  - `git diff --check` -> pass
- Build:
  - `npm run build` -> pass; `/karte` generated as static route.
- Targeted verification:
  - Local dev server on `http://127.0.0.1:3114`.
  - `curl -sSI http://127.0.0.1:3114/karte` -> 200.
  - `vercel env ls` shows `NEXT_PUBLIC_MAPTILER_KEY` encrypted for Production.
- Sensitive-data negative checks:
  - No participant/team/account API serializers changed.
  - No service-worker changes.
  - Sponsor seed contains only public business names, addresses, websites, and
    route links.
  - Non-admin route protection follows the existing client permission pattern;
    unauthenticated static HTML initially shows loading state until hydration.
- Authenticated role smoke:
  - Not required for MVP unless nav/auth behavior changes.
- Manual smoke:
  - Browser visual smoke pending; Playwright is not installed in this project.
  - Production MapTiler smoke pending until `NEXT_PUBLIC_MAPTILER_KEY` is
    configured.

## Deploy

- Deployment needed: yes
- Deployment ID:
  - Pending.
- Deployment URL:
  - Pending.
- Production alias:
  - `https://portal.s5evo.de`
- Deployed at:
  - Pending.

## Post-Deploy Smoke

- Routes checked:
  - Pending.
- API checks:
  - Pending.
- Sensitive-data/API leakage checks:
  - Pending.
- Result:
  - Pending.

## Follow-Ups

- Add route layers from GPX/GeoJSON for Lauf, Rennrad, and MTB.
- Add infrastructure POIs: Start/Ziel, Parken, WC, Erste Hilfe, Bierzelt/Bar.
- Add admin-managed POI CRUD if annual sponsor/location changes should be
  editable without code changes.
- Evaluate PMTiles/offline basemap once MVP is live and traffic pattern is
  known.
