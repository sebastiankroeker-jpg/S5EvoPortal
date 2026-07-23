# CR: Live, map and message UI follow-ups

Status: Deployed
Date: 2026-07-23
Type: follow-up
Risk: medium
Owner: S5Evo

## Context

Sebastian reported several mobile/UI issues after map, live-list and message
changes:

- sponsor map selection stayed highlighted after closing the popup.
- scroll/zoom could reopen the sponsor info box.
- selecting map/list entries could become stuck.
- the sponsor lookup popup could render behind the card/header.
- Live navigation between team and start-list sections did not immediately
  scroll/focus the highlighted target.
- start lists needed tighter columns and less width pressure.
- non-admin messages missed the visible compose action.

## Scope

- Map:
  - close popup clears selected sponsor and amber marker ring.
  - selecting the same sponsor can clear/reselect cleanly.
  - scroll/zoom no longer reopens a closed info box.
  - popup/list interactions no longer block the header.
  - sponsor data corrections:
    Fischerhaeusl website removed, `Onkel Blech` renamed to `Oemer Blech`,
    Metzgerei Joerg address set to Hechenrainerstr. 1, 82449 Uffing, and
    Parkhotel no longer includes Kletterwald.
- Live:
  - start-list column spacing/width optimized.
  - gender column removed.
  - horizontal scroll available where necessary.
  - team/start-list cross-links focus the correct target immediately after
    navigation.
- Messages:
  - non-admin compose action is a visible `Neue Nachricht` button with
    paper-plane icon.
  - side collapse/open controls removed.

## Files

- `app/components/event-map.tsx`
- `lib/event-map/sponsor-pois.ts`
- `app/components/live-screen.tsx`
- `app/components/message-center.tsx`
- related styling where touched

## Deploy

- Relevant commits:
  - `8838191 Refine sponsor map selection and data`
  - `985cbe0 Refine message compose controls`
  - `136bae8 Refine mobile message and live list UI`
  - `5ff1d18 Stabilize sponsor map selection`
  - `1b1ef94 Refine live start list navigation`
  - `bdb581a Fix sponsor popup reselection`
  - `5211422 Stabilize live focus scrolling`
- Production alias: `https://portal.s5evo.de`
- Later production deployments include all listed commits.

## Verification

- Targeted ESLint for touched files was run during the respective fixes.
- `npx tsc --noEmit --incremental false`, `npm run build`,
  `git diff --check`, and `npm run smoke:public` were green in the deploy
  sequence.
- Sebastian confirmed the Live navigation focus fix with "Funktioniert".

## Remaining Gaps

- Final mobile visual smoke by Sebastian remains useful for:
  - sponsor map popup selection/deselection.
  - message compose button visibility as non-admin.
  - start-list width on the target device.
