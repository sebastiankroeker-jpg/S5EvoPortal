# SESSION_HANDOFF

Stand: 2026-07-22 23:02 UTC

## Kurzzusammenfassung fuer naechste Session

- Event Map Sponsor Popup UI 2026-07-22 22:56 UTC:
  - Sebastian confirmed "Mega!" after Leaflet deploy; iPhone screenshot showed
    the map, sponsor markers, zoom control, attribution, and sponsor tree.
  - Requested UI change:
    - Sponsor list should show only name and Gewerbe/category.
    - On click, open a detail box with all other sponsor info in the map at the
      Standort-Symbol/marker instead of inline in the list.
  - Fix in `app/components/event-map.tsx`:
    - List rows now show logo, sponsor name, and category only.
    - Removed inline selected sponsor detail block from the sponsor tree.
    - Added Leaflet popups bound to sponsor markers.
    - List click and marker click select the sponsor and open the marker popup.
    - Popup contains logo, name, category, address, status, source note, route,
      and optional website link.
    - Popup HTML is escaped before injection.
  - Styling:
    - Added `.event-map-popup` CSS in `app/globals.css` so Leaflet popups use
      portal background/foreground/border tokens and work in light/dark themes.
  - Checks gruen:
    `npx eslint app/components/event-map.tsx`,
    `npx tsc --noEmit --incremental false`, `npm run build`,
    `git diff --check`.
  - Commit/Push:
    - Code/docs commit: `139af0c Move sponsor details into map popups`
    - Pushed `c7484d5..139af0c`.
  - Vercel Production Deployment:
    - Deployment-ID: `dpl_3WrqzkLY7P7jPtcYWS4TK3ZrKg7n`
    - Vercel-URL:
      `https://s5-evo-portal-nm83g988z-sebastiankroeker-2781s-projects.vercel.app`
    - Alias: `https://portal.s5evo.de`
    - Ready-State: `READY`
    - Deployed at: 2026-07-22 23:02 UTC
  - Post-Deploy-Smoke gruen:
    `HEAD https://portal.s5evo.de/karte` 200,
    `npm run smoke:public`,
    direct MapTiler raster tile for Bad Bayersoien z14/x8692/y5716 with
    `Referer: https://portal.s5evo.de/karte` -> 200 `image/png`.
  - Weiter offen nach Deploy:
    authenticated iPhone visual smoke by Sebastian for popup behavior.

- Event Map Leaflet Fallback 2026-07-22 22:32 UTC:
  - Sebastian sent another iPhone screenshot after `885e062`: still only the
    fallback map background. He also sent a Google AI screenshot about MapTiler
    + Vercel API keys.
  - Interpretation:
    - Google AI note is not the primary issue. Browser map tile keys are
      expected to be public-ish and protected with MapTiler domain/referrer
      restrictions; our direct MapTiler tile request with portal referer is
      200.
    - Since both vector style and inline raster style still do not visibly
      render through MapLibre on iPhone, the practical next move is to avoid
      MapLibre/WebGL/worker entirely for the MVP.
  - Fix in `app/components/event-map.tsx`:
    - Replaced MapLibre runtime usage with Leaflet runtime usage.
    - Leaflet is dynamically imported client-side.
    - MapTiler Outdoor raster PNG XYZ tiles remain the provider.
    - Sponsor markers are now Leaflet div markers.
    - Map zoom control is bottom-right, attribution bottom-left.
    - Leaflet tile load/error events drive the visible loading/error state.
  - Dependency/CSS changes:
    - Added `leaflet` and `@types/leaflet`.
    - Removed `maplibre-gl`.
    - Replaced MapLibre CSS import with Leaflet CSS import in
      `app/globals.css`.
  - Checks gruen:
    `npx eslint app/components/event-map.tsx`,
    `npx tsc --noEmit --incremental false`, `npm run build`,
    `git diff --check`.
  - Commit/Push:
    - Code/docs commit: `c7484d5 Switch event map to Leaflet`
    - Pushed `885e062..c7484d5`.
  - Vercel Production Deployment:
    - Deployment-ID: `dpl_UDLeGMtAJ5YxSWzQ7wsXYSqJYgQZ`
    - Vercel-URL:
      `https://s5-evo-portal-5yw3zzs80-sebastiankroeker-2781s-projects.vercel.app`
    - Alias: `https://portal.s5evo.de`
    - Ready-State: `READY`
    - Deployed at: 2026-07-22 22:37 UTC
  - Post-Deploy-Smoke gruen:
    `HEAD https://portal.s5evo.de/karte` 200,
    `npm run smoke:public`,
    direct MapTiler raster tile for Bad Bayersoien z14/x8692/y5716 with
    `Referer: https://portal.s5evo.de/karte` -> 200 `image/png`.
  - Weiter offen nach Deploy:
    authenticated iPhone visual smoke durch Sebastian. Expected next signal:
    Leaflet DOM image-tile map, zoom controls bottom-right, sponsor markers.

- Event Map Raster Style Hotfix 2026-07-22 22:17 UTC:
  - Sebastian sent a screenshot after `ffeeab7` showing the intended red
    timeout box: MapLibre starts, but the external MapTiler style did not reach
    `load` on iPhone.
  - Root-cause hypothesis:
    - MapLibre runtime is active.
    - Problem is likely the remote style JSON/glyph/sprite/vector-tile style
      chain on iOS/Safari, not the React shell.
  - Fix in `app/components/event-map.tsx`:
    - Replaced the external MapTiler `outdoor-v2/style.json` URL with an
      inline MapLibre raster style.
    - Raster source uses MapTiler Maps API XYZ PNG tiles:
      `https://api.maptiler.com/maps/outdoor-v2/256/{z}/{x}/{y}.png?key=...`.
    - This keeps MapTiler as provider but avoids remote style/glyph/sprite
      loading before MapLibre can fire `load`.
  - Verification:
    - Direct MapTiler raster tile for Bad Bayersoien z14/x8692/y5716 with
      `Referer: https://portal.s5evo.de/karte` -> 200 `image/png`.
    - `npx eslint app/components/event-map.tsx`,
      `npx tsc --noEmit --incremental false`, `npm run build`,
      `git diff --check` all gruen.
  - Commit/Push:
    - Code/docs commit: `885e062 Use raster MapTiler style for event map`
    - Pushed `ffeeab7..885e062`.
  - Vercel Production Deployment:
    - Deployment-ID: `dpl_6QQFUFKBSfX5H2Vw9AWGowyRfyBC`
    - Vercel-URL:
      `https://s5-evo-portal-vr4dffsfl-sebastiankroeker-2781s-projects.vercel.app`
    - Alias: `https://portal.s5evo.de`
    - Ready-State: `READY`
    - Deployed at: 2026-07-22 22:23 UTC
  - Post-Deploy-Smoke gruen:
    `HEAD https://portal.s5evo.de/karte` 200,
    `npm run smoke:public`,
    direct MapTiler raster tile for Bad Bayersoien z14/x8692/y5716 with
    `Referer: https://portal.s5evo.de/karte` -> 200 `image/png`.
  - Weiter offen nach Deploy:
    authenticated iPhone visual smoke durch Sebastian. Expected next signal:
    rendered raster map + bottom-right MapLibre controls.

- Event Map Visible Diagnostics Hotfix 2026-07-22 22:09 UTC:
  - Sebastian sent a third iPhone screenshot after deploy
    `34d53c6`/`dpl_6t3cu4nQiuShkrgYpgYuguALfrbp`: the map area was still
    fallback green. A dark clipped strip at the top-left suggested the new
    loading overlay may have been hidden under the sticky mobile nav.
  - Fix in `app/components/event-map.tsx`:
    - Moved MapLibre `NavigationControl` from `top-right` to `bottom-right`.
    - Moved attribution to `bottom-left`.
    - Moved loading and error overlays to `top-16` on mobile, keeping `top-3`
      on desktop.
    - Added an 8s timeout after MapLibre construction; if no `load` event
      arrives, the map area shows a red error message pointing at
      Safari/WebGL/content-blocker checks.
  - Checks gruen:
    `npx eslint app/components/event-map.tsx`,
    `npx tsc --noEmit --incremental false`, `npm run build`,
    `git diff --check`.
  - Commit/Push:
    - Code/docs commit: `ffeeab7 Improve event map mobile diagnostics`
    - Pushed `34d53c6..ffeeab7`.
  - Vercel Production Deployment:
    - Deployment-ID: `dpl_5eUfNdSN3FDpFGsdF8pPmtE7rCMt`
    - Vercel-URL:
      `https://s5-evo-portal-gmutbr4dh-sebastiankroeker-2781s-projects.vercel.app`
    - Alias: `https://portal.s5evo.de`
    - Ready-State: `READY`
    - Deployed at: 2026-07-22 22:14 UTC
  - Post-Deploy-Smoke gruen:
    `HEAD https://portal.s5evo.de/` 200,
    `HEAD https://portal.s5evo.de/karte` 200, `npm run smoke:public`,
    MapTiler style fetch with `Referer: https://portal.s5evo.de/karte` -> 200
    `style ok`, client chunk contains the timeout diagnostic and worker asset
    reference.
  - Weiter offen nach Deploy:
    authenticated iPhone visual smoke durch Sebastian. Expected next signal:
    bottom-right controls/rendered map, visible loading label, or red timeout
    error after 8s.

- MapLibre Hydration Diagnostics Hotfix 2026-07-22 21:59 UTC:
  - CR: `docs/cr/2026-07-22-interaktive-event-map.md`.
  - Sebastian sent a second iPhone screenshot after deploy
    `7275234`/`dpl_87w3iLvAiNxiRjY6VWnrpw1E7osx`: sponsor tree still visible,
    but map area remained only the green fallback.
  - Interpretation:
    - The page shell and SSR/client markup are present.
    - Missing MapLibre controls means the issue is still before/inside
      MapLibre client initialization, not only tile loading.
    - PWA service worker was inspected; it does not intercept `/_next/*` and
      navigations are network-first, so stale SW chunk caching is unlikely.
  - Fix in `app/components/event-map.tsx`:
    - Removed the static runtime import of `maplibre-gl`.
    - MapLibre now loads inside the client `useEffect` with dynamic
      `import("maplibre-gl")`.
    - The same-origin worker URL is still set before map construction.
    - Added explicit `mapLoaded` state and a visible `Karte wird geladen...`
      overlay while MapLibre has not reached `load`.
    - Existing caught MapLibre import/constructor errors now surface in the map
      area instead of leaving the fallback background silent.
  - Checks gruen:
    `npx eslint app/components/event-map.tsx`,
    `npx tsc --noEmit --incremental false`, `npm run build`,
    `git diff --check`.
  - Commit/Push:
    - Code/docs commit: `34d53c6 Harden event map client initialization`
    - Pushed `7275234..34d53c6`.
    - Note: this push also included the local docs-only commit
      `bf386c1 docs: record event map worker hotfix release [skip ci]`.
  - Vercel Production Deployment:
    - Deployment-ID: `dpl_6t3cu4nQiuShkrgYpgYuguALfrbp`
    - Vercel-URL:
      `https://s5-evo-portal-hqxl9bklm-sebastiankroeker-2781s-projects.vercel.app`
    - Alias: `https://portal.s5evo.de`
    - Ready-State: `READY`
    - Deployed at: 2026-07-22 22:04 UTC
  - Post-Deploy-Smoke gruen:
    `HEAD https://portal.s5evo.de/` 200,
    `HEAD https://portal.s5evo.de/karte` 200, `npm run smoke:public`,
    MapTiler style fetch with `Referer: https://portal.s5evo.de/karte` -> 200
    `style ok`, same-origin MapLibre worker asset -> 200 JavaScript.
  - Weiter offen nach Deploy:
    authenticated iPhone visual smoke durch Sebastian. Expected next signal:
    either rendered map, `Karte wird geladen...`, or a red map error box.

- MapLibre Worker Hotfix 2026-07-22 21:47 UTC:
  - CR: `docs/cr/2026-07-22-interaktive-event-map.md`.
  - Sebastian reported by iPhone screenshot that the sponsor tree is correct,
    but the map area still renders only the fallback background without visible
    tiles/controls.
  - Documentation check:
    - MapTiler React MapLibre guide confirms the expected React setup:
      MapTiler key, MapLibre GL JS, map container, controls, and marker.
    - MapLibre v6 docs confirm WebGL/style-driven rendering, required
      MapLibre CSS, and ESM worker setup.
    - MapLibre v6 docs explicitly recommend setting a worker URL for bundled
      apps/strict CSP instead of relying on worker autodetection.
  - Fix in `app/components/event-map.tsx`:
    - Added an explicit same-origin MapLibre worker URL via
      `new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url)`.
    - Calls `maplibregl.setWorkerUrl(...)` before constructing the map.
  - Rationale:
    - The visible fallback background means the layout/container exists.
    - Missing tiles and missing MapLibre controls point to MapLibre not
      completing client initialization/rendering, so worker/bundling is the
      next likely failure point.
  - Checks gruen:
    `npx eslint app/components/event-map.tsx`,
    `npx tsc --noEmit --incremental false`, `npm run build`,
    `git diff --check`.
  - Commit/Push:
    - Code/docs commit: `7275234 Fix event map worker initialization`
    - Pushed `06d0efb..7275234`.
    - Note: this push also included the earlier local docs-only commit
      `5466334 docs: record event map layer hotfix release [skip ci]`.
  - Vercel Production Deployment:
    - Deployment-ID: `dpl_87w3iLvAiNxiRjY6VWnrpw1E7osx`
    - Vercel-URL:
      `https://s5-evo-portal-ovy2ofvgs-sebastiankroeker-2781s-projects.vercel.app`
    - Alias: `https://portal.s5evo.de`
    - Ready-State: `READY`
    - Deployed at: 2026-07-22 21:53 UTC
  - Post-Deploy-Smoke gruen:
    `HEAD https://portal.s5evo.de/` 200,
    `HEAD https://portal.s5evo.de/karte` 200, `npm run smoke:public`,
    MapTiler style fetch with `Referer: https://portal.s5evo.de/karte` -> 200
    `style ok`, same-origin MapLibre worker asset -> 200 JavaScript.
  - Weiter offen nach Deploy:
    authenticated iPhone visual smoke durch Sebastian.

- Sponsor Layer Tree / Mobile Touch Hotfix 2026-07-22 21:18 UTC:
  - CR: `docs/cr/2026-07-22-interaktive-event-map.md`.
  - Sebastian requested:
    - Sponsor entries nested under the `Sponsoren` layer toggle.
    - The parent toggle should show/hide the whole sponsor layer.
    - Remove the remaining connection/leader line.
    - Do not keep the selected sponsor card in the map area, especially after
      layer off.
    - Keep route link behavior to Google Maps.
    - Continue improving mobile map visibility and pan/scroll.
  - Fix in `app/components/event-map.tsx`:
    - Sponsor entries now render as a tree below the `Sponsoren` toggle.
    - Toggle off hides sponsor tree and markers together.
    - Leader-line state/effects/SVG removed completely.
    - Selected sponsor details moved from map overlay into the tree item.
    - Mobile map area enlarged and MapLibre resize/touch handling reinforced
      with `ResizeObserver`, orientation/resize hooks, and explicit pan/touch
      options.
  - Checks gruen:
    `npx eslint app/components/event-map.tsx`,
    `npx tsc --noEmit --incremental false`, `npm run build`,
    `git diff --check`.
  - Production deploy approved by Sebastian in Telegram on 2026-07-22 21:15 UTC
    with "Handoff und guard rails beachten und los".
  - Commit/Push: `06d0efb Refine event map layer controls`,
    pushed `46a654e..06d0efb`.
  - Vercel Production Deployment:
    - Deployment-ID: `dpl_12w5sorZjYkcJ92zgFrxjbRtdo5u`
    - Vercel-URL:
      `https://s5-evo-portal-9dxip5gkf-sebastiankroeker-2781s-projects.vercel.app`
    - Alias: `https://portal.s5evo.de`
    - Ready-State: `READY`
  - Post-Deploy-Smoke gruen:
    `HEAD https://portal.s5evo.de/` 200,
    `HEAD https://portal.s5evo.de/karte` 200, `npm run smoke:public`,
    MapTiler style fetch with `Referer: https://portal.s5evo.de/karte` -> 200
    `style ok`.
  - Weiter offen nach Deploy:
    authenticated iPhone visual smoke durch Sebastian.
  - Doku-Nachtrag fuer finalen Deploy-Status ist lokal geschrieben; nicht
    erneut gepusht, um keine weitere Vercel-Deployment-Schleife durch reine
    Doku-Aenderungen auszuloesen.

- Mobile Map Viewport Fix 2026-07-22 19:06 UTC:
  - Sebastian reported on iOS Safari that he still saw no actual map and could
    not scroll the screen. He also asked whether the default map area can be
    defined and whether Bad Bayersoien coordinates are known.
  - Confirmed coordinates already used:
    `BAD_BAYERSOIEN_CENTER = [10.9987, 47.6907]`.
  - Root cause: initial `fitBounds` included sponsor addresses outside the
    municipality, including Oberau/Oderding, so Mobile started with an
    over-wide extent instead of the Gemeindegebiet. The mobile shell also used
    fixed viewport/overflow settings that could trap iOS Safari.
  - Fix in `app/components/event-map.tsx`:
    - Removed all-sponsor initial `fitBounds`.
    - Map initializes and jumps to Bad Bayersoien center at zoom `14.2`.
    - Mobile shell uses `svh`, allows page scrolling, and keeps desktop as a
      fixed two-column map/list layout.
    - Map area has a subtle land-colored fallback background while tiles load.
  - Commit/Push: `46a654e Fix mobile event map viewport`.
  - Vercel Production Deployment:
    - Deployment-ID: `dpl_4U1hP5mpb5p8kZiuKiEoaH9Bhdwz`
    - Vercel-URL:
      `https://s5-evo-portal-n66uclkot-sebastiankroeker-2781s-projects.vercel.app`
    - Alias: `https://portal.s5evo.de`
    - Ready-State: `READY`
  - Checks gruen:
    `npx eslint app/components/event-map.tsx`,
    `npx tsc --noEmit --incremental false`, `npm run build`,
    `git diff --check`, `HEAD https://portal.s5evo.de/karte` 200,
    `npm run smoke:public`, MapTiler style fetch with
    `Referer: https://portal.s5evo.de/karte` -> 200 `style ok`.

- Mobile Hotfix 2026-07-22 18:55 UTC:
  - Sebastian schickte einen iPhone-Screenshot: Die gestrichelte
    Card-zu-Marker-Verbindungslinie lief auf Mobile diagonal ueber Karte,
    Popup und Layer-Panel.
  - Fix: `app/components/event-map.tsx` blendet die Leader-Line auf kleinen
    Viewports aus und zeigt sie erst ab `lg`, wo Karte und Sponsor-Liste
    nebeneinander stehen.
  - Commit/Push: `3b5301a Fix mobile event map leader line`.
  - Vercel Production Deployment:
    - Deployment-ID: `dpl_Bumou1pLZjUzzF41BcX6HphZTRSz`
    - Vercel-URL:
      `https://s5-evo-portal-at92pvgfu-sebastiankroeker-2781s-projects.vercel.app`
    - Alias: `https://portal.s5evo.de`
    - Ready-State: `READY`
  - Checks gruen:
    `npx eslint app/components/event-map.tsx`,
    `npx tsc --noEmit --incremental false`, `npm run build`,
    `git diff --check`, `HEAD https://portal.s5evo.de/karte` 200,
    `npm run smoke:public`.
  - Weiter offen: echter authenticated Mobile-Visual-Smoke durch Sebastian.

- Production Release 2026-07-22 18:22 UTC:
  - CR: `docs/cr/2026-07-22-interaktive-event-map.md`.
  - Sebastian hat Option 1 freigegeben: MapLibre GL JS + MapTiler Cloud,
    self-hosting-faehiger Pfad spaeter ueber MapLibre-kompatible Tiles/PMTiles.
  - Sebastian hat am 2026-07-22 17:49 UTC entschieden:
    Event-Map erstmal nur fuer Admins. MapTiler-Key wurde von Sebastian auf
    Origin `portal.s5evo.de` eingeschraenkt bereitgestellt.
  - Lokal umgesetzt:
    - `maplibre-gl` installiert.
    - Neue admin-gated Route `/karte`.
    - Neue Admin-Gate-Komponente `app/components/admin-event-map-page.tsx`
      nach bestehendem `can("config.edit")`-Pattern.
    - Neue Client-Komponente `app/components/event-map.tsx`.
    - Static Sponsor Seed in `lib/event-map/sponsor-pois.ts` mit
      `verified`/`needs_review` Confidence.
    - MapTiler-Style via `NEXT_PUBLIC_MAPTILER_KEY`; ohne Key nutzt die lokale
      Seite einen MapLibre Demo-Style und zeigt einen Hinweis.
    - Sponsor-Layer, Marker, Sponsor-Liste, Detail-Popup, Route-/Website-Links,
      Layer-Platzhalter fuer Infrastruktur/Strecken und dezente
      Card-zu-Marker-Verbindungslinie.
    - Top-Nav-Link `Karte` und authenticated Sidebar-Eintrag nur fuer Admins
      ergaenzt.
    - `NEXT_PUBLIC_MAPTILER_KEY` lokal in `.env.local` gesetzt.
    - `NEXT_PUBLIC_MAPTILER_KEY` in Vercel Production env gesetzt; `vercel env
      ls` zeigt den Wert als `Encrypted`. Kein Deploy ausgefuehrt.
  - Geaenderte Dateien:
    `package.json`, `package-lock.json`, `app/karte/page.tsx`,
    `app/components/admin-event-map-page.tsx`,
    `app/components/event-map.tsx`, `app/components/nav-bar.tsx`,
    `app/components/sidebar.tsx`, `app/globals.css`, `.env.local`,
    `lib/event-map/sponsor-pois.ts`,
    `docs/cr/2026-07-22-interaktive-event-map.md`,
    `SESSION_HANDOFF.md`.
  - Checks gruen:
    `npx eslint app/components/admin-event-map-page.tsx app/components/event-map.tsx app/karte/page.tsx app/components/nav-bar.tsx app/components/sidebar.tsx lib/event-map/sponsor-pois.ts`,
    `npx tsc --noEmit --incremental false`, `git diff --check`,
    `npm run build`.
  - Lokaler Smoke:
    Dev-Server `http://127.0.0.1:3114`; `HEAD /karte` -> 200.
  - Commit/Push:
    - Commit: `8448f11 Add admin event map`
    - Push: `git push origin main` -> `94e7e3a..8448f11`.
    - Docs release-record commit `a20b94d docs: record admin event map release
      [skip ci]` pushed afterwards. Vercel ignored/overrode `[skip ci]` and
      still created a production deployment for that docs commit.
  - Vercel Production Deployment:
    - Final Deployment-ID on alias: `dpl_65GVcfmnVVnjPSkSrDMDbQW9QXMv`
    - Vercel-URL:
      `https://s5-evo-portal-qrd8uod9j-sebastiankroeker-2781s-projects.vercel.app`
    - Alias: `https://portal.s5evo.de`
    - Ready-State: `READY`
  - Post-Deploy Smoke gruen:
    `npm run smoke:public`; `HEAD https://portal.s5evo.de/` 200;
    `HEAD https://portal.s5evo.de/karte` 200; unauthenticated
    `GET /api/teams` -> 401 `Unauthorized`; Smoke bestaetigt auch
    unauthenticated `/api/admin/pending-changes` -> 401.
    Rueckgabe von `/karte` enthaelt keinen Demo-Key-Hinweis.
    Hinweis: Direkt nach dem zweiten Aliaswechsel gab es zwei transiente
    `/api/competition` 500er (`PrismaClientInitializationError`, DB
    `db.prisma.io:5432` kurz nicht erreichbar). Danach 5 direkte Retries 200
    und voller `npm run smoke:public` erneut gruen.
  - Offen:
    - Browser/Visual-Smoke mit echtem Key.
    - Sponsor-Liste/Adressen kurz plausibilisieren, insbesondere
      `needs_review`-Eintraege.
    - Authenticated Admin-Smoke durch Sebastian oder mit Admin-Cookie.
  - Git-Hinweis:
    Lokale `.git/info/exclude` ignoriert neue Dateien unter `app/`, `lib/` und
    `docs/`; beim Commit muessen neue Event-Map-Dateien gezielt mit
    `git add -f` aufgenommen werden. Unrelated untracked Workspace-Dateien
    `AGENTS.md`, `HEARTBEAT.md`, `MEMORY.md`, `SOUL.md` nicht anfassen.
    Der Nachtrag fuer den finalen zweiten Deployment-Status ist lokal in
    CR/Handoff dokumentiert, aber bewusst nicht erneut gepusht, um keine dritte
    Vercel-Deployment-Schleife durch reine Doku-Aenderungen auszuloesen.

- Production Release 2026-07-22 10:18 UTC:
  - CR: `docs/cr/2026-07-21-legacy-result-import-v2.md`.
  - Commit: `0abe34d Validate legacy import scoring`.
  - Aenderung:
    - V2-Legacy-Ergebnisimport priorisiert weiter die gelieferten
      Legacy-Punkte/-Plaetze und schreibt keine engineberechneten Punkte als
      Ergebniswerte in die DB.
    - Unsere Scoring Engine laeuft beim Import als Kontrollrechnung und
      erzeugt `WARNING`-Validation-Messages, falls Klassenpunkte/-platz oder
      Damen-/Herren-Gesamtpunkte/-platz von der Legacy-CSV abweichen.
    - Admin-Workbench zeigt `Engine-Abweichungen` in der Dry-run/Import-
      Zusammenfassung und Ist/Soll-Details in Draft-Warnungen.
    - `Live -> Ergebnisse` zeigt Teams ohne Ergebnisdaten, z.B. Startnummer
      `35`, im Gesamtergebnis ohne Platz/Punkte statt sie auszublenden.
    - Gesamtergebnis-Disziplinpunkte-Header bleiben untenbuendig.
    - `scripts/prepare-legacy-result-csvs.ts` korrigiert beim Erzeugen der
      Testdateien fuer Lauf/Rennrad/MTB Klassenpunkte und Damen-/Herren-
      Gesamtpunkte anhand der Portal-Klassen; Bank/Stock bleiben nur
      startnummern-/klassenbereinigt.
  - Neu erzeugtes Archiv:
    `/home/ocadmin/.openclaw/workspace/exports/legacy-results-portal-startnumbers-2026-07-22.tar.gz`.
  - CSV-Prep-Counts:
    - Lauf/Rennrad/MTB: je 76 Output Rows, je 76 Scoring Rows korrigiert.
    - Bank: 204 Output Rows, 0 Scoring Rows korrigiert.
    - Stock: 924 Output Rows, 0 Scoring Rows korrigiert.
  - Checks gruen:
    `npx eslint app/api/results/route.ts app/components/results-view.tsx app/api/admin/result-staging/legacy-results/import/route.ts app/admin/ergebnisse/page.tsx lib/legacy-result-import.ts scripts/prepare-legacy-result-csvs.ts`,
    `npx tsc --noEmit --incremental false`,
    `npm run verify:legacy-result-import`,
    `git diff --check`,
    `npm run build`.
  - Vercel Production Deployment:
    - Deployment-ID: `dpl_BkgYPkXFNLAMuDojCg6ySkJRPKsq`
    - Vercel-URL:
      `https://s5-evo-portal-gz8k3zg5r-sebastiankroeker-2781s-projects.vercel.app`
    - Alias: `https://portal.s5evo.de`
    - Ready-State: `READY`
  - Post-Deploy Smoke gruen:
    `npm run smoke:public`; `HEAD https://portal.s5evo.de/` 200;
    `GET /api/results?competitionId=cmn3a1piz0002l104372yx9yt` 200 mit
    `totalClasses=9`, `totalTeams=82`, `resultBuckets=9`.
  - Authenticated Manual Smoke offen:
    Mit Admin-Session eine korrigierte Lauf/Rennrad/MTB-Datei importieren und
    pruefen, dass `Engine-Abweichungen` nur noch bei echten Restdifferenzen
    auftauchen und Startnummer `35` im Gesamtergebnis ohne Punkte sichtbar ist.

- Production Data Ops 2026-07-22 09:20 UTC:
  - CR: `docs/cr/2026-07-22-soier-lions-startnumber-legacy-csv-prep.md`.
  - Direkte Production-DB-Korrektur nach Sebastian-Auftrag:
    - `ESV Soier Lions` (`cmrv6vfd20002l404pbh1a4xr`) von Startnummer
      `null` auf `96`, Klasse `masters`.
    - `Schwaigers 5` (`cmrv4t1pw0002jr0467ytjihq`) von Startnummer `null`
      auf `97`, Klasse `jungsters`.
    - Fuer beide wurde ein `AuditEvent` mit Action
      `TEAM_START_NUMBER_MANUAL_SET` geschrieben.
  - Bereinigte Legacy-Ergebnis-Testdateien neu erzeugt:
    `/home/ocadmin/.openclaw/workspace/exports/legacy-results-portal-startnumbers-2026-07-22/`.
    Archiv:
    `/home/ocadmin/.openclaw/workspace/exports/legacy-results-portal-startnumbers-2026-07-22.tar.gz`.
  - CSV-Counts nach Portal-Startnummern/Klassen:
    - Laufen: 76 Raw Records / 76 Drafts, `96` und `97` enthalten, `35`
      fehlt.
    - Rennrad: 76 Raw Records / 76 Drafts, `96` und `97` enthalten, `35`
      fehlt.
    - MTB: 76 Raw Records / 76 Drafts, `96` und `97` enthalten, `35` fehlt.
    - Bank: 204 Raw Records / 76 Drafts, parserseitig 7 Fehler; nicht erster
      Importtest.
    - Stock: 924 Raw Records / 77 Drafts, `96`, `97` und `35` enthalten.
  - Verification:
    - Read-only DB Verify bestaetigt `96` und `97` eindeutig.
    - `GET /api/results?competitionId=cmn3a1piz0002l104372yx9yt` 200 mit
      `totalClasses=9`, `totalTeams=82`, `buckets=9`.
  - Hinweis:
    Als normales Team ohne Startnummer bleibt `Vier Läuche und ein Schrank`;
    Sportlerboerse-Eintraege ohne Startnummer sind separat.

- Production Release 2026-07-22 08:55 UTC:
  - CR: `docs/cr/2026-07-21-legacy-result-import-v2.md`
    Addendum `Legacy Result Parser V2 Staging Write`.
  - Sebastian hat den Vorschlag angenommen:
    - `Dry-run` bleibt Vorschau/Pruefung und schreibt nichts in die DB.
    - Neue Import-Pakete verwenden nur noch `Produktionstest` / `PROD_TEST`.
    - `Produktion` bleibt fuer spaetere Publikation/Siegerehrungs-/Release-
      Workflows reserviert.
  - Aenderung:
    - Generischer V2-Endpunkt
      `POST /api/admin/result-staging/legacy-results/import` schreibt bei
      `dryRun:false` `PROD_TEST`-Batches mit Raw Records und Drafts.
    - V2-Dry-run bleibt ohne DB-Write, liest aber fuer Matching Startnummer +
      Disziplin gegen Teams/Teilnehmer:innen.
    - Legacy-Laufen-Importer und Zeitnahme-Import akzeptieren serverseitig nur
      noch `PROD_TEST` fuer neue Writes.
    - Admin-UI entfernt Import-Zweck-Dropdowns; V2-CSV-Aktion macht
      Dry-run-Zusammenfassung, Confirm, dann Staging-Testpaket.
    - Alte Enum-Werte/Filter bleiben fuer historische Pakete kompatibel.
  - Geaenderte Dateien:
    `app/admin/ergebnisse/page.tsx`,
    `app/api/admin/result-staging/legacy-results/import/route.ts`,
    `app/api/admin/result-staging/legacy-running/import/route.ts`,
    `app/api/admin/result-staging/timekeeping/import/route.ts`,
    `scripts/verify-legacy-result-import.ts`,
    `docs/cr/2026-07-21-legacy-result-import-v2.md`,
    `SESSION_HANDOFF.md`.
  - Checks gruen:
    `npx eslint app/admin/ergebnisse/page.tsx app/api/admin/result-staging/legacy-results/import/route.ts app/api/admin/result-staging/legacy-running/import/route.ts app/api/admin/result-staging/timekeeping/import/route.ts scripts/verify-legacy-result-import.ts`,
    `npx tsc --noEmit --incremental false`,
    `npm run verify:legacy-result-import`,
    `git diff --check`, `npm run build`.
  - Commit: `3efadfb Enable legacy result staging import`.
  - Push: `git push origin main` nach Sebastian-Go.
  - Vercel Production Deployment:
    - Deployment-ID: `dpl_2yNgvX2Ye7ibLtt6P5W6iazoeNZ9`
    - Vercel-URL:
      `https://s5-evo-portal-6vmb532nk-sebastiankroeker-2781s-projects.vercel.app`
    - Alias: `https://portal.s5evo.de`
    - Ready-State: `READY`
  - Local negative smoke:
    unauthenticated V2 import `POST` -> 401 ohne Payload;
    alter RUN-Importer mit `purpose=PRODUCTION` -> 400 `Ungueltiger purpose.`
    ohne Payload.
  - Post-Deploy Smoke gruen:
    `npm run smoke:public`; `HEAD https://portal.s5evo.de/` 200;
    production unauthenticated V2 import `POST` -> 401 ohne Payload;
    `GET /api/results?competitionId=cmn3a1piz0002l104372yx9yt` 200 mit
    `totalClasses=9`, `totalTeams=82`, `resultBuckets=9`.
  - Check-Gap:
    `npm run verify:tenant-scope` faellt aktuell wegen bestehenden,
    unberuehrten Home-News-Routen
    `app/api/admin/home-news/[entryId]/route.ts` und
    `app/api/admin/home-news/route.ts`.
  - Authenticated Manual Smoke offen:
    Mit Admin-Session `Admin -> Ergebnisse -> Pakete -> Legacy-Ergebnis-CSV`
    eine Legacy-Datei trocken pruefen, Confirm geben, neues
    `Produktionstest`-Paket ansehen und unter `Live -> Ergebnisse` mit
    `Staging-Testdaten` gegenpruefen.
  - Lokaler Dev-Server laeuft auf `http://localhost:3113`.

