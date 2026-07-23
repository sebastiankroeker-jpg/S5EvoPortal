# CR: Privacy consent, cookie settings and communication opt-in

Status: Deployed
Date: 2026-07-23
Type: feature
Risk: high
Owner: S5Evo

## Context

Sebastian requested a new privacy CR:

- opt-in for Datenschutz/Cookies
- ask participants with stored e-mail addresses whether S5Evo may send them
  messages
- analyze which cookies/storage/external services are used
- offer user-facing customization
- draft a short privacy notice
- keep optional features disabled when consent is missing

This is high risk because it touches e-mail addresses, consent state, auth
cookies, browser storage, external services, and outbound messages.

## Current Inventory

Observed in code on 2026-07-23:

- Authentication/session:
  - NextAuth with JWT session strategy in
    `app/api/auth/[...nextauth]/route.ts`.
  - Auth provider: Authentik OIDC at `auth.s5evo.de`, scope
    `openid profile email`.
  - Expected cookies from NextAuth/Auth flow:
    - session token
    - CSRF token
    - callback URL
    - PKCE/state/nonce cookies during login
  - Purpose: login, session security, CSRF/OIDC protection.
  - Classification: essential for authenticated portal use.
- Consent/settings storage:
  - not implemented yet.
  - Proposed: one essential consent cookie or localStorage record, plus
    account-backed consent for logged-in users.
- Browser localStorage/sessionStorage:
  - `lib/theme-context.tsx`: theme and visual preferences.
  - `lib/competition-context.tsx`: selected competition.
  - `app/components/sidebar.tsx`, `app/components/nav-bar.tsx`,
    `app/components/layout-wrapper.tsx`: sidebar/navigation preferences.
  - `app/components/dashboard.tsx`: dashboard layout/list preferences.
  - `app/components/message-center.tsx`: message filters, visible columns,
    personal/admin compose drafts.
  - `app/zeitnahme/page.tsx` and `/zeitnahme/monitor`: local timekeeping state.
  - `lib/pwa-offline-cache.ts`: PWA offline read-model helpers.
  - `lib/auth-flow.ts`: temporary login callback data in sessionStorage.
  - Classification:
    - essential/session: auth callback state
    - functional preferences: theme/navigation/dashboard/selected competition
    - sensitive optional/local feature: message drafts, timekeeping/offline data
- PWA/service worker:
  - `app/components/pwa-service-worker.tsx` registers `/sw.js`.
  - `public/sw.js` precaches offline shell/static icons and explicitly skips
    `/api/*` and `/_next/*`.
  - Classification: functional/offline; not needed for core website access.
- External services:
  - Vercel: hosting/runtime for `portal.s5evo.de`.
  - Database via Prisma/PostgreSQL: portal data persistence.
  - Authentik: login/identity provider.
  - Resend: outbound e-mail via `https://api.resend.com/emails`.
  - MapTiler: map tiles on `/karte` when `NEXT_PUBLIC_MAPTILER_KEY` is set;
    fallback is OpenStreetMap tile server when the key is missing.
  - Google Maps: route links only. Current code creates external links; Google
    is contacted only after the user clicks the route link.
  - Next/font Google imports are used at build time; Next normally self-hosts
    the optimized font assets, so no runtime Google Fonts request is expected.
- Analytics/tracking:
  - No active Google Analytics/PostHog/Sentry tracking code found in the
    searched app/lib/components/public paths.
  - `lib/data/architecture.ts` has a conceptual "analytics" node for audit
    logs, not a third-party analytics implementation.

## Recommended Consent Model

Use a compact consent center with four categories:

1. Essential
   - Always active.
   - Includes login/session/security cookies, CSRF/OIDC state, consent record,
     requested route/session state needed to provide the portal.
   - No toggle, only explanation.
2. Functional preferences
   - Default: on for usability, but user can switch off.
   - Theme, sidebar, selected competition, dashboard/list preferences.
   - If off: use defaults and avoid writing non-essential preferences.
3. External map content
   - Default: off until accepted.
   - Enables MapTiler/OpenStreetMap tile requests on `/karte`.
   - If off: show sponsor list and a map placeholder with a one-click
     "Karte laden" action that grants this category.
   - Google Maps route links remain plain external links and should be labeled
     as leaving the portal.
4. Local offline and drafts
   - Default: off until accepted.
   - Enables service worker registration, PWA offline shell, message drafts,
     and local timekeeping/offline state.
   - If off: no service worker registration; no local message draft retention;
     timekeeping/offline data remains session-only or disabled.

Communication consent should be separate from cookie/storage consent:

- `transactional`: no separate marketing opt-in; includes registration
  confirmation, claim/account links, admin decisions, support replies, and
  direct messages explicitly caused by the user's portal action.
