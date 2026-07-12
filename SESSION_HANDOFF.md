# SESSION_HANDOFF

Stand: 2026-07-12 14:05 UTC

## Aktueller Nachtrag: Team Manager Team Name Change

- Ausloeser:
  - Sebastian: Team Manager:innen sollen unter `Details -> Bearbeiten` den Mannschaftsnamen aendern koennen.
  - Folgeentscheidung: Bis zum Beginn des Wettkampfs sind Teamnamen-Aenderungen nicht genehmigungspflichtig.
- CR:
  - `docs/cr/2026-07-12-team-manager-team-name-change.md`
- Implementiert, noch nicht deployed:
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
- Naechster Schritt:
  - Commit erstellen, auf `main` pushen, Vercel-Deploy abwarten, Production smoke: `/`, `/aenderungen`, `/api/admin/pending-changes?scope=all` ohne Session 401, `/api/teams/<id>` ohne Session 401.

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