- Production Release 2026-07-22 08:16 UTC:
  - Aenderung: Nachschliff fuer `Live`-Teams, Startlisten, Ergebnislisten und
    Filterpanels.
  - Teams:
    - Disziplinanzeige in Teamkarten zeigt den Text vor dem Icon; Icon steht
      direkt rechts neben dem Disziplintext.
  - Startlisten:
    - Startnummern werden ohne `#` angezeigt.
    - Aufgeklappte Klassen haben Spaltenueberschriften fuer STRNR, Name,
      Mannschaft und Geschlecht.
    - Favoritenstern steht direkt rechts neben der Startnummer.
  - Ergebnisse:
    - Subtabs sind getauscht: `Einzelergebnisse` links,
      `Gesamtergebnisse` rechts.
    - Favoritenstern steht in Gesamt- und Einzelergebnislisten direkt neben der
      Startnummer statt im Teamnamenbereich.
  - Filterpanels:
    - Filter-Toolbarbuttons in `Live` sind sichtbar beschriftet.
    - Aufgeklappte Panels haben unten einen breiten Button
      `Filter Ausblenden`.
  - Geaenderte Dateien:
    `app/components/dashboard-controls.tsx`,
    `app/components/live-screen.tsx`,
    `app/components/results-view.tsx`.
  - Checks gruen: `npx eslint app/components/dashboard-controls.tsx
    app/components/live-screen.tsx app/components/results-view.tsx`,
    `npx tsc --noEmit --incremental false`, `git diff --check`,
    `npm run build`.
  - Commit: `abc0f7f Adjust live cockpit table controls`.
  - Push: `git push origin main` nach Sebastian-Go; dabei wurde der vorher
    lokale Handoff-Commit `4676bb4 docs: record live display polish release`
    mit gepusht.
  - Vercel Production Deployment:
    - Deployment-ID: `dpl_B4jHQA1yDn51YsQ4rCRj42yvFwUp`
    - Vercel-URL:
      `https://s5-evo-portal-b81x4ch5w-sebastiankroeker-2781s-projects.vercel.app`
    - Alias: `https://portal.s5evo.de`
    - Ready-State: `READY`
  - Post-Deploy Smoke gruen: `npm run smoke:public`; `/`, `/login`,
    `/anmeldung`, `/aenderungen` 200; Legacy-Domain 308;
    `/api/competition` 200; `/api/results` 200; unauthenticated `/api/teams`
    401; unauthenticated `/api/admin/pending-changes` 401.
  - Targeted Live/API Smoke: `HEAD https://portal.s5evo.de/` 200;
    `GET /api/results?competitionId=cmn3a1piz0002l104372yx9yt` 200;
    aktuelle API-Daten: `totalClasses=9`, `totalTeams=82`,
    `resultBuckets=9`.
  - Authenticated Manual Smoke offen: Startlisten-Spalten/Favoritenstern und
    Ergebnis-Subtab-Reihenfolge mit echter Live-Rolle visuell pruefen.

- Production Release 2026-07-22 07:41 UTC:
  - Aenderung: Nachschliff fuer `Live` nach Screenshot-Feedback.
  - Teams:
    - Teilnehmer innerhalb der Teamkarten folgen jetzt der Standard-
      Disziplinreihenfolge.
    - Neben dem Disziplin-Icon steht der Disziplintext.
    - Favoritenbutton heisst zustandsabhaengig `Favorit hinzufuegen` oder
      `Favorit`.
    - Klassen-Ueberschriften nutzen offizielle Klassenlabels mit Umlauten.
  - Gesamtergebnisse:
    - Klassen-Ueberschriften nutzen offizielle Klassenlabels mit Umlauten.
    - Lange Teamnamen umbrechen statt abgeschnitten zu werden.
    - Disziplin-Punktespalten sind kompakter; Gesamtspalte ebenfalls schmaler.
    - Disziplin-Ueberschriften nutzen volle Namen, `Bank` statt abgeleitetem
      Kurznamen.
  - Geaenderte Dateien:
    `app/components/live-screen.tsx`,
    `app/components/results-view.tsx`.
  - Checks gruen: `npx eslint app/components/live-screen.tsx
    app/components/results-view.tsx`, `npx tsc --noEmit --incremental false`,
    `git diff --check`, `npm run build`.
  - Commit: `a6ca1ca Polish live cockpit displays`.
  - Push: `git push origin main` nach Sebastian-Go; dabei wurde der vorher
    lokale Handoff-Commit `e44f46a docs: record live filter refinement release`
    mit gepusht.
  - Vercel Production Deployment:
    - Deployment-ID: `dpl_7Nq2kqSLoMynCGSLaPDepKSLH1ZQ`
    - Vercel-URL:
      `https://s5-evo-portal-pj6vc0ic5-sebastiankroeker-2781s-projects.vercel.app`
    - Alias: `https://portal.s5evo.de`
    - Ready-State: `READY`
  - Post-Deploy Smoke gruen: `npm run smoke:public`; `/`, `/login`,
    `/anmeldung`, `/aenderungen` 200; Legacy-Domain 308;
    `/api/competition` 200; `/api/results` 200; unauthenticated `/api/teams`
    401; unauthenticated `/api/admin/pending-changes` 401.
  - Targeted Live/API Smoke: `HEAD https://portal.s5evo.de/` 200;
    `GET /api/results?competitionId=cmn3a1piz0002l104372yx9yt` 200;
    aktuelle API-Daten: `totalClasses=9`, `totalTeams=82`,
    `resultBuckets=9`.
  - Authenticated Manual Smoke offen: Teamkarten und Gesamtergebnis-Tabelle im
    Browser mit echter Live-Rolle visuell gegen die Screenshots pruefen.

- Production Release 2026-07-22 07:01 UTC:
  - Aenderung: Nachkorrektur fuer `Live`-Such-/Filterpanel.
  - Teams/Startlisten:
    - `Damen Gesamt` und `Herren Gesamt` aus den Filterpanelen entfernt;
      Gesamtklassen bleiben fuer die Siegerehrung reserviert.
    - Favoriten-Pille ist immer im Filterpanel sichtbar.
    - `Alle Klassen` setzt auf ungefilterte Klassenauswahl zurueck.
    - Innerhalb einer Klasse wird nach Startnummer sortiert.
    - Team-Kacheln zeigen keine `5/5`-Stats und keinen Status-Haken/-Timer
      mehr.
    - Team-Startnummern werden ohne `#` angezeigt.
    - Disziplinanzeigen nutzen `DisciplineBrandIcon` analog
      Mannschafts-Dashboard.
  - Ergebnisse:
    - Gesamtklassen aus der Ergebnis-Klassenauswahl entfernt.
    - Einzelergebnis-Disziplinfilter ins Filterpanel verschoben.
    - Neue Pille `Alle Disziplinen`; separate Disziplinleiste unter dem
      Filterpanel entfernt.
    - Einzelergebnis-Platzierung ohne `#` und ohne Kreis/Badge.
    - Einzelergebnis-Tabelle kompakter mit optimierten Spaltenbreiten.
  - Geaenderte Dateien:
    `app/components/live-screen.tsx`,
    `app/components/results-view.tsx`.
  - Checks gruen: `npx eslint app/components/live-screen.tsx
    app/components/results-view.tsx`, `npx tsc --noEmit --incremental false`,
    `git diff --check`, `npm run build`.
  - Lokale Runtime-Probe: Dev-Server `http://localhost:3110`; `HEAD /` 200.
  - Commit: `680be82 Refine live cockpit filters`.
  - Push: `git push origin main` nach Sebastian-Go; dabei wurde der vorher
    lokale Handoff-Commit `1c5f6d6 docs: record live cockpit filter release`
    mit gepusht.
  - Vercel Production Deployment:
    - Deployment-ID: `dpl_8v5t6QZy2VLEsqKhweCje1wFk8Pa`
    - Vercel-URL:
      `https://s5-evo-portal-ndhbvz0su-sebastiankroeker-2781s-projects.vercel.app`
    - Alias: `https://portal.s5evo.de`
    - Ready-State: `READY`
  - Post-Deploy Smoke gruen: `npm run smoke:public`; `/`, `/login`,
    `/anmeldung`, `/aenderungen` 200; Legacy-Domain 308;
    `/api/competition` 200; `/api/results` 200; unauthenticated `/api/teams`
    401; unauthenticated `/api/admin/pending-changes` 401.
  - Targeted Live/API Smoke: `HEAD https://portal.s5evo.de/` 200;
    `GET /api/results?competitionId=cmn3a1piz0002l104372yx9yt` 200;
    aktuelle API-Daten: `classes=9`, `teams=82`, `totalClasses=9`,
    `competition.status=OPEN`.
  - Authenticated Manual Smoke offen: Live-Filterpanel in `Teams`,
    `Startlisten` und `Ergebnisse` mit Admin-Rolle im Browser pruefen.

- Production Release 2026-07-22 06:25 UTC:
  - Aenderung: `Live` hat in allen drei Tabs `Teams`, `Startlisten` und
    `Ergebnisse` ein Dashboard-analoges Such-/Filterfeld.
  - Suchindex:
    - Teams/Startlisten: Teamname, sichtbare Startnummer, Teilnehmer:innen;
      fuer Admins zusaetzlich Teammanager/Kontakt.
    - Ergebnisse: Teamname, sichtbare Startnummer, Teilnehmer:innen aus
      Ergebnissen; fuer Admins zusaetzlich Teammanager/Kontakt ueber den
      bereits geladenen Live-Teamkontext.
  - Filterpanel:
    - Klassen-Pillen pro Tab.
    - `Damen Gesamt` = `damen-a` + `damen-b`.
    - `Herren Gesamt` = `jungsters` + `herren` + `masters`.
    - Favoritenfilter bleibt watchlist-basiert und ist in das Panel gezogen.
  - Startlisten-Suche reduziert bei Treffer auf Teilnehmer:innen-Niveau:
    Teamname/Startnummer/Teammanager filtert teamweit, Teilnehmername nur die
    passenden Starter:innen.
  - Geaenderte Dateien:
    `app/components/live-screen.tsx`,
    `app/components/results-view.tsx`.
  - Checks gruen: `npx eslint app/components/live-screen.tsx
    app/components/results-view.tsx`, `npx tsc --noEmit --incremental false`,
    `git diff --check`, `npm run build`.
  - Lokale Runtime-Probe: Dev-Server `http://localhost:3109`; `HEAD /` 200.
  - Commit: `4fde882 Add live cockpit search filters`.
  - Push: `git push origin main` nach Sebastian-Go; dabei wurde der vorher
    lokale Handoff-Commit `0005952 docs: record live cockpit production
    release` mit gepusht.
  - Vercel Production Deployment:
    - Deployment-ID: `dpl_CVox9EKY8PyRGh5yubg5wFdtd7Sf`
    - Vercel-URL:
      `https://s5-evo-portal-hsn4lpd4u-sebastiankroeker-2781s-projects.vercel.app`
    - Alias: `https://portal.s5evo.de`
    - Ready-State: `READY`
  - Post-Deploy Smoke gruen: `npm run smoke:public`; `/`, `/login`,
    `/anmeldung`, `/aenderungen` 200; Legacy-Domain 308;
    `/api/competition` 200; `/api/results` 200; unauthenticated `/api/teams`
    401; unauthenticated `/api/admin/pending-changes` 401.
  - Targeted Live/API Smoke: `HEAD https://portal.s5evo.de/` 200;
    `GET /api/results?competitionId=cmn3a1piz0002l104372yx9yt` 200;
    aktuelle API-Daten: `classes=9`, `teams=82`, `totalClasses=9`,
    `competition.status=OPEN`.
  - Authenticated Manual Smoke offen: Suchfeld/Filterpanel in `Teams`,
    `Startlisten` und `Ergebnisse` mit eingeloggter Admin-Rolle visuell
    pruefen, insbesondere Teammanager-Suche und Favoriten.

- Production Release 2026-07-22 05:25 UTC:
  - CR: `docs/cr/2026-07-22-live-results-tabs.md`
  - Aenderung: `Live` ist als Wettkampftags-Cockpit geordnet:
    `Teams | Startlisten | Ergebnisse`.
  - `Ergebnisse` enthaelt zwei Subtabs: `Gesamtergebnisse` und
    `Einzelergebnisse`.
  - In beiden Ergebnis-Subtabs gibt es Klassen-Buttons fuer `Damen Gesamt` und
    `Herren Gesamt`; bestehende lokale Favoriten werden pro Gesamtklasse als
    Count am Button gekennzeichnet.
  - Teams und Startlisten sind wiederhergestellt. Der separate Watchlist-
    Haupttab ist entfernt; Favoriten bleiben als Stern und `Nur Favoriten`-
    Filter in Teams/Startlisten sowie als Stern/Count in Ergebnissen.
  - Sportlerboerse-/Marketplace-Teams werden aus Teams/Startlisten in `Live`
    clientseitig herausgefiltert (`registrationMode=MARKETPLACE` oder
    `category=sportlerboerse`).
  - Keine API-/DB-/Serializer-/Service-Worker-/Mail-/Export-/Log-Aenderung.
    Kombinierte Gesamtklassen werden clientseitig aus `/api/results` abgeleitet:
    `damen-a` + `damen-b`; `jungsters` + `herren` + `masters`.
  - Checks gruen: `npx eslint app/components/live-screen.tsx
    app/components/results-view.tsx`, `npx tsc --noEmit --incremental false`,
    `git diff --check`, `npm run build`.
  - Lokale Runtime-Probe: Dev-Server `http://localhost:3108`; `HEAD /` 200;
    `GET /api/results?competitionId=cmn3a1piz0002l104372yx9yt` 200; Quellklassen
    fuer `Damen Gesamt` = 2, `Herren Gesamt` = 3.
  - Commit: `35f4d15 Reorganize live cockpit result tabs`
  - Nach Sebastian-Go wurde `git push origin main` ausgefuehrt.
  - Vercel Production Deployment:
    - Deployment-ID: `dpl_Cgsp5YyBUqkp38UanLKrqVttRo3K`
    - Vercel-URL:
      `https://s5-evo-portal-2263mmjyz-sebastiankroeker-2781s-projects.vercel.app`
    - Alias: `https://portal.s5evo.de`
    - Ready-State: `READY`
  - Post-Deploy Smoke gruen: `npm run smoke:public`; `/`, `/login`,
    `/anmeldung`, `/aenderungen` 200; Legacy-Domain 308; `/api/competition`
    200; `/api/results` 200; unauthenticated `/api/teams` 401;
    unauthenticated `/api/admin/pending-changes` 401.
  - Targeted Live/API Smoke: `HEAD https://portal.s5evo.de/` 200;
    `GET /api/results?competitionId=cmn3a1piz0002l104372yx9yt` 200; aktuelle
    API-Daten: `Damen Gesamt` 2 Quellklassen/0 offizielle TeamScores,
    `Herren Gesamt` 3 Quellklassen/0 offizielle TeamScores, insgesamt
    `classes=9`, `teams=82`.
  - Authenticated Manual Smoke offen: Teams/Startlisten/Favoriten-Filter und
    Ergebnis-Subtabs im Browser mit eingeloggter Rolle pruefen.

- Production Release 2026-07-22 04:41 UTC:
  - Commit `97f90f6 Hide changelog link from non-admin header`
  - Aenderung: Header-Badge `Projektstand` / `APP_VERSION` / Link
    `/changelog` wird in `app/components/nav-bar.tsx` nur noch fuer aktive
    Rolle `ADMIN` gerendert. Nicht-Admins sehen ihn route-uebergreifend nicht
    mehr.
  - Checks gruen: `npx eslint app/components/nav-bar.tsx`,
    `npx tsc --noEmit --incremental false`, `npm run build`,
    `git diff --check -- app/components/nav-bar.tsx`.
  - Lokale Runtime-Probe: `http://localhost:3107/anmeldung` 200; Suche nach
    `Projektstand`, `v0.7.1`, `/changelog` im nicht-authentifizierten HTML ohne
    Treffer.
  - Nach Sebastian-Go wurde `git push origin main` ausgefuehrt.
  - Vercel Production Deployment:
    - Deployment-ID: `dpl_5hR4bfqanaPJKsxP7moxCrY5uuj9`
    - Vercel-URL:
      `https://s5-evo-portal-kmysnqdqw-sebastiankroeker-2781s-projects.vercel.app`
    - Alias: `https://portal.s5evo.de`
    - Ready-State: `READY`
  - Post-Deploy Smoke gruen: `npm run smoke:public`; `/`, `/login`,
    `/anmeldung`, `/aenderungen` 200; Legacy-Domain 308; `/api/competition`
    200; `/api/results` 200; unauthenticated `/api/teams` 401;
    unauthenticated `/api/admin/pending-changes` 401.
  - Live Header-Smoke: `https://portal.s5evo.de/anmeldung` 200; Suche nach
    `Projektstand`, `v0.7.1`, `/changelog` im nicht-authentifizierten HTML ohne
    Treffer.
  - Dieser Handoff-Update-Commit bleibt zunaechst lokal, damit kein zweiter
    docs-only Production-Build direkt nach dem Release ausgeloest wird.

- Release-/Commit-Standard ab 2026-07-22:
  - `main` ist mit Vercel/GitHub verbunden:
    - Vercel-Projekt `s5-evo-portal`
    - GitHub-Link `sebastiankroeker-jpg/S5EvoPortal`
    - Production Branch `main`
    - `gitProviderOptions.createDeployments = enabled`
  - Ein `git push origin main` ist damit deploy-relevant und zaehlt als
    Production-Release-Schritt, nicht nur als Remote-Backup.
  - Standardprozess fuer CRs:
    1. CR lokal umsetzen.
    2. Relevante Checks laufen lassen.
    3. Kleine fachliche Commits erstellen.
    4. Erst nach Sebastian-Go `git push origin main`.
    5. Vercel Production Build/Deploy abwarten.
    6. Smoke gegen `https://portal.s5evo.de`, inklusive relevanter
       unauthenticated 401/403-Negativtests.
    7. CR/Handoff mit Commit, Deployment-ID, URL und Smoke-Ergebnis
       aktualisieren.
  - Nicht mehr aus dirty/uncommitted lokalem Stand deployen, ausser es gibt
    einen bewusst dokumentierten Notfallgrund.
  - Fuer High-Risk-Themen wie Authentik/Passwort-Reset:
    - eigener kleiner Commit als Ruecksprungpunkt vor Aenderungen;
    - kein Misch-Deploy mit anderen CRs;
    - Rollback-Weg vor Umsetzung dokumentieren;
    - separates Go fuer Implementierung und Production-Release.
  - Production Release 2026-07-22 02:49 UTC:
    - `git push origin main` wurde nach gruenen Pre-Checks ausgefuehrt.
    - `main` ist jetzt mit `origin/main` synchron.
    - Vercel Production Deployment:
      - Deployment-ID: `dpl_3XtD9XYN2zmVBNd55qmyDh3oYf67`
      - Vercel-URL:
        `https://s5-evo-portal-992i43hoj-sebastiankroeker-2781s-projects.vercel.app`
      - Alias: `https://portal.s5evo.de`
      - Ready-State: `READY`
    - Pre-Checks gruen: `git diff --check`, `npx prisma validate`,
      `npx tsc --noEmit --incremental false`, `npm run build`.
    - Post-Deploy Smoke gruen: `npm run smoke:public`; `/` 200;
      `/admin?tab=news` 200; `/zeitnahme/monitor` 200;
      `GET /api/home-news` 200; unauthenticated `GET /api/admin/users` 401;
      unauthenticated `GET /api/admin/home-news` 401; unauthenticated
      `POST /api/admin/start-numbers/import` mit gueltigem JSON-Dry-run 401;
      unauthenticated `GET /api/timekeeping/snapshot?...&startNumberSource=imported-test` 401.
  - Vorherige lokale Commit-Aufraeumung:
    - Neue lokale Commits:
      - `53dad00 Harden participant changes and start number visibility`
      - `45e16f8 Add home news admin and standalone user visibility`
      - `57d3e57 Extend start number import workflow`
      - `ad5465f Add legacy result staging workflows`
      - `86dfcb2 Add road timekeeping monitor workflow`
      - `6def917 docs: update session handoff for deployed CRs`
      - `67664c7 docs: record release commit standard`
    - Getrackter Working Tree war nach der Aufraeumung sauber; untracked
      Workspace-Dateien `AGENTS.md`, `HEARTBEAT.md`, `MEMORY.md`, `SOUL.md`
      nicht ins Portal-Repo aufnehmen.

- Neue Draft-CRs 2026-07-21 21:00 UTC:
  - `docs/cr/2026-07-21-start-number-import-create-missing-teams.md`
    - Anlass: Sebastian hat weitere Mannschaften, die ausserhalb des Portals
      zugetragen wurden, und moechte sie ueber den Startnummern-Import anlegen,
      indem die Mannschafts-UID leer bleibt.
    - Status: deployed 2026-07-22 02:49 UTC via `git push origin main`
      / Vercel auto-deploy.
    - Aktueller Code: Leere Mannschafts-UID erzeugt heute keine Mannschaft.
      Wenn keine ID-basierten Zuordnungen gefunden werden, matched der
      Legacy-Fallback bestehende Teams per Mannschaftsname/Teilnehmer-
      Signatur; nicht matchbare Rows werden nur als Warnung gefuehrt.
    - Umsetzung lokal:
      - Leere Mannschafts-UID kann als Create-Signal dienen, aber nur mit
        explizitem Flag/Bestätigung `createMissingTeams`.
      - Dashboard-Legacy-Import sendet `createMissingTeams: true` und zeigt im
        Confirm-Dialog Anzahl neuer Mannschaften.
      - Neue Mannschaften werden `approved=true`, Owner/Kontakt
        `sebastian.kroeker@proton.me`.
      - Keine Authentik/User/Claim/Mail-Side-Effects.
      - Teilnehmer werden aus den fuenf Legacy-Disziplin-Slots angelegt.
      - Duplicate Teamname oder Duplicate Startnummer blockt die Row.
      - Audit schreibt Team-Anlage-Zusammenfassung, nicht CSV-Body.
    - Gate: High Risk, weil Teams/Teilnehmer persistent angelegt werden.
    - Lokale Checks gruen: targeted ESLint, `npx tsc --noEmit --incremental
      false`, `git diff --check`, `npm run build`.
  - `docs/cr/2026-07-21-home-news-admin-crud.md`
    - Anlass: Sebastian will auf Home in der Box "Aktuelles & Neuigkeiten"
      Admin-Nachrichten einstellen, bearbeiten und archivieren koennen.
    - Status: deployed 2026-07-21 21:23 UTC.
    - Lokale Aenderungen:
      - Neues Prisma-Modell `HomeNewsEntry` plus Migration
        `prisma/migrations/20260721211500_add_home_news_entries/migration.sql`.
      - Neue APIs: public `GET /api/home-news`, admin
        `GET/POST /api/admin/home-news`, admin
        `PATCH /api/admin/home-news/[entryId]`.
      - Neue Admin-Komponente `app/components/home-news-management.tsx`.
      - Home liest bis zu 3 veroeffentlichte, nicht archivierte Eintraege und
        nutzt die bisherige statische Meldung als Fallback.
      - Admin-Navigation hat neuen Tab `News`.
    - Migration `20260721211500_add_home_news_entries` wurde per
      `npx prisma migrate deploy` erfolgreich angewendet.
    - Deploy:
      - Deployment-ID: `dpl_AuuSHhAjmqZDReQWt1Nc1NkD3pUY`
      - Vercel-URL:
        `https://s5-evo-portal-rngodacmx-sebastiankroeker-2781s-projects.vercel.app`
      - Alias: `https://portal.s5evo.de`
      - Ready-State: `READY`
    - Post-Deploy Smoke gruen: `npm run smoke:public`; `/` 200;
      `/admin?tab=news` 200; `GET /api/home-news` 200 mit leerer Liste;
      unauthenticated `GET /api/admin/home-news` 401.
  - `docs/cr/2026-07-21-user-management-authentik-recovery.md`
    - Anlass: `schmid905@gmx.de` existiert laut Sebastian in Authentik, ist
      aber nicht in der Portal-Benutzerverwaltung sichtbar; Passwort-Reset
      fehlt und soll hoch strukturiert mit Rollback angegangen werden.
    - Read-only Portal-DB-Befund: Es gibt einen lokalen Portal-User
      `Marco Schmid <schmid905@gmx.de>` mit `authentikSub = null`, ohne
      Tenant-Rollen, ohne Teams und ohne Teilnehmer-Verknuepfung.
    - Aktuelle Ursache fuer Nicht-Anzeige war: `app/api/admin/users/route.ts`
      listete nur User mit `tenantRoles.some({ tenantId: scopedTenantId })`.
    - Deployed: Admin-User-API nimmt nun auch ungescopte Portal-
      User ohne Rollen/Teams/Teilnehmerlinks auf; UI hat Filter/KPI
      `ohne Rolle` und Standalone-Konto-Status fuer User ohne Teambezug.
    - Authentik-Recovery-Recherche: Passwort-Reset sollte ueber Authentik
      Recovery Flow laufen; Portal darf keine Passwoerter oder Recovery-Tokens
      selbst verwalten.
    - Gate: keine Authentik-Flow-/Provider-Aenderung, keine Recovery-Mail-
      Automatisierung und kein Deploy ohne explizites Go.
    - Checks fuer beide CRs gruen: targeted ESLint, `npx prisma
      validate`, `npx tsc --noEmit --incremental false`, `git diff --check`,
      `npm run build`.
    - Post-Deploy Sensitive Negative Smoke: unauthenticated
      `GET /api/admin/users` bleibt 401.

- Deployed Legacy-Ergebnisimport-V2-Dry-run 2026-07-21 20:36 UTC:
  - CR `docs/cr/2026-07-21-legacy-result-import-v2.md` per Addendum
    `Legacy Result Parser V2 Dry-run` erweitert.
  - Anlass: Sebastian will den Fokus zuerst auf Import der Legacy-Daten legen,
    unter der Annahme, dass keine manuellen Korrekturen nötig sind.
  - Testdateien liegen in `/home/ocadmin/.openclaw/media/inbound/`:
    RUN, ROAD, MTB, BENCH, STOCK. Sie wurden nicht ins Repo kopiert, weil sie
    personenbezogene Ergebnisdaten enthalten.
  - Neue lokale Aenderungen:
    - `lib/legacy-result-import.ts`: generischer Legacy-CSV-Parser fuer alle
      fuenf Disziplinen.
    - `app/api/admin/result-staging/legacy-results/import/route.ts`:
      admin-only Dry-run-Endpunkt; `dryRun:false` wird in diesem Schnitt
      bewusst abgelehnt.
    - `app/admin/ergebnisse/page.tsx`: neuer Block
      `Legacy-Ergebnis-CSV prüfen` fuer V2-Dry-run ohne Paket-Schreiben; alter
      RUN-Staging-Import bleibt unveraendert.
    - `scripts/verify-legacy-result-import.ts` + package script
      `verify:legacy-result-import`.
    - `scripts/verify-tenant-scope.ts` umfasst die neue Route.
  - Fachliche Erkennung:
    - `1` RUN, `2` STOCK, `3` ROAD, `4` BENCH, `5` MTB.
    - RUN/ROAD/MTB: 1 Raw-Zeile -> 1 Draft Preview.
    - BENCH: Versuchzeilen gruppiert; bester gueltiger `AuGewicht` als
      Draft-Wert, `AuBruttoGewicht` bleibt in Details.
    - STOCK: 11 Schubzeilen + Summary `S` gruppiert; Summary liefert Summe,
      Streicher und BWZ.
  - Fixture-Check gruen:
    - RUN 111 -> 111 Drafts.
    - ROAD 112 -> 112 Drafts.
    - MTB 111 -> 111 Drafts.
    - BENCH 309 -> 111 Drafts.
    - STOCK 1344 -> 112 Drafts.
  - Checks bisher gruen: targeted ESLint, `npx tsc --noEmit --incremental
    false`, `npm run verify:legacy-result-import`,
    `npm run verify:tenant-scope`.
  - Weitere Checks gruen:
    `git diff --check -- lib/legacy-result-import.ts app/api/admin/result-staging/legacy-results/import/route.ts app/admin/ergebnisse/page.tsx scripts/verify-legacy-result-import.ts scripts/verify-tenant-scope.ts package.json docs/cr/2026-07-21-legacy-result-import-v2.md SESSION_HANDOFF.md`,
    `npm run build`.
  - Production Deploy:
    - Deployment-ID: `dpl_DZ6Un29B7DCikWQ1CgedNdUon3kw`
    - Vercel-URL: `https://s5-evo-portal-1uytzwvso-sebastiankroeker-2781s-projects.vercel.app`
    - Alias: `https://portal.s5evo.de`
    - Ready-State: `READY`
  - Post-Deploy Smoke gruen: `npm run smoke:public`; `curl -sSI
    https://portal.s5evo.de/admin/ergebnisse` 200; unauthenticated V2
    dry-run API `POST /api/admin/result-staging/legacy-results/import` 401.
  - Keine DB-Mutation; V2-Endpunkt lehnt `dryRun:false` weiterhin ab.
  - Manueller Browsercheck offen: Admin -> Ergebnisdaten -> Pakete ->
    `Legacy-Ergebnis-CSV prüfen` mit RUN/ROAD/MTB/BENCH/STOCK-Dateien.

- Deployed Ergebnisdaten-Overlay-Fix 2026-07-21 20:16 UTC:
  - CR `docs/cr/2026-07-21-legacy-result-import-v2.md` per Addendum
    `Manual Correction Overlays` erweitert.
  - Anlass: Sebastian fragte nach dem naechsten Schritt "manuelle Korrekturen
    als Overlay" und gab per `go` die Umsetzung frei.
  - Lokale Aenderung:
    - Neue Route
      `app/api/admin/result-staging/batches/[batchId]/corrections/route.ts`
      fuer Admin/Moderator-gesicherte Overlay-Korrekturen.
    - Korrekturen werden in bestehende `AuditEvent` geschrieben:
      `RESULT_STAGING_CORRECTION_APPLIED` und
      `RESULT_STAGING_CORRECTION_REVERTED`, Scope
      `result-staging-batch`.
    - Keine neue Tabelle, keine Schema-Migration.
    - `app/api/admin/result-staging/batches/[batchId]/route.ts` liest
      Correction/Revert-Events und liefert `corrections` plus effektive
      Anzeige-Werte fuer korrigierte Felder.
    - `app/admin/ergebnisse/page.tsx` hat im Paketdetail neuen Tab
      `Korrekturen`; Draft-/Raw-Zeilen koennen Startnummer, Zeit/Wert und
      Status als Overlay korrigieren; aktive Korrekturen koennen
      zurueckgenommen werden.
    - `scripts/verify-tenant-scope.ts` umfasst die neue Admin-Route.
  - Scope/Limit bewusst eng:
    - Draft-Felder: `startNumber`, `rawValueText`, `resultStatus`.
    - Raw-Felder: `startNumber`, `rawValueText`, `validationStatus`.
    - Keine Re-Ranking-/Scoring-Neuberechnung, kein Parser V2, keine
      Publikation, keine offiziellen Ergebnis-Mutationen, Raw bleibt
      unveraendert.
  - Checks gruen: targeted ESLint, `npx tsc --noEmit --incremental false`,
    `npm run verify:tenant-scope`,
    `git diff --check -- app/admin/ergebnisse/page.tsx app/api/admin/result-staging/batches/[batchId]/route.ts app/api/admin/result-staging/batches/[batchId]/corrections/route.ts scripts/verify-tenant-scope.ts docs/cr/2026-07-21-legacy-result-import-v2.md SESSION_HANDOFF.md`,
    `npm run build`.
  - Production Deploy:
    - Deployment-ID: `dpl_DQGgyXVUf3b6LQxmVVTtMRh3D935`
    - Vercel-URL: `https://s5-evo-portal-65ptkv2vb-sebastiankroeker-2781s-projects.vercel.app`
    - Alias: `https://portal.s5evo.de`
    - Ready-State: `READY`
  - Post-Deploy Smoke gruen: `npm run smoke:public`; `curl -sSI
    https://portal.s5evo.de/admin/ergebnisse` 200; unauthenticated
    Batch-Detail API 401; unauthenticated Correction API `POST` 401.
  - Keine Raw-/Draft-/offiziellen Ergebnis-Mutationen durch Deploy.
  - Manualer Browsercheck offen: Admin -> Ergebnisdaten -> Paketdetails ->
    Drafts/Raw Records -> Korrektur speichern und im Tab `Korrekturen`
    zuruecknehmen.

- Deployed Ergebnisdaten-UI-Fix 2026-07-21 19:50 UTC:
  - CR `docs/cr/2026-07-21-legacy-result-import-v2.md` per Addendum
    `Package Workbench Clarity` erweitert.
  - Anlass: Sebastian bestaetigte, dass Paketdetails/Raw Records live
    funktionieren, fragte danach nach Ideen fuer eine uebersichtlichere und
    intuitivere Paketansicht, und gab per `go` die Umsetzung frei.
  - Lokale Aenderung in `app/admin/ergebnisse/page.tsx`:
    - Paketliste zeigt kompakte Filter-KPIs: Pakete, Raw/Drafts, Warnsignale,
      offene Pakete.
    - Paketzeilen zeigen jetzt abgeleitete Disziplin und Warnsignal-Badge.
    - Paketdetails haben Tabs `Uebersicht`, `Drafts`, `Raw Records`,
      `Konflikte`.
    - Uebersicht zeigt Quelle/Zweck, Status, Raw/Drafts, Warnsignale,
      Referenz/Zeitpunkt und read-only Next Step.
    - Konflikte-Tab kombiniert Draft- und Raw-Record-Hinweise aus den bereits
      geladenen Details.
  - Keine API-Aenderung, keine Parser-V2-Implementierung, keine manuelle
    Edit-Persistenz, keine Schema-Migration, keine offiziellen
    Ergebnis-Mutationen.
  - Checks gruen: `npx eslint app/admin/ergebnisse/page.tsx`,
    `npx tsc --noEmit --incremental false`,
    `git diff --check -- app/admin/ergebnisse/page.tsx docs/cr/2026-07-21-legacy-result-import-v2.md SESSION_HANDOFF.md`,
    `npm run build`.
  - Production Deploy:
    - Deployment-ID: `dpl_GM8rqv8eyhKSMex9W1DrFPqChZtG`
    - Vercel-URL: `https://s5-evo-portal-fhwdtolom-sebastiankroeker-2781s-projects.vercel.app`
    - Alias: `https://portal.s5evo.de`
    - Ready-State: `READY`
  - Post-Deploy Smoke gruen: `npm run smoke:public`; `curl -sSI
    https://portal.s5evo.de` 200; `curl -sSI
    https://portal.s5evo.de/admin/ergebnisse` 200; unauthenticated
    `/api/admin/result-staging/batches/invalid-batch-id?competitionId=cmn3a1piz0002l104372yx9yt` 401.
  - Keine DB-Mutation, keine offiziellen Ergebnisse geaendert.
  - Noch offen: manueller Admin-Browsercheck `Admin -> Ergebnisdaten ->
    Pakete`, neue Paket-KPIs und Detail-Tabs `Uebersicht`/`Konflikte`.