- `portalMessagesEmailOptIn`: optional opt-in for e-mail notifications about
  portal messages/news/reminders to participants with stored e-mail addresses.
- Default: false for existing participants/users unless there is already a
  clear active consent record.
- Users can grant/withdraw in profile and during registration/claim.
- Admin can see consent status but should not silently override it.

## Data / API Design

Preferred database model:

- Add `UserConsent` or `ConsentPreference` table:
  - `id`
  - `userId` nullable for anonymous/session-level consent
  - `participantId` nullable for participant-specific communication consent
  - `tenantId`
  - `competitionId` nullable
  - `category`: `ESSENTIAL`, `FUNCTIONAL`, `EXTERNAL_MAPS`, `LOCAL_OFFLINE`,
    `PORTAL_MESSAGE_EMAIL`
  - `granted`: boolean
  - `version`: privacy notice version, e.g. `2026-07-23`
  - `source`: `banner`, `profile`, `registration`, `claim`, `admin_import`
  - `createdAt`, `updatedAt`, `withdrawnAt`
  - optional audit metadata with no broad PII in technical logs.

Minimal implementation option:

- Add consent fields to `User` and `Participant` for the immediate need:
  - `privacyNoticeVersion`
  - `privacyAcceptedAt`
  - `functionalStorageConsentAt`
  - `externalMapConsentAt`
  - `localOfflineConsentAt`
  - `portalMessageEmailConsentAt`
  - withdrawal timestamps
- This is faster but less flexible than a consent table. I prefer the table
  because it is cleaner for auditability and future categories.

API/UI:

- `GET /api/privacy/preferences`: returns current consent state.
- `PUT /api/privacy/preferences`: updates categories and writes audit event.
- `GET /datenschutz`: public privacy notice.
- Consent banner:
  - Buttons: "Nur notwendige", "Alle akzeptieren", "Einstellungen".
  - Same first-layer availability for accept and reject.
  - No preselected optional boxes.
- Profile settings:
  - "Datenschutz & Einwilligungen" with toggles and withdrawal.
- Registration/claim:
  - mandatory acknowledgement of privacy notice for the form submission
    processing itself.
  - optional checkbox for e-mail notifications/news/messages.

## Draft Privacy Notice Text

Kurzfassung für `/datenschutz` and the consent dialog:

> Wir verarbeiten die im Portal eingegebenen Daten, um den Soier 5Kampf zu
> organisieren: Anmeldung, Mannschaftsverwaltung, Startnummern, Ergebnisse,
> Nachrichten und organisatorische Rückfragen. Dazu gehören je nach Nutzung
> Namen, Geburtsjahr bzw. Geburtsdatum, E-Mail-Adresse, Telefonnummer,
> Mannschafts- und Teilnehmerdaten, Rollen, Nachrichten, Änderungs- und
> Auditprotokolle.
>
> Verantwortlich ist Sebastian Kroeker, Schleifmühlweg 8, 82435 Bad Bayersoien,
> E-Mail: esv@s5evo.de.
>
> Wir geben Daten nicht an Dritte weiter, sofern dies für Betrieb und Nutzung
> des Portals nicht erforderlich ist. Erforderliche Dienstleister sind
> insbesondere Hosting/Betrieb, Datenbank, Login-Dienst, E-Mail-Versand und
> optional Kartendienste. Diese Dienstleister verarbeiten Daten nur für die
> bereitgestellten Portalzwecke.
>
> Notwendige Cookies und Speicherungen nutzen wir für Login, Sicherheit,
> Formularschutz, Session und die Speicherung deiner Datenschutzeinstellungen.
> Optionale Speicherungen für Komfortfunktionen, lokale Entwürfe,
> Offlinefunktionen und externe Kartendienste werden nur genutzt, wenn du sie
> aktivierst. Wenn du sie nicht aktivierst, bleiben die entsprechenden
> Funktionen deaktiviert oder werden nur eingeschränkt angezeigt.
>
> E-Mail-Nachrichten senden wir ohne gesonderte Werbeeinwilligung nur, wenn sie
> für deine Anmeldung, dein Konto, deine Mannschaft oder eine von dir
> ausgelöste Portalaktion erforderlich sind. Für zusätzliche Portal-
> Benachrichtigungen per E-Mail fragen wir dich gesondert und du kannst diese
> Einwilligung jederzeit widerrufen.

Detailed service list for the full page:

- S5Evo Portal / Verantwortliche Stelle: Sebastian Kroeker, Schleifmühlweg 8,
  82435 Bad Bayersoien, esv@s5evo.de.
- Vercel: hosting and delivery of the web application.
- PostgreSQL/Prisma database: storage of portal records.
- Authentik: login and account identity.
- Resend: transactional e-mail delivery.
- MapTiler/OpenStreetMap: optional map images on `/karte`.
- Google Maps: only when the user opens a route link.
- Browser storage: essential session/security plus optional preferences/offline.

