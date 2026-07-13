# CR: Messenger Channel Clarity And Compact UI

Status: Implemented locally
Date: 2026-07-13
Type: feature
Risk: medium
Owner: S5Evo

## Context

Sebastian pruefte die mobile Messenger-UI fuer Orga- und persoenliches Postfach.

Rueckmeldungen:

- Admins koennen User persoenlich oder aus dem Orga-Postfach anschreiben; fuer Empfaenger muss klar erkennbar sein, in welchem Kanal sie kommunizieren.
- Bei neuer persoenlicher Admin-Nachricht soll die Zielperson analog zum Admin-Flow auswaehlbar sein.
- Im persoenlichen Compose reicht der Betreff; das sichtbare Kontext-Feld soll raus.
- Bei Benutzeranzeigen soll neben dem Anzeigenamen auch die E-Mail-Adresse sichtbar sein.
- Die mobile UI soll kompakter und uebersichtlicher werden.

## Scope

- In scope:
  - Sichtbare Kanal-/Absender-Kennzeichnung fuer Orga-Team vs. persoenliche Admin-Nachricht.
  - Admin-Composer kann zwischen `Orga-Team` und `Persoenlich` unterscheiden.
  - Persoenlicher Admin-Composer nutzt dieselbe registrierte Zielpersonen-Suche wie der Orga-Flow.
  - Benutzeranzeigen in Target-Liste, Thread-Header/Details und Portal-Badge zeigen Name plus E-Mail.
  - Persoenlicher User-Composer blendet das Kontext-Feld aus und nutzt intern weiterhin einen erlaubten Default-Kontext.
  - Mobile Verdichtung von Composer, Filterleiste, Threadliste und Chat-Bubbles.
- Out of scope:
  - Freie externe E-Mail-Empfaenger.
  - Nachrichtenversand per E-Mail statt Portal-Thread.
  - Server-Drafts.
  - Volltext-/Server-Pagination fuer die Zielpersonensuche.

## Affected Flows

- User/API/admin flows touched:
  - `/nachrichten` Orga-Postfach.
  - `/nachrichten` persoenliches Postfach fuer Admins.
  - `GET /api/messages/admin-targets`.
  - `POST /api/messages/admin-conversations`.
  - Thread-Detailansicht und Reply-Composer.
- Data model impact:
  - Voraussichtlich keine Migration, sofern persoenliche Admin-Nachrichten als Support-Conversation mit eingeschraenkter Teilnehmerliste abgebildet werden koennen.
- Auth/permission impact:
  - Orga-Nachrichten bleiben fuer Admin/Moderator im Gruppenpostfach sichtbar.
  - Persoenliche Admin-Nachrichten duerfen fuer den Empfaenger nicht wie Orga-Team-Kommunikation wirken.
  - Persoenliche Admin-Nachrichten enthalten nur Zielperson und absendenden Admin als aktive Teilnehmer.
- Production/deploy impact:
  - Frontend/API-Deploy noetig; keine Migration erwartet.

## Data / API Design

- Proposed data model:
  - Bestehendes `senderDisplayMode` bleibt fuer Nachrichtendarstellung erhalten.
  - Keine neue Tabelle.
  - Wenn moeglich: persoenliche Admin-Threads erhalten nur Zielperson und Absender als aktive `conversation_participants`.
- Proposed API shape:
  - `GET /api/messages/admin-targets` liefert zusaetzlich `email`.
  - `POST /api/messages/admin-conversations` akzeptiert `senderDisplayMode: "ORG" | "PERSONAL"` und entscheidet daran:
    - `ORG`: Orga-Team als sichtbarer Absender, Admin/Moderator-Gruppe beteiligt.
    - `PERSONAL`: echter Admin-Name als sichtbarer Absender, Teilnehmerliste nur Zielperson + absendender Admin.
- Backward compatibility:
  - Bestehende Orga-Threads bleiben unveraendert.
  - Bestehende Replies nutzen weiterhin ihren gespeicherten `senderDisplayMode`.
- Migration/data backfill:
  - Nicht geplant.

## Open Questions

- Decision 1:
  - Entschieden am 2026-07-13 durch Sebastian: `Persoenlich = persoenlich`. Persoenliche Admin-Nachrichten sind echte 1:1-Threads zwischen Admin und Zielperson.
- Decision 2:
  - Zielpersonensuche und Admin-/Kontaktanzeigen zeigen Name plus E-Mail. Orga-Team bleibt als Gruppenpostfach ohne private Admin-Mail dargestellt.

## Acceptance Criteria

- Empfaenger sehen im Thread klar, ob sie mit dem `Orga-Team` oder mit einer persoenlichen Admin-Nachricht kommunizieren.
- Admins koennen im persoenlichen Postfach eine neue Nachricht an eine registrierte Zielperson starten.
- Zielpersonen-Suche zeigt Anzeigename und E-Mail.
- Persoenlicher User-Composer zeigt kein Kontext-Feld mehr.
- Der Betreff bleibt sichtbar und editierbar.
- Orga- und persoenliche Nachricht koennen nicht versehentlich verwechselt werden.
- Mobile UI ist kompakter: weniger Meta-Zeilen im Compose, kompaktere Thread-Karten, Details einklappbar.
- Keine DB-Migration, sofern nicht durch die finale Privatheitsentscheidung erforderlich.

## Implementation Handoff