- Deployed Ergebnisdaten-Fix 2026-07-21 19:03 UTC:
  - Neuer CR: `docs/cr/2026-07-21-legacy-result-import-v2.md`.
  - Anlass: Sebastian will beim Legacy-Ergebnisimport Datenpakete manuell
    pruefen/wechseln koennen; die Record-Liste war in der Ergebnisdaten-UI zu
    versteckt und zeigte nur Drafts.
  - Fachlicher Import-Kontext fuer V2:
    - Legacy-Disziplin-Codes: Lauf `1`, Stock `2`, Rad `3`, Bank `4`, MTB `5`.
    - Lauf/Rad/MTB: 1 Raw-Zeile -> 1 Draft.
    - Bank: Versuch-Zeilen gruppieren; `AuBruttoGewicht` = gestemmtes Gewicht,
      `AuGewicht` = gestemmtes Gewicht minus Koerpergewicht; Schueler 2
      Versuche, Jugend/Damen/Herren 3.
    - Stock: 11 Schub-Zeilen + Summary `AuSummenkennzeichen = S`; Summe der
      10 besten, Streicher/BWZ aus Summary.
  - Lokale Aenderung:
    - `app/api/admin/result-staging/batches/[batchId]/route.ts` liefert jetzt
      read-only `rawRecords` neben bestehenden `drafts`.
    - `app/admin/ergebnisse/page.tsx` hat im Paketdetail Umschalter
      `Drafts`/`Raw Records`.
    - Paketliste-Aktion heisst `Records ansehen` und oeffnet die
      Detailansicht mit Raw Records.
    - Legacy-Laufen-Import springt weiter in die Paketdetails mit Drafts fuer
      Ergebnisvorschau.
    - Raw-Tabelle zeigt Zeile, Startnummer, Disziplin, Klasse, Zeit/Wert,
      Versuch/Schub, Bank-Brutto/Netto, Stock-Felder, Punkte/Rang, Status,
      Hinweise und Row-Key.
  - Keine Parser-V2-Implementierung, keine manuelle Edit-Persistenz, keine
    offiziellen Ergebnis-Mutationen, keine Schema-Migration.
  - Checks gruen: `npx eslint app/admin/ergebnisse/page.tsx app/api/admin/result-staging/batches/[batchId]/route.ts`,
    `npx tsc --noEmit --incremental false`, `git diff --check`, `npm run build`.
  - Production Deploy:
    - Deployment-ID: `dpl_FH6HHUyrBWRB7u1m18Ln5i2kZo3G`
    - Vercel-URL: `https://s5-evo-portal-80rgmfjk3-sebastiankroeker-2781s-projects.vercel.app`
    - Alias: `https://portal.s5evo.de`
    - Ready-State: `READY`
  - Post-Deploy Smoke gruen: `npm run smoke:public`; `curl -sSI
    https://portal.s5evo.de` 200; `curl -sSI
    https://portal.s5evo.de/admin/ergebnisse` 200; unauthenticated
    `/api/admin/result-staging/batches/invalid-batch-id?competitionId=cmn3a1piz0002l104372yx9yt` 401.
  - Noch offen: manueller Admin-Browsercheck `Admin -> Ergebnisdaten ->
    Pakete -> Records ansehen`, Tabs `Raw Records` und `Drafts`.
  - Naechste sinnvolle Schritte: manuelle Korrektur-Overlay-Persistenz
    konzipieren/umsetzen; danach Legacy Parser V2 fuer ROAD/MTB/BENCH/STOCK.

- Deployed Zeitnahme-Fix 2026-07-21 18:08 UTC:
  - CR `docs/cr/2026-07-21-road-timekeeping-monitor.md` wurde per Addendum
    `ROAD Two Visible Clock Slots` erweitert.
  - Anlass: Sebastian meldete, dass bei `Rad` nach drei konfigurierten
    Startbloecken auch drei Uhr-Kacheln angezeigt werden; zwei genuegen.
  - Lokale Aenderung in `app/zeitnahme/page.tsx`:
    - ROAD behaelt beliebig konfigurierte Startbloecke fuer Customizing und
      Auswahl.
    - Sichtbar sind maximal zwei ROAD-Uhrslots.
    - Auswahl eines Startblock-Buttons in einer Uhr-Konfiguration ersetzt den
      jeweiligen Uhrslot, statt eine weitere Uhr-Kachel anzuzeigen.
    - Zieleinlauf-Routing per Startnummer sucht bei ROAD nur in den sichtbaren
      Uhrslots; versteckte konfigurierte Bloecke bleiben reine Auswahloption.
  - Checks gruen: `npx eslint app/zeitnahme/page.tsx app/zeitnahme/monitor/page.tsx app/api/timekeeping/snapshot/route.ts`,
    `npx tsc --noEmit --incremental false`, `git diff --check`,
    `npm run build`.
  - Production Deploy:
    - Deployment-ID: `dpl_AbfseswHwun99qcAgcB2bJ7Mh7vN`
    - Vercel-URL: `https://s5-evo-portal-5q3i6rsdn-sebastiankroeker-2781s-projects.vercel.app`
    - Alias: `https://portal.s5evo.de`
    - Ready-State: `READY`
  - Post-Deploy Smoke gruen: `npm run smoke:public`; `curl -sSI
    https://portal.s5evo.de` 200; `curl -sSI
    https://portal.s5evo.de/zeitnahme` 200; `curl -sSI
    https://portal.s5evo.de/zeitnahme/monitor` 200; unauthenticated
    `/api/timekeeping/snapshot?competitionId=cmn3a1piz0002l104372yx9yt&startNumberSource=imported-test` 401.
  - Noch offen: Browser-Smoke mit echter Zeitnehmer-Session.

- Deployed Zeitnahme-UI-Fix 2026-07-21 17:47 UTC:
  - Anlass: Sebastian meldete, dass die definierten Startbloecke in der
    Uhr-Konfiguration wieder als Buttons dargestellt werden sollen, wie die
    Klassenauswahl; das Dropdown war nicht die urspruengliche Loesung.
  - Lokale Aenderung in `app/zeitnahme/page.tsx`:
    - Der `Startblock`-Selector in der Uhr-Konfiguration ist wieder eine
      umbruchfaehige Button-Leiste.
    - Aktiver Startblock nutzt `default`, andere Startbloecke `outline`.
    - `Block hinzufügen` bleibt im selben Konfigurationsbereich.
    - Bestehende Blockfelder bleiben unveraendert: Name, Klassen, erste
      Startnummer, Abstand, Basiszeit, Startnummernquelle und Entfernen.
  - Checks gruen: `npx eslint app/zeitnahme/page.tsx`,
    `npx tsc --noEmit --incremental false`,
    `git diff --check -- app/zeitnahme/page.tsx docs/cr/2026-07-21-road-timekeeping-monitor.md SESSION_HANDOFF.md`,
    `npm run build`.
  - Pre-Deploy Checks gruen: `npx eslint app/zeitnahme/page.tsx app/zeitnahme/monitor/page.tsx app/api/timekeeping/snapshot/route.ts`,
    `npx tsc --noEmit --incremental false`, `git diff --check`,
    `npm run build`.
  - Production Deploy:
    - Deployment-ID: `dpl_98WCC7p2SYDYX6h3iUi6HxsDRWkw`
    - Vercel-URL: `https://s5-evo-portal-m8zungrp5-sebastiankroeker-2781s-projects.vercel.app`
    - Alias: `https://portal.s5evo.de`
    - Ready-State: `READY`
  - Post-Deploy Smoke gruen: `npm run smoke:public`; `curl -sSI
    https://portal.s5evo.de` 200; `curl -sSI
    https://portal.s5evo.de/zeitnahme` 200; `curl -sSI
    https://portal.s5evo.de/zeitnahme/monitor` 200; unauthenticated
    `/api/timekeeping/snapshot?competitionId=cmn3a1piz0002l104372yx9yt&startNumberSource=imported-test` 401.
  - Noch offen: Browser-Smoke mit echter Zeitnehmer-Session.

- Deployed Zeitnahme-Regressionsfix 2026-07-21 17:23 UTC:
  - CR `docs/cr/2026-07-21-road-timekeeping-monitor.md` wurde per Addendum
    `Clock Config Start Block Selector` erweitert.
  - Anlass: Sebastian meldete, dass in der Uhr-Konfiguration die fruehere
    Moeglichkeit fehlt, Startbloecke zu definieren und auszuwaehlen.
  - Lokale Aenderung in `app/zeitnahme/page.tsx`:
    - Die Uhr-Konfiguration zeigt wieder einen `Startblock`-Selector.
    - `Block hinzufügen` sitzt wieder direkt in der Uhr-Konfiguration.
    - Auswahl eines vorhandenen Blocks fokussiert und oeffnet dessen
      Konfiguration.
    - Bestehende Blockfelder bleiben unveraendert: Name, Klassen, erste
      Startnummer, Abstand, Basiszeit, Startnummernquelle und Entfernen.
  - Checks gruen: `npx eslint app/zeitnahme/page.tsx`,
    `npx tsc --noEmit --incremental false`,
    `git diff --check -- app/zeitnahme/page.tsx`, `npm run build`.
  - Pre-Deploy Checks gruen: `npx eslint app/zeitnahme/page.tsx app/zeitnahme/monitor/page.tsx app/api/timekeeping/snapshot/route.ts`,
    `npx tsc --noEmit --incremental false`, `git diff --check`,
    `npm run build`.
  - Production Deploy:
    - Deployment-ID: `dpl_ATRyPFps8QMZt3gxPen8ZPFcYLLh`
    - Vercel-URL: `https://s5-evo-portal-l5whajbam-sebastiankroeker-2781s-projects.vercel.app`
    - Alias: `https://portal.s5evo.de`
    - Ready-State: `READY`
  - Post-Deploy Smoke gruen: `npm run smoke:public`; `curl -sSI
    https://portal.s5evo.de` 200; `curl -sSI
    https://portal.s5evo.de/zeitnahme` 200; `curl -sSI
    https://portal.s5evo.de/zeitnahme/monitor` 200; unauthenticated
    `/api/timekeeping/snapshot?...&startNumberSource=imported-test` 401.
  - Noch offen: Browser-Smoke mit echter Zeitnehmer-Session.
- Aktueller Production-Stand 2026-07-21 17:10 UTC:
  - CR `docs/cr/2026-07-21-road-timekeeping-monitor.md` wurde per Addendum
    `Combined ROAD Finish List` erweitert.
  - Anlass: Sebastian meldete, dass die Liste der gestoppten Zeiten nur die
    Uhr zeigte, fuer die zuletzt ein Teilnehmer erfasst wurde.
  - Diagnose: ROAD-Zieleinlauf routete korrekt in die per Startnummer
    abgeleitete Startblock-Session und setzte diese danach aktiv. Die
    Zeitenliste las aber weiterhin nur `activeSession.events`.
  - Lokale Aenderung in `app/zeitnahme/page.tsx`:
    - Zeitenliste kombiniert nun Finish-Events aus allen sichtbaren Sessions
      der gewaehlten Disziplin; bei ROAD also aus allen sichtbaren
      ROAD-Uhr-Kacheln inkl. Custom-Blocks.
    - Reihenfolge, Suche, Filter, Sortierung und Duplicate-Warnung laufen auf
      der kombinierten sichtbaren Liste.
    - ROAD-Zeilen zeigen den Startblock unter der Klasse.
    - Nachtraegliche Startnummern-Zuordnung aus der Tabelle aktualisiert die
      Quell-Session der Zeile, nicht blind die aktive Uhr.
  - Checks gruen: `npx eslint app/zeitnahme/page.tsx`,
    `npx tsc --noEmit --incremental false`,
    `git diff --check -- app/zeitnahme/page.tsx docs/cr/2026-07-21-road-timekeeping-monitor.md SESSION_HANDOFF.md`,
    `npm run build`.
  - Pre-Deploy Checks gruen: `npx eslint app/zeitnahme/page.tsx app/zeitnahme/monitor/page.tsx app/api/timekeeping/snapshot/route.ts`,
    `npx tsc --noEmit --incremental false`, `git diff --check`.
  - Production Deploy URL:
    `https://s5-evo-portal-1ka8bg23j-sebastiankroeker-2781s-projects.vercel.app`.
  - Inspect URL:
    `https://vercel.com/sebastiankroeker-2781s-projects/s5-evo-portal/GRhuiJcF3MTWHpUrC3gcTQht5SCR`.
  - Alias: `https://portal.s5evo.de`.
  - Post-Deploy Smoke gruen: `npm run smoke:public`; `curl -sSI
    https://portal.s5evo.de` 200; `curl -sSI
    https://portal.s5evo.de/zeitnahme` 200; `curl -sSI
    https://portal.s5evo.de/zeitnahme/monitor` 200; unauthenticated
    `/api/timekeeping/snapshot?...&startNumberSource=imported-test` 401.
  - Noch offen: Browser-Smoke mit echter Zeitnehmer-Session.
- Lokaler, noch nicht deployter Zeitnahme-Zusatzfix 2026-07-21 16:59 UTC:
  - CR `docs/cr/2026-07-21-road-timekeeping-monitor.md` wurde per Addendum
    `Clock Card Finish Stats And Negative ROAD Net Times` erweitert.
  - Anlass: Sebastian meldete im Screenshot ROAD-Zeiten mit `0:00.00` und
    wuenschte in den Uhr-Kacheln oben links die Disziplin zuerst sowie oben
    rechts die Anzahl der Teilnehmer im Ziel.
  - Diagnose: ROAD-Nettozeit kann in Tests negativ werden, wenn vor der
    geplanten Einzelstartzeit einer Startnummer erfasst wird
    (`Blockzeit - Startnummern-Offset`). Die Anzeige clampte negative Werte
    bisher auf `0:00.00`.
  - Lokale Aenderung in `app/zeitnahme/page.tsx`:
    - `formatDuration` erhaelt negative Werte, statt sie auf 0 zu clampen.
    - Negative Nettozeiten werden in der Zeitentabelle mit der bestehenden
      Warnmarkierung und Tooltip sichtbar.
    - Uhr-Kachel links zeigt jetzt `Disziplin · Startblock`.
    - Uhr-Kachel-Stats zeigen jetzt `x/y im Ziel` plus ROAD-Details.
  - Checks gruen: `npx eslint app/zeitnahme/page.tsx`,
    `npx tsc --noEmit --incremental false`,
    `git diff --check -- app/zeitnahme/page.tsx`, `npm run build`.
  - Noch offen: Production-Deploy nach Sebastian-Go und Browser-Smoke mit
    echter Zeitnehmer-Session.
- Lokaler, noch nicht deployter Zeitnahme-Regressionsfix 2026-07-21 16:45 UTC:
  - CR `docs/cr/2026-07-21-road-timekeeping-monitor.md` wurde per Addendum
    `Restore Start Block Customizing` erweitert.
  - Anlass: Sebastian meldete nach dem ROAD-Dual-Clock-Deploy, dass das
    Startblock-Customizing verloren ging. Die Defaults waren korrekt, aber
    Hinzufuegen, Loeschen, Umbenennen und Klassen-Zuordnung von Startbloecken
    fehlten bzw. waren zu stark beschnitten.
  - Lokale Aenderung in `app/zeitnahme/page.tsx`:
    - `Block hinzufügen` ist wieder sichtbar.
    - ROAD zeigt alle konfigurierten ROAD-Startbloecke statt hart nur die
      ersten zwei. Default bleibt `Schueler` + `Herren`.
    - Pro Kachel bleiben Blockname, Klassen, erste Startnummer, Abstand,
      lokale Basiszeit und Entfernen konfigurierbar.
  - Checks gruen: `npx eslint app/zeitnahme/page.tsx`,
    `npx tsc --noEmit --incremental false`,
    `git diff --check -- app/zeitnahme/page.tsx`.
  - Noch offen: Production-Deploy nach Sebastian-Go und Browser-Smoke mit
    echter Zeitnehmer-Session.
- Aktueller Production-Stand 2026-07-21 16:33 UTC:
  - CR `docs/cr/2026-07-21-road-timekeeping-monitor.md` wurde per Addendum
    erweitert und ist live.
  - Anlass: Sebastian braucht bei ROAD zwei gleichzeitig laufende Startbloecke
    und stellte klar, dass der Zielblock beim gemeinsamen Zieleinlauf-Feld
    automatisch aus der eingegebenen Startnummer abgeleitet werden soll.
  - Lokale Aenderung in `app/zeitnahme/page.tsx`:
    - Disziplin-Auswahl sitzt in der `Zeitnahme`-Kopfzeile.
    - Bei `Rad` werden zwei Uhr-Kacheln angezeigt, initial `Schueler` und
      `Herren`.
    - Uhr-Kachel zeigt Startblock + enthaltene Klassen und enthaelt die
      Blockkonfiguration inklusive Klassen, erster Startnummer, Abstand und
      lokaler Basiszeit.
    - Stop kann mit Start fortgesetzt werden; die Uhr behält die bisher
      verstrichene Zeit.
    - Gemeinsame Zieleinlauf-Erfassung bleibt, routet ROAD-Finish-Events aber
      anhand der eingegebenen Startnummer/Klasse in den passenden Startblock.
      Ohne Startnummer oder Treffer bleibt der aktive Block Fallback, damit
      bestehende Nachzuordnungs-/Ad-hoc-Erfassung erhalten bleibt.
    - Eingabefeld ist nutzbar, sobald irgendeine Uhr der gewaehlten Disziplin
      laeuft; der Button erfordert, dass der abgeleitete/Fallback-Zielblock
      laeuft.
  - Checks gruen: `npx eslint app/zeitnahme/page.tsx`,
    `npx tsc --noEmit --incremental false`,
    `git diff --check -- app/zeitnahme/page.tsx`.
  - Pre-Deploy Checks gruen: targeted ESLint fuer
    `app/zeitnahme/page.tsx`, `app/zeitnahme/monitor/page.tsx`,
    `app/api/timekeeping/snapshot/route.ts`; `npx tsc --noEmit --incremental
    false`; `git diff --check`; `npm run build`.
  - Production Deploy: `dpl_8AS3Lt3eZL5qSi2cYgc1BVN16Twz`.
  - Deployment URL:
    `https://s5-evo-portal-7og5cbazd-sebastiankroeker-2781s-projects.vercel.app`.
  - Alias: `https://portal.s5evo.de`.
  - Post-Deploy Smoke gruen: `npm run smoke:public`; `curl -sSI
    https://portal.s5evo.de` 200; `curl -sSI
    https://portal.s5evo.de/zeitnahme` 200; `curl -sSI
    https://portal.s5evo.de/zeitnahme/monitor` 200; unauthenticated
    `/api/timekeeping/snapshot?...&startNumberSource=imported-test` 401.
  - Noch offen: Browser-Smoke mit echter Zeitnehmer-Session.
- Aktueller Production-Stand 2026-07-21 14:53 UTC:
  - CR `docs/cr/2026-07-21-participant-change-deadline-and-class-impact.md`
    ist umgesetzt und live.
  - Anlass: Sebastian meldete zwei offene Nachnamen-Aenderungsantraege und
    eine irrefuehrende `Klassenwirkung` bei reiner Namensaenderung. Er fragte
    auch, ob die Regel "bis Anmeldeschluss nicht genehmigungspflichtig" noch
    vorhanden ist.
  - Read-only DB-Check aktive 2026 Competition `cmn3a1piz0002l104372yx9yt`:
    `registrationDeadline = 2026-07-22T00:00:00.000Z`.
  - Read-only DB-Check offene Requests: 2 Pending-Participant-Updates, beide
    reine Nachnamenkorrektur `Hurzler -> Hutzler`, aber fuer zwei
    unterschiedliche Teilnehmer: Peter und Ferdinand.
  - Ursache/Fix lokal:
    - `app/api/teams/[id]/route.ts` hatte die Deadline-Direktregel bereits.
    - `app/api/participants/[id]/route.ts` hatte sie nicht; nicht-Admin
      Einzelteilnehmer-Aenderungen liefen deshalb trotz offenem
      Anmeldeschluss in den Approval-Flow. Der Endpoint nutzt jetzt
      `isRegistrationDeadlineOpen(...)` fuer Direkt-Speicherung, sofern die
      bestehende Edit-Berechtigung greift. Disziplin bleibt im
      Participant-Endpoint fuer Nicht-Admins gesperrt und gehoert in den
      Team-Kontext.
    - `GET /api/admin/pending-changes` trennt jetzt echten Klassenwechsel von
      allgemeinen Klassifikationswarnungen. Name-only erzeugt keine
      Klassenwirkung mehr.
    - `app/components/approval-queue.tsx` zeigt `Klassenwirkung` nur bei
      echtem Klassenwechsel und dann `Klasse vorher -> Klasse neu`.
  - Checks gruen: targeted ESLint fuer die drei betroffenen Dateien,
    `npx tsc --noEmit --incremental false`, `npm run verify:participant-edit-flow`,
    `git diff --check`, `npm run build`.
  - Production Deploy: `dpl_GgrAPLpBcPuVUGuQXnsye7m7mZDg`.
  - Deployment URL:
    `https://s5-evo-portal-mcliaup63-sebastiankroeker-2781s-projects.vercel.app`.
  - Alias: `https://portal.s5evo.de`.
  - Post-Deploy Smoke gruen: `npm run smoke:public`; `curl -sSI
    https://portal.s5evo.de` 200; `curl -sSI
    https://portal.s5evo.de/aenderungen` 200; unauthenticated
    `/api/admin/pending-changes` 401; unauthenticated `PUT /api/participants/...`
    401.
  - Keine Produktionsdatenmutation. Authentifizierter Rollen-/Browser-Smoke
    bleibt manuell offen.
  - Bereinigung der beiden bestehenden Pending-Requests `Hurzler -> Hutzler`
    ist nicht erfolgt und braucht bei Bedarf separates Sebastian-Gate.
- Aktueller Datenfix 2026-07-21:
  - CR `docs/cr/2026-07-21-running-testdata-class-fix.md` ist angewendet.
  - Anlass: Sebastian meldete inkonsistente hochgeladene Lauf-Testdaten und
    vermutete falsche Klassen-Zuordnung.
  - Read-only Diagnose aktive 2026 Competition `cmn3a1piz0002l104372yx9yt`:
    74 RUN-Testdrafts im Batch `cmruq55xj0005jr04nnvizbcx`; Portal-Teamklassen
    waren intern konsistent, aber 28/74 RUN-Drafts hatten eine Legacy-Klasse,
    die nicht zur aktuellen Portal-Teamklasse passte.
  - Nach Sebastian-"go" wurden nur die `PROD_TEST`/`STAGED` RUN-Drafts dieses
    Batches korrigiert: `proposedResultSnapshot.classScoring.classCode`,
    Label, Rang und Punkte folgen jetzt der aktuellen `Team.classificationCode`
    und wurden je Klasse aus den RUN-Zeiten neu berechnet.
  - Offizielle `DisciplineResult`, Teams, Teilnehmer, Startnummern und Code
    wurden nicht geaendert; kein Deploy.
  - Batch-Summary hat einen `portalClassCorrection` Marker.
  - Post-Fix DB-Check: 74 Drafts, 0 Snapshot-vs-Team-Mismatches, 0
    Team-vs-Neuberechnung-Mismatches.
  - Manueller Browsercheck offen: `Live -> Ergebnis -> Staging-Testdaten ->
    Laufen`.
- Aktueller Production-Stand 2026-07-21 10:57 UTC:
  - Hotfix/Erweiterung fuer `docs/cr/2026-07-21-road-timekeeping-monitor.md`
    ist live.
  - Anlass: Sebastian meldete, dass in der Beamer-Anzeige keine Startnummer-,
    Name- und Teamdaten erscheinen, und wollte die importierten/teamzugeordneten
    Test-Startnummern statt 9000er-Synthetik nutzen.
  - Vermutete Ursache: `/zeitnahme/monitor` bevorzugte den aktiven
    Competition-Kontext des neuen Fensters gegenueber der `competitionId` aus
    dem Monitor-Link. Wenn das divergiert, wird der falsche lokale
    Zeitnahme-Storage gelesen.
  - Fix: Monitor nutzt jetzt URL-`competitionId` als Wahrheit und den aktiven
    Wettbewerb nur als Fallback.
  - Snapshot-Erweiterung: `/api/timekeeping/snapshot` akzeptiert
    `startNumberSource=imported-test` und laedt dann nicht geloeschte Teams mit
    importierter `Team.startNumber` ohne `approved=true` zu erzwingen.
    `official` bleibt streng: approved + Startnummer.
  - Zeitnahme-UI: Konfiguration hat jetzt `Startnummernquelle` mit genau zwei
    Optionen: `Offizielle Startnummern` und `Importierte Test-Startnummern`.
    9000er-Synthetik ist aus der UI entfernt.
  - Datencheck aktive 2026 Competition: `officialTeams=0`,
    `importedTestTeams=74`, `roadFromImportedTest=74`.
  - Checks gruen: targeted ESLint, `npx tsc --noEmit --incremental false`,
    `git diff --check`, `npm run build`.
  - Production Deploy: `dpl_736bWE2MDXie2gqgYN8iBps5Vyaw`.
  - Deployment URL:
    `https://s5-evo-portal-it0s268wu-sebastiankroeker-2781s-projects.vercel.app`.
  - Alias: `https://portal.s5evo.de`.
  - Post-Deploy Smoke gruen: `npm run smoke:public`; `curl -sSI
    https://portal.s5evo.de` 200; `curl -sSI
    https://portal.s5evo.de/zeitnahme/monitor` 200; unauthenticated
    `/api/timekeeping/snapshot?...&startNumberSource=imported-test` 401.
  - Authentifizierter Zeitnahme-Browser-Smoke bleibt manuell offen.
- Aktueller Production-Stand 2026-07-21 10:10 UTC:
  - CR `docs/cr/2026-07-21-road-timekeeping-monitor.md` ist umgesetzt und
    live.
  - Inhalt: ROAD-Beamer-/Monitoransicht `/zeitnahme/monitor` fuer dasselbe
    Geraet/denselben Browser wie die Zeitnahme.
  - Geaendert:
    `lib/timekeeping-local.ts`, `app/zeitnahme/page.tsx`,
    `app/zeitnahme/monitor/page.tsx`.
  - Zeitnahme schreibt weiter die bestehende lokale
    `s5evo-timekeeping-v1:{competitionId}`-Session und broadcastet zusaetzlich
    Updates via `s5evo-timekeeping-local-v1`.
  - Monitor kombiniert alle lokalen ROAD-Startblock-Sessions, zeigt Rang nach
    Nettozeit je Klasse, Startnummer, Teilnehmername, Mannschaft, Klasse, Zeit
    und lokal/sync-Status.
  - Klassenfilter ist als Mehrfachauswahl vorhanden; `Herren Gesamt` und
    `Damen Gesamt` werden defensiv aus der Beamer-Auswahl entfernt. Bei zu
    wenig Platz auto-paging alle 8 Sekunden.
  - Keine neue API, keine DB-Mutation, keine offizielle Ergebnis-Publikation,
    keine Service-Worker-API-Caching-Aenderung.
  - Checks gruen: targeted ESLint fuer Zeitnahme/Monitor/Helper,
    `npx tsc --noEmit --incremental false`, `git diff --check`,
    `npm run build`.
  - Production Deploy: `dpl_EAQdgjRXSHoiMRAQpZg8v3xsV1ZS`.
  - Deployment URL:
    `https://s5-evo-portal-abm7mw4qc-sebastiankroeker-2781s-projects.vercel.app`.
  - Alias: `https://portal.s5evo.de`.
  - Post-Deploy Smoke gruen: `npm run smoke:public`; `curl -sSI
    https://portal.s5evo.de` 200; `curl -sSI
    https://portal.s5evo.de/zeitnahme/monitor` 200; unauthenticated
    `/api/timekeeping/snapshot?...` 401.
  - Authentifizierter Rollen-/Browser-Smoke mit echter lokaler Zeitnahme-Session
    bleibt manuell offen.
- Aktueller Production-Stand 2026-07-20 16:53 UTC:
  - Live-Ergebnis-Testmodus fuer gestagte Ergebnis-Drafts ist umgesetzt und
    live.
  - Anlass: Sebastian hat das Paket `Legacy Laufen CSV 2026-07-20` erfolgreich
    gestaged und wollte die Ergebnisanzeige mit Einzelergebnislisten pruefen,
    ohne Testdaten oeffentlich sichtbar zu machen oder offizielle Ergebnisse zu
    mutieren.
  - Geaendert:
    `app/api/results/route.ts`, `app/components/results-view.tsx`,
    `lib/domain/scoring.ts`.
  - `/api/results` akzeptiert jetzt fuer Admins
    `includeStagingTest=true`.
    - Ohne ADMIN-Session liefert dieser Parameter 403.
    - Public/normaler Abruf bleibt ohne Staging-Drafts.
    - Startnummern bleiben weiterhin nur fuer ADMIN sichtbar.
  - Admin-Testmodus in `Live -> Ergebnis`:
    - Button `Staging-Testdaten` aktiviert die gestagten
      `ResultDraft`-Daten aus `ResultDataBatch.purpose in PROD_TEST/DRY_RUN`.
    - Gestagte Drafts ueberschreiben nur die jeweilige Disziplin in der Anzeige;
      offizielle `DisciplineResult` werden nicht geschrieben.
    - Legacy-Punkte/-Plaetze aus dem Draft-Snapshot werden fuer die Haupttabelle
      genutzt, also kein Recalc der Legacy-Laufwertung.
  - Einzeldisziplin-Detailansicht zeigt jetzt:
    `Platz | Start Nr | Name | Mannschaft | Klasse | Zeit`.
  - Sebastian bestaetigte: 74 Lauf-Drafts sind korrekt, weil die Testdaten auf
    die aktuell 74 Mannschaften reduziert wurden.
  - Reset bleibt ueber `/admin/ergebnisse` -> Tab `Pakete` ->
    `Testdaten loeschen`; das entfernt nur Staging-Pakete/Drafts mit
    `PROD_TEST`/`DRY_RUN`, keine offiziellen Ergebnisse.
  - Checks gruen: targeted ESLint,
    `npx tsc --noEmit --incremental false`, `npm run verify:tenant-scope`,
    `git diff --check`, `npm run build`.
  - Production Deploy: `dpl_L69nTBC1RRn1T2TREF4kJ9ambYki`.
  - Deployment URL:
    `https://s5-evo-portal-5o5exj6qt-sebastiankroeker-2781s-projects.vercel.app`.
  - Alias: `https://portal.s5evo.de`.
  - Post-Deploy Smoke gruen: `npm run smoke:public`; `curl -sSI
    https://portal.s5evo.de` 200; unauthenticated
    `/api/results?...&includeStagingTest=true` 403.
  - Keine Produktionsdaten-Mutation durch den Agenten.
  - Naechster sinnvoller Schritt:
    Browser-Test durch Sebastian:
    `Live -> Ergebnis -> Staging-Testdaten -> Klasse -> Laufen` pruefen.
    Danach entscheiden, ob Ergebnis-Preview fuer weitere Disziplinen analog
    gebaut wird oder zuerst der Publikations-/Review-Schritt fuer Drafts folgt.
- Vorheriger Production-Stand 2026-07-20 16:08 UTC:
  - Hotfix fuer Legacy-Laufen-CSV Staging live.
  - Produktionsfehler nach Sebastian-Test:
    `POST /api/admin/result-staging/legacy-running/import` scheiterte beim
    echten Staging mit Prisma `P2028` (`Transaction not found`) auf
    `ResultRawRecord`/`ResultDraft`.
  - Fix in `app/api/admin/result-staging/legacy-running/import/route.ts`:
    - Raw Records werden per `createMany` geschrieben.
    - Danach werden Raw-Record-IDs ueber `batchId + rowKey` geladen.
    - Drafts werden per `createMany` geschrieben.
    - Transaktion bekommt `timeout: 30_000`.
  - Matching/Parsing/Fachlogik unveraendert.
  - Checks gruen: `npm run verify:legacy-running-import`,
    `npm run verify:tenant-scope`, targeted ESLint,
    `npx tsc --noEmit --incremental false`, `git diff --check`, `npm run build`.
  - Production Deploy: `dpl_4E9u5BK8SeMzT1fFdKEa1B4FcMDi`.
  - Deployment URL:
    `https://s5-evo-portal-k8d79yx4a-sebastiankroeker-2781s-projects.vercel.app`.
  - Alias: `https://portal.s5evo.de`.
  - Post-Deploy Smoke gruen: `npm run smoke:public`; unauthenticated
    `POST /api/admin/result-staging/legacy-running/import` 401; Vercel logs
    der letzten 5 Minuten ohne neue `legacy-running` Fehler.
  - Keine Datenmutation durch den Agenten.
- Vorheriger Production-Stand 2026-07-20 15:48 UTC:
  - Startnummern-Anzeige fuer Admin-Live-/Dashboard-Workflow live.
  - Geaendert:
    `app/components/dashboard.tsx`, `app/components/live-screen.tsx`,
    `app/components/results-view.tsx`, `app/api/results/route.ts`,
    `lib/domain/scoring.ts`.
  - Mannschafts-Dashboard Kacheln: `#Startnummer` direkt rechts neben der
    Klassen-Pille.
  - Live -> Teams: `#Startnummer` vor dem Mannschaftsnamen.
  - Live -> Start: `#Startnummer` vor dem Teilnehmernamen.
  - Live -> Ergebnis: vorhandene `#`-Spalte zeigt `#Startnummer` statt
    Rang-Badge.
  - Datenschutz: `/api/results` gibt `startNumber` nur fuer ADMIN-Sessions aus;
    Public/normal bekommt `null`.
  - Checks gruen: targeted ESLint, `npx tsc --noEmit --incremental false`,
    `git diff --check`, `npm run build`.
  - Production Deploy: `dpl_AsWX98GBVFN7FzZL69o4bQjQvxRc`.
  - Deployment URL:
    `https://s5-evo-portal-o8bvwtky6-sebastiankroeker-2781s-projects.vercel.app`.
  - Alias: `https://portal.s5evo.de`.
  - Post-Deploy Smoke gruen: `npm run smoke:public`; gezielter Public
    `/api/results?competitionId=cmn3a1piz0002l104372yx9yt` Leak-Check ohne
    nicht-null `startNumber` gruen.
  - Keine Produktionsdaten-Mutation.
- Vorheriger Production-Stand 2026-07-20 15:28 UTC:
  - Hotfix fuer Startnummern-Import live.
  - Produktionsfehler nach Sebastian-Test: `POST /api/admin/start-numbers/import`
    lief im Dry-run, scheiterte beim echten Schreiben mit Prisma `P2028`
    (`Transaction not found`), weil die sequentiellen Team-Updates plus
    einzelne Audit-Events die Default-Transaktion ueberzogen.
  - Fix in `app/api/admin/start-numbers/import/route.ts`:
    - Team-Updates bleiben transaktional.
    - Audit-Events werden per `createMany` gebuendelt.
    - Prisma-Transaktion bekommt `timeout: 30_000`.
  - Keine Matching-/CSV-Format-Aenderung in diesem Hotfix.
  - Checks gruen: targeted ESLint, `npx tsc --noEmit --incremental false`,
    `git diff --check`, `npm run build`.
  - Production Deploy: `dpl_EaQRBWvEYD6QDhyxVJA5EGHHzWxs`.
  - Deployment URL:
    `https://s5-evo-portal-o9milppr1-sebastiankroeker-2781s-projects.vercel.app`.
  - Alias: `https://portal.s5evo.de`.
  - Post-Deploy Smoke gruen: `npm run smoke:public`; unauthenticated
    `POST /api/admin/start-numbers/import` 401; Vercel logs der letzten 5
    Minuten ohne neue `start-numbers` Fehler.
  - Keine Datenmutation durch den Agenten ausgefuehrt.