## Privacy / Security Review

- Sensitive fields touched:
  - names, e-mails, phone numbers, participant records, messages, consent
    records, login IDs, audit logs.
- Purpose / data minimization:
  - Only store consent category, timestamp, version, source and actor/context.
  - Do not store unnecessary user-agent/IP in consent records unless a legal
    audit need is explicitly confirmed.
- Visibility:
  - users see and edit their own settings.
  - admins see consent status for support/operations, not unnecessary details.
- Persistence:
  - DB for account/participant consent.
  - one essential browser consent record for anonymous users.
  - optional browser storage only after the relevant category is active.
- Offline/cache:
  - keep `/api/*` out of service worker cache.
  - disable service worker registration until local offline consent.
  - add logout cleanup for optional local storage keys.
- Logs/mails/exports:
  - do not log full consent payloads with PII.
  - no consent data in normal CSV exports unless explicitly needed.
  - mail events should reference consent status but avoid broad message bodies.
- Residual risk:
  - exact legal wording should be reviewed by the responsible Verein/DSB if this
    becomes the public final Datenschutzerklärung.

## Acceptance Criteria

- Public user can open `/datenschutz` without login.
- First visit shows a small consent dialog unless only essential storage is
  active or a prior choice exists.
- "Nur notwendige" keeps map tiles, service worker, local drafts and optional
  preferences off.
- "Alle akzeptieren" enables functional preferences, external map tiles and
  local offline/drafts.
- "Einstellungen" allows granular toggles and later withdrawal.
- `/karte` does not request MapTiler/OSM tiles until external map consent or
  explicit one-click map load.
- PWA service worker is not registered until local offline consent.
- Message drafts are not persisted without local offline/draft consent.
- Participants/users can opt in/out of optional e-mail notifications.
- Transactional mails for required registration/account/support flows remain
  possible and documented separately from optional notifications.
- Consent changes are recorded with timestamp and notice version.

## Implementation Handoff

- Relevant files:
  - `prisma/schema.prisma`
  - `app/layout.tsx`
  - `app/providers.tsx`
  - `app/components/pwa-service-worker.tsx`
  - `app/components/event-map.tsx`
  - `lib/event-map/sponsor-pois.ts`
  - `app/components/message-center.tsx`
  - `lib/theme-context.tsx`
  - `lib/competition-context.tsx`
  - `lib/auth-flow.ts`
  - `app/api/auth/[...nextauth]/route.ts`
  - `lib/mail/*`
  - new `app/datenschutz/page.tsx`
  - new consent API/components under `app/api/privacy/*` and
    `app/components/privacy-*`
- Current decisions:
  - separate cookie/storage consent from optional e-mail communication consent.
  - essential auth/security remains always active.
  - optional external/local features are default-off unless granted.
- Open decisions:
  - association/contact details for the public privacy notice.
  - exact retention periods.
  - whether functional preferences should be default-on or opt-in-only. Safest:
    opt-in-only for all non-essential writes.
  - whether existing participants should receive a one-time consent request by
    e-mail now, and with what wording.
- Non-goals:
  - no tracking/marketing implementation.
  - no automatic mass e-mail before separate explicit approval.
  - no production deploy before gate approval.
- Expected implementation steps:
  1. Add consent data model and migration.
  2. Add consent API and UI provider.
  3. Add `/datenschutz` page and footer/profile links.
  4. Gate MapTiler/OSM tile loading.
  5. Gate service worker registration and local draft/offline persistence.
  6. Add communication opt-in fields and UI.
  7. Update mail sending so optional notifications respect opt-in while
     transactional mails continue.
  8. Add admin visibility for consent state.
  9. Add tests/smokes and update CR/handoff.
- Required checks:
  - `npx tsc --noEmit --incremental false`
  - targeted ESLint for touched files
  - `npm run build`
  - `git diff --check`
  - migration review and Prisma generate
  - targeted privacy checks for unauthenticated/authenticated payload shape
  - browser smoke for consent choices and map/service-worker gating
- Context read before implementation:
  - `SESSION_HANDOFF.md` top block: read 2026-07-23 01:42 UTC.
  - Relevant prior CR(s): registration deadline CR and event map CR list read
    enough for current scope.
  - Relevant source files: auth route, service worker, mail sender, map,
    schema, layout/providers, storage references.

## Confirmation Gate

- Gate needed: yes.
- Reason:
  - high-risk privacy/consent feature, DB migration, e-mail behavior changes,
    browser storage behavior, external service gating, and production deploy.
- Sensitive-data/production-data reason:
  - stores and changes consent state linked to users/participants/e-mails.
- Approved by:
  - Sebastian via Telegram: "Go".