- Relevant files:
  - `app/components/message-center.tsx`
  - `app/api/messages/admin-targets/route.ts`
  - `app/api/messages/admin-conversations/route.ts`
  - `lib/messaging.ts`
  - `docs/cr/2026-07-13-message-channel-clarity-compact-ui.md`
- Current decisions:
  - E-Mail-Anzeige wird jetzt als gewuenscht betrachtet.
  - Kontext-Feld im persoenlichen User-Composer wird visuell entfernt, intern bleibt Default-Kontext.
  - Kanal-Kennzeichnung soll explizit statt nur ueber Farbe/Badge erfolgen.
  - Persoenliche Admin-Nachrichten sind echte 1:1-Threads; keine Orga-Gruppenbeteiligung.
- Open decisions:
  - Keine.
- Non-goals:
  - Keine externen Freitext-Empfaenger.
  - Kein Mail-Forwarding.
- Expected implementation steps:
  - Admin-Target-API um `email` erweitern und Suchtext anpassen.
  - Shared UI-Helfer fuer Name+E-Mail einfuehren.
  - Compose-Dialoge auf Kanal-Badge und kompakte Meta reduzieren.
  - Persoenlichen User-Composer ohne sichtbares Kontext-Feld rendern.
  - Admin-Personal-Composer ueber bestehende Zielpersonensuche anbinden.
  - Thread-Header/Bubbles mit klarer `Antwortet als ...` bzw. `Kanal: ...` Kennzeichnung ausstatten.
  - Checks laufen lassen und CR/Handoff aktualisieren.
- Required checks:
  - `pnpm exec eslint app/components/message-center.tsx app/api/messages/admin-targets/route.ts app/api/messages/admin-conversations/route.ts lib/messaging.ts`
  - `npx tsc --noEmit`
  - `git diff --check`
  - `npm run build`
- Risks/assumptions:
  - Persoenliche Admin-Nachrichten koennen ohne Migration sauber ueber Participants modelliert werden; muss vor Implementierung final verifiziert werden.

## Model / Subagent Plan

- Model switch needed: no
- Target model/role: current Codex implementation after confirmation
- Subagent needed: no
- Subagent role: n/a
- Handoff source: this CR + `SESSION_HANDOFF.md`

## Confirmation Gate

- Gate needed: yes
- Reason: Auth-/Privacy-Semantik fuer persoenliche Admin-Kommunikation und anschliessender Production-Deploy.
- Approved by: Sebastian, "Bitte direkt Production & Go :)"
- Approval timestamp: 2026-07-13 12:10 UTC

## Implementation Notes

- Files changed:
  - `app/components/message-center.tsx`
  - `app/api/messages/admin-targets/route.ts`
  - `app/api/messages/admin-conversations/route.ts`
  - `app/api/messages/conversations/route.ts`
  - `app/api/messages/conversations/[id]/messages/route.ts`
  - `lib/messaging.ts`
  - `docs/cr/2026-07-13-message-channel-clarity-compact-ui.md`
- Important decisions during implementation:
  - `senderDisplayMode=PERSONAL` in `POST /api/messages/admin-conversations` erstellt nur zwei Teilnehmer: Zielperson als `OWNER`, absendender Admin als `MEMBER`.
  - Orga-Postfach-Listen und Admin-Fallback-Zugriff beschraenken sich auf Threads mit aktiven `ADMIN`/`MODERATOR`-Teilnehmern.
  - Replies duerfen nur in Orga-Threads `senderDisplayMode=ORG` nutzen; persoenliche Threads erzwingen persoenlichen Absender.
  - Admins starten aus `Persoenlich` eine persoenliche Zielperson-Nachricht, aus `Orga-Team` eine Orga-Nachricht.
  - Zielpersonensuche, Portal-Badges und Thread-Kontakt-Details zeigen Name plus E-Mail.

## Verification

- Local checks:
  - `npx tsc --noEmit` gruen.
  - `npx eslint app/components/message-center.tsx app/api/messages/admin-targets/route.ts app/api/messages/admin-conversations/route.ts app/api/messages/conversations/route.ts app/api/messages/conversations/[id]/messages/route.ts lib/messaging.ts` gruen.
  - `git diff --check` gruen.
- Build:
  - `npm run build` gruen.
- Targeted verification:
  - API-/UI-Logik lokal per TypeScript/ESLint/Build verifiziert.
- Manual smoke:
  - Production smoke ohne Login gruen; Browser-Real-Smoke mit Admin-Login bleibt optional.

## Deploy

- Deployment needed: yes
- Deployment ID: `dpl_6x3eJszRccjTkQzF3k8qbc8FdDpF`
- Deployment URL: `https://s5-evo-portal-ifgomehp4-sebastiankroeker-2781s-projects.vercel.app`
- Production alias: `https://portal.s5evo.de`
- Deployed at: 2026-07-13 12:15 UTC

## Post-Deploy Smoke

- Routes checked:
  - `GET /` -> 200
  - `GET /nachrichten` -> 200
  - `GET /sportlerboerse-dashboard` -> 200
  - `npm run smoke:public` against `https://portal.s5evo.de` gruen
- API checks:
  - `GET /api/messages/conversations` without session -> 401
  - `GET /api/messages/admin-targets` without session -> 401
  - `GET /api/messages/admin-conversations` -> 405 because route is POST-only
  - `POST /api/messages/admin-conversations` without session -> 401
- Result: gruen

## Follow-Ups

- Optional Browser-Real-Smoke mit Admin-Login: persoenlich an User schreiben, Orga-Team an User schreiben, Empfaengeransicht Kanal pruefen.