- Vorheriger Production-Stand 2026-07-20 15:02 UTC:
  - Legacy-Stammdaten-CSV Export enthaelt jetzt `team_id` als erste Spalte.
  - Startnummern-Import erkennt Headerzeilen hinter Beschreibungstext, d. h.
    die Portal-Datei mit Zeile 1-3 Beschreibung, Zeile 4 Header, Daten ab Zeile 5
    kann nach manueller Excel-Startnummernpflege direkt wieder importiert werden.
  - Import-Aliase fuer technische Team-ID erweitert:
    `team_id`, `teamid`, `team_uid`, `teamuid`, `portal_team_uid`,
    `mannschaft_id`.
  - Damit matched der Portal-Import fuehrend ueber `team_id` +
    `Startnummer`; Legacy-Matching ueber Mannschaftsname bleibt Fallback.
  - Checks gruen: Source-Assertion fuer `team_id` Export/Import, targeted ESLint,
    `npx tsc --noEmit --incremental false`, `npm run verify:admin-csv-export-scope`,
    `git diff --check`, `npm run build`.
  - Production Deploy: `dpl_84u2WYfhuoMs23dAxHvw8iKQa18e`.
  - Deployment URL:
    `https://s5-evo-portal-8pewuyp9v-sebastiankroeker-2781s-projects.vercel.app`.
  - Alias: `https://portal.s5evo.de`.
  - Post-Deploy Smoke gruen: `npm run smoke:public`; unauthenticated
    `POST /api/admin/teams-export` 401; unauthenticated
    `POST /api/admin/start-numbers/import` 401.
  - Keine Produktionsdaten-Mutation ausgefuehrt.
- Vorheriger Production-Stand 2026-07-20 14:56 UTC:
  - Legacy-Stammdaten-CSV Export fuer Access/ANSI nachgezogen und live.
  - Geaendert: `lib/team-csv-export.ts`.
  - Nur der fixe `legacy-stammdaten` Export wurde angepasst; normale/layout
    CSV-Exporte bleiben UTF-8/BOM.
  - Legacy-Stammdaten-Export:
    - keine UTF-8-BOM mehr.
    - Content-Type `text/csv; charset=windows-1252`.
    - Bytes werden als Latin-1/ANSI-kompatibel erzeugt.
    - Zeile 1-3 enthalten Beschreibung/Hinweise.
    - Zeile 4 enthaelt die Spaltenueberschriften.
    - Daten beginnen in Zeile 5.
    - ASCII-Apostroph `'` wird durch `´` ersetzt.
    - Zeichen ausserhalb ANSI/Latin-1 werden entfernt; dadurch verschwindet
      z. B. das Flammen-Emoji in `Cinque Flamme`.
  - Team-UID wurde bewusst noch nicht in diese Legacy-Datei aufgenommen, weil
    unklar ist, ob Access Zusatzspalten akzeptiert. Fachlich sinnvoll waere
    `team_id` fuer Portal-Roundtrip; erst aufnehmen, wenn das Legacy-Ziel
    Zusatzspalten toleriert oder ein separater technischer Export genutzt wird.
  - Checks gruen: Source-Assertion fuer Legacy-ANSI-Export, targeted ESLint,
    `npx tsc --noEmit --incremental false`, `npm run verify:admin-csv-export-scope`,
    `git diff --check`, `npm run build`.
  - Production Deploy: `dpl_ErAdB9fuEupPZw6oNu9V9oTM1fKu`.
  - Deployment URL:
    `https://s5-evo-portal-c5krij6kk-sebastiankroeker-2781s-projects.vercel.app`.
  - Alias: `https://portal.s5evo.de`.
  - Post-Deploy Smoke gruen: `npm run smoke:public`; `curl -sSI
    https://portal.s5evo.de` 200; unauthenticated
    `POST /api/admin/teams-export` mit `format:"legacy-stammdaten"` 401.
  - Keine Produktionsdaten-Mutation ausgefuehrt.
- Vorheriger Production-Stand 2026-07-20 14:36 UTC:
  - Produktionstest-Schutz fuer Startnummern/Ergebnis-Staging ist umgesetzt und
    live.
  - Normale `/api/teams` Antworten liefern `startNumber` nur noch fuer ADMIN;
    Teamchefs/Teilnehmer/normale angemeldete Nutzer sehen keine Startnummer.
  - Neue Admin-Route: `POST /api/admin/start-numbers/reset`.
    - Default ist Dry-run/Preview.
    - Ausfuehrung erfordert `dryRun:false` plus exakten Confirmation-Text.
    - Loescht nur `Team.startNumber` im aktiven Wettkampf, keine Teams oder
      Teilnehmer.
    - Audit-Action: `TEAM_START_NUMBERS_RESET`.
  - Mannschafts-Dashboard hat neben Legacy-Startnummern-Import einen Admin-only
    Reset-Button fuer Startnummern.
  - `/admin/ergebnisse`, Tab `Pakete`, hat jetzt einen Admin-only Button
    `Testdaten loeschen` fuer `ResultDataBatch.purpose in PROD_TEST/DRY_RUN`.
    Offizielle Ergebnisse werden nicht geloescht.
  - Guard erweitert: `npm run verify:tenant-scope` prueft jetzt auch
    `/api/admin/start-numbers/reset`.
  - Checks gruen: `npm run verify:tenant-scope`, targeted ESLint,
    `npx tsc --noEmit --incremental false`, `git diff --check`, `npm run build`.
  - Production Deploy: `dpl_7KoCreUVknNEPkKqVrdingfphVAK`.
  - Deployment URL:
    `https://s5-evo-portal-pojwbb4rm-sebastiankroeker-2781s-projects.vercel.app`.
  - Alias: `https://portal.s5evo.de`.
  - Post-Deploy Smoke gruen: `npm run smoke:public`; `curl -sSI
    https://portal.s5evo.de` 200; unauthenticated
    `POST /api/admin/start-numbers/reset` 401; unauthenticated
    `POST /api/admin/result-staging/reset/preview` 401.
  - Keine Produktionsdaten-Mutation ausgefuehrt.
- Vorheriger Production-Stand 2026-07-20 14:17 UTC:
  - Legacy-Lauf-Ergebnisimport ist umgesetzt und live.
  - CR: `docs/cr/2026-07-20-legacy-running-result-import.md`
    (wie andere `docs/*` durch `.git/info/exclude` nicht im normalen Git-Status sichtbar).
  - Neue Route: `POST /api/admin/result-staging/legacy-running/import`.
  - Neue UI: `/admin/ergebnisse`, Tab `Pakete`, Block
    `Legacy-Laufen-CSV importieren` mit Dateiauswahl, Dry-run und Confirm vor
    Staging.
  - Scope: Legacy-Laufen-CSV mit Header Zeile 6 parsen, Startnummer+RUN matchen,
    als `ResultDataBatch(source=LEGACY_IMPORT)` plus `ResultRawRecord` und
    `ResultDraft` stagen; keine Publikation in offizielle Ergebnisse.
  - Default-Sicherheit: `dryRun` ist standardmaessig aktiv; DB-Schreiben nur mit
    explizitem `dryRun:false`.
  - Fachliche Regeln: `AuZeit` ist relevante Laufzeit; `AuPunkte` und
    `AuPlatzKlasse` bleiben Legacy-Klassenwertung; Damen/Herren-Gesamtwertung
    nur fuer Klassen 4/5 bzw. 6/7/8; `88:88:88.00` wird als `manual_check`
    normalisiert, Legacy-Punkte/Raenge bleiben erhalten.
  - Matching: ausschliesslich `Team.startNumber` + Teilnehmer `disciplineCode=RUN`;
    `Au1TlID` bleibt nur Raw/Debug im Payload.
  - Checks gruen: `npm run verify:legacy-running-import`,
    `npm run verify:tenant-scope`, targeted ESLint,
    `npx tsc --noEmit --incremental false`, `git diff --check`, `npm run build`.
  - Echte Vorjahresdatei aggregiert geprueft: 111 Zeilen, 109 gueltige Zeiten,
    2 Sonderzeiten, DAMEN-Gesamtwertung 22, HERREN-Gesamtwertung 54.
  - Production Deploy: `dpl_6eSK6dAPBgnBgqcYrcGeTiZ7fYBH`.
  - Deployment URL:
    `https://s5-evo-portal-1jlbms3d2-sebastiankroeker-2781s-projects.vercel.app`.
  - Alias: `https://portal.s5evo.de`.
  - Post-Deploy Smoke gruen: `npm run smoke:public`; `curl -sSI
    https://portal.s5evo.de/admin/ergebnisse` 200; unauthenticated
    `POST /api/admin/result-staging/legacy-running/import` 401.
  - Keine Produktionsdaten-Mutation, kein UI-Upload.
  - Gap: authentifizierter API-Smoke und Browser-Encoding fuer echten Upload fehlen.
- Aktueller Production-Stand 2026-07-19 13:31 UTC:
  - Legacy Stammdaten CSV Workflow ist umgesetzt und live.
  - CR: `docs/cr/2026-07-19-legacy-stammdaten-csv.md`
    (lokal durch bestehende `.git/info/exclude`-Regel fuer `docs/*`
    nicht im Git-Status sichtbar).
  - Code-Commit: `440bacf Add legacy stammdaten csv workflow`.
  - Production Deploy: `dpl_qzKfXy8zMPENX3J8VcKPgq4Jx3LJ`.
  - Deployment URL:
    `https://s5-evo-portal-8w4gbqksl-sebastiankroeker-2781s-projects.vercel.app`.
  - Alias: `https://portal.s5evo.de`.
  - Scope: Mannschafts-Dashboard Legacy-Stammdaten-CSV Export plus
    Legacy-Startnummern-Import-Fallback.
  - Geaendert:
    `lib/team-csv-export.ts`,
    `app/api/admin/teams-export/route.ts`,
    `app/api/admin/start-numbers/import/route.ts`,
    `app/components/dashboard.tsx`.
  - Export: neuer fixer `legacy-stammdaten` Preset erzeugt exakt drei
    Leerzeilen, dann Header
    `Startnummer;Mannschaftsname;Klasse;Gesamtalter;...`, eine Zeile je
    Mannschaft, Teilnehmer nach RUN/BENCH/STOCK/ROAD/MTB, lesbare Klassenlabels,
    UTF-8 BOM.
  - Dashboard: zweiter CSV-Button fuer Legacy-Stammdaten mit aktueller
    gefilterter/sortierter Mannschaftsmenge fuer ADMIN/MODERATOR;
    zusaetzlicher Upload-Button nur fuer ADMIN fuer Legacy-Startnummern-Import
    mit Dry-Run, Bestaetigungsdialog, ersten Warnungsdetails und
    UTF-8/Windows-1252 Decode-Fallback; bestehender normaler/layout CSV bleibt
    unveraendert.
  - Import: vorhandener `/api/admin/start-numbers/import` bleibt ID-basiert
    fuehrend; wenn keine IDs gefunden werden, matched der Legacy-Fallback
    ueber normalisierten Mannschaftsnamen und bei Duplikaten ueber
    Teilnehmer-Signatur. Geschrieben wird weiterhin nur `Team.startNumber`.
    Unmatched/ambiguous rows kommen als Warnungen zurueck. Import-API ist
    ADMIN-only, Export-API bleibt ADMIN/MODERATOR.
  - Privacy: exportiert bewusst Teilnehmernamen/Geschlecht/Geburtsjahr fuer
    Admin/Moderator; keine Kontakt-/Owner-/Claim-/ID-Felder im Legacy-Export;
    keine CSV-Inhalte in Logs/Audit. Audit schreibt nur Startnummer vor/nach.
  - Checks gruen: targeted ESLint, `npx tsc --noEmit --incremental false`,
    inline `tsx` Legacy-CSV-Shape-Check, `git diff --check`, `npm run build`.
  - Post-Deploy Smoke gruen: `npm run smoke:public`; `curl -sSI
    https://portal.s5evo.de` 200; unauthenticated
    `POST /api/admin/teams-export` mit `format:"legacy-stammdaten"` 401;
    unauthenticated `POST /api/admin/start-numbers/import` mit Legacy-CSV
    Body 401.
  - Keine DB-Migration, keine Produktionsdaten-Mutation.
  - Gap: kein authentifizierter Browser/API-Smoke mangels Session-Cookies;
    Legacy-Encoding muss nach Deploy mit echter Legacy-Datei manuell validiert
    werden.
- Aktueller Production-Stand 2026-07-19 10:32 UTC:
  - Entity-ID Tenant Scope Guardrails sind umgesetzt und live.
  - CR: `docs/cr/2026-07-18-entity-id-tenant-scope-guardrails.md`.
  - Commit: `2afbbf8 Harden entity tenant scoped admin routes`.
  - Production Deploy: `dpl_Xgx3fzLQjFkRivwoyFnWbKbCB8nx`.
  - Deployment URL:
    `https://s5-evo-portal-ptynuwniy-sebastiankroeker-2781s-projects.vercel.app`.
  - Alias: `https://portal.s5evo.de`.
  - Gehaertet: Claim-Link POST/PATCH, Deleted-Team Restore,
    Participant-Change-Bundle Create/Detail/Decision.
  - Zusaetzlich nach Messenger-Inbox-Fund gehaertet:
    `/api/messages/admin-targets` und `/api/messages/admin-conversations`
    nutzen jetzt alle expliziten Admin-/Moderator-Tenants bzw. den Zielkontext,
    statt blind auf den ersten/default Tenant zu fallen.
  - Neue Helper in `lib/server-permissions.ts`:
    `requireAnyTenantRoles()`, `requireTeamTenantRoles()`,
    `requireParticipantTenantRoles()`, `requirePendingChangesTenantRoles()`,
    `requirePendingChangeBundleTenantRoles()`.
  - Guard erweitert: `npm run verify:tenant-scope` prueft jetzt die fuenf
    Entity-ID-Routen und die zwei Messenger-Orga-Routen.
  - Checks gruen: `npm run verify:tenant-scope`,
    `npm run verify:admin-competition-scope`,
    `npm run verify:admin-dashboard-scope`,
    `npm run verify:admin-csv-export-scope`, targeted ESLint,
    `npx tsc --noEmit --incremental false`, `git diff --check`,
    `npm run build`.
  - Post-Deploy Smoke gruen: `npm run smoke:public`; `/nachrichten` 200;
    unauthenticated touched endpoints bleiben 401:
    Claim-Links POST/PATCH, Deleted-Team Restore, Bundle Detail/Decision,
    Messenger Admin Targets, Messenger Admin Conversations.
  - Keine DB-Migration, keine Produktionsdaten-Mutation, keine Test-Mails,
    keine Exporte/Resets/Claim-Einladungen ausgefuehrt.
  - Bekannter Gap: kein authentifizierter Multi-Tenant-Admin-Smoke mangels
    Session-Cookies/Test-Account-Automation; Sebastian kann UI live pruefen.
- Aktueller Production-Stand 2026-07-19 09:20 UTC:
  - Sebastian meldete, dass die Prisma/Vercel Subscription upgegradet ist.
  - Live-Check danach: `https://portal.s5evo.de/api/competition` liefert wieder
    200; Prisma `planLimitReached` ist damit akut geloest.
  - Wartungsmodus wurde erfolgreich nach Production deployed, nachdem der
    Vercel Resource-Provisioning-Blocker verschwunden war.
  - Vercel Production Env `PORTAL_MAINTENANCE_MODE=1` wurde erneut
    ueberschrieben; finaler Deploy wird mit explizitem
    `--env PORTAL_MAINTENANCE_MODE=1` ausgefuehrt.
  - UI-Smoke gruen: `/` und `/anmeldung` zeigen
    `Wartungsarbeiten` / `Portal aktuell geschlossen` /
    `wegen Wartungsarbeiten`.
  - Zusaetzliche Haertung in aktueller Session: `proxy.ts` blockiert im
    Wartungsmodus mutierende `/api/*`-Requests (`POST`, `PUT`, `PATCH`,
    `DELETE`) mit 503, damit auch alte offene Formulare bzw. direkte API-POSTs
    keine Mannschaft anmelden oder Daten aendern koennen.
  - Checks fuer API-Guard gruen: targeted ESLint, `npx tsc --noEmit
    --incremental false`, `git diff --check`, `npm run build`.
  - Finaler Production Deploy: `dpl_AUxng2PFN4xnJ434vuSbezKa2SRv`
    (`https://s5-evo-portal-7mn50zovq-sebastiankroeker-2781s-projects.vercel.app`),
    Alias `https://portal.s5evo.de`.
  - API-Guard-Smoke gruen: `POST /api/teams` ohne Body liefert 503
    `maintenance_mode`; read-only `/api/competition` bleibt 200.
  - Reopen-Prozedur: `PORTAL_MAINTENANCE_MODE=0` bzw. Env entfernen/setzen und
    neu nach Production deployen; danach public smoke laufen lassen.
- Aktuelle Production-Stoerung 2026-07-18 16:52 UTC:
  - Sebastian meldete, dass keine Mannschaften sichtbar sind und fragte, ob Adminrechte entzogen wurden.
  - Befund: sehr wahrscheinlich nicht Adminrechte. Production erreicht die Prisma-DB nicht.
  - `npm run smoke:public` gegen `https://portal.s5evo.de` ist rot: `/api/competition` liefert 500.
  - Vercel Logs fuer Deployment `dpl_9gaTBCHhd46gWNt93yhf8wfRmvqm`: Prisma P1001 `Can't reach database server at db.prisma.io:5432` fuer `/api/competition`, `/api/messages/unread-count`, `/api/profile/presence`.
  - Lokaler TCP-Test zu `db.prisma.io:5432` ist offen, aber `npx prisma migrate status` liefert P1001.
  - Direkter `psql`-Handshake mit der aktuellen `.env` meldet: `Failed to identify your database: Your account has restrictions: planLimitReached`.
  - Prisma public status meldete zeitgleich `All Systems Operational`.
  - Schlussfolgerung: DB-Projekt/Billing/Usage/Account-Restriction bei Prisma pruefen/loesen. Rollback der letzten App-Commits hilft nach aktuellem Befund nicht, weil die App vor Rollen-/Tenant-Logik an der DB-Verbindung scheitert.
- Wartungsmodus-Versuch 2026-07-18 18:18 UTC:
  - Sebastian bat, das Portal offline zu nehmen und ein Wartungs-/Bauarbeiten-Schild zu zeigen.
  - CR: `docs/cr/2026-07-18-portal-maintenance-mode.md`.
  - Commit: `fea24c6 Add portal maintenance mode`.
  - Code: `PORTAL_MAINTENANCE_MODE=1` rendert in `app/layout.tsx` vor Providers/DB/Auth die statische `app/components/maintenance-screen.tsx`.
  - Vercel Production Env `PORTAL_MAINTENANCE_MODE=1` wurde gesetzt.
  - Lokale Checks gruen: targeted ESLint, `npx tsc --noEmit --incremental false`, `git diff --check`, `npm run build`, `PORTAL_MAINTENANCE_MODE=1 vercel build --prod`.
  - Production Deploys blockiert: `dpl_A3pbRRCcMX6avzXbzECLXmFNwxuU`, `dpl_9w1ifE7aKRgVxmGVzm4GMFkYGfDP`, prebuilt `dpl_75E9dNvj3888R6F5odRmwQyBU4MM`; alle `BUILD_ERROR Resource provisioning failed`.
  - Vercel Integration Check: `vercel integration list s5-evo-portal` zeigt `prisma-postgres-celeste-bridge` als `Suspended`.
  - Current alias ist deshalb noch nicht auf Wartungsseite; aktuell bleibt die vorherige Production live und DB-APIs fallen wegen Prisma-Restriction aus.
  - Sichere Optionen: Prisma/Vercel Storage Restriction loesen; oder mit expliziter Freigabe einen riskanteren Infra-Bypass waehlen (z.B. Threshold/Billing setzen, Integration disconnecten, oder Domain temporaer auf Ersatzprojekt umhaengen).
- Aktueller vorbereiteter Follow-up-CR: Entity-ID Tenant Scope Guardrails.
  - CR: `docs/cr/2026-07-18-entity-id-tenant-scope-guardrails.md`.
  - Status: Draft, noch keine Codeaenderung.
  - Scope: gestrige fuenf Entity-ID-only-Follow-ups aus dem Tenant-Scope-Handoff: Claim-Links POST/PATCH, Deleted-Team Restore, Participant-Change-Bundle Create/Detail/Decision.
  - Gate: High-Risk Auth/Sensitive-Data-CR; braucht explizites Go vor Implementierung und separates Go vor Production Deploy.
- Aktueller Hotfix-/Hardening-CR: Tenant Scope Audit Guardrail.
  - CR: `docs/cr/2026-07-18-tenant-scope-audit-guardrail.md`.
  - Status: deployed.
  - Commit: `4fe6527 Harden admin tenant scope guardrails`.
  - Production Deploy: `dpl_9gaTBCHhd46gWNt93yhf8wfRmvqm`.
  - Deployment URL: `https://s5-evo-portal-cpztoggsn-sebastiankroeker-2781s-projects.vercel.app`.
  - Alias: `https://portal.s5evo.de`.
  - Ausloeser: Sebastian machte nach zwei Multi-Tenant-Hotfixes berechtigt Sorgen, ob alle betroffenen Tenant-Scope-Stellen abgesichert sind.
  - Kernursache: `requireTenantRoles()` ohne expliziten Tenant kann bei Multi-Tenant-Admins auf den ersten passenden Admin-Tenant fallen, waehrend die UI einen anderen aktiven `competitionId`-Wettkampf sendet.
  - Geaendert: direkte `competitionId`-Adminrouten nutzen jetzt `requireCompetitionTenantRoles()` bzw. loesen den Ziel-Tenant vor der Autorisierung auf. Betroffen: Audit-Events, Claim-Audit, Claim-Links GET, Competition Reset, Deleted Teams GET, Mail-Events, Orga-Summary, Participant-Audit, Participants, Pending-Change-Decision, Result-Staging Batches/Reset/Sessions, Startnummern-Import, Team-Access-Audit.
  - Neuer Guard: `npm run verify:tenant-scope` (`scripts/verify-tenant-scope.ts`) blockiert Regressionen, wenn competition-scoped Adminrouten wieder fallback-basiert autorisieren.
  - Bewusst unveraendert: keine DB-Migration, keine Produktionsdaten-Mutation, keine neuen Serializer-Felder, keine Mails/Exports/Resets ausgefuehrt.
  - Checks gruen: `npm run verify:tenant-scope`, `npm run verify:admin-competition-scope`, `npm run verify:admin-dashboard-scope`, `npm run verify:admin-csv-export-scope`, targeted ESLint, `npx tsc --noEmit --incremental false`, `git diff --check`, `npm run build`.
  - Post-Deploy Smoke gruen: `npm run smoke:public`; `/` 200; `/admin` 200; geschuetzte Admin-Endpunkte ohne Session bleiben 401 fuer `participants`, `mail-events`, `audit-events`, `result-staging/batches`, `start-numbers/import`, `result-staging/reset/preview`, `competition/reset`, `claim-links`.
  - Follow-up-Risiko: fuenf Entity-ID-only-Routen brauchen eigene scoped Helper/Guards: Claim-Links POST/PATCH, Deleted-Team Restore, Participant-Change-Bundle Create/Detail/Decision.
  - Authenticated multi-tenant Browser/API-Smoke bleibt Gap mangels Session-Cookies.
- Aktueller Hotfix-CR: CSV Export Tenant Scope And Round Logo.
  - CR: `docs/cr/2026-07-17-csv-export-tenant-scope-and-round-logo.md`.
  - Status: deployed.
  - Ausloeser: Sebastian meldete per Screenshot, dass das offizielle Logo das kreisrunde 5Kampf-Mark ist und der Admin-CSV-Mailversand mit `Wettkampf nicht gefunden` fehlschlaegt.
  - Ursache/Codepfad: `/api/admin/daily-orga-export` und `/api/admin/teams-export` autorisierten zuerst per `requireTenantRoles()` gegen einen impliziten Fallback-Tenant und filterten danach `loadCompetitionsForDailyExport()` mit `auth.tenantId`. Bei Multi-Tenant-Admins konnte dadurch der ausgewaehlte 2026-Wettkampf im falschen Tenant gesucht werden.
  - Geaendert: neuer `requireCompetitionTenantRoles()` Helper in `lib/server-permissions.ts`; Daily-Orga-CSV-Mailversand, CSV-Download und Layout-CSV-Export pruefen den Tenant des uebergebenen `competitionId`; Header, Sidebar und Home nutzen `/brand/5kampf/mark.webp` statt Banner.
  - Bewusst unveraendert: CSV-Inhalt, Empfaengerlogik, Mail-Provider, DB, Offline-Cache und PWA-Manifest.
  - Privacy: Exportpfad enthaelt sensible Team-/Manager-/Teilnehmerdaten; keine neuen Felder, keine neuen Logs, keine Test-Mail versendet.
  - Checks gruen: `npm run verify:admin-csv-export-scope`, `npm run verify:admin-dashboard-scope`, `npm run verify:admin-competition-scope`, targeted ESLint, `npx tsc --noEmit --incremental false`, `git diff --check`, `npm run build`.
  - Local smoke gruen: `/brand/5kampf/mark.webp` 200 `image/webp`; `/` enthaelt `<title>Soier 5Kampf</title>`; unauthenticated `POST /api/admin/daily-orga-export` und `GET /api/admin/teams-export?...` bleiben 401.
  - Test-Gap: kein authentifizierter Admin-/Mail-Smoke durch Agent; Production Deploy braucht klares Go.
- Aktueller Content-CR: Home Branding Official Logo.
  - CR: `docs/cr/2026-07-17-home-branding-official-logo.md`.
  - Status: deployed.
  - Commit: `4490d5b Apply official home branding`.
  - Handoff-Commit: `8f9583c docs: record home branding handoff [skip ci]`.
  - Production Deploy: `dpl_D5dijDSZuadfHRBczpyGu1vuoNUq`.
  - Deployment URL: `https://s5-evo-portal-q46fww3m8-sebastiankroeker-2781s-projects.vercel.app`.
  - Alias: `https://portal.s5evo.de`.
  - Ausloeser: Sebastian bat darum, Browser-Tab-Titel ebenfalls anzupassen, Header links oben Medaille + `S5Evo` durch offizielles Logo zu ersetzen, auf Home das offizielle Logo statt Pokal gross mittig zu zeigen, den Schriftzug `Bad Bayersoier Fünfkampf für Mannschaften 2026` gleich gross/fett zu setzen, Ort zu entfernen und Status ans Seitenende zu stellen.
  - Geaendert: `app/layout.tsx` title `Soier 5Kampf`; `app/components/nav-bar.tsx` Top-Header-Logo; `app/components/sidebar.tsx` Desktop-Sidebar-Logo; `app/components/home-screen.tsx` Home-Brand-Header, Ort-Zeile entfernt, Status-Footer.
  - Assets: nutzt bestehende `/brand/5kampf/banner.webp` und `/brand/5kampf/mark.webp`; keine neuen Assets.
  - Bewusst unveraendert: keine API, DB, Auth, Service-Worker, Offline-Cache, Mail, Export oder Privacy-Aenderung; PWA Icons bleiben unveraendert.
  - Checks gruen: targeted ESLint, `npx tsc --noEmit --incremental false`, `git diff --check`, `npm run build`; lokaler `next start` Smoke: `/` title `Soier 5Kampf`, Banner/Mark Assets 200.
  - Post-Deploy Smoke gruen: `npm run smoke:public`; `/` 200 mit `<title>Soier 5Kampf</title>`; `/brand/5kampf/banner.webp` 200 `image/webp`; `/brand/5kampf/mark.webp` 200 `image/webp`; protected API checks bleiben 401 ohne Session.
  - Test-Gap: kein Playwright/Puppeteer im Workspace, daher kein Pixel-Screenshot; Sebastian prueft Logo-Groesse manuell auf dem Geraet.
- Aktueller Content-CR: PWA Install Name Soier 5Kampf.
  - CR: `docs/cr/2026-07-17-pwa-install-name-soier-5kampf.md`.
  - Status: deployed.
  - Commit: `0775970 Update PWA install name`.
  - Production Deploy: `dpl_BzBt3bxJ3fUeDmqRaQTJnKmtmQRS`.
  - Deployment URL: `https://s5-evo-portal-glw36n2lx-sebastiankroeker-2781s-projects.vercel.app`.
  - Alias: `https://portal.s5evo.de`.
  - Ausloeser: Sebastian bat darum, beim Installieren der App den Default-Text `Soier 5Kampf` zu verwenden.
  - Geaendert: `app/manifest.ts` setzt `name` und `short_name` auf `Soier 5Kampf`; `app/layout.tsx` setzt `metadata.applicationName` und `appleWebApp.title` auf `Soier 5Kampf`.
  - Bewusst unveraendert: Browser-Tab-Titel bleibt `S5Evo Portal – Mannschaftsfünfkampf`; keine API, DB, Service-Worker, Offline-Cache, Mail, Export oder Privacy-Aenderung.
  - Checks gruen: `npx eslint app/manifest.ts app/layout.tsx`, `npx tsc --noEmit --incremental false`, `git diff --check`, `npm run build`; gebautes Manifest enthaelt `name:"Soier 5Kampf"` und `short_name:"Soier 5Kampf"`.
  - Post-Deploy Smoke gruen: `npm run smoke:public`; `/` 200; `/manifest.webmanifest` 200 mit `content-type: application/manifest+json`; Live-Manifest meldet `name` und `short_name` als `Soier 5Kampf`.
- Aktueller Hotfix: Admin Dashboard Tenant Scope.
  - CR: `docs/cr/2026-07-17-admin-dashboard-tenant-scope-hotfix.md`.
  - Status: deployed.
  - Commit: `f2419f6 Fix admin dashboard tenant scope`.
  - Production Deploy: `dpl_FiwHpJBxynaLpynRBrzNcT6zJ3QT`.
  - Deployment URL: `https://s5-evo-portal-9bibaqa67-sebastiankroeker-2781s-projects.vercel.app`.
  - Alias: `https://portal.s5evo.de`.
  - Ausloeser: Sebastian meldete, dass nach Wechsel vom alten Tenant auf aktuellen Wettkampf keine Aenderungen mehr im Dashboard sichtbar seien und `Leonhard.Schwaiger@t-online.de` fehle.
  - Read-only-Fakten: Leonhard existiert als User im aktuellen Tenant `esv-bad-bayersoien` und als Teilnehmer im 2026-Team `5Kampf Orga`; im alten Tenant `esv-2024` ist er nicht. 2026 hat 25 ChangeRequests, 2024 hat 0.
  - Ursache/Codepfad: `/api/admin/pending-changes` und `/api/admin/users` nutzten `requireTenantRoles()` ohne aktiven `competitionId`-Scope und konnten bei Multi-Tenant-Admins auf den alten 2024-Fallback-Tenant fallen.
  - Geaendert: Änderungsdashboard und Benutzerverwaltung senden den aktiven `competitionId`; Admin-Routen loesen daraus den Tenant und pruefen Admin/Moderator-Rechte gegen genau diesen Tenant.
  - Mitgesichert: Rollen-Speichern und User-Loeschen in der Benutzerverwaltung nutzen denselben ausgewählten Tenant; Team-Manager-Scopes in der Userliste werden ebenfalls tenant-/competition-gefiltert.
  - Keine Produktionsdaten-Mutation, keine DB-Migration, keine neuen Serializer-Felder.
  - Neuer Guard: `npm run verify:admin-dashboard-scope`.
  - Checks gruen: `npm run verify:admin-dashboard-scope`, `npm run verify:admin-competition-scope`, targeted ESLint, `npx tsc --noEmit --incremental false`, `git diff --check`, `npm run build`.
  - Post-Deploy Smoke gruen: `npm run smoke:public`; `/` 200; `/aenderungen` 200; `/admin` 200; `/api/admin/pending-changes?competitionId=...&scope=all` ohne Session 401; `/api/admin/users?competitionId=...` ohne Session 401; `/api/teams?...&scope=all` ohne Session 401.
  - Test-Gap: kein authentifizierter Admin-Browser-Smoke durch Agent; Sebastian soll live im 2026-Wettkampf Benutzerverwaltung nach Leonhard pruefen und im Aenderungsdashboard ggf. `Alle`/Historie nutzen, weil 2026 aktuell 20 applied und 5 rejected ChangeRequests, aber keine offenen 2024-Changes hat.
- Aktueller Hotfix: PWA Watchlist Discoverability.
  - CR: `docs/cr/2026-07-17-pwa-watchlist-discoverability.md`.
  - Status: deployed.
  - Commit: `8c1c620 Improve watchlist discoverability`.
  - Production Deploy: `dpl_4CBXBp2qDaxbdv3uujf2FmXg5mGy`.
  - Deployment URL: `https://s5-evo-portal-p9d4xss2r-sebastiankroeker-2781s-projects.vercel.app`.
  - Alias: `https://portal.s5evo.de`.
  - Scope: Watchlist-Auffindbarkeit verbessert; leerer Watchlist-Tab hat `Teams auswählen`, Teamkarten zeigen `Merken`/`Gemerkt` statt nur Icon.
  - Keine Datenlogik-Aenderung: keine API, DB, Store-Schema, Rollenlogik oder Privacy-Aenderung.
  - Checks gruen: targeted ESLint, `npx tsc --noEmit --incremental false`, `git diff --check`, `npm run build`.
  - Post-Deploy Smoke gruen: `npm run smoke:public`; `/` 200; `/teilnehmer` 200; `/api/teams?...&scope=all` ohne Session 401; `/api/results?...` 200; Production `sw.js` bypassed weiter `/api/` und `/_next/`.
  - Test-Gap: kein authentifizierter Admin-Browser-Smoke durch Agent; Sebastian testet live.
- Aktueller Feature-CR: PWA Watchlist V1.
  - CR: `docs/cr/2026-07-17-pwa-watchlist-v1.md`.
  - Status: deployed.
  - Commit: `13c63ec Add PWA watchlist v1`.
  - Production Deploy: `dpl_7GsY6PwrSMtkDebV9tYFTJFiEjTQ`.
  - Deployment URL: `https://s5-evo-portal-89ct2rumr-sebastiankroeker-2781s-projects.vercel.app`.
  - Alias: `https://portal.s5evo.de`.
  - Scope: Team-Watchlist fuer Live/PWA, lokal pro Wettkampf gespeichert; Watchlist-Segment in Live, Stern-Button an Teams, Ergebnisliste kann auf Watchlist-Teams filtern.
  - Privacy-Entscheidung: neuer Watchlist-Store persistiert nur Team-IDs in `localStorage` (`s5evo.watchlist.teams.v1.${competitionId}`), keine Teamnamen, Teilnehmerdaten, Geburtstage, E-Mails, Telefonnummern, Claim-Links oder Rollen.
  - Keine API-/DB-/Serializer-/Service-Worker-Aenderung; bestehende Rollen-/Sichtbarkeitslogik bleibt fuehrend.
  - Dateien: `lib/pwa-watchlist.ts`, `app/components/live-screen.tsx`, `app/components/results-view.tsx`, CR.
  - Checks gruen: targeted ESLint, `npx tsc --noEmit --incremental false`, `git diff --check`, `npm run build`, gezielter Store-Negativcheck gegen PII-Felder.
  - Post-Deploy Smoke gruen: `npm run smoke:public`; `/` 200; `/teilnehmer` 200; `/api/results?competitionId=...` 200; `/api/teams?...&scope=all` ohne Session 401; Production `sw.js` bypassed weiter `/api/` und `/_next/`.
  - Test-Gap: kein authentifizierter Browser-/Handy-Smoke durch Agent; manuell testen: Team sternen, Reload/PWA-Update, Watchlist-Tab, Ergebnisfilter.