- Approval timestamp:
  - 2026-07-23 01:54 UTC.

## Implementation Notes

- Files changed:
  - `prisma/schema.prisma`
  - `prisma/migrations/20260723015620_privacy_consent_preferences/migration.sql`
  - `lib/privacy-consent.ts`
  - `lib/privacy-consent-context.tsx`
  - `app/api/privacy/preferences/route.ts`
  - `app/components/privacy-consent-banner.tsx`
  - `app/components/privacy-settings-panel.tsx`
  - `app/datenschutz/page.tsx`
  - `app/providers.tsx`
  - `app/profile/page.tsx`
  - `app/components/event-map.tsx`
  - `app/components/pwa-service-worker.tsx`
  - `app/components/message-center.tsx`
  - `lib/mail/message-notification.ts`
  - `lib/theme-context.tsx`
  - `lib/competition-context.tsx`
- Important decisions during implementation:
  - Implemented a dedicated `ConsentPreference` table with category, grant
    state, notice version, source, timestamps, and optional user/participant/
    tenant/competition context.
  - Added `/api/privacy/preferences` for authenticated account-backed consent;
    anonymous consent stays in essential local browser storage only.
  - Added global consent banner with equal first-layer actions:
    "Nur notwendige", "Einstellungen", "Alle akzeptieren".
  - Added profile consent settings and public `/datenschutz` page.
  - Gated `/karte` so MapTiler/OSM tiles are not requested before
    `EXTERNAL_MAPS` consent or explicit "Karte laden".
  - Gated PWA service worker registration behind `LOCAL_OFFLINE`; withdrawal
    unregisters existing service workers and clears cache storage.
  - Gated message compose draft persistence behind `LOCAL_OFFLINE`.
  - Gated portal message e-mail notifications behind
    `PORTAL_MESSAGE_EMAIL`; users without opt-in do not receive these optional
    notification mails. Transactional registration/account/support mails remain
    unchanged.
  - Gated theme, active-competition preference, sidebar collapse state,
    dashboard preferences, selected dashboard layout, team list columns, and
    message list filters/columns behind `FUNCTIONAL_STORAGE`.
  - Added cleanup for known functional localStorage keys/prefixes when
    `FUNCTIONAL_STORAGE` is not granted or is withdrawn.
- Current local caveat:
  - Registration/claim forms do not yet include the communication opt-in; the
    current MVP asks in the global banner/profile and blocks optional portal
    notification e-mails unless consent exists.

## Verification

- Local checks:
  - `npx prisma generate` -> pass.
  - `npx tsc --noEmit --incremental false` -> pass.
  - targeted ESLint for privacy/map/PWA/message/profile/provider files -> pass.
  - targeted ESLint for sidebar/dashboard/list functional-storage follow-up
    files -> pass.
  - `git diff --check` -> pass.
- Build:
  - `npm run build` -> pass.
- Targeted verification:
  - Build output includes `/datenschutz` and `/api/privacy/preferences`.
  - Static code review confirms map tile layer initialization is skipped until
    `EXTERNAL_MAPS` consent.
  - Static code review confirms service worker registration is skipped until
    `LOCAL_OFFLINE` consent.
  - Static code review confirms optional portal message e-mails filter
    recipients by `PORTAL_MESSAGE_EMAIL` consent.
- Sensitive-data negative checks:
  - `/api/privacy/preferences` returns 401 before DB access when there is no
    authenticated session.
  - Consent audit event metadata stores category booleans/version/source, not
    message bodies or broad participant details.
- Authenticated role smoke:
  - Pending until the migration is applied in a test/prod-like DB and an
    authenticated browser session is available.

## Deploy / Migration Gate

- Deployment needed:
  - completed.
- Production deploy status:
  - deployed to `https://portal.s5evo.de`; current production alias also
    contains the later follow-up commits through
    `3de8925 Fix results matrix point rendering`.
- Migration status:
  - applied; `npx prisma migrate status` on 2026-07-23 10:31 UTC reported
    production schema up to date.
- Deployment/verification notes:
  - Local checks before deploy were green:
    `npx prisma generate`, `npx tsc --noEmit --incremental false`,
    targeted ESLint, `git diff --check`, `npm run build`.
  - Public production smoke after later deploys remained green:
    `npm run smoke:public`, `/api/competition` 200, `/api/results` 200,
    protected APIs 401 without session.
  - Authenticated browser smoke remains a manual gap for profile consent
    save/load and optional message e-mail behavior.

## Follow-Ups

- Legal review of final public Datenschutz text before going live.
- Decide whether to use one-time consent request e-mail for existing e-mail
  contacts, or collect consent only on next login/claim/registration.
- Decide retention periods for deleted users, participants, message drafts,
  audit logs and mail logs.