- Feature-Brainstorm Zuschauer/Teilnehmer fuer spaeter gemerkt:
  - Prioritaet PWA/MVP+: 1) lokale Watchlist/Favoriten, 2) Watchlist-Start-/Ergebnisansicht, 3) Heute-Zeitplan/naechste Starts, 4) offizieller Live-Ticker, 5) Event Map light.
  - Weitere Ideen: Results Story, QR-Teamkarte, spaetere Push/In-App-Notifications, Heute-Timeline, WhatsApp-Share-Karte, Public-Follow-Modus ohne Login.
- Aktueller Methodik-/Guardrail-Stand:
  - Ausloeser: Sebastian fragte wegen Geburtsdatum, E-Mail, Telefonnummer und PWA-Offline-Daten nach Security-/Quality-Guardrails und Kontextverlust.
  - Skill Workshop Proposal `s5evo-change-request-20260717-3cf3ed0e22` wurde applied fuer `s5evo-change-request`.
  - Live-Skill enthaelt jetzt PII/Privacy-Guardrails: sensitive Felder, Offline-Caches, Exporte, Logs, Mails, Serializer/API-Leaks, negative Checks, Handoff-Lesepflicht.
  - Lokaler Guardrail bereits aktiv im Repo: `docs/cr/_template.md` enthaelt jetzt `Privacy / Security Review`, sensitive-data impact, negative checks, authenticated-smoke gap und Kontext-Leseliste.
  - Naechster sinnvoller Schritt: eigener Runtime-Privacy-Audit-CR fuer PWA Offline Cache und API-Serializer-Payloads.
- Aktueller lokaler Feature-CR: Telefonnummer fuer normale Mannschaftsanmeldung.
  - CR: `docs/cr/2026-07-17-normal-team-contact-phone.md`.
  - Status: deployed.
  - Commits: `a8bc9a5 Require phone for team registrations`, `a98b61c Improve team phone validation message`.
  - Production Deploy: `dpl_DTB4QwNr3A8Gotj4Sz4PSAABuu63` (supersedes initial deploy `dpl_988E5NxxAppx3A8w6RMy1mARSaD9`).
  - Deployment URL: `https://s5-evo-portal-rabkwy20o-sebastiankroeker-2781s-projects.vercel.app`.
  - Alias: `https://portal.s5evo.de`.
  - Geaendert: `TeamRegistrationSchema.contactPhone` ist fuer normale Mannschaftsanmeldungen Pflicht; `/anmeldung` zeigt das Telefonnummernfeld fuer anonyme und eingeloggte normale Team-Manager; `POST /api/teams` speichert den getrimmten Wert in `Team.contactPhone`.
  - Keine DB-Migration: Spalte `teams.contactPhone` existiert bereits und wird von MTC/Sportlerboerse genutzt.
  - Checks gruen: `npm run verify:team-draft`, targeted ESLint (nur bestehende Hook-Warnung in `team-registration.tsx`), `npx tsc --noEmit --incremental false`, `git diff --check`, `npm run build`.
  - Post-Deploy Smoke gruen: `npm run smoke:public`; `/anmeldung` 200; `/api/teams` ohne Session 401; nicht-mutierender `POST /api/teams` ohne `contactPhone` -> 400 mit sauberer Telefon-Pflichtmeldung.
- Aktueller lokaler Hardening-CR: Admin Competition Scope Guard.
  - CR: `docs/cr/2026-07-17-admin-competition-scope-guard.md`.
  - Ausloeser: Sebastian hatte kurz den 2026er Wettkampf nicht mehr in der Admin-Auswahl, weil sein User Admin in zwei Tenants ist und der alte Codepfad den 2024-Archiv-Tenant als Fallback-Kontext nahm.
  - Produktionsfix ist bereits live: `2d04b4a Fix admin competition switcher tenant scope`, Deploy `dpl_FSgyPbacMZArx6kzGpba6cR2gE8C`, Alias `https://portal.s5evo.de`.
  - Guard lokal hinzugefuegt: `scripts/verify-admin-competition-scope.ts` plus npm-Script `verify:admin-competition-scope`.
  - Business-Invariant: Admin-Wettkampf-Auswahl muss alle Tenants beruecksichtigen, in denen der User `ADMIN` ist; Detail/Speichern muss gegen den Tenant des ausgewaehlten Wettkampfs autorisieren, nicht gegen einen impliziten Fallback-Tenant.
  - Deploy fuer den Guard selbst nicht erforderlich, sofern er nicht mit einem spaeteren Release gebuendelt wird.
- Aktueller Deploy: PWA Offline Read Model V1.
  - CR: `docs/cr/2026-07-17-pwa-offline-read-model-v1.md`.
  - Commit: `a0c4870 Add PWA offline read model`.
  - Production Deploy: `dpl_CjYJX8kALKjxpYeZXVhGuvMyw95s`.
  - Deployment URL: `https://s5-evo-portal-ezcxb3l20-sebastiankroeker-2781s-projects.vercel.app`.
  - Alias: `https://portal.s5evo.de`.
  - Status: committet, gepusht, deployed.
  - Geaendert: `lib/pwa-offline-cache.ts`, `app/components/dashboard.tsx`, `app/components/live-screen.tsx`, `app/components/results-view.tsx`, `app/components/pwa-service-worker.tsx`, `public/sw.js`.
  - Wirkung: Dashboard, Live/Startlisten und Ergebnisse speichern erfolgreiche Online-Antworten lokal, zeigen Datenstand, haben `Daten aktualisieren` und fallen bei Ladefehlern auf lokalen Stand zurueck.
  - App-Update: Service Worker kann neue Version signalisieren; PWA zeigt Banner `Neue App-Version verfuegbar` mit `App aktualisieren`.
  - Bewusst unveraendert: keine Offline-Mutationen, kein API-Caching im Service Worker, keine DB-Migration, kein neues Server-API.
  - Lokale Checks gruen: targeted ESLint, `npx tsc --noEmit --incremental false`, `git diff --check`, `npm run build`.
  - Post-Deploy Smoke gruen: `npm run smoke:public`; `/` 200; `/zeitnahme` 200; `/manifest.webmanifest` 200; `/sw.js` 200; `/api/results?competitionId=cmn3a1piz0002l104372yx9yt` 200; `/api/teams?...` ohne Session 401; SW enthaelt weiter `/api/`-/`/_next/`-Bypass plus `SKIP_WAITING`.
  - Test-Gap: kein authentifizierter Browser-Smoke fuer echten lokalen Cache-Fallback mangels Session-Cookies; bitte PWA auf Handy einmal online laden, Daten aktualisieren, danach Offline-/Flugmodus pruefen.
- Aktueller Hotfix deployed: Zeitnahme nur noch mit expliziter Rolle `ZEITNAHME`.
  - CR: `docs/cr/2026-07-17-timekeeping-role-only-hotfix.md`.
  - Commit: `5b9516c Restrict timekeeping to explicit role`.
  - Production Deploy: `dpl_HxJJjXkwHC5q5CF6guN9hsqzphjb`.
  - Deployment URL: `https://s5-evo-portal-bsfbqm5m4-sebastiankroeker-2781s-projects.vercel.app`.
  - Alias: `https://portal.s5evo.de`.
  - Status: committet, gepusht, deployed.
  - Geaendert: `lib/permissions.ts`, `app/api/timekeeping/snapshot/route.ts`, `app/api/timekeeping/events/route.ts`, `app/components/sidebar.tsx`.
  - Wirkung: `ADMIN`/`MODERATOR` erben `timekeeping.use`/`timekeeping.review` nicht mehr; `/api/timekeeping/snapshot` und `/api/timekeeping/events` akzeptieren nur noch `ZEITNAHME`; Sidebar-Erfassung nutzt denselben Zeitnahme-Gate.
  - Bewusst unveraendert: Admin-Ergebnisdaten/Result-Staging bleibt Admin-gated; keine DB-Migration.
  - Lokale Checks gruen: Permission-Assertion via `npx tsx -e`, targeted ESLint, `npx tsc --noEmit --incremental false`, `git diff --check`, `npm run build`.
  - Post-Deploy Smoke gruen: `npm run smoke:public`; `/zeitnahme` -> 200; `/api/timekeeping/snapshot?...` ohne Session -> 401; `POST /api/timekeeping/events` ohne Session -> 401.
  - Test-Gap: kein authentifizierter Admin-only-/Zeitnahme-Role-Smoke mangels Session-Cookies.
- Naechster PWA-Kandidat: Offline Read Model fuer Teilnehmer/Teamchefs.
  - Sebastian bestaetigte am 2026-07-17 die Richtung: Fokus auf Mannschafts-Dashboard, Startlisten und Ergebnislisten.
  - Zielbild: rollen-/privacy-bereinigtes read-only Offline-Paket pro Wettkampf/User-Sicht, lokal gespeichert mit Datenstand und Button `Daten aktualisieren`.
  - In V1 keine Offline-Mannschaftsaenderungen und keine automatische spaetere Mutation; serverseitige Sichtbarkeit bleibt fuehrend, insbesondere bei `hideForeignTeams`.
  - Umsetzungsidee fuer spaeteren CR: `/api/offline-package?competitionId=...&scope=participant`, IndexedDB-Persistenz, Offline-Badge, App-/Daten-Aktualisierungs-UX.
- Git-Stand: Privacy-Hotfix fuer fremde Mannschaften ist gebaut, deployed und wird in dieser Session gepusht. Bekannte untracked Workspace-Dateien bleiben unveraendert (`AGENTS.md`, `HEARTBEAT.md`, `MEMORY.md`, `SOUL.md`).
- Production ist live unter `https://portal.s5evo.de`.
- Aktiver Hotfix: Wettkampf-Switch `hideForeignTeams`.
  - CR: `docs/cr/2026-07-16-hide-foreign-teams-hotfix.md`.
  - Commit: `Add competition team privacy switch` (final Hash siehe `git log`/Abschlussmeldung).
  - Datenmodell: neue Competition-Spalte `hideForeignTeams Boolean @default(false)`.
  - Migration bereits gegen angebundene DB angewendet: `20260716182000_add_competition_hide_foreign_teams`.
  - Aktueller 2026er Wettkampf steht nach Migration noch auf `hideForeignTeams=false`; bestehendes Verhalten bleibt bis zum Admin-Speichern unveraendert.
  - Wenn aktiv: `/api/competition` liefert oeffentlich `teamCount: null`, Home laedt keine Team-/Teilnehmer-/Klassenstatistik, `/api/teams?scope=all` ist fuer Teamchef/Teilnehmer gesperrt, eigene Teams bleiben per Owner/Teamchef/Manager/Participant-Link oder Participant-Mail sichtbar.
  - Admin/Moderator behalten Vollsicht.
  - Lokale Checks gruen: `npx prisma generate`, `npx prisma migrate deploy`, `npx tsc --noEmit`, targeted ESLint, `git diff --check`, `npm run build`.
  - Production Deploy: `dpl_CWrZFbfDXfxp8bTJxLvKqU2qxxZD` (auto-deploy after push; supersedes manual deploy `dpl_fmF9DYSfbEmRePk1fN4jHGnG7tgP`).
  - Deployment URL: `https://s5-evo-portal-jhkhhgc5c-sebastiankroeker-2781s-projects.vercel.app`.
  - Alias: `https://portal.s5evo.de`.
  - Post-Deploy Smoke gruen: `npm run smoke:public`; `/admin` -> 200; `/api/teams?competitionId=...&scope=all` ohne Session -> 401; `/api/admin/competition?id=...` ohne Session -> 401; `/api/competition` -> `hideForeignTeams=false`, `teamCount=43`.
  - Test-Gap: kein authentifizierter Admin-/Teamchef-/Teilnehmer-Smoke mangels Session-Cookies; Logikfunktion lokal geprueft.
- Result-Staging V1 Foundation:
  - CR: `docs/cr/2026-07-15-result-staging-v1.md`
  - Status: deployed.
  - Commits:
    - `ef76a9c Add result staging foundation`
    - `9df19c9 Add result staging preview APIs`
    - `33f5126 Add result staging admin preview UI`
  - Latest Production Deploy: `dpl_GkPPtgvsGqefo7oTuK9fXT3JmqwN`
  - Latest Deployment URL: `https://s5-evo-portal-bq377v1q3-sebastiankroeker-2781s-projects.vercel.app`
  - Origin-sync deployment: `dpl_2qfjziTrj4TBaTdSw9vvPVTyiQXW`
  - Manual pre-push deployment: `dpl_AoTiw3GL7Trcox2Q7LoH3HSq8AZw`
  - Initial foundation deployment: `dpl_3QGsKAzXaDSVVc5CtRjRVSnSGZw1`
  - Alias: `https://portal.s5evo.de`
  - Scope: additive Prisma-Grundlage fuer `ResultDataBatch`, `ResultRawRecord`, `ResultDraft`, `ResultPublication`, `ResultPublicationItem`, `ResultResetSnapshot` plus Enums fuer Quelle/Zweck/Status/Reset-Scope.
  - Zweck: Legacy-Ergebnisimport, Zeitnahme-Sync und manuelle Ergebnis-Pflege ueber gemeinsame Raw-/Draft-/Review-/Publish-/Reset-Logik konsolidieren.
  - Produktionstest-Support: `ResultDataPurpose.PROD_TEST`/`DRY_RUN`, Batch-/Draft-/Publication-/Official-Result-Reset-Snapshots.
  - DB-Backup vor Migration: `backups/db/s5evo-prod-before-result-staging-20260715T192343Z.dump` plus `.sha256`.
  - Production-Migration angewendet: `20260715190500_add_result_staging_foundation`; `npx prisma migrate status` danach up to date.
  - Neue Tabellen nach Migration leer verifiziert: `result_data_batches`, `result_raw_records`, `result_drafts`, `result_publications`, `result_publication_items`, `result_reset_snapshots` jeweils `0`.
  - Dateien: `prisma/schema.prisma`, `prisma/migrations/20260715190500_add_result_staging_foundation/migration.sql`, `lib/result-staging.ts`, `app/api/admin/result-staging/batches/route.ts`, `app/api/admin/result-staging/reset/preview/route.ts`, `app/admin/page.tsx`, CR, `SESSION_HANDOFF.md`.
  - Checks gruen: `npx prisma validate`, `npx prisma generate`, `npx tsc --noEmit --incremental false`, `git diff --check`, `npm run build`, `npm run smoke:public`.
  - Post-Deploy Checks: `/` -> 200, `/api/competition` -> active competition, `/api/results?competitionId=cmn3a1piz0002l104372yx9yt` -> 200.
  - Read-only Preview-APIs deployed:
    - `GET /api/admin/result-staging/batches`
    - `POST /api/admin/result-staging/reset/preview`
    - Admin/Moderator-geschuetzt, nicht destruktiv, schreibt keine Preview-Snapshots.
    - Unauthenticated smoke: beide neuen APIs geben ohne Session 401.
  - Admin UI deployed:
    - `/admin?tab=competition` zeigt Ergebnis-Staging-Pakete, Aggregat-Zaehler und Reset-Preview-Form.
    - Destruktive Reset-Ausfuehrung bleibt gesperrt.
  - Lokaler Nachtrag nach Deploy:
    - Result Reset Execution V1 gebaut und inzwischen deployed (`dpl_ACTRDSxg1DCn3EgJFtWeGwV9dJyT`), Smoke gruen: `/admin` 200, neue Reset-Routen ohne Session 401.
    - Neue Route: `POST /api/admin/result-staging/reset`.
    - Neuer Helper: `lib/result-staging-reset.ts` fuer gemeinsame Preview-/Execute-Filter, Counts und Blocker.
    - Ausfuehrbar nur fuer `RAW_BATCH`, `DRAFTS`, `TEST_DATA`; `PUBLICATION` und `OFFICIAL_RESULTS` bleiben serverseitig blockiert.
    - Ausfuehrung braucht Begruendung + exakten Preview-Bestaetigungstext, schreibt `ResultResetSnapshot(mode=EXECUTED)` vor Delete und `RESULT_STAGING_RESET_EXECUTED` Audit.
    - Admin UI kann nach ausfuehrbarer Preview den Reset starten; loescht noch keine offiziellen `DisciplineResult`.
    - Ergebnisdaten-Workbench gebaut und deployed:
      - Route: `/admin/ergebnisse`.
      - Navigation: Sidebar, Search Overlay, Command Palette.
      - Workflow-Tabs: `Ueberblick`, `Pakete`, `Zuordnung & Validierung`.
      - Filter: Disziplin, Quelle, Zweck, Status, Suche.
      - Datenbasis: vorhandenes `GET /api/admin/result-staging/batches`; noch kein Publish, kein Raw-Row-Editing.
      - Production Deploy: `dpl_6PVaRGtjwPKVuz9JxyDuX8Mrd6Wi`; Smoke gruen: `/admin/ergebnisse` 200, public smoke gruen.
    - Timekeeping-to-Staging Intake lokal gebaut:
      - `GET /api/admin/result-staging/timekeeping/sessions` listet Uhr-Sessions mit Finish-/STRNR-/Import-Zaehlern.
      - `POST /api/admin/result-staging/timekeeping/import` uebernimmt neue FINISH-Events bewusst als `TIMEKEEPING_SYNC`-Paket nach `ResultDataBatch`/`ResultRawRecord`.
      - Workbench-Tab `Pakete` hat den Flow `Zeitnahme-Sync uebernehmen`: Session waehlen, Zweck `PROD_TEST`/`PRODUCTION`/`DRY_RUN` waehlen, Preview-Zaehler sehen, Paket erzeugen.
      - Stable Row-Key `timekeeping:{eventId}` verhindert doppelte Uebernahme bereits gestagter Uhr-Events.
      - Kein Publish nach `DisciplineResult`, keine Draft-Entscheidung; fehlende STRNR/Elapsed werden als Raw-Record-Warnungen markiert.
      - Audit: `RESULT_TIMEKEEPING_SESSION_STAGED`.
    - Lokale Checks fuer Intake bisher gruen: targeted ESLint, `npx tsc --noEmit --incremental false`.
  - Naechster Schritt: Intake fertig verifizieren, committen; danach nach separatem Go deployen/smoken. Danach Paketdetail/Raw-Record-Ansicht, Legacy-Import und Timekeeping-Draft-Ableitung. Noch kein Publish nach `DisciplineResult`.
- Deploy-Pfad fuer `portal.s5evo.de`:
  - Canonical ist Vercel (`vercel deploy --prod --yes`), nicht IONOS static.
  - CR: `docs/cr/2026-07-15-retire-ionos-static-portal.md`
  - Grund: DNS/HTTP bestaetigt Vercel (`*.vercel-dns-017.com`, Header `server: Vercel`).
  - Alte lokale IONOS-Static-Artefakte `build/` und Root-`deploy.sh` wurden recoverable nach `backups/retired-ionos-static-20260715T1802Z/` verschoben.
  - Alter IONOS-Remote-Pfad `./portal/` wurde vor dem Clear nach `backups/retired-ionos-static-20260715T1802Z/remote-portal/` gesichert (69 Dateien, 2.3 MB) und danach geleert.
  - Verifikation danach: `https://portal.s5evo.de/zeitnahme` -> 200, `server: Vercel`; IONOS `./portal/` dry-run total size 0.
  - Skill Workshop Updates angewendet:
    - `s5evo-change-request-20260715-4e65b087b0` stellt den vollstaendigen CR-Skill wieder her und ergaenzt den Vercel-Deploy-Contract.
    - `ionos-deploy-20260715-dd6874691e` stellt den IONOS-Skill-Text wieder her und markiert `portal.s5evo.de` als retired.
    - Hinweis: die ersten Applied-Proposals (`s5evo-change-request-20260715-a57f0e768c`, `ionos-deploy-20260715-eb833dcb67`) waren zu proposal-artig; wurden durch die obigen Reparatur-Proposals ersetzt. Das Support-File-Proposal `ionos-deploy-20260715-3f2a8608e9` blieb wegen Tool-Timeout pending.
- Zeitnahme V1:
  - CR: `docs/cr/2026-07-15-timekeeping-v1.md`
  - Commit: `8c854e6 Add timekeeping V1`
  - Status: deployed.
  - Production Deploy: `dpl_2BCfRS4pNu4rDYw5jVLCpB3beYDj`
  - Deployment URL: `https://s5-evo-portal-m0yaq1wwb-sebastiankroeker-2781s-projects.vercel.app`
  - Alias: `https://portal.s5evo.de`
  - Scope: neue Rolle `ZEITNAHME`, `/zeitnahme`, Snapshot-API, lokales Browser-Eventlog, append-only Sync in `timekeeping_sessions`/`timekeeping_events`, Navigation fuer berechtigte Rollen.
  - DB-Migration: `20260715111500_add_timekeeping_foundation` wurde auf Prod angewendet; Migration ist additiv (`ZEITNAHME` enum value, neue Tabellen) und mutiert keine bestehenden Team-/Teilnehmer-/Ergebnisdaten.
  - Backup vor Migration: `backups/db/s5evo-prod-before-timekeeping-20260715T135817Z.dump` plus `.sha256`; dafuer wurde lokal ein PostgreSQL-17-Client unter `tools/postgres17/` extrahiert, weil System-`pg_dump` 16 gegen Server 17 abbricht.
  - Rollbackpunkt vor Deploy: `dpl_5XAKJRkWhDz3opiCLpwuUDvDLCQM`.
  - Checks gruen: `npx tsc --noEmit --incremental false`, `npm run build`, targeted ESLint, `git diff --check`, `npx prisma migrate status`.
  - Post-Deploy Smoke gruen: `npm run smoke:public`; `/zeitnahme` -> 200; `/api/timekeeping/snapshot?competitionId=...` ohne Session -> 401; `/api/timekeeping/events` mit GET -> 405.
  - Bekannte Luecke: kein authentifizierter iPhone-/Zeitnehmer-Smoke durch Agent; Sebastian soll live pruefen, ob `/zeitnahme` in Safari/Home-Screen hydratisiert, Snapshot laedt, lokale Zeitnahme klappt und Sync-Status sauber wird.
- Change-Dashboard-Follow-up:
  - CR: `docs/cr/2026-07-15-change-dashboard-navigation-and-teamname-direct.md`
  - Commit: `fb25fe1 Improve change dashboard navigation`
  - Status: deployed.
  - Production Deploy: `dpl_7GzShqBrev6veN3ZKjHXsQZ3eXck`
  - Deployment URL: `https://s5-evo-portal-5ig6qroyw-sebastiankroeker-2781s-projects.vercel.app`
  - Alias: `https://portal.s5evo.de`
  - Scope: `/aenderungen` Default `PENDING` + letzte Aktivitaet, Admin-Navigation von Antragsteller/Team, klickbare Mannschafts-Dashboard-Aenderungsbadges, direkter TeamName-Pfad ueberholt alte offene TeamName-Antraege vor Anmeldeschluss.
  - Geaendert: `app/components/approval-queue.tsx`, `app/components/dashboard.tsx`, `app/api/teams/[id]/route.ts`, CR, `SESSION_HANDOFF.md`.
  - Checks gruen: targeted ESLint (nur bestehende Hook-Warnung in `approval-queue`), `npx tsc --noEmit`, `npm run verify:team-draft`, `git diff --check`.
  - Post-Deploy Smoke gruen: `npm run smoke:public` gegen `https://portal.s5evo.de`; `/`, `/login`, `/anmeldung`, `/aenderungen`, `/api/competition`, `/api/results` OK; geschuetzte APIs ohne Session 401.
  - Noch offen: Bereits vorhandener Veloass-Pending-Antrag in Prod wurde nicht automatisch mutiert; ggf. gezielt read-only pruefen und manuell/administrativ entscheiden.
- Change-Methodik/Skill wurde geschaerft:
  - Skill `s5evo-change-request` wurde ueber Skill Workshop aktualisiert und angewendet.
  - Neue Leitplanken: CR-Tiers (`micro`, `standard`, `high-risk`), Auto-Deploy-Awareness (`push origin main` bei Produktions-Auto-Deploy zaehlt als deploy-relevanter Schritt), Smoke-Matrix mit expliziten Authenticated-Gaps, Handoff-Topblock, Business-Invariants.
  - Wichtig fuer kuenftige Arbeit: funktionalen Code nicht auf auto-deployendes `main` pushen, bevor Sebastian ein klares Go fuer den deploy-relevanten Schritt gegeben hat. Lokale Commits bleiben ok; fuer Pre-Go-Remote-Review Branch/PR nutzen, falls sinnvoll.
- MTC-Owner-Hotfix:
  - CR: `docs/cr/2026-07-14-mtc-owner-edit-shortcut.md`
  - Commit: `6f36d94 Add MTC owner edit shortcut`
  - Status: deployed.
  - Production Deploy: `dpl_3iFYRehRNNfU9F4scczSYvE4rgS4`
  - Deployment URL: `https://s5-evo-portal-fo4yfa9ut-sebastiankroeker-2781s-projects.vercel.app`
  - Alias: `https://portal.s5evo.de`
  - Ausloeser: Markus Huber kann seinen eigenen MTC im Portal nicht selbststaendig bearbeiten. Ursache: MTC-Slot-Pflege im Portal-Dashboard war historisch Admin-Matching; die bestehende Selbstpflege-Maske haengt am vertraulichen `/mtc-anonym/[token]`-Link.
  - Geaendert: neuer `POST /api/teams/[id]/mtc-edit-link` erzeugt fuer berechtigte Owner eigener offener `MARKETPLACE`/`MATCHING`-MTCs einen frischen Bearbeitungslink zur bestehenden MTC-Maske; Dashboard zeigt fuer eigene MTCs einen `MTC bearbeiten`-Shortcut.
  - Nicht geaendert: Owner erhalten keine Admin-Suche nach fremden Sportlerboersen-Meldungen; Finalisierung bleibt bestehender Owner/Admin-Pfad.
  - Checks gruen: `npx eslint app/components/dashboard.tsx app/api/teams/[id]/mtc-edit-link/route.ts`, `npx tsc --noEmit`, `git diff --check`.
  - Post-Deploy Smoke gruen: `npm run smoke:public`, `/api/teams/nonexistent/mtc-edit-link` ohne Session -> 401, `/api/competition` -> 200.
- PWA-/Stoppuhr-Konzept fuer spaeter:
  - Sebastian moechte das Stoppuhr-/manuelle-Zeitnahme-Projekt fuer spaeter merken.
  - PWA-Basis-CR angelegt und nach neuer Methodik aktualisiert: `docs/cr/2026-07-14-pwa-foundation.md`.
  - CR-Tier: `standard`, Risk: low, Status: deployed.
  - Scope des CR: Portal installierbar machen, Manifest/Icons/konservativer Offline-Fallback; keine Stoppuhr-Umsetzung und keine breit gecachten Auth/Admin-Daten.
  - Business-Invariant: PWA-Basis ist keine zweite Smartphone-App und kein gespiegelter Smartphone-Persistierungs-Layer; bestehende UI/Backend/Auth bleiben fuehrend.
  - Lokal implementiert: Manifest/Metadata, PWA-Icons, Service-Worker-Registrierung, konservativer `/sw.js`, statischer Offline-Fallback `/offline.html`, normale `/offline`-Route.
  - Wichtig: Service Worker cached keine `/api/*`- oder `/_next/*`-Requests; Navigation nutzt network-first und faellt nur auf statisches `/offline.html` zurueck.
  - Lokale Checks gruen: targeted ESLint, `node --check public/sw.js`, `git diff --check`, `npx tsc --noEmit`, `npm run build`.
  - Lokaler HTTP-Smoke auf `127.0.0.1:3100` gruen: `/manifest.webmanifest`, `/sw.js`, `/offline.html`, `/offline`, Icons -> 200; `/api/teams`, `/api/admin/users`, `/api/admin/pending-changes` ohne Session -> 401.
  - Production Deploy: `dpl_7ZAAEVkh4A8YpwFL53QULKm5WMnY`
  - Deployment URL: `https://s5-evo-portal-40zxpjoi7-sebastiankroeker-2781s-projects.vercel.app`
  - Alias: `https://portal.s5evo.de`
  - Commit: `2c5eb29 Add PWA foundation`
  - Post-Deploy Smoke gruen: `npm run smoke:public`, `/manifest.webmanifest`, `/sw.js`, `/offline.html`, `/offline`, Icons -> 200; `/api/teams`, `/api/admin/users`, `/api/admin/pending-changes` ohne Session -> 401; `/sw.js` enthaelt `/api/`- und `/_next/`-Bypass.
  - Sebastian-side optionaler Mini-Smoke: auf Handy einloggen, Installierbarkeit pruefen, installierte App starten, optional Flugmodus/Offline-Fallback testen.
  - Stoppuhr bleibt spaeterer eigener CR: offlinefaehiges Zeitnahme-Modul mit lokalem Event-Log, Sync Queue, Konfliktbehandlung und Admin-Review.
  - Event-Map/Event-Guide bleibt ebenfalls spaeterer eigener CR: MapLibre/GeoJSON/GPX-Layer fuer Veranstaltungsorte, Lauf/MTB/Rennrad, Hoehenprofile, POIs wie Bierzelt/Bar/Sponsoren, optionale PMTiles-Offline-Basemap, spaeter Timeline/Social Feeds. Nicht Teil der PWA-Basis.
- Grafik-/Icon-Unterstuetzung:
  - Sebastian hat Kontakt zu einer Person, die kurzfristig Icons/Grafiken als PNG erstellen kann.
  - Empfehlung an Designer: 5 einzelne transparente PNGs je Disziplin als 512x512-Master: `run.png` (Laufen), `bench.png` (Bankdruecken), `stock.png` (Stockschiessen), `road.png` (Rennrad), `mtb.png` (Mountainbike).
  - Stilvorgaben: einheitliche klare Silhouette, bei 24-32 px noch lesbar, kein Text im Icon, Motiv zentriert mit ca. 10-15% Padding, gerne einfarbig Portal-Blau oder neutral dunkel; SVG/Quelldatei optional zusaetzlich hilfreich.
  - Spaeter optional: PWA/App-Icon 512x512 und 192x192 sowie Social-/Preview-Grafik 1200x630.
- Letzter funktionaler Code-Deploy:
  - Commits: `1d5b1b9 Show class badges in user team scopes`, `9112f40 Clarify portal account link badge`
  - Production Deploy: `dpl_BvYpNXZGLh3f2xSaKVicKRvnFGoZ`
  - Deployment URL: `https://s5-evo-portal-d79b1ldjt-sebastiankroeker-2781s-projects.vercel.app`
  - Alias: `https://portal.s5evo.de`
  - Smoke gruen: `npm run smoke:public`, `/` -> 200, `/login` -> 200, `/anmeldung` -> 200, `/aenderungen` -> 200, `/api/competition` -> 200, `/api/results` -> 200, `/api/teams` ohne Session -> 401, `/api/admin/pending-changes` ohne Session -> 401, `/api/admin/users` ohne Session -> 401.
- Naechste aktive Arbeit liegt nicht in weiterem UI-Bau, sondern in Real-Smokes:
  1. Authenticated Messenger-Smoke: persoenlich an User, Orga-Team an User, Kanal-Anzeige in Empfaengeransicht, persoenliche Threads schliessen/wieder oeffnen, Reopen bei Antwort.
  2. Markus-Huber/MTC-Smoke: eigene vollstaendige MTC zeigt Uebernehmen-Dialog, Finalisierung klappt, danach regulaere Mannschaft mit Team-Manager-/Teamchef-Recht.
- User-Team-Scope-Class-Badge-Hotfix:
  - CR: `docs/cr/2026-07-14-user-team-scope-class-badge.md`
  - Commits: `1d5b1b9 Show class badges in user team scopes`, `9112f40 Clarify portal account link badge`
  - Status: deployed.
  - Production Deploy: `dpl_BvYpNXZGLh3f2xSaKVicKRvnFGoZ`
  - Deployment URL: `https://s5-evo-portal-d79b1ldjt-sebastiankroeker-2781s-projects.vercel.app`
  - Alias: `https://portal.s5evo.de`
  - Ausloeser: Markus-Huber Useransicht zeigt `Huber Cars, Team 3` nach MTC-Ueberfuehrung als regulaere Mannschaft ohne Klassenkuerzel vor dem Teamnamen.
  - Geaendert: `app/api/admin/users/route.ts` liefert `classificationCode` in `teamScopes[]`; `app/components/user-management.tsx` zeigt fuer regulaere Teams ein kompaktes Klassen-Badge (SA/SB/J/DA/DB/HA/HB/HC) vor dem Mannschaftsnamen. MTC-Scopes behalten `MTC x/5`.
  - Wording-Nachtrag: `Portal-Konto vorhanden` heisst jetzt `Portal-Konto ohne Link`, damit der Badge konsistent zum Filter `Konto ohne Link` ist.
  - Checks gruen: `npx eslint app/api/admin/users/route.ts app/components/user-management.tsx`, `npx eslint lib/account-link-status.ts app/components/user-management.tsx`, `npx tsc --noEmit`, `git diff --check`.
  - Post-Deploy Smoke gruen: `npm run smoke:public`, `/api/admin/users` ohne Session -> 401.
- Pending-Change-BirthDate-Hotfix:
  - CR: `docs/cr/2026-07-14-pending-change-birthdate-live-drift-hotfix.md`
  - Status: deployed.
  - Commit: `5231bbf Fix pending change birthdate live drift`
  - Production Deploy: `dpl_7fJ2g8rCEPhRisEQ7ihCVBUgD4ME`
  - Deployment URL: `https://s5-evo-portal-qhry98nkm-sebastiankroeker-2781s-projects.vercel.app`
  - Alias: `https://portal.s5evo.de`
  - Ursache: Admin-Pending-Change-Readmodels selektierten `birthYear`, aber nicht `birthDate`; `toParticipantSnapshot()` interpretierte den Live-Stand dadurch als `birthDate=null`.
  - Effekt in Prod: Die zwei offenen Markus/Huber-Antraege fuer `Huber Cars Team 4, Family Edition` zeigten false-positive `Live-Stand abweichend`, obwohl die Live-Teilnehmer Geburtstage haben.
  - Geaendert:
    - `app/api/admin/pending-changes/route.ts`: `birthDate` in Generic-/Legacy-/Direct-Participant-Selects und Typ ergaenzt.
    - `app/api/admin/participant-change-bundles/[id]/route.ts`: `birthDate` im Participant-Select ergaenzt.
  - Read-only Prod-Verifikation nach Fix-Logik:
    - `cmrkkd0y5000dju04bg32e4ua`: live `2004-04-27`, Drift `[]`.
    - `cmrkkbnuw0003ju040vpsvhls`: live `1993-10-14`, Drift `[]`.
  - Checks gruen: targeted ESLint, `npx tsc --noEmit`, `git diff --check`.
  - Post-Deploy Smoke gruen: `npm run smoke:public`, `/` -> 200, `/aenderungen` -> 200, `/api/admin/pending-changes` ohne Session -> 401.
- Markus-Huber MTC-Owner-Offline-Hotfix:
  - Commit: `175835b Allow MTC owners to view offline drafts`
  - Production Deploy: `dpl_GACfAtJPip3eRjTpxqWnpv54WdBX`
  - Deployment URL: `https://s5-evo-portal-2xxnpdmkw-sebastiankroeker-2781s-projects.vercel.app`
  - Alias: `https://portal.s5evo.de`
  - CR: `docs/cr/2026-07-14-mtc-owner-offline-visibility-hotfix.md`
  - Ursache: `marketplaceGlobalVisibility=OFFLINE` blendete auch eigene MTCs fuer Nicht-Admins aus.
  - Korrektur: Owner eigener Marketplace-/MTC-Teams duerfen eigene Teams trotz global `OFFLINE` sehen; fremde/public Teams bleiben offline.
  - Checks lokal gruen: targeted ESLint, `npx tsc --noEmit`, `git diff --check`, gezielte Sichtbarkeits-Assertions.
  - Post-Deploy Smoke gruen: `npm run smoke:public`, `/sportlerboerse-dashboard` -> 200, `/api/teams` ohne Session -> 401.
- Team-Edit-bis-Anmeldeschluss-Hotfix:
  - CR: `docs/cr/2026-07-14-team-edit-direct-until-registration-deadline.md`
  - Status: deployed.
  - Commit: `41ad486 Allow direct team edits before deadline`
  - Production Deploy: `dpl_3HxpsrUmpz1ajiC7E6qMFf77R6fx`
  - Deployment URL: `https://s5-evo-portal-5et0yhr1x-sebastiankroeker-2781s-projects.vercel.app`
  - Alias: `https://portal.s5evo.de`
  - Ursache: Team-Manager:innen konnten vor Anmeldeschluss nicht alle Mannschaftsaenderungen direkt speichern; Identitaet/Geburtsdaten/Geschlecht/Disziplin liefen in PendingChange, obwohl fachlich bis Anmeldeschluss keine Genehmigung noetig ist.
  - Korrektur: `PUT /api/teams/[id]` nutzt fuer Team-Owner/Manager vor `competition.registrationDeadline` den bestehenden Direkt-Update-Pfad; nach Anmeldeschluss bleibt der Approval-Flow bestehen.
  - Checks lokal gruen: targeted ESLint, `npx tsc --noEmit`, `npm run verify:team-draft`, `git diff --check`, gezielte Deadline-Assertions.
  - Post-Deploy Smoke gruen: `npm run smoke:public`, `/anmeldung` -> 200, `/aenderungen` -> 200, `/sportlerboerse-dashboard` -> 200, `/api/teams` ohne Session -> 401.
- Groessere Spaeter-Punkte bleiben: Glossar/Regelwerk fuer Rollen-/UI-Semantik, zentraler Audit-Helper, optional Team-Startnummern-UI/Doku.

## Aktueller Nachtrag: Team-Edit direkt bis Anmeldeschluss

- Ausloeser:
  - Sebastian stellte klar: Bis zum Anmeldeschluss sind Aenderungen in der Mannschaft nicht genehmigungspflichtig.
- CR:
  - `docs/cr/2026-07-14-team-edit-direct-until-registration-deadline.md`
- Implementiert und produktiv deployed:
  - Commit: `41ad486 Allow direct team edits before deadline`
  - Production Deploy: `dpl_3HxpsrUmpz1ajiC7E6qMFf77R6fx`
  - Deployment URL: `https://s5-evo-portal-5et0yhr1x-sebastiankroeker-2781s-projects.vercel.app`
  - Alias: `https://portal.s5evo.de`
  - `app/api/teams/[id]/route.ts`
  - `lib/registration-deadline.ts`
- Geaendert:
  - Team-Owner/Manager mit bestehender Team-Edit-Berechtigung speichern gueltige komplette Mannschaftsaenderungen vor `registrationDeadline` direkt.
  - Dazu zaehlen Teamname, Teilnehmer-Identitaet, Geburtsdaten, Geschlecht, Disziplin, T-Shirt, E-Mail, Moderationshinweis und Veroeffentlichung, solange die bestehende Teamvalidierung erfolgreich ist.
  - Nach `registrationDeadline` bleibt der bestehende Pending-Change-/Genehmigungsfluss fuer Nicht-Admins aktiv.
  - Admins bleiben unveraendert direkt.
  - Bestehende offene Antraege, die durch einen direkten Vor-Deadline-Save ueberholt werden, werden wie beim Admin-Direktpfad abgelehnt, aber mit Self-Service-Fristgrund.
- Checks lokal gruen:
  - `npx eslint app/api/teams/[id]/route.ts lib/registration-deadline.ts`
  - `npx tsx -e` Deadline-Assertions fuer offen/abgelaufen/fehlende Deadline
  - `npx tsc --noEmit`
  - `npm run verify:team-draft`
  - `git diff --check`
- Post-Deploy Smoke:
  - `npm run smoke:public` gegen `https://portal.s5evo.de` gruen
  - `GET /` -> 200
  - `GET /login` -> 200
  - `GET /anmeldung` -> 200
  - `GET /aenderungen` -> 200
  - `GET /sportlerboerse-dashboard` -> 200
  - `GET /api/competition` -> 200
  - `GET /api/results` -> 200
  - `GET /api/teams` ohne Session -> 401
  - `GET /api/admin/pending-changes` ohne Session -> 401
- Naechster Schritt:
  - Authenticated Smoke mit Team-Owner/Manager-Session: vor Anmeldeschluss Mannschaft editieren und pruefen, dass kein PendingChange entsteht.

## Aktueller Nachtrag: MTC Owner Offline Visibility Hotfix

- Ausloeser:
  - Markus Huber meldete, dass er fertige MTC-Teams nicht in echte Anmeldungen umwandeln kann.
- Prod-Daten read-only:
  - `Huber Cars, Team 1`: `MARKETPLACE`, `MATCHING`, 5/5 Teilnehmer, vollstaendige Disziplinen, keine Blocking Errors.
  - `Huber Cars, Team 3`: `MARKETPLACE`, `MATCHING`, 5/5 Teilnehmer, vollstaendige Disziplinen, keine Blocking Errors.
  - `Huber Cars, Team 2`: 4/5 Teilnehmer, nicht finalisierbar.
  - Markus hat aktiven Portal-Login und ist Owner der MTCs.
  - Aktiver Wettkampf: `marketplaceGlobalVisibility = OFFLINE`.
- Ursache:
  - `canViewerSeeMarketplaceTeam()` gab fuer globale `OFFLINE`-Sichtbarkeit bei Nicht-Admins sofort `false` zurueck.
  - Dadurch wurden eigene MTC-Teams aus `/api/teams` und `/api/teams/[id]` ausgefiltert, bevor Owner-Sichtbarkeit greifen konnte.
- CR:
  - `docs/cr/2026-07-14-mtc-owner-offline-visibility-hotfix.md`
- Implementiert und produktiv deployed:
  - Commit: `175835b Allow MTC owners to view offline drafts`
  - Production Deploy: `dpl_GACfAtJPip3eRjTpxqWnpv54WdBX`
  - Deployment URL: `https://s5-evo-portal-2xxnpdmkw-sebastiankroeker-2781s-projects.vercel.app`
  - Alias: `https://portal.s5evo.de`
  - `lib/marketplace-visibility.ts`
  - `app/api/teams/route.ts`
  - `app/api/teams/[id]/route.ts`
- Geaendert:
  - `ownsMarketplaceTeam` wird vor dem globalen `OFFLINE`-Block erlaubt.
  - Teamliste und Teamdetail werten explizit `team.ownerId === currentUser.id` als eigene Marketplace-/MTC-Sichtbarkeit.
  - Nicht-Owner ohne Privilegien sehen fremde Marketplace-Teams bei global `OFFLINE` weiterhin nicht.
- Checks lokal gruen:
  - `npx eslint lib/marketplace-visibility.ts app/api/teams/route.ts app/api/teams/[id]/route.ts`
  - `npx tsc --noEmit`
  - `git diff --check`
  - gezielte `npx tsx` Sichtbarkeits-Assertions
  - read-only Markus-Datencheck: Team 1 und Team 3 waeren nach Fix sichtbar/finalisierbar, Team 2 sichtbar aber wegen 4/5 nicht finalisierbar.
- Post-Deploy Smoke:
  - `npm run smoke:public` gegen `https://portal.s5evo.de` gruen
  - `GET /` -> 200
  - `GET /login` -> 200
  - `GET /anmeldung` -> 200
  - `GET /aenderungen` -> 200
  - `GET /sportlerboerse-dashboard` -> 200
  - `GET /api/competition` -> 200
  - `GET /api/results` -> 200
  - `GET /api/teams` ohne Session -> 401
  - `GET /api/admin/pending-changes` ohne Session -> 401
- Naechster Schritt:
  - Authenticated Smoke: Markus reload, `Huber Cars, Team 1` oder `Team 3` uebernehmen.

## Aktueller Nachtrag: Persoenliche Thread-Statusupdates und mobile Messenger-Kosmetik

- Ausloeser:
  - Sebastian zeigte mobile Messenger-Screenshots nach der E-Mail-Anzeige in Kontaktlabels.
  - Gewuenscht: persoenliche Nachrichten sollen ebenfalls geschlossen werden koennen.
- CR-Kontext:
  - Nachtrag im Messenger-Kanal-/Kontaktanzeigen-Kontext: `docs/cr/2026-07-13-message-channel-clarity-compact-ui.md`
- Implementiert und produktiv deployed:
  - Commit: `186b01d Allow personal message status updates`
  - Production Deploy: `dpl_8FtFkpKUwDv7ncxFTXyzaND31MNM`
  - Deployment URL: `https://s5-evo-portal-dacwasdce-sebastiankroeker-2781s-projects.vercel.app`
  - Alias: `https://portal.s5evo.de`
  - `app/components/message-center.tsx`
  - `app/api/messages/conversations/[id]/route.ts`
- Geaendert:
  - Persoenliche Threads koennen jetzt geschlossen und wieder geoeffnet werden.
  - Berechtigung: Orga/Admin wie bisher, zusaetzlich aktive `OWNER`/`MEMBER` des persoenlichen Threads.
  - `READ_ONLY` und reine Admin-/Moderator-Teilnahme ohne Support-Recht duerfen nicht schliessen.
  - Mobile Thread-Header: Kontakt-Badge mit Name/E-Mail liegt auf kleinen Screens in einer eigenen Zeile.
  - Mobile Thread-Karten: Status/Richtung/Person, Kontakt+Datum und Betreff sind entzerrt.
- Checks lokal gruen:
  - `npx eslint app/components/message-center.tsx app/api/messages/conversations/[id]/route.ts`
  - `npx tsc --noEmit`
  - `git diff --check`
- Post-Deploy Smoke:
  - `GET /` -> 200
  - `GET /nachrichten` -> 200
  - `GET /sportlerboerse-dashboard` -> 200
  - `npm run smoke:public` -> gruen
  - `GET /api/messages/conversations` ohne Session -> 401
  - `GET /api/messages/admin-targets` ohne Session -> 401
  - `GET /api/messages/admin-conversations` -> 405 erwartbar, Route ist POST-only
  - `POST /api/messages/admin-conversations` ohne Session -> 401

## Aktueller Nachtrag: Contact Email Visibility

- Ausloeser:
  - Screenshot aus Prod zeigte im Orga-Thread `Namens Aenderung` fuer `schusterkat78@gmail.com` nur Anzeigename `Schuster`.
  - Sebastian bestaetigte: Claim-Links bei gleicher E-Mail fuer unterschiedliche User sollen erhalten bleiben.
- CR-Kontext:
  - Nachtrag in `docs/cr/2026-07-13-message-channel-clarity-compact-ui.md`
- Implementiert und produktiv deployed:
  - Commit: `1a74c7e Show email in message contact labels`
  - Production Deploy: `dpl_8HD7Qp23xpf24kx6xnQP37khwiSp`
  - Deployment URL: `https://s5-evo-portal-kemkvbs7g-sebastiankroeker-2781s-projects.vercel.app`
  - Doku-Nachtrag: `31bd8c3 Document contact email visibility deploy`
  - Folge-Deploy Ready: `dpl_5RqdtVXkFnAFT5jymEa35SyMY4v5`
- Geaendert:
  - Messenger-Kontaktlabels zeigen echte User-Kontakte als `Name · E-Mail` in Threadliste, Threadkopf, Kontakt-Badge und Message-Senderzeile.
  - `Orga-Team` bleibt bewusst Mailbox-Label ohne persoenliche E-Mail.
  - Keine Aenderung an Claim-Link-Logik bei gleicher E-Mail.
- Post-Deploy Smoke:
  - `GET /` -> 200
  - `GET /nachrichten` -> 200
  - `GET /sportlerboerse-dashboard` -> 200
  - `npm run smoke:public` -> gruen
  - Message-APIs ohne Session -> erwartete Auth-/Methodenantworten.

## Aktueller Nachtrag: Messenger Kanal-Klarheit und persoenliche Admin-Threads

- Ausloeser:
  - Sebastian entschied: `Persoenlich = persoenlich`.
  - Zielpersonensuche soll neben Anzeigenamen auch E-Mail anzeigen.
  - Persoenlicher Compose soll ohne sichtbares Kontext-Feld auskommen; Betreff reicht.
- CR:
  - `docs/cr/2026-07-13-message-channel-clarity-compact-ui.md`
- Implementiert und produktiv deployed:
  - Commit: `90c9619 Clarify personal message channels`
  - Production Deploy: `dpl_6x3eJszRccjTkQzF3k8qbc8FdDpF`
  - Deployment URL: `https://s5-evo-portal-ifgomehp4-sebastiankroeker-2781s-projects.vercel.app`
  - Alias: `https://portal.s5evo.de`
  - `app/components/message-center.tsx`
  - `app/api/messages/admin-targets/route.ts`
  - `app/api/messages/admin-conversations/route.ts`
  - `app/api/messages/conversations/route.ts`
  - `app/api/messages/conversations/[id]/messages/route.ts`
  - `lib/messaging.ts`
- Geaendert:
  - Admin-Target-API liefert und durchsucht `email`.
  - Zielpersonensuche und Kontakt-/Portal-Badges zeigen Name plus E-Mail.
  - Admins starten im Tab `Persoenlich` eine echte 1:1-Nachricht an eine registrierte Zielperson; im Tab `Orga-Team` weiter eine Gruppenpostfach-Nachricht.
  - Persoenliche Admin-Threads enthalten nur Zielperson (`OWNER`) und absendenden Admin (`MEMBER`), keine Admin-/Moderator-Gruppe.
  - Orga-Postfach-Liste und Admin-Fallback-Zugriff beschraenken sich auf Threads mit aktiven `ADMIN`/`MODERATOR`-Teilnehmern.
  - Replies koennen `senderDisplayMode=ORG` nur noch in Orga-Threads nutzen; persoenliche Threads bleiben persoenlich.
  - Thread-Header und Reply-Bereich zeigen explizit `Kanal: Orga-Team/Persoenlich` und `Antwortet als ...`.
  - Sichtbares Kontext-Feld im User-Composer entfernt; API nutzt weiter den ersten erlaubten Kontext als Default.
- Checks lokal gruen:
  - `npx tsc --noEmit`
  - `npx eslint app/components/message-center.tsx app/api/messages/admin-targets/route.ts app/api/messages/admin-conversations/route.ts app/api/messages/conversations/route.ts app/api/messages/conversations/[id]/messages/route.ts lib/messaging.ts`
  - `git diff --check`
  - `npm run build`
- Post-Deploy Smoke:
  - `npm run smoke:public` gegen `https://portal.s5evo.de` gruen
  - `GET /` -> 200
  - `GET /nachrichten` -> 200
  - `GET /sportlerboerse-dashboard` -> 200
  - `GET /api/messages/conversations` ohne Session -> 401
  - `GET /api/messages/admin-targets` ohne Session -> 401
  - `POST /api/messages/admin-conversations` ohne Session -> 401
- Naechster Schritt:
  - Optional Browser-Real-Smoke mit Admin-Login: persoenlich an User schreiben, Orga-Team an User schreiben, Empfaengeransicht Kanal pruefen.

## Aktueller Nachtrag: MTC Owner Finalisierung

- Ausloeser:
  - Sebastian gab Go fuer die Funktion, dass Owner vollstaendige MTC-Mannschaften selbst in regulaere Mannschaften ueberfuehren koennen.
  - Markus Huber ist der akute Praxisfall; wichtig war die Unterscheidung zwischen MTC-Owner-Vorzustand und regulaeren Teamchef-/Teammanager-Rechten.
- CR:
  - `docs/cr/2026-07-13-mtc-owner-finalize.md`
- Implementiert und produktiv deployed:
  - Commit: `85fd757 Allow MTC owners to finalize teams`
  - Production Deploy: `dpl_5hkMD2RqyPZsUT3k5QprqCQiFxKG`
  - Deployment URL: `https://s5-evo-portal-a0rh7smxt-sebastiankroeker-2781s-projects.vercel.app`
  - Alias: `https://portal.s5evo.de`
  - `app/api/admin/marketplace-matching/route.ts`
  - `app/api/teams/route.ts`
  - `app/api/teams/[id]/route.ts`
  - `app/components/dashboard.tsx`
  - `app/api/admin/users/route.ts`
  - `app/components/user-management.tsx`
- Geaendert:
  - `POST /api/admin/marketplace-matching` erlaubt Aktion `finalize` jetzt fuer Admins oder den eingeloggten Owner des Ziel-MTCs mit bestaetigtem Portal-Login.
  - Alle Nicht-Finalize-Matching-Aktionen und `GET /api/admin/marketplace-matching` bleiben Admin-only.
  - Beim Finalisieren wird fuer `targetTeam.ownerId` eine aktive `TEAM_MANAGER`-Rolle angelegt/reaktiviert und danach `syncDerivedTeamchefRole` ausgefuehrt.
  - Eigene MTCs werden im Team-Dashboard auch ueber `ownerId` geladen, ohne allgemeine Edit-Rechte zu vergeben.
  - Owner sehen fuer eigene vollstaendige MTCs den Uebernehmen-Dialog; Admin-Slotverwaltung, Suche und Entwurf-Metadaten bleiben ausgeblendet.
  - Benutzerverwaltung unterscheidet MTC-Owner ohne regulaere Teamrechte als `MTC-Owner` statt `Team Manager:in`.
- Checks lokal gruen:
  - `pnpm exec eslint app/api/admin/marketplace-matching/route.ts app/components/dashboard.tsx app/api/admin/users/route.ts app/components/user-management.tsx app/api/teams/route.ts app/api/teams/[id]/route.ts`
  - `npx tsc --noEmit`
  - `npm run verify:team-draft`
  - `npm run verify:account-link-status`
  - `git diff --check`
  - `npm run build`
- Post-Deploy Smoke:
  - `https://portal.s5evo.de/`: 200
  - `https://portal.s5evo.de/sportlerboerse-dashboard`: 200
  - `npm run smoke:public`: gruen
  - `GET /api/teams` ohne Session: 401
  - `GET /api/admin/marketplace-matching` ohne Session: 401
- Naechster sinnvoller Real-Smoke:
  - Mit Markus-Huber-Login oder Admin-Simulation pruefen, dass eigene vollstaendige MTC den Uebernehmen-Dialog zeigt und nach Finalisierung als regulaere Mannschaft mit Team-Manager-Recht erscheint.

## Aktueller Nachtrag: Message Admin Target Registered Search

- Ausloeser:
  - Sebastian meldete anhand mobiler Screenshots:
    - Admin-Empfaengerauswahl soll auf registrierte Benutzer eingeschraenkt werden.
    - In der Empfaengerauswahl soll ein Suchfeld angeboten werden.
- CR:
  - `docs/cr/2026-07-13-message-admin-target-registered-search.md`
- Implementiert und produktiv deployed:
  - Commit: `6fd5d4c Restrict admin message targets to registered users`
  - Production Deploy: `dpl_H15TXMsk2xEqRcvZfkKG2WaXBJGY`
  - Deployment URL: `https://s5-evo-portal-8l3bezq9d-sebastiankroeker-2781s-projects.vercel.app`
  - Spaeter durch `90c9619`, `1a74c7e` und `186b01d` im Messenger-Kontext erweitert/ueberbaut.
  - `app/api/messages/admin-targets/route.ts`
  - `app/api/messages/admin-conversations/route.ts`
  - `app/components/message-center.tsx`
- Geaendert:
  - `GET /api/messages/admin-targets` liefert nur noch User mit `authentikSub` und dedupliziert auf eine Zielperson pro User.
  - Mehrere Rollen/Team-/Teilnehmer-Kontexte werden zu einer kurzen Beschreibung verdichtet, statt mehrere Auswahlzeilen zu erzeugen.
  - Suchtext beruecksichtigt Name und Rollen-/Verknuepfungsbeschreibung; Team-/Teilnehmernamen werden in dieser Zielauswahl nicht ausgeliefert.
  - Der Admin-Composer nutzt jetzt ein Suchfeld plus scrollbare Trefferliste statt nativem Select.
  - `POST /api/messages/admin-conversations` lehnt unregistrierte Zieluser serverseitig mit `403` ab.
  - Urspruenglich keine E-Mail-Adressen in der Zielauswahl; spaeter durch Kanal-Klarheit/Contact-Visibility bewusst auf Name plus E-Mail erweitert.
  - Keine DB-Migration.
- Checks lokal gruen:
  - `pnpm exec eslint app/components/message-center.tsx app/api/messages/admin-targets/route.ts app/api/messages/admin-conversations/route.ts`
  - `npx tsc --noEmit`
  - `git diff --check`
  - `npm run build`
- Post-Deploy Smoke:
  - `GET /` -> 200
  - `GET /nachrichten` -> 200
  - `npm run smoke:public` -> gruen
  - `GET /api/messages/admin-targets` ohne Session -> 401
  - `GET /api/messages/conversations` ohne Session -> 401
  - `POST /api/messages/admin-conversations` ohne Session -> 401
- Naechster Schritt:
  - Kein Deploy offen; durch spaetere Messenger-Deploys produktiv enthalten.

## Aktueller Nachtrag: Message Admin Free Targets And Reopen

- Ausloeser:
  - Sebastian ergaenzte:
    - Admins sollen selbst einen Thread mit beliebigen Empfaengern aus den verknuepften Usern erstellen koennen.
    - Wenn eine Meldung geschlossen ist, sollen beide Adressaten dennoch antworten koennen.
    - Eine Antwort auf eine geschlossene Meldung soll den Thread automatisch wieder auf offen setzen.
- CR:
  - `docs/cr/2026-07-13-message-admin-free-targets-and-reopen.md`
- Implementiert und produktiv deployed:
  - Commits:
    - `2f2754e Add message compose popups and drafts`
    - `92c16d1 Add admin message targets and reopen replies`
  - Production Deploy: `dpl_EUkVf6NsqXbpb1qwbFzPV9F2wey9`
  - Deployment URL: `https://s5-evo-portal-hasgiaj0p-sebastiankroeker-2781s-projects.vercel.app`
  - Alias: `https://portal.s5evo.de`
  - `app/api/messages/admin-targets/route.ts`
  - `app/api/messages/conversations/[id]/messages/route.ts`
  - `app/components/message-center.tsx`
- Geaendert:
  - Neue API `GET /api/messages/admin-targets` fuer Admin-/Moderator-Zielauswahl.
  - Zielauswahl sammelt verknuepfte User aus Tenant-Rollen, verknuepften Teilnehmer:innen, Teamkontakten, Teamchef:innen und Team-Manager:innen.
  - API gibt keine E-Mail-Adressen zurueck.
  - Orga-Postfach Header-Send-Button oeffnet jetzt freie Empfaengerauswahl; der Kontakt des aktiven Threads bleibt Vorauswahl.
  - Admin-Composer nutzt einen nativen Select fuer mobile Robustheit.
  - Antworten auf geschlossene Threads werden fuer Teilnehmer:innen nicht mehr mit `409` geblockt.
  - Jede Antwort setzt den Thread weiterhin auf `WAITING_FOR_ADMIN` oder `WAITING_FOR_USER` und entfernt `closedAt`/`closedById`.
- Checks lokal gruen:
  - `pnpm exec eslint app/components/message-center.tsx app/api/messages/admin-targets/route.ts app/api/messages/conversations/[id]/messages/route.ts`
  - `npx tsc --noEmit`
  - `git diff --check`
  - `npm run build`
- Post-Deploy Smoke:
  - `https://portal.s5evo.de`: 200
  - `https://portal.s5evo.de/nachrichten`: 200
  - `npm run smoke:public`: gruen
  - `GET /api/messages/conversations` ohne Session: 401
  - `POST /api/messages/admin-conversations` ohne Session: 401
  - `GET /api/messages/admin-targets` ohne Session: 401
- Naechster sinnvoller Real-Smoke:
  - Als Admin `/nachrichten` oeffnen, Orga-Send-Icon pruefen und einen verknuepften User auswaehlen.
  - Geschlossenen Thread als Teilnehmer:in und Admin beantworten und Reopen pruefen.

## Aktueller Nachtrag: Message Compose Popup Drafts

- Ausloeser:
  - Sebastian meldete:
    - Im Orga-Postfach ist der Button zum Mail verfassen verloren gegangen.
    - Auch im persoenlichen Postfach soll `Neue Nachricht` als Popup erscheinen.
    - Geschriebene Nachrichten sollen gemerkt werden, wenn man zwischenzeitlich woanders hin navigiert.
    - Loesung soll ressourcenschonend bleiben.
- CR:
  - `docs/cr/2026-07-13-message-compose-popup-drafts.md`
- Implementiert und produktiv deployed:
  - Commit: `2f2754e Add message compose popups and drafts`
  - Production Deploy: `dpl_EUkVf6NsqXbpb1qwbFzPV9F2wey9`
  - Deployment URL: `https://s5-evo-portal-hasgiaj0p-sebastiankroeker-2781s-projects.vercel.app`
  - Alias: `https://portal.s5evo.de`
  - `app/components/message-center.tsx`
- Geaendert:
  - Persoenlicher Composer rendert jetzt als Dialog/Popup statt als Karte am Seitenende.
  - Admin-Composer rendert ebenfalls als Dialog/Popup.
  - Header-Send-Button in `Mein Postfach` oeffnet den Orga-Composer direkt.
  - Header-Send-Button in `Orga-Team` ist wieder vorhanden, wenn ein fachlicher Kontakt aus dem aktiv selektierten Thread ableitbar ist.
  - Orga-Button erstellt einen Admin-Compose fuer den Kontakt des aktiven Threads; keine freie Empfaengersuche.
  - Persoenliche Drafts werden clientseitig in `localStorage` unter `s5evo.messages.composeDraft.v1` gespeichert.
  - Admin-Drafts werden clientseitig pro Zielperson/Kontext unter `s5evo.messages.adminComposeDrafts.v1` gespeichert.
  - `Abbrechen` schliesst nur das Popup; erfolgreicher Versand loescht den passenden lokalen Entwurf.
  - Keine API-/DB-Aenderung; keine zusaetzliche Serverlast.
- Checks lokal gruen:
  - `pnpm exec eslint app/components/message-center.tsx`
  - `npx tsc --noEmit`
  - `git diff --check`
  - `npm run build`
- Post-Deploy Smoke:
  - `https://portal.s5evo.de`: 200
  - `https://portal.s5evo.de/nachrichten`: 200
  - `npm run smoke:public`: gruen
  - `GET /api/messages/conversations` ohne Session: 401
  - `POST /api/messages/admin-conversations` ohne Session: 401
  - `GET /api/messages/admin-targets` ohne Session: 401

## Aktueller Nachtrag: Message Status Multi Filter Persistence

- Ausloeser:
  - Sebastian zeigte die mobile Messenger-Filteransicht.
  - Gewuenscht:
    - Status im Filter-Panel kombinierbar filterbar anbieten.
    - Status `geschlossen` default ausblenden.
    - Filter merken, wenn man weg navigiert und zurueckkommt.
    - Loesung soll ressourcenschonend bleiben.
- CR:
  - `docs/cr/2026-07-12-message-status-multi-filter.md`
- Implementiert und produktiv deployed:
  - Commit: `01c4478 Add persisted message status filters`
  - Production Deploy: `dpl_DuGJ5sQrFNvL8j5EGhLFLGZwdW8o`
  - Deployment URL: `https://s5-evo-portal-7b8xdpi26-sebastiankroeker-2781s-projects.vercel.app`
  - Alias: `https://portal.s5evo.de`
  - `app/components/message-center.tsx`
- Geaendert:
  - Statusfilter ist jetzt eine kombinierbare Mehrfachauswahl.
  - Default sichtbare Status: `OPEN`, `WAITING_FOR_ADMIN`, `WAITING_FOR_USER`; `CLOSED` muss bewusst aktiviert werden.
  - Filter-Reset stellt genau diesen Default wieder her.
  - Suche, Statusfilter, Ungelesen-Schalter, Sortierfeld und Sortierrichtung werden clientseitig in `localStorage` pro Postfachmodus gespeichert.
  - Keine API-/DB-Aenderung; Filterung bleibt clientseitig auf den bereits geladenen Threads.
- Checks lokal gruen:
  - `pnpm exec eslint app/components/message-center.tsx`
  - `npx tsc --noEmit`
  - `git diff --check`
  - `npm run build`
- Post-Deploy Smoke:
  - `https://portal.s5evo.de`: 200
  - `https://portal.s5evo.de/nachrichten`: 200
  - `npm run smoke:public`: gruen
  - `GET /api/messages/conversations` ohne Session: 401
  - `POST /api/messages/admin-conversations` ohne Session: 401

## Aktueller Nachtrag: Message Theme Sparkle And Portal Badges

- Ausloeser:
  - Sebastian wollte den Sparkle-Effekt ueber den Theme-Switcher aktivieren und dann fuer das aktuelle Theme verwenden.
  - Im Posteingang sollen gelesene Antworten den Betreff nicht fett zeigen.
  - Der auffaellige `wartet auf Antwort`-Badge soll raus.
  - Portal-Badge des Adressaten soll auch in der Uebersicht sichtbar sein.
  - Forward-Navigation aus dem Portal-Badge in Mail/Header und Uebersicht zum User-Dashboard soll funktionieren.
- CR:
  - `docs/cr/2026-07-12-message-theme-sparkle-and-portal-badges.md`
- Implementiert und produktiv deployed:
  - Commit: `ed0e8e7 Gate message sparkle and add portal badges`
  - Production Deploy: `dpl_8bPskBCMk4kJeoyGNCHqx11wYCvz`
  - Deployment URL: `https://s5-evo-portal-2wu5bcdfn-sebastiankroeker-2781s-projects.vercel.app`
  - Alias: `https://portal.s5evo.de`
  - `lib/theme-context.tsx`
  - `app/components/nav-bar.tsx`
  - `app/components/sidebar.tsx`
  - `app/components/command-pill.tsx`
  - `app/components/message-center.tsx`
- Geaendert:
  - Theme-Context speichert Sparkle als lokalen Effekt pro Theme (`s5evo-theme-effects`).
  - Navbar, Sidebar und Command-Menue zeigen einen Sparkle-Schalter am Theme-Bereich.
  - Message-Center zeigt Sparkle-Bursts nur noch, wenn Sparkle fuer das aktive Theme eingeschaltet ist.
  - Gelesene Threads zeigen den Betreff normalgewichtig; ungelesene bleiben betont.
  - `WAITING_FOR_USER` rendert im sichtbaren Status-Badge neutral als `offen`.
  - Sender/Empfaenger-Spalte zeigt einen Portal-/Orga-Badge.
  - Portal-Badge-Dialog in Uebersicht, Thread-Header und Admin-Compose kann ohne sichtbare E-Mail-/Team-Kontextdaten ins User-Dashboard navigieren.
- Checks lokal gruen:
  - `pnpm exec eslint app/components/message-center.tsx app/components/nav-bar.tsx app/components/sidebar.tsx app/components/command-pill.tsx lib/theme-context.tsx`
  - `npx tsc --noEmit`
  - `git diff --check`
  - `npm run build`
- Post-Deploy Smoke:
  - `https://portal.s5evo.de`: 200
  - `https://portal.s5evo.de/nachrichten`: 200
  - `npm run smoke:public` gruen
  - `GET /api/messages/conversations` ohne Session: 401
  - `POST /api/messages/admin-conversations` ohne Session: 401
- Naechster sinnvoller Real-Smoke:
  - Als Admin `/nachrichten` hart aktualisieren, Sparkle im Theme-Schalter aktivieren und Postfach-/Thread-/Composer-Navigation pruefen.
  - Portal-Badge in Uebersicht und Thread-Header oeffnen und User-Dashboard-Forward testen.

## Aktueller Nachtrag: Message Center Nested Controls And Sparkle Navigation

- Ausloeser:
  - Sebastian zeigte die mobile Messenger-Ansicht.
  - Gewuenscht:
    - obere Nachrichtenbox um ca. zwei Drittel in der Hoehe reduzieren.
    - Suche/Layout-Steuerung aus der separaten Box in die Threadlisten-Box verschachteln.
    - erste Zeile der Threadlisten-Box als `Orga-Team 3 Threads` bzw. `Mein Postfach 3 Threads`.
    - einfacher visueller Glitzer-/Konfetti-Hinweis fuer Bildschirmaufnahmen, wo eine Navigation gelandet ist.
- CR:
  - `docs/cr/2026-07-12-message-center-nested-controls-sparkle-navigation.md`
- Implementiert und produktiv deployed:
  - Commit: `66a3dc2 Nest message controls and add navigation sparkle`
  - Production Deploy: `dpl_8bPskBCMk4kJeoyGNCHqx11wYCvz`
  - Deployment URL: `https://s5-evo-portal-2wu5bcdfn-sebastiankroeker-2781s-projects.vercel.app`
  - Alias: `https://portal.s5evo.de`
  - `app/components/message-center.tsx`
- Geaendert:
  - obere Messenger-Box ist jetzt eine kompakte Titel-/Switch-Zeile.
  - Suche, Statuschips, Aktualisieren, Filter und Spalten-/Sortieroptionen sind in den Header der Threadlisten-Card verschoben.
  - Suchplaceholder nennt keine Teamdaten mehr.
  - Threadlisten-Titel kombiniert Postfachname und Threadanzahl in einer Zeile.
  - `NavigationSparkleBurst` zeigt kurz einen lokalen, pointer-events-freien Sparkle-Hinweis bei Postfachwechsel, Threadnavigation und Composer-Navigation.
- Checks lokal gruen:
  - `pnpm exec eslint app/components/message-center.tsx`
  - `npx tsc --noEmit`
  - `git diff --check`
  - `npm run build`
- Post-Deploy Smoke:
  - `https://portal.s5evo.de`: 200
  - `https://portal.s5evo.de/nachrichten`: 200
  - `npm run smoke:public` gruen
  - `GET /api/messages/conversations` ohne Session: 401
  - `POST /api/messages/admin-conversations` ohne Session: 401

## Aktueller Nachtrag: Message Email Dialog Excerpt

- Ausloeser:
  - Sebastian zeigte eine mobile E-Mail-Benachrichtigung, die nur auf eine neue Portal-Nachricht verweist.
  - Gewuenscht: E-Mail an Teilnehmer soll direkt die aktuelle Antwort plus den vorherigen Dialog enthalten.
  - Mobile Mailclients sollen ordentlich aussehen; Desktop ebenso.
- CR:
  - `docs/cr/2026-07-12-message-email-dialog-excerpt.md`
- Implementiert und produktiv deployed:
  - Commit: `be72207 Include message dialog excerpt in email`
  - Production Deploy: `dpl_4pAHNYPrrqbySPYsBwJwpPBEHbRs`
  - Deployment URL: `https://s5-evo-portal-6wjx49uaf-sebastiankroeker-2781s-projects.vercel.app`
  - Alias: `https://portal.s5evo.de`
  - `lib/mail/message-notification.ts`
  - `app/api/messages/conversations/route.ts`
  - `app/api/messages/conversations/[id]/messages/route.ts`
  - `app/api/messages/admin-conversations/route.ts`
- Geaendert:
  - Message-Mailtemplate zeigt jetzt eine kompakte S5Evo-Karte mit Thread, Absenderlabel, aktueller Antwort und bisherigem Dialog.
  - Dialogauszug ist auf die letzten acht Thread-Nachrichten begrenzt.
  - Die aktuelle Antwort steht nur einmal prominent oben; vorherige Nachrichten stehen unter `Bisheriger Dialog`.
  - Keine Teamdaten, Empfaenger-E-Mail, Teilnehmer-E-Mail oder interne Kontextdaten im Mailbody.
  - Anzeige-Fallbacks vermeiden E-Mail-Adressen (`Teilnehmer`, `Kontakt`, `Orga-Team`).
  - Plain-Text-Fallback enthaelt dieselbe Antwort-/Dialogstruktur.
- Checks lokal gruen:
  - `pnpm exec eslint lib/mail/message-notification.ts app/api/messages/conversations/route.ts app/api/messages/conversations/[id]/messages/route.ts app/api/messages/admin-conversations/route.ts`
  - `npx tsc --noEmit`
  - `git diff --check`
  - `npm run build`
- Post-Deploy Smoke:
  - `https://portal.s5evo.de`: 200
  - `https://portal.s5evo.de/nachrichten`: 200
- Naechster sinnvoller Real-Smoke:
  - Eine echte Antwort in einem Teilnehmer-Thread senden und die empfangene E-Mail auf Mobile/Desktop pruefen: aktuelle Antwort oben, vorheriger Dialog darunter, keine E-Mail-/Team-Kontextdaten im Mailbody.

## Aktueller Nachtrag: Message Detail Chat Refresh

- Ausloeser:
  - Sebastian gab Go fuer den empfohlenen Manager-Perspektive-Refresh der Nachrichten-Detailansicht.
  - Ziel: Detail-Ebene deutlich mehr wie moderner Chat statt Portal-Formular.
- CR:
  - `docs/cr/2026-07-12-message-detail-chat-refresh.md`
- Implementiert und produktiv deployed:
  - Commits:
    - `c4e6edf Refresh message detail chat UI`
    - `ff33a5f Polish message mobile thread controls`
  - Production Deploy: `dpl_564U12qyHP4HxJuRLAXjo9LNaxaL`
  - `app/components/message-center.tsx`
- Geaendert:
  - Thread-Detailansicht nutzt jetzt einen kompakten sticky Chat-Header.
  - Vollstaendige Metadaten sind ueber einen Details-Toggle einklappbar.
  - Nachrichtenverlauf scrollt separat zwischen Header und Composer.
  - Antwort-Composer bleibt unten sticky.
  - Gesendete/ausgehende Nachrichten zeigen privacy-schonend `Gelesen` plus Zeitpunkt, wenn ein Gegenueber gelesen hat.
  - Header-Fallback fuer Kontakte vermeidet E-Mail-Anzeige und nutzt `Kontakt`.
  - Nach mobilem Screenshot-Feedback:
    - Mobile Thread-Details blenden die obere Nachrichten-Landingbox und Such-/Filterleiste aus.
    - Admin-/Persoenlich-Umschalter sitzt nur noch in der obersten Nachrichtenbox.
    - Einzelne Threads/Antworten bieten keine Sender-Umschaltung mehr; Admin-Postfach antwortet als `Orga-Team`, persoenliches Postfach als `Persoenlich`.
- Checks lokal gruen:
  - `pnpm exec eslint app/components/message-center.tsx`
  - `npx tsc --noEmit`
  - `git diff --check`
  - `npm run build`
- Post-Deploy Smoke:
  - `GET /` -> 200
  - `GET /nachrichten` -> 200
- Naechster Schritt:
  - Kein Deploy offen; Real-Smoke bleibt im zusammengefuehrten Messenger-Smoke oben.

## Aktueller Nachtrag: Message List Compact Columns

- Ausloeser:
  - Sebastian wollte die Zeile im Messenger-Eingang deutlich kompakter.
  - Gewuenschte Metadaten-Reihenfolge: Status, Badge gesendet/empfangen, Empfaenger oder Sender, Betreff, Datum & Uhrzeit.
  - Dieselbe Metadatenlogik sollte im Mail-/Thread-Header beim Lesen und Schreiben sichtbar sein.
  - Desktop sollte eine konfigurierbare Listenanzeige mit Spaltenoptionen und Sortierung wie in der MD-Listanzeige bekommen.
- CR:
  - `docs/cr/2026-07-12-message-list-compact-columns.md`
- Implementiert und produktiv deployed:
  - Commit: `592240c Add compact configurable message list`
  - Production Deploy: `dpl_BPueAWdtDt4F7M6SvNy49WdL1P7A`
  - Deployment URL: `https://s5-evo-portal-kkqbi66jz-sebastiankroeker-2781s-projects.vercel.app`
  - Alias: `https://portal.s5evo.de`
- Geaendert:
  - Mobile Messenger-Uebersicht bleibt eine kompakte Thread-Zeilenliste zum Rein-Navigieren.
  - Desktop Messenger-Uebersicht nutzt eine kompakte spaltenbasierte Liste.
  - Spaltenauswahl, Reihenfolge und Sortierung sind lokal konfigurierbar und im Stil der MD-Listanzeige umgesetzt.
  - Standardspalten: Status, gesendet/empfangen, Sender/Empfaenger, Betreff, Datum & Uhrzeit.
  - Thread-/Read-Header und Compose-Header zeigen dieselbe kompakte Metadaten-Vokabularik.
- Checks:
  - `pnpm exec eslint app/components/message-center.tsx` gruen
  - `npx tsc --noEmit` gruen
  - `git diff --check` gruen
  - `npm run build` gruen
  - Remote Vercel Build/TypeScript gruen
  - `npm run smoke:public` gegen Production-Alias gruen
  - `/nachrichten`: 200
  - `GET /api/messages/conversations` ohne Session: 401
  - `POST /api/messages/admin-conversations` ohne Session: 401
- Naechster sinnvoller Real-Smoke:
  - Auf Mobile `/nachrichten` hart aktualisieren und pruefen, dass die Uebersicht als kompakte WhatsApp-aehnliche Zeilenliste navigiert.
  - Auf Desktop Spaltenoptionen/Sortierung in `Mein Postfach` testen und einen Thread plus neue Nachricht oeffnen.

## Aktueller Nachtrag: Message Compose Header Compact Follow-up

- Ausloeser:
  - Sebastian zeigte nach dem Deploy einen mobilen Screenshot der Schreiben-Ansicht.
  - Der Metadatenkopf in `Neue Nachricht an das Orga-Team` war noch zu hoch, weil der gemeinsame Meta-Strip mobil als einspaltige Detailkarte umbrechen konnte.
  - Unter `Kontext` erschien zusaetzlich eine Detail-Hilfszeile mit Kontextdaten.
- CR:
  - Nachtrag in `docs/cr/2026-07-12-message-list-compact-columns.md`
- Implementiert und produktiv deployed:
  - Commit: `9ba0822 Compact message compose metadata strip`
  - Production Deploy: `dpl_2twbbCY233s29Cwzn22c8sotkgd4`
  - `app/components/message-center.tsx`
- Geaendert:
  - `MessageMetaStrip` rendert jetzt als kompakte horizontale, wrap-faehige Metazeile.
  - Admin- und persoenliche Compose-Header haben weniger Padding/Spacing.
  - Die Kontext-Detail-Hilfszeile unter dem Kontext-Dropdown ist entfernt.
- Checks:
  - `pnpm exec eslint app/components/message-center.tsx` gruen
  - `npx tsc --noEmit` gruen
  - `git diff --check` gruen
  - `npm run build` gruen
- Post-Deploy Smoke:
  - `GET /` -> 200
  - `GET /nachrichten` -> 200
- Naechster Schritt:
  - Kein Deploy offen; in aktuellem Production-Stand enthalten.

## Aktueller Nachtrag: Message Orga Context Privacy Hotfix

- Ausloeser:
  - Sebastian meldete per Screenshot, dass der Orga-Team-Kontextdialog in `/nachrichten` zu freizuegig ist.
  - E-Mail und Team sollten in dieser Orga-Team-Kontextinfo ausgeblendet werden.
- CR:
  - `docs/cr/2026-07-12-message-org-context-privacy-hotfix.md`
- Implementiert und produktiv deployed:
  - Commit: `8e39f80 Hide org context sensitive message details`
  - Production Deploy: `dpl_FeS1MGBkRfmmFr7F2on6eoKqA7XJ`
  - Deployment URL: `https://s5-evo-portal-ewsk1ae6h-sebastiankroeker-2781s-projects.vercel.app`
  - Alias: `https://portal.s5evo.de`
- Geaendert:
  - Orga-Team-Kontextdialog blendet `E-Mail` und `Team` aus.
  - Normale Thread-Kontakte behalten ihre bisherigen Kontextzeilen.
  - API/DB blieben unveraendert; Hotfix betrifft nur die sichtbaren Dialogzeilen.
- Checks:
  - `pnpm exec eslint app/components/message-center.tsx` gruen
  - `npx tsc --noEmit` gruen
  - `git diff --check` gruen
  - `npm run build` gruen
  - `npm run smoke:public` gegen Production-Alias gruen
  - `/nachrichten`: 200
  - `GET /api/messages/conversations` ohne Session: 401
  - `POST /api/messages/admin-conversations` ohne Session: 401
- Naechster sinnvoller Real-Smoke:
  - Als Admin `/nachrichten` hart aktualisieren, Orga-Team-Thread oeffnen und den Header-Badge/Dialog pruefen: keine E-Mail, kein Team im Orga-Team-Kontext.

## Aktueller Nachtrag: Message Center Admin Mailbox UX

- Ausloeser:
  - Sebastian gab Go fuer die Empfehlung zum Messenger-CR:
    - Persoenliche Admin-Threads bleiben im persoenlichen Postfach nur bei `OWNER`/`MEMBER`.
    - Reine Orga-/Support-Beteiligung via `ADMIN`/`MODERATOR` gehoert ins Orga-Team-Postfach.
- CR:
  - `docs/cr/2026-07-12-message-center-admin-mailbox-ux.md`
- Implementiert und produktiv deployed:
  - Commit: `f30c648 Implement message center org mailbox UX`
  - Doku-Commit: dieser Handoff-/CR-Nachtrag (`Document message center org mailbox deploy [skip ci]`)
  - Production Deploy: `dpl_5N4fZ4jyHHUoy9qMaBLHqbHevNG9`
  - Deployment URL: `https://s5-evo-portal-3jxkp2607-sebastiankroeker-2781s-projects.vercel.app`
  - Alias: `https://portal.s5evo.de`
- Geaendert:
  - `/api/messages/conversations?mode=mine` liefert nur noch Threads, in denen der Viewer `OWNER` oder `MEMBER` ist.
  - Admins/Moderator:innen starten in `/nachrichten` standardmaessig im Orga-Team-Postfach.
  - Switch-Reihenfolge ist jetzt `Orga-Team` links, `Persoenlich` rechts.
  - `Admin-Team`-Copy wurde fuer Nachrichten auf `Orga-Team` umgestellt.
  - Header von `Mein Postfach` hat einen Icon-Button fuer neue Nachrichten; er nutzt das bestehende Compose-Formular.
  - Thread-Header zeigt einen Account-/Statusdialog-Badge fuer Zielkontakt oder Orga-Team-Kontext.
  - Read-/Reply-Upserts bewahren `OWNER`/`MEMBER`, wenn ein Admin selbst fachlicher Thread-Empfaenger ist; nur reine Support-Teilnahme wird als `ADMIN` gefuehrt.
- Checks:
  - `pnpm exec eslint app/components/message-center.tsx app/api/messages/conversations/route.ts app/api/messages/admin-conversations/route.ts app/api/messages/conversations/[id]/messages/route.ts app/api/messages/conversations/[id]/read/route.ts lib/messaging.ts` gruen
  - `npx tsc --noEmit` gruen
  - `git diff --check` gruen
  - `npm run build` gruen
  - `npm run smoke:public` gegen Production-Alias gruen
  - `/nachrichten`: 200
  - `GET /api/messages/conversations` ohne Session: 401
  - `POST /api/messages/admin-conversations` ohne Session: 401
- Naechster sinnvoller Real-Smoke:
  - Als Admin `/nachrichten` hart aktualisieren: Start im Orga-Team-Postfach, Orga-Team-Threads nicht mehr in `Persoenlich`.
  - In `Persoenlich` den Header-Button fuer neue Nachricht testen.
  - Einen Thread oeffnen und den Header-Badge/Dialog pruefen.

## Aktueller Nachtrag: Neuer Draft-CR Message Center Admin Mailbox UX

- Ausloeser:
  - Sebastian bestaetigte Teamname-Hotfix erfolgreich.
  - Neuer Messenger-CR mit Admin-/Orga-Postfach-UX:
    - Orga-Team-Nachrichten erscheinen aktuell im persoenlichen Bereich.
    - Neue Nachricht ist nur durch Scrollen nach unten erreichbar.
    - Admin-/Persoenlich-Switch soll Admin links und fuer Admins standardmaessig aktiv zeigen.
    - Thread-Header soll User-Badge mit Dialog-Menue wie in anderen Kontexten bekommen.
    - Orga-Icons sollen als `Orga-Team` beschriftet und als Gruppe erkennbar sein.
- CR-Draft:
  - `docs/cr/2026-07-12-message-center-admin-mailbox-ux.md`
- Empfohlener naechster Schritt:
  - Nach Sebastian-Go implementieren und deployen.
  - Erwartete Hauptdateien: `app/components/message-center.tsx`, `lib/messaging.ts`, `app/api/messages/conversations/route.ts`, ggf. Admin-/Reply-Routen.

## Aktueller Nachtrag: Team Manager Team Name Field UI Hotfix

- Ausloeser:
  - Sebastian testete mit User `NDBS`; Rollenverwaltung zeigte `Team Manager:in` fuer Team `5Kampf Orga`, aber im Dialog `Team bearbeiten` war `Team-Name` nicht eingabebereit.
- Ursache:
  - Backend-/Rollenlogik war bereits erweitert.
  - Im gemeinsamen Edit-Dialog war das Team-Name-Input noch mit `disabled={!showAdminInfo}` nur fuer Admin/Orga freigegeben.
- Geaendert:
  - `app/components/dashboard.tsx`: Team-Name-Feld ist fuer den vorhandenen editierbaren Team-Dialog nicht mehr admin-only disabled.
  - Team-Manager-Hinweis nennt Team-Name als direkte Pre-Start-Aenderung.
- Checks:
  - `pnpm exec eslint app/components/dashboard.tsx` gruen
  - `npx tsc --noEmit` gruen
  - `git diff --check` gruen
  - `npm run build` gruen
- Deploy:
  - Commit: `bd23d6f Fix team manager team name field`
  - Production Deploy: `dpl_GFPC2Jbr4iU4A7f43EKJYSRrgFdV`
  - Deployment URL: `https://s5-evo-portal-iiz7ec6qr-sebastiankroeker-2781s-projects.vercel.app`
  - Alias: `https://portal.s5evo.de`
  - Deployed at: 2026-07-12 14:57 UTC
- Post-Deploy Smoke:
  - `npm run smoke:public` gegen Production-Alias gruen
  - `/admin`: 200
  - `/aenderungen`: 200
  - `/api/teams/probe` ohne Session: 401
  - `/api/admin/pending-changes?scope=all` ohne Session: 401

## Aktueller Nachtrag: Team Manager Team Name Change

- Ausloeser:
  - Sebastian: Team Manager:innen sollen unter `Details -> Bearbeiten` den Mannschaftsnamen aendern koennen.
  - Folgeentscheidung: Bis zum Beginn des Wettkampfs sind Teamnamen-Aenderungen nicht genehmigungspflichtig.
- CR:
  - `docs/cr/2026-07-12-team-manager-team-name-change.md`
- Implementiert und produktiv deployed:
  - Commits:
    - `2fea5d0 Draft team manager team name change CR`
    - `fb4833d Implement team manager team name changes`
  - Production Deploy: `dpl_HnExu1AX9AppfTkVAmZr3cz3sdtJ`
  - Deployment URL: `https://s5-evo-portal-428opfzot-sebastiankroeker-2781s-projects.vercel.app`
  - Alias: `https://portal.s5evo.de`
  - Team Manager Rename vor Wettkampfbeginn direkt: `Competition.status` nicht `RUNNING`/`CLOSED` und, falls `Competition.date` gesetzt ist, aktueller Zeitpunkt davor.
  - Direkter Pre-Start-Rename aktualisiert `Team.name`, schreibt `AuditEvent` und einen angewendeten generischen `ChangeRequest` fuer die konsolidierte Historie.
  - Nach Wettkampfbeginn wird ein team-scoped `ChangeRequest` erstellt oder ein offener Rename-Request aktualisiert.
  - `/aenderungen` laedt und dekoriert Team-Update-Requests zusaetzlich zu Teilnehmer-Requests.
  - `/api/admin/pending-changes/[id]` kann Team-Update-Requests genehmigen/ablehnen und prueft beim Approve erneut Namensduplikate.
  - `approval-queue.tsx` zeigt `teamName` als `Mannschaftsname` und Team-Requests mit Titel `Mannschaftsname`.
- Checks lokal gruen:
  - `pnpm exec eslint app/api/teams/[id]/route.ts app/api/admin/pending-changes/route.ts app/api/admin/pending-changes/[id]/route.ts app/components/approval-queue.tsx` gruen mit bestehender Hook-Warnung in `approval-queue.tsx`
  - `npx tsc --noEmit` gruen
  - `git diff --check` gruen
  - `npm run verify:team-draft` gruen
  - `npm run build` gruen
  - `npm run smoke:public` gegen Production-Alias gruen
  - `/aenderungen`: 200
  - `/api/admin/pending-changes?scope=all` ohne Session: 401
  - `/api/teams/probe` ohne Session: 401
- Naechster sinnvoller Real-Smoke:
  - Als Team Manager:in vor Wettkampfbeginn Mannschaft unter `Details -> Bearbeiten` umbenennen; Name sollte direkt gespeichert werden.
  - Als Admin `/aenderungen` pruefen; direkte Umbenennung sollte als angewendete Mannschaftsname-Aenderung in der Historie auftauchen.

## Aktueller Nachtrag: Legacy Bundle Status Sync Hotfix

- Ausloeser:
  - Sebastian meldete per Screenshot, dass der Edward-Wolf-Feldwechsel in `/aenderungen` weiterhin als `In Prüfung` angezeigt wird und nicht weg bearbeitet werden kann.
- Ursache:
  - Das Legacy-Bundle in `pending_changes` war bereits `APPROVED`.
  - Der verknuepfte generische Spiegel-Datensatz `change_requests.cmqytajju0005kz04wvdu99eo` stand noch auf `PENDING`.
  - Das konsolidierte Dashboard zeigte dadurch den stale generischen Status statt des kanonischen Legacy-Status.
- Produktion Datenkorrektur:
  - `pending_changes.cmqytaj3y0001kz042y7gc5tj`: bereits `APPROVED` / Bundle `APPROVED`.
  - `change_requests.cmqytajju0005kz04wvdu99eo`: am 2026-07-12 10:42 UTC von `PENDING` auf `APPLIED` synchronisiert.
  - Audit-Logs `APPROVED` und `APPLIED` fuer die nachtraegliche Legacy-Bundle-Synchronisierung angelegt.
  - Keine Teilnehmerdaten geaendert, kein Mailversand.
- Code-Fix ist auf `origin/main` gepusht und produktiv deployed:
  - Commit: `3489ad7 Fix legacy bundle status sync`
  - Production Deploy: `dpl_GZ7tX93ZywkDFU6fZTsUayzQNSYC`
  - Deployment URL: `https://s5-evo-portal-9g6e5dgwo-sebastiankroeker-2781s-projects.vercel.app`
  - Alias: `https://portal.s5evo.de`
  - `app/api/admin/pending-changes/route.ts`: Legacy-verlinkte Eintraege bevorzugen `pending_changes.status`.
  - `app/api/admin/participant-change-bundles/[id]/decision/route.ts`: Bundle-Entscheidungen synchronisieren verknuepfte generische `change_requests`.
  - CR: `docs/cr/2026-07-12-legacy-bundle-status-sync-hotfix.md`
- Checks:
  - `pnpm exec eslint app/api/admin/pending-changes/route.ts app/api/admin/participant-change-bundles/[id]/decision/route.ts` gruen
  - `npx tsc --noEmit` gruen
  - `git diff --check` gruen
  - `npm run build` gruen
  - `npm run smoke:public` gegen Production-Alias gruen
  - `/aenderungen`: 200
  - `/api/admin/pending-changes?scope=all` ohne Session: 401
- Naechster sinnvoller Real-Smoke:
  - Angemeldet `/aenderungen` hart aktualisieren und den Edward-Wolf-Eintrag prüfen; er sollte nicht mehr als `In Prüfung` erscheinen.

## Aktueller Nachtrag: Message And Change Dashboard Controls

- App-/CR-Commits sind auf `origin/main` gepusht und produktiv deployed:
  - `ffb63c3 Draft messaging and change dashboard CR backlog`
  - `5e2c8ad Implement message and change dashboard controls`
- Production Deploy: `dpl_881AguqPcGbhDUBNUewE5iXJHbPu`
- Deployment URL: `https://s5-evo-portal-a5rb0h4ce-sebastiankroeker-2781s-projects.vercel.app`
- Alias: `https://portal.s5evo.de`
- CRs:
  - `docs/cr/2026-07-12-message-center-whatsapp-mobile-navigation.md`
  - `docs/cr/2026-07-12-change-dashboard-consolidated-history.md`
  - `docs/cr/2026-07-12-message-and-change-search-sort-filter.md`
  - `docs/cr/2026-07-12-message-read-receipts.md` bleibt Draft; Entscheidung: Message-Level-Receipts.
- Geaendert:
  - Nachrichten haben jetzt Control-Strip mit Suche, Status-/Unread-Pills, Filterpanel und Sortierung.
  - Mobile `/nachrichten` trennt Thread-Uebersicht und Thread-Ansicht; Threadansicht hat eine `Übersicht`-Rueckaktion.
  - Desktop-Nachrichtenlayout bleibt als Sidebar/Thread-Layout erhalten.
  - `/aenderungen` startet in der Seitenansicht als Gesamtuebersicht `ALL`, embedded Queue bleibt `PENDING`.
  - Aenderungs-Suche umfasst zusaetzlich Status, Quelle, Actor/Reviewer und Historienmeldungen.
  - Aenderungen haben Sortierung nach Prioritaet, letzter Aktivitaet, aelteste zuerst, Teilnehmer, Team und Feldanzahl.
- Checks:
  - `pnpm exec eslint app/components/message-center.tsx app/components/approval-queue.tsx` gruen mit bestehender Hook-Warnung in `approval-queue.tsx`
  - `npx tsc --noEmit` gruen
  - `git diff --check` gruen
  - `npm run build` gruen
  - `npm run smoke:public` gegen Production-Alias gruen
  - `/nachrichten`: 200
  - `/aenderungen`: 200
  - `/api/messages/conversations` ohne Session: 401
  - `/api/admin/pending-changes?scope=all` ohne Session: 401

## Aktueller Nachtrag: Direct Changes In Overview And Profile Name Hotfix

- App-Commits sind auf `origin/main` gepusht und produktiv deployed:
  - `5bb680f Show direct participant changes in change overview`
  - `6795175 Fix profile display name persistence`
- Production Deploy: `dpl_2yJnXvAgGm2fa6TjqUCebxRtXgzt`
- Deployment URL: `https://s5-evo-portal-82kj9by2m-sebastiankroeker-2781s-projects.vercel.app`
- Alias: `https://portal.s5evo.de`
- CRs:
  - `docs/cr/2026-07-12-direct-participant-changes-in-change-overview.md`
  - `docs/cr/2026-07-12-profile-display-name-save-hotfix.md`
- Geaendert:
  - `/aenderungen` laedt bei `scope=all` zusaetzlich `ParticipantAuditLog.DIRECT_CHANGE` als synthetische Eintraege mit Status `DIRECT`.
  - Direkte Admin-Aenderungen werden als `Direkt geändert` angezeigt und bekommen einen eigenen `Direkt`-Filter.
  - Embedded Admin-Queue bleibt auf offene Antraege fokussiert.
  - Profil-Anzeigename bleibt nach dem Speichern erhalten; `resolveCurrentUser()` ueberschreibt vorhandene Namen nicht mehr aus Authentik.
  - Profile-UI uebernimmt den gespeicherten Namen aus der API-Antwort und stoesst ein Session-Update an.
- Konkreter Ausloeser:
  - `Die 5 Muskeltiere` / `Vinzenz Kronacker`, Direct-Change am 2026-07-11 16:52 UTC durch Sebastian K.; vorher nur im Participant-Audit, nicht in `/aenderungen`.
- Checks:
  - targeted `pnpm exec eslint ...` gruen mit bestehender Hook-Warnung in `approval-queue.tsx`
  - `npx tsc --noEmit` gruen
  - `git diff --check` gruen
  - `npm run build` gruen
  - `npm run smoke:public` gegen Production-Alias gruen
  - `/aenderungen`: 200
  - `/profile`: 200
  - `/api/admin/pending-changes?scope=all` ohne Session: 401
  - `/api/profile` ohne Session: 401

## Aktueller Nachtrag: Message Center Collapsed Mobile Hotfix

- App-Commit `1dec83b Fix message sidebar collapsed mobile layout` ist auf `origin/main` gepusht und produktiv deployed.
- Production Deploy: `dpl_9kUFoBDKWggk6ugNrS3LCQVMtsiT`
- Deployment URL: `https://s5-evo-portal-rcrh70cfm-sebastiankroeker-2781s-projects.vercel.app`
- Alias: `https://portal.s5evo.de`
- CR: `docs/cr/2026-07-11-message-center-collapsed-mobile-hotfix.md`
- Geaendert:
  - Zugeklapptes Nachrichten-Panel ist auf Mobile jetzt eine kompakte horizontale Leiste statt einer hohen leeren Rail.
  - Thread-Zaehler bleibt auf Mobile horizontal lesbar.
  - Desktop behaelt die schmale Rail mit vertikaler Thread-Zahl.
- Checks:
  - `pnpm exec eslint app/components/message-center.tsx` gruen
  - `npx tsc --noEmit` gruen
  - `git diff --check` gruen
  - `npm run build` gruen
  - `npm run smoke:public` gegen Production-Alias gruen
  - `/nachrichten`: 200
  - `/admin`: 200
  - `/api/messages/conversations` ohne Session: 401
  - `/api/messages/unread-count` ohne Session: 401

## Aktueller Nachtrag: Message Center Sidebar And Sender Mode

- App-/Schema-Commit `35beb6f Add message center sidebar and sender modes` ist auf `origin/main` gepusht und produktiv deployed.
- Production Deploy: `dpl_9aBg7wpVUKNdaDn33uK9cXSsWptF`
- Deployment URL: `https://s5-evo-portal-68ko3rr7l-sebastiankroeker-2781s-projects.vercel.app`
- Alias: `https://portal.s5evo.de`
- Migration: `20260711190500_add_message_sender_display_mode` wurde per `npx prisma migrate deploy` erfolgreich angewendet.
- CR: `docs/cr/2026-07-11-message-center-sidebar-and-sender-mode.md`
- Geaendert:
  - Nachrichtencenter nutzt jetzt links ein einklappbares Thread-Panel mit chronologisch nach letzter Aktivitaet sortierten Betreffen.
  - Admins schalten im Nachrichtencenter zwischen `Mein Postfach` und `Admin-Postfach` um.
  - Admins koennen beim Admin-Compose und bei Antworten zwischen `Orga-Postfach` und `Persoenlich` waehlen.
  - Neuer Message-Feldwert `senderDisplayMode` speichert die Anzeige als `PERSONAL` oder `ORG`.
  - `ORG` wird im Verlauf und Mail-Hinweis als `Admin-Team` angezeigt; die echte `senderId` bleibt fuer Audit/Technik erhalten.
- Checks:
  - `npx prisma generate` gruen
  - `npx prisma validate` gruen
  - targeted `pnpm exec eslint ...` gruen
  - `npx tsc --noEmit` gruen
  - `git diff --check` gruen
  - `npm run build` gruen
  - `npx prisma migrate status` gruen / schema up to date
  - `npm run smoke:public` gegen Production-Alias gruen
  - `/nachrichten`: 200
  - `/admin`: 200
  - `/api/messages/conversations` ohne Session: 401
  - `/api/messages/unread-count` ohne Session: 401
  - `POST /api/messages/admin-conversations` ohne Session: 401
- Follow-up:
  - Authenticated Real-Smoke: als Admin Postfach wechseln, als `Orga-Postfach` und `Persoenlich` senden, als Zielkonto Senderlabel und Unread-Badge pruefen.
  - Spaeter separater Performance-CR fuer Pagination, schlanke Threadlisten, Lazy-Loading und DB-seitige Unread-Counts.

## Aktueller Nachtrag: Owner Status Consistency Follow-Up

- App-Commit `3f448f9 Align owner account status display` ist auf `origin/main` gepusht und produktiv deployed.
- Production Deploy: `dpl_GCgUFBLK84Hvse7vwUW2GofqcjDV`
- Deployment URL: `https://s5-evo-portal-c6p2ic2x2-sebastiankroeker-2781s-projects.vercel.app`
- Alias: `https://portal.s5evo.de`
- CR-Follow-up: `docs/cr/2026-07-11-status-dialog-admin-message-hotfix.md`
- Ausloeser:
  - Benutzer-Dashboard zeigte bei Markus Huber / `Die 5 Muskeltiere` `Verknüpft`, der Team-Owner-Statusdialog aber `Login noch nicht aktiviert`.
- Ursache:
  - Der konkrete DB-Datensatz hat einen bestaetigten Portal-Login (`authentikSub`) und ist Owner/Teamchef.
  - Im Team-Owner-Status wurde der offene alte Claim-Link staerker gewichtet als der vorhandene Owner-Portal-Login.
  - `ownerHasPortalAccount` hing in der Team-API zu eng an der Claim-Feld-Freigabe statt an den sensiblen Teamdaten.
- Geaendert:
  - `getOwnerClaimMeta` bewertet `ownerId + ownerHasPortalAccount` als fachliche Verknuepfung.
  - `app/api/teams` serialisiert `ownerHasPortalAccount` fuer Admin/Orga-sensible Teamdaten.
  - Offene alte Claim-Links koennen einen bereits bestaetigten Owner-Login nicht mehr auf `Login noch nicht aktiviert` zurueckstufen.
- Checks:
  - `pnpm exec eslint app/components/dashboard.tsx app/api/teams/route.ts` gruen
  - `npx tsc --noEmit` gruen
  - `git diff --check` gruen
  - `npm run build` gruen
  - `npm run smoke:public` gegen Production-Alias gruen
  - `/admin`: 200
  - `/sportlerboerse-dashboard`: 200
  - `/api/teams` ohne Session: 401
  - `POST /api/messages/admin-conversations` ohne Session: 401

## Aktueller Nachtrag: Status Dialog Admin Message Hotfix

- App-Commit `86fcaeb Add admin message action to status dialog` ist auf `origin/main` gepusht und produktiv deployed.
- Production Deploy: `dpl_AGj5R1cCRYrJcVD6yp6Zy5UX134w`
- Deployment URL: `https://s5-evo-portal-ces016epu-sebastiankroeker-2781s-projects.vercel.app`
- Alias: `https://portal.s5evo.de`
- CR: `docs/cr/2026-07-11-status-dialog-admin-message-hotfix.md`
- Geaendert:
  - Statusdialog-Zielzeilen fuer `User` und `Claim` nutzen jetzt theme-faehige Kontrastklassen und bleiben im dunklen Theme lesbar.
  - Owner- und Teilnehmer-Statusdialoge zeigen fuer Admin-Kontexte bei vorhandener Portal-User-ID die Aktion `Nachricht schreiben`.
  - Das Nachrichtencenter kann per `/nachrichten?mode=admin&targetUserId=...` eine Admin-Nachricht an eine Zielperson vorbereiten.
  - Neuer geschuetzter Endpoint `POST /api/messages/admin-conversations` erstellt Admin-started Support-Threads an konkrete Portal-User.
  - Admin-started Threads bleiben im generischen `SUPPORT`-Modell, starten mit Status `WAITING_FOR_USER` und senden Mail-Hinweise ohne Nachrichtentext.
- Checks:
  - `pnpm exec eslint app/components/account-link-status-dialog.tsx app/components/dashboard.tsx app/components/message-center.tsx app/api/messages/admin-conversations/route.ts lib/admin-routing.ts` gruen
  - `npx tsc --noEmit` gruen
  - `git diff --check` gruen
  - `npm run build` gruen
  - `npm run smoke:public` gegen Production-Alias gruen
  - `/nachrichten`: 200
  - `/admin`: 200
  - `/sportlerboerse-dashboard`: 200
  - `POST /api/messages/admin-conversations` ohne Session: 401
- Follow-up:
  - Authenticated Real-Smoke: als Admin im Teilnehmer-/Owner-Statusdialog `Nachricht schreiben` oeffnen, Nachricht senden, als Zielperson Unread-Badge und Thread pruefen.

## Aktueller Nachtrag: Messaging Navigation And Unread Badge

- App-Commit `1b8b3fc Surface messages in navigation` ist auf `origin/main` gepusht und produktiv deployed.
- Production Deploy: `dpl_8KqCr1nULitdiFUbFrTJjWBcnJ1A`
- Deployment URL: `https://s5-evo-portal-r3grum4uv-sebastiankroeker-2781s-projects.vercel.app`
- Alias: `https://portal.s5evo.de`
- CR: `docs/cr/2026-07-11-message-navigation-unread-badge.md`
- Geaendert:
  - `Nachrichten` ist jetzt im Lupen-/Suchmenue auffindbar.
  - Suchbegriffe u. a. `nachrichten`, `postfach`, `brief`, `support`, `admin kontaktieren`.
  - Neuer API-Endpunkt `/api/messages/unread-count` liefert die Anzahl ungelesener Nachrichten fuer angemeldete User.
  - Profil-/Konto-Icon zeigt bei ungelesenen Nachrichten einen roten Badge.
  - Mobiles Konto-Menue zeigt die Anzahl zusaetzlich neben `Nachrichten`.
- Checks:
  - `pnpm exec eslint app/components/nav-bar.tsx app/components/search-overlay.tsx lib/navigation-menu.ts lib/messaging.ts app/api/messages/unread-count/route.ts` gruen
  - `npx tsc --noEmit` gruen
  - `git diff --check` gruen
  - `npm run build` gruen
  - `npm run smoke:public` gegen Production-Alias gruen
  - `/api/messages/unread-count` ohne Session: 401

## Aktueller Nachtrag: Messaging Team-Manager Contact Email Hotfix

- App-Commit `70867cb Allow contact email team messaging contexts` ist auf `origin/main` gepusht und produktiv deployed.
- Production Deploy: `dpl_2ATYT4M8WqdiVWrisFPs8dwMDG7D`
- Deployment URL: `https://s5-evo-portal-hip0x7fuh-sebastiankroeker-2781s-projects.vercel.app`
- Alias: `https://portal.s5evo.de`
- CR: `docs/cr/2026-07-11-message-support-contact-email-team-manager.md`
- Geaendert:
  - Support-Kontexte fuer `/nachrichten` beruecksichtigen jetzt zusaetzlich `Team.contactEmail == User.email`.
  - Damit koennen Team-Manager/Kontaktpersonen ohne verknuepftes Teilnehmerprofil Nachrichten an das Admin-Team schreiben.
  - Bestehende Kontexte ueber `ownerId`, `teamChiefId`, `TeamMemberRole` und `Participant.userId` bleiben unveraendert.
- Checks:
  - `pnpm exec eslint lib/messaging.ts app/api/messages/support-contexts/route.ts app/api/messages/conversations/route.ts` gruen
  - `npx tsc --noEmit` gruen
  - `git diff --check` gruen
  - `npm run build` gruen
  - `npm run smoke:public` gegen Production-Alias gruen
  - `/api/messages/support-contexts` ohne Session: 401

## Aktueller Nachtrag: Participant/Admin Messaging Foundation

- App-/Schema-Commit `8a4fce7 Add participant admin messaging foundation` ist auf `origin/main` gepusht und produktiv deployed.
- Production Deploy: `dpl_bfLFtFkkNZc57p9Rk7H2vSq6dwUb`
- Deployment URL: `https://s5-evo-portal-2cmr1k3vr-sebastiankroeker-2781s-projects.vercel.app`
- Alias: `https://portal.s5evo.de`
- Migration: `20260711125500_add_messaging_foundation` wurde per `npx prisma migrate deploy` erfolgreich angewendet.
- CR: `docs/cr/2026-07-11-participant-admin-messaging-foundation.md`
- Geaendert:
  - generisches Messaging-Datenmodell mit `Conversation`, `ConversationParticipant` und `Message`
  - Conversation-Typen vorbereitet: `SUPPORT`, `TEAM`, `DIRECT`, `GROUP`, `SYSTEM`
  - MVP aktiviert Support-Threads: Teilnehmer:in/Teamchef:in schreibt an Admin-/Moderator-Team
  - `/nachrichten` als neues Portal-Nachrichtencenter
  - Admin-/Moderator-Sicht fuer Support-Inbox innerhalb des Nachrichtencenters
  - API-Routen fuer Thread-Liste, Thread-Detail, Thread-Erstellung, Antworten und Read-State
  - Nachrichten-Mailhinweise ohne Nachrichtentext; Link fuehrt ins Portal
  - Message-Schema ist crypto-ready (`contentFormat`, `bodyCiphertext`, `bodyPreview`, `encryptionVersion`, `keyId`), aber MVP speichert Plaintext
  - Konto-Menue und Profil verlinken auf `/nachrichten`
- Checks:
  - `npx prisma generate` gruen
  - `npx prisma validate` gruen
  - targeted `pnpm exec eslint ...` gruen
  - `npx tsc --noEmit` gruen
  - `git diff --check` gruen
  - `npm run build` gruen
  - `npm run smoke:public` gegen Production-Alias gruen
  - `/nachrichten`: 200
  - `/api/messages/conversations` ohne Session: 401
  - `/api/messages/support-contexts` ohne Session: 401
- Follow-ups:
  - Authenticated Smoke mit echtem Admin-/Teilnehmerkonto durchspielen: Thread erstellen, Admin antwortet, Read-State pruefen.
  - Spaeter Team-/Gruppen- und Direktnachrichten freischalten, wenn Privacy-/Kontakt-Einstellungen definiert sind.
  - Optional Envelope Encryption oder E2EE-Spike separat bewerten.

## Aktueller Nachtrag: User Dashboard Filter And Sort Follow-Up

- App-Commit `fe7cd2c Add user dashboard filters and sorting` ist auf `origin/main` gepusht und produktiv deployed.
- Production Deploy: `dpl_H83dicV1PDv6xfp1c9ZgDt351Kmg`
- Deployment URL: `https://s5-evo-portal-kmuz04wtn-sebastiankroeker-2781s-projects.vercel.app`
- Alias: `https://portal.s5evo.de`
- CR: `docs/cr/2026-07-11-user-dashboard-filter-and-sort-followup.md`
- Geaendert:
  - Benutzer-Stats `Admins`, `Moderatoren`, `Teamchef:innen` und `Online` sind jetzt als Filter klickbar.
  - Filterpanel enthaelt jetzt Mail-Status `mit E-Mail` / `ohne E-Mail`.
  - Filterpanel enthaelt jetzt Portal-Verknuepfungsstatus `Verknüpft`, `Konto ohne Link`, `Einladung offen`, `Placeholder`, `Klärfall`.
  - Ergebnisliste kann jetzt nach `Zuletzt aktiv zuerst`, `Name A-Z`, `Neueste Registrierung` und `Meiste Teams zuerst` sortiert werden.
- Checks:
  - `pnpm exec eslint app/components/user-management.tsx` gruen
  - `npx tsc --noEmit` gruen
  - `git diff --check` gruen
  - `npm run build` gruen
  - `npm run smoke:public` gegen Production-Alias gruen
  - `/admin`: 200

## Aktueller Nachtrag: Reusable Dashboard Control Strip

- App-Commit `851fb59 Add reusable dashboard control strip` ist auf `origin/main` gepusht und produktiv deployed.
- Production Deploy: `dpl_AQ213NzUxueW2wd7tUbW6FWaiftf`
- Deployment URL: `https://s5-evo-portal-ero9di4ob-sebastiankroeker-2781s-projects.vercel.app`
- Alias: `https://portal.s5evo.de`
- CR: `docs/cr/2026-07-11-reusable-dashboard-control-strip.md`
- Geaendert:
  - neue Shared-UI-Bausteine fuer Suche, Stats, Toolbar, Toolbar-Buttons und aufklappbare Panels
  - Teilnehmer-Dashboard nutzt jetzt dasselbe `Suche -> Stats -> Toolbar -> Panels`-Muster wie das Mannschafts-Dashboard
  - Aenderungs-Dashboard nutzt jetzt denselben Control-Strip mit klickbaren Status-/Update-Pillen
  - Benutzer-Dashboard ist strukturell auf denselben Strip gehoben und hat jetzt konsistente Suche, Stats, Toolbar und Filterpanel
  - Panel-Icons sind nur im offenen Zustand aktiv eingefaerbt; geschlossene Panels zeigen Aktivitaet ueber Badge/Count
- Checks:
  - `pnpm exec eslint app/components/dashboard-controls.tsx app/components/participant-list.tsx app/components/approval-queue.tsx app/components/user-management.tsx` mit 2 bestehenden Hook-Warnungen, keine neuen Errors
  - `npx tsc --noEmit` gruen
  - `git diff --check` gruen
  - `npm run build` gruen
  - `npm run smoke:public` gegen Production-Alias gruen
  - `/admin`: 200
  - `/teilnehmer`: 200
  - `/aenderungen`: 200

## Aktueller Nachtrag: MD Stats Row And Filter Icon State

- App-Commit `df99bc1 Fix dashboard stats row and filter icon state` ist auf `origin/main` gepusht und produktiv deployed.
- Production Deploy: `dpl_9NiKXJytAWZDantdkKDiun3Myarc`
- Deployment URL: `https://s5-evo-portal-ec3r4whu1-sebastiankroeker-2781s-projects.vercel.app`
- Alias: `https://portal.s5evo.de`
- CR: `docs/cr/2026-07-11-md-stats-row-and-filter-icon-state.md`
- Geaendert:
  - Trefferstatistik steht jetzt als eigene Zeile direkt unter dem Suchfeld und oberhalb der Panel-Icons.
  - Filter-Icon nutzt im zugeklappten Zustand wieder das geschlossene Farbschema.
  - Aktive Filter bleiben bei geschlossenem Panel weiter ueber den Counter-Badge sichtbar.
- Checks:
  - `pnpm exec eslint app/components/dashboard.tsx` gruen
  - `npx tsc --noEmit` gruen
  - `git diff --check` gruen
  - `npm run build` gruen
  - `npm run smoke:public` gegen Production-Alias gruen
  - `/sportlerboerse-dashboard`: 200

## Aktueller Nachtrag: MD Kombinierbare Klassenpillen

- App-Commit `1f58350 Add combinable dashboard class pills` ist auf `origin/main` gepusht und produktiv deployed.
- Production Deploy: `dpl_EccDbuSxTLc5urnfvdu3tqJqMBUH`
- Deployment URL: `https://s5-evo-portal-m01076f2j-sebastiankroeker-2781s-projects.vercel.app`
- Alias: `https://portal.s5evo.de`
- CR: `docs/cr/2026-07-11-md-combinable-class-pills.md`
- Geaendert:
  - Trefferstatistik steht jetzt direkt unter der Such-/Toolbar-Zeile und bleibt auch bei offenem Filterpanel sichtbar.
  - Klassenpillen in Statistik und Filterpanel sind jetzt kombinierbar statt nur einzeln waehlbar.
  - Das alte Klassen-Dropdown im Filterpanel ist entfernt.
  - Gespeicherte Legacy-Filter mit `categoryFilter` werden weiter geladen und auf `categoryFilters` uebernommen.
- Checks:
  - `pnpm exec eslint app/components/dashboard.tsx` gruen
  - `npx tsc --noEmit` gruen
  - `git diff --check` gruen
  - `npm run build` gruen
  - `npm run smoke:public` gegen Production-Alias gruen
  - `/sportlerboerse-dashboard`: 200

## Aktueller Nachtrag: MD List Default And Stats Order

- App-Commit `d524352 Tweak MD list defaults and stats order` ist auf `origin/main` gepusht und produktiv deployed.
- Production Deploy: `dpl_GrR8AGcTBx5eLXUMHN44cgU4WyPV`
- Deployment URL: `https://s5-evo-portal-ihc1jsrnt-sebastiankroeker-2781s-projects.vercel.app`
- Alias: `https://portal.s5evo.de`
- CR: `docs/cr/2026-07-10-md-list-default-and-stats-order.md`
- Geaendert:
  - Default-/Legacy-LocalStorage-Listenlayout entfernt die Sammelspalte `participants`/`Mitglieder`; Zeilen bleiben dadurch niedriger.
  - Die Spalte bleibt manuell ueber das Spaltenpanel waehlbar und gespeicherte Layouts bleiben unveraendert.
  - Trefferstatistik steht jetzt oberhalb der Zeile mit Ansicht/Suche/Filter/Layout-Buttons.
- Checks:
  - `npx tsc --noEmit` gruen
  - `npm run lint` gruen, nur bestehende 11 Warnungen
  - `npm run build` gruen
  - `npm run smoke:public` gegen Production-Alias gruen
  - `/sportlerboerse-dashboard`: 200

## Aktueller Nachtrag: Participant Replacement Flow

- Ersetzen-Flow ist produktiv deployed.
- App-Commit `1902498 Add participant replacement flow`
- Production Deploy: `dpl_2QT5BaiacdLvmpy7z5ydJrRnKjaV`
- Deployment URL: `https://s5-evo-portal-h8lwpzklz-sebastiankroeker-2781s-projects.vercel.app`
- Alias: `https://portal.s5evo.de`
- Neuer CR: `docs/cr/2026-07-10-participant-replacement-flow.md`
- Geaendert:
  - Orga/Admin-Team-Edit hat pro verankertem Teilnehmer die Aktion `Andere Person einsetzen`.
  - Markierte Zeilen werden beim Speichern nicht als Korrektur behandelt, sondern ersetzen die Teilnehmer-Identitaet.
  - API `PUT /api/teams/:id` akzeptiert im Admin-Direktpfad `replaceParticipant: true` pro Teilnehmer.
  - Alte Teilnehmer-ID wird archiviert (`deletedAt`), neue Teilnehmer-ID wird im selben Team/Disziplin-Slot angelegt.
  - Portal-Konto, Historie, Ergebnisse und Audit bleiben bei der alten ID; aktive Team-Manager-Rechte fuer dieses Team werden entzogen.
  - Offene PendingChanges/legacy ChangeRequests der alten ID werden als ueberholt abgelehnt.
  - Team-Manager/Self-Service kann `replaceParticipant` nicht nutzen (403).
- Checks lokal gruen:
  - `npx tsc --noEmit`
  - `npm run verify:participant-edit-flow`
  - `npm run verify:team-draft`
  - `npm run lint` mit bestehenden 11 Warnungen
  - `npm run build`
- Post-Deploy:
  - `npm run smoke:public` gruen gegen Production-Alias
  - `/sportlerboerse-dashboard`: 200
- Naechster Schritt:
  - UI fachlich mit echtem Team pruefen; spaeter optional Existing-Participant-Picker statt nur neue ID.

## Aktueller Nachtrag: Participant Identity Guardrails

- App-Commit `47015c8 Guard team edit participant identity changes` ist auf `origin/main` gepusht und produktiv deployed.
- Vorheriger App-Commit: `52709c1 Add participant identity guardrails`
- Production Deploy: `dpl_EFnHKkxmnwqDoheBMP3rNfHoAhrT`
- Deployment URL: `https://s5-evo-portal-7m3s4q9mq-sebastiankroeker-2781s-projects.vercel.app`
- Alias: `https://portal.s5evo.de`
- Geaendert:
  - Teilnehmer-Edit zeigt bei verankerten Datensaetzen, dass die Teilnehmer-ID beim Speichern erhalten bleibt.
  - Team-bearbeiten-Dialog zeigt dieselbe Guardrail pro verankertem Teilnehmer und fragt vor dem Speichern bei verdächtigem Personenwechsel nach.
  - Hinweis formuliert die Entscheidung klar: Korrektur hier speichern; andere Person nicht ueberschreiben, sondern Ersetzen-Flow nutzen.
  - Bestehende Aktion heisst nun korrekt `Konto-Verknuepfung loesen` statt `Teilnehmer ersetzen`.
  - Identitaetsfeld-Aenderungen an verankerten Teilnehmern zeigen vor dem Speichern eine Bestaetigung.
- Checks:
  - `npx tsc --noEmit` gruen
  - `npm run verify:participant-edit-flow` gruen
  - `npm run lint` gruen, nur bestehende 11 Warnungen
  - `npm run build` gruen
  - `npm run smoke:public` gegen Production-Alias gruen
  - `/sportlerboerse-dashboard`: 200
- CR: `docs/cr/2026-07-10-participant-identity-guardrails.md`
- Follow-up: echter Ersetzen-Flow mit neuer/anderer Teilnehmer-ID bleibt separate CR.

## Read First: Scope-Guard / Domaenenkanon

- S5Evo bildet den konkret definierten Vereins-/Wettkampf-Scope ab, nicht "moderner Fuenfkampf" allgemein.
- Gueltige Disziplin-Codes im aktuellen System sind ausschliesslich: `RUN`, `BENCH`, `STOCK`, `ROAD`, `MTB`.
- Keine extern abgeleiteten Sportarten oder olympischen/modernen Fuenfkampf-Disziplinen vorschlagen, insbesondere nicht Fechten, Schiessen oder Reiten.
- Wenn Disziplinen im UI oder in Anforderungen erwaehnt werden, muessen sie aus Systemdaten/Config oder dieser Kanonliste kommen.
- Bei unklarer Fachlichkeit generische Begriffe nutzen: Disziplin, Station, Wertung, Teilnehmer.
- Abkuerzung: `MD` = Mannschafts-Dashboard.
- Mannschaft = Team im Wettkampf; Startnummer = `Team.startNumber` / `team_startnummer`, nicht Teilnehmer-Startnummer.
- Klasse ist eine eigene Team-Eigenschaft und kein Bestandteil des Mannschaftsnamens.

## Kurzfazit

- `portal.s5evo.de` ist stabil und produktiv auf dem aktuellen Stand.
- MD-Listen-Spalten, MD Control Strip Cleanup, Trefferstatistik, mobile volle Icon-Breite, Filter/Sortier-Reset und aktive Toolbar-Kosmetik sind deployed.
- MD-Mobile-Folgefix ist produktiv: Statistik bleibt oberhalb aller Panels, wird nicht mehr im Filter-Panel dupliziert; mobile Tool-Icons nutzen die volle Breite als gleichmaessiges Grid; Stat-Pillen toggeln Klassen-/Gruppenfilter.
- Live-Route sortiert Klassen in Teams, Startlisten und Ergebnissen einheitlich: SA, SB, J, DA, DB, HA, HB, HC.
- Startnummern wurden erfolgreich von Teilnehmer-Ebene auf Mannschaft-Ebene umgestellt.
- Umstellung wurde kontrolliert in sicherer Reihenfolge durchgezogen: Code -> Deploy -> DB-Migration -> Smoke.
- App-Commit `eb1cbff Polish MD class sort and layout badge` wurde nach `origin/main` gepusht und produktiv deployed.
- MD-Follow-up ist produktiv: redundante Statuspillen unter den Trefferstatistik-Pillen sind entfernt, normale Teams zeigen in der Listenansicht unter dem Namen keine `x / 5 Teilnehmer:innen`-Stats mehr, Toolbar-Button-/Counter-Farben sind panel-spezifisch nachgezogen, Listensortierung nach Klasse nutzt die Standard-Reihenfolge SA, SB, J, DA, DB, HA, HB, HC, Layout-Toolbar-Button/Badge sind konsistent.

## Aktueller Git-Stand

- Aktiver Branch: `main`
- App-Deploy-Commit: `eb1cbff Polish MD class sort and layout badge`
- Hotfix-Commits:
  - `ec94981` Fix MD mobile quick filters
  - `a822beb` Add MD hit statistics
  - `529602a` Fix MD mobile toolbar width
  - `9939763` Keep MD hit stats above panels
  - `f4c450b` Fix MD filter reset and stat toggles
  - `13f1953` Polish MD toolbar active states
  - `06e204e` Refine MD toolbar toggle colors
  - `eb1cbff` Polish MD class sort and layout badge
- Relevante Dateien:
  - `app/components/dashboard.tsx`
  - `docs/cr/2026-07-10-md-mobile-toolbar-width.md`
  - `docs/cr/2026-07-10-md-mobile-quickfilter-hotfix.md`
  - `docs/cr/2026-07-10-md-active-toolbar-cosmetics.md`
  - `SESSION_HANDOFF.md`
  - Inhalt: kompakte Trefferstatistik unter dem MD-Control-Strip mit Gesamt, Damen, Herren und Klassen; Stat-Pillen sind Filter-Toggles; Filter-Reset setzt Filter und Sortierung zurueck; Kachel/Liste und Toolbar-Counter zeigen aktive Zustaende farbig an.
  - Checks: `npx tsc --noEmit` gruen, `npm run build` gruen, `npm run smoke:public` gruen.
- Letzte relevante Commits:
  - `eb1cbff` Polish MD class sort and layout badge
  - `06e204e` Refine MD toolbar toggle colors
  - `13f1953` Polish MD toolbar active states
  - `f4c450b` Fix MD filter reset and stat toggles
  - `9939763` Keep MD hit stats above panels
  - `529602a` Fix MD mobile toolbar width
  - `a822beb` Add MD hit statistics
  - `ec94981` Fix MD mobile quick filters
  - `82f23fc` Improve MD list controls
  - `36efa09` Add saved dashboard layouts
  - `9343a54` Require contact phone for marketplace registrations
  - `01d7418` Sort live classes consistently
  - `8f546e8` Move start numbers from participants to teams
- Lokale uncommitted App-/Doku-Aenderungen:
  - `app/components/dashboard.tsx`
  - `docs/cr/2026-07-10-md-active-toolbar-cosmetics.md`
  - `SESSION_HANDOFF.md`
- Lokale Checks fuer diese uncommitted Aenderungen:
  - `eslint app/components/dashboard.tsx` gruen
  - `npx tsc --noEmit` gruen
  - `npm run lint` gruen, nur bestehende Warnungen
  - `npm run build` gruen
- Nachkorrektur 15:21 UTC:
  - `sortField === "category"` nutzt `compareClassificationCodes` statt alphabetischem Collator.
  - Layout-Button ist primary bei offenem Panel, ausgewaehltem Layout oder Dirty-State.
  - Layout-Badge zeigt `1` fuer ausgewaehltes Layout, `!` fuer ungespeicherte Layout-Aenderungen und `•` wenn das Layout-Panel ohne ausgewaehltes Layout offen ist; Badge-Farbe wechselt wie bei den anderen Toolbar-Panels nach offen/geschlossen.
  - Checks: `eslint app/components/dashboard.tsx` gruen, `npx tsc --noEmit` gruen, `npm run lint` gruen mit bestehenden Warnungen, `npm run build` gruen.
  - Deploy: `dpl_J1U8rthSjLQ8tG2P4Jddsjgithkv`, Alias `https://portal.s5evo.de`, Smoke gruen.
- Nachkorrektur 14:41 UTC:
  - Filter-Button nutzt wieder die direkte Regel `filtersOpen || activeFilterCount > 0`.
  - `activeFilterCount` zaehlt keine reinen Schnellfilter-Excludes mehr.
  - Toolbar-Counter wechseln zwischen geschlossenem hellen Badge und geoeffnetem Primary-Badge.
  - Checks: `eslint app/components/dashboard.tsx` gruen, `npx tsc --noEmit` gruen, `npm run lint` gruen mit bestehenden Warnungen, `npm run build` gruen.
  - Deploy: `dpl_E7aJRq6hMD9HzvbtFvVjEXMNAKXW`, Alias `https://portal.s5evo.de`, Smoke gruen.

## Produktivstand / Deployments

- Aktueller Production Deploy:
  - Deployment: `dpl_J1U8rthSjLQ8tG2P4Jddsjgithkv`
  - URL: `https://s5-evo-portal-7sh5rcngt-sebastiankroeker-2781s-projects.vercel.app`
  - Alias: `https://portal.s5evo.de`
  - Status: `READY`
- Post-Deploy Smoke:
  - `npm run smoke:public` gruen
  - `/`, `/login`, `/anmeldung`, `/aenderungen`, `/sportlerboerse-dashboard`: 200
  - `/api/competition`: 200
  - `/api/results?competitionId=cmn3a1piz0002l104372yx9yt`: 200
  - `/api/teams` ohne Session: 401 (erwartet)
  - `/api/admin/pending-changes` ohne Session: 401 (erwartet)
  - `/sportlerboerse`: 200
  - `/sportlerboerse/mtc`: 200
  - `/api/dashboard-layouts` ohne Session: 401 (erwartet)
  - `/api/admin/teams-export` ohne Session: 401 (erwartet)
- Startnummern-Import-Route:
  - `GET /api/admin/start-numbers/import`: 405 (erwartet)
  - `POST /api/admin/start-numbers/import` ohne Session: 401 (erwartet)

## Was umgesetzt wurde (Live-Klassensortierung)

- Gemeinsamer Sortierhelper in `lib/domain/classification.ts`.
- Offizielle Reihenfolge: `schueler-a`, `schueler-b`, `jugend`, `damen-a`, `damen-b`, `jungsters`, `herren`, `masters`.
- `app/components/live-screen.tsx`:
  - Teams-Klassengruppen nach offizieller Reihenfolge.
  - Startlisten-Klassen innerhalb jeder Disziplin nach offizieller Reihenfolge.
  - alte ungenutzte Ergebnis-Placeholder-Funktion entfernt, da `ResultsView` aktiv genutzt wird.
- `app/api/results/route.ts`:
  - Ergebnis-Klassen werden API-seitig nach offizieller Reihenfolge sortiert.
- Checks:
  - `npx tsc --noEmit` gruen
  - `npm run build` gruen
  - `npm run smoke:public` gegen `https://portal.s5evo.de` gruen

## Was umgesetzt wurde (Startnummern)

## Phase A/B Vorarbeiten (bereits erledigt)

- `participants.startNumber` wurde initial eingefuehrt (Phase A/B).
- Danach wurde die fachliche Entscheidung getroffen: Startnummer gehoert auf Team-Ebene.

## Umstellung auf Team-Ebene (final)

- Prisma Schema:
  - `Team.startNumber String?` hinzugefuegt
  - `Participant.startNumber` entfernt
- Migration:
  - `prisma/migrations/20260630010500_move_start_number_to_team/migration.sql`
  - migriert vorhandene Teilnehmer-Startnummern deterministisch hoch auf Team (`MIN(startNumber)` je Team)
  - entfernt anschliessend `participants.startNumber` + Index
- API:
  - `POST /api/admin/start-numbers/import` schreibt jetzt auf `teams.startNumber`
  - primaeres CSV-Format: `team_id` + `team_startnummer`
  - Legacy weiter kompatibel:
    - `participant_id` + `startnummer`
    - `tn_XX_id` + `tn_XX_startnummer`
  - Legacy-Werte werden teamweise aufgeloest; Konflikte werden sauber als 400 gemeldet
- Export:
  - CSV enthaelt `team_startnummer`
  - `tn_XX_startnummer` wurde entfernt
  - betrifft Admin-Download und Daily-Orga-Mail-Export

## DB-Operationen

- Migrationen erfolgreich angewendet mit:
  - `npx prisma migrate deploy`
- Zuletzt angewendete Migration:
  - `20260630010500_move_start_number_to_team`

## Wichtige Dateien der letzten Umstellung

- `prisma/schema.prisma`
- `prisma/migrations/20260630010500_move_start_number_to_team/migration.sql`
- `app/api/admin/start-numbers/import/route.ts`
- `lib/team-csv-export.ts`
- `app/api/admin/teams-export/route.ts`
- `lib/mail/daily-orga-export.ts`

## Operative Leitplanken (weiterhin gueltig)

- Keine breiten Sammel-Deploys aus grossen Recovery-Branches.
- Immer kleine isolierte Pakete.
- Bei DB-relevanten Aenderungen:
  1. Schema/Migration bereitstellen
  2. deployen
  3. Migration ausfuehren
  4. Smoke pruefen
- Nach jedem Production Deploy:
  - `npm run smoke:public`
  - API-Route aktiv pruefen (nicht nur `/`)

## Offene / naechste sinnvolle Schritte

1. Optional: Kurze fachliche Abnahme mit echtem Import-CSV (`team_id;team_startnummer`) im Admin-Flow.
2. Optional: Kleine Admin-UI fuer Team-Startnummern (anzeigen/bearbeiten), falls operativ gewuenscht.
3. Optional: Doku fuer externes Zeiterfassungs-/Auswerte-Backend aktualisieren (CSV-Vertrag mit `team_startnummer`).
4. CR-Methodik schrittweise nutzen: Skill `skills/s5evo-change-request/SKILL.md`, Template `docs/cr/_template.md`, erster CR `docs/cr/2026-07-09-marketplace-contact-phone.md`.
5. Layout-CR fuer ALV-artige Layouts im Mannschafts-Dashboard: `docs/cr/2026-07-09-dashboard-saved-layouts.md`. Implementierung ist deployed; Migration und Smoke waren gruen.
6. Neuer UI-Folgepunkt Mannschafts-Dashboard Listenansicht:
   - Startnummer anzeigen.
   - Teilnehmer je Disziplin als eigene Spalte anzeigen.
   - Spalten-Reihenfolge anpassbar machen.
   - Klasse aus der Spalte Mannschaftsname entfernen; Klasse separat als Spalte/Filter fuehren.
   - Filter und Listenoptionen kompakt halten: Suche sichtbar, Filter/Spalten/Export als Icon-Buttons oder Dropdowns.
   - Status 2026-07-10: deployed mit `82f23fc`; TypeScript/Build und Post-Deploy-Smoke gruen.

## Was umgesetzt wurde (Kontakttelefonnummer)

- MTC/unvollstaendige Mannschaft und Sportlerboerse-Einzelanmeldung verlangen jetzt eine Telefonnummer.
- Technischer Speicherort: bestehendes Feld `Team.contactPhone`; keine Prisma-Migration noetig.
- Normale Mannschaftsanmeldung bleibt ohne Telefonnummer.
- Anonymer MTC-Link zeigt und speichert die Telefonnummer.
- Relevante Checks:
  - `npx tsc --noEmit` gruen
  - `npm run build` gruen
  - `npm run verify:participant-edit-flow` gruen
  - `npm run smoke:public` gegen `https://portal.s5evo.de` gruen

## CR-/Skill-Methodik

- Neuer Skill: `skills/s5evo-change-request/SKILL.md`.
- Neuer Standard: produktrelevante Aenderungen bekommen ein CR-Dokument unter `docs/cr/`.
- Pflicht-Gates vor Modellwechsel, Subagent-Delegation, Production Deploy, DB-Migration, Produktionsdatenmutation und externen Nachrichten.
- Modellwechsel sollen kuenftig ueber explizite `Implementation Handoff`-Bloecke im CR erfolgen, nicht ueber implizites Chat-Gedaechtnis.
- Template/Skill wurden beim Layout-CR erweitert um `Data / API Design`, `Open Questions` und `Model / Subagent Plan`.

## Was deployed wurde (Dashboard-Layouts)

- Neues Prisma-Modell `DashboardLayout` mit `tenantId`, optionaler `competitionId`, Scope `PERSONAL/GLOBAL`, versionierter JSON-Konfiguration und Soft Delete.
- Migration vorbereitet: `prisma/migrations/20260709214500_add_dashboard_layouts/migration.sql`.
- Neue Layout-API:
  - `GET/POST /api/dashboard-layouts`
  - `PATCH/DELETE /api/dashboard-layouts/[id]`
- Mannschafts-Dashboard:
  - Layout-Auswahl, Name, Typ, Neu/Speichern/Loeschen.
  - Persoenliche Layouts fuer berechtigte Nutzer.
  - Globale Layouts nur ADMIN-only schreibbar.
  - Layout speichert Ansicht, sichtbare Spalten, Sortierung und Export-Spalten, aber keine Filter.
- CSV:
  - Bestehender `GET /api/admin/teams-export` bleibt Full Competition Export.
  - Neuer Layout-Export via `POST /api/admin/teams-export` nutzt `layoutId` + gefilterte Team-IDs.
  - Serverseitige Export-Allowlist `TEAM_EXPORT_COLUMN_DEFINITIONS`; keine freien JSON-Datenpfade.
- Lokale Checks:
  - `npx prisma validate` gruen
  - `npx prisma generate` gruen
  - `npx tsc --noEmit` gruen
  - `npm run build` gruen
  - Inline-`tsx` Check fuer Layout-Sanitization und CSV-Allowlist gruen
  - `git diff --check` gruen
- Commit: `36efa09 Add saved dashboard layouts`
- Production Deploy:
  - Deployment-ID: `dpl_EAtRbHGp4vntJ54oT5djDUemUKf8`
  - Vercel-URL: `https://s5-evo-portal-die3r3mq3-sebastiankroeker-2781s-projects.vercel.app`
  - Alias: `https://portal.s5evo.de`
  - Ready-State: `READY`
- Production Migration:
  - `npx prisma migrate deploy` hat `20260709214500_add_dashboard_layouts` erfolgreich angewendet.
- Post-Deploy Smoke:
  - `npm run smoke:public` gruen
  - `/sportlerboerse` 200
  - `/sportlerboerse/mtc` 200
  - `/api/dashboard-layouts` ohne Session 401 erwartet
  - `/api/admin/teams-export` ohne Session 401 erwartet

## Lokale Notizdateien (bewusst untracked)

- `AGENTS.md`
- `HEARTBEAT.md`
- `MEMORY.md`
- `SOUL.md`
## Current Handoff - 2026-07-22 11:45 UTC

Context:

- Sebastian is done for the day after successfully testing the full Legacy
  Ergebnis-Import V2 path.
- RUN, ROAD, MTB were imported with corrected test CSVs and Sebastian reported
  no visible issues.
- BENCH was fixed/deployed for Legacy `-999` DNF handling and imported
  successfully.
- STOCK was fixed/deployed for Legacy tie-breakers and BWZ/Streichergebnis
  display; Sebastian imported it and said it looks good on first pass.

Production:

- Live URL: `https://portal.s5evo.de`.
- Latest pushed code commit: `94e7e3a Handle legacy stock tie breakers`.
- Latest Vercel deployment: `dpl_QWFvViDedR9vXyrWQhQdwzJKLfMw`.
- Deployment URL:
  `https://s5-evo-portal-ci3pl138s-sebastiankroeker-2781s-projects.vercel.app`.
- Ready state: `READY`.
- Post-deploy smokes passed:
  - `npm run smoke:public`
  - `HEAD https://portal.s5evo.de/`: 200
  - Results API with `includeStaging=true`: 200

Legacy Result Import V2 current behavior:

- V2 import performs Dry-run first; Dry-run writes nothing.
- Confirmed write creates `PROD_TEST` staging packages only.
- Official production results are not written by this flow.
- Legacy CSV points/ranks remain the staged source of truth.
- S5Evo scoring engine runs as validation/control calculation only and emits
  warnings for mismatches.
- `Live -> Ergebnisse` can show staging packages when `Staging-Testdaten` is
  enabled.
- Teams without imported results, especially start number `35`, are kept visible
  in overall result lists without points.

Discipline notes:

- RUN/ROAD/MTB: generated test CSVs are corrected against current engine scoring
  and portal classes.
- BENCH: Legacy `-999` imports as DNF; generated test CSV clears non-scoring
  attempt rows and corrects class and Damen/Herren Gesamt values.
- STOCK: tie-breaker validation/correction uses rings descending, BWZ
  descending, then Streichergebnis descending. `AuSchubBWZ` display is
  left-padded to 8 digits and formatted as `##.###.###`.
- Stock individual result rows now show BWZ and Streichergebnis below the ring
  value.

Prepared artifact:

- Latest corrected test archive:
  `/home/ocadmin/.openclaw/workspace/exports/legacy-results-portal-startnumbers-2026-07-22.tar.gz`
- SCP:
  `scp ocadmin@192.168.100.159:/home/ocadmin/.openclaw/workspace/exports/legacy-results-portal-startnumbers-2026-07-22.tar.gz .`

Documentation:

- Main CR: `docs/cr/2026-07-21-legacy-result-import-v2.md`.
- Local docs-only commits intentionally not pushed to avoid docs-only Vercel
  deploys:
  - `753a70a docs: record legacy bench import release`
  - `32bed30 docs: record legacy stock import release`
- Git is expected `main...origin/main [ahead 2]`.
- Untracked workspace note files are still intentionally untouched:
  `AGENTS.md`, `HEARTBEAT.md`, `MEMORY.md`, `SOUL.md`.

Next recommended step:

1. Run a read-only staging audit across all imported packages.
2. Verify package completeness, draft counts, engine warnings, class ranks,
   Damen/Herren Gesamt ranks, Bank DNF, Stock ties, and start number `35`
   without points.
3. Only after that, create a separate CR for an official result publish flow
   with preview, warning gate, explicit confirmation, audit event, and no
   ambiguous `Produktion` dropdown.
