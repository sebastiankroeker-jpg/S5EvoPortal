# CR: Wettbewerbs-Sichtbarkeit, Auswahl und Anmeldung

Status: In implementation (local only)
Date: 2026-07-28
Type: schema + feature
Risk: high
Owner: S5Evo

## Context

Der 2027-Wettkampf ist als Draft vorbereitet. Status, Portal-Sichtbarkeit,
Anmeldefreigabe und die Default-Auswahl sind bisher nicht getrennt modelliert:
normale Portal-User erhalten nur den neuesten offenen Wettkampf, und die
Anmeldung kann ohne explizite `competitionId` auf einen impliziten Default
fallen.

Sebastian hat entschieden:

- 2027 ist zunächst nur für eingeloggte Portal-User sichtbar und anmeldbar.
- Ein `RUNNING`-Wettkampf übersteuert den Standard auf den letzten
  abgeschlossenen Wettkampf.

## Scope

- In scope:
  - Separate Portal- und Anmeldesichtbarkeit je Wettbewerb.
  - Rollenbewusste, serverseitig gefilterte Wettbewerbsliste und abgesicherter
    Einzel-Read.
  - Auswahl-Default: gespeicherte sichtbare Wahl, dann `RUNNING`, dann der
    neueste sichtbare `CLOSED` Wettbewerb, anschließend ein sichtbarer
    Fallback.
  - Jede Anmeldung übermittelt und validiert eine explizite `competitionId`.
  - 2027 kann nach bewusster Admin-Konfiguration als `DRAFT` +
    `PORTAL_USERS` für Sichtbarkeit und Anmeldung genutzt werden.
- Out of scope:
  - Keine Änderung von Rollen, Ergebnis- oder Teamdaten.
  - Keine automatische Öffnung/Veröffentlichung von 2027.
  - Keine 2024-Tenant-Konsolidierung.

## Affected Flows

- User/API/admin flows touched: Wettkampfumschalter, öffentliche/
  authentifizierte Wettbewerbsreads, Registrierung, Admin-Wettkampfeinstellung.
- Data model impact: additive, nullable Sichtbarkeitsfelder auf `Competition`.
- Auth/permission impact: Sichtbarkeit ist serverseitig durchgesetzt; ADMIN
  sieht seinen Tenant vollständig, operative Rollen nur ihre Zuweisungen plus
  regulär sichtbare Wettbewerbe, eigene Team-/Teilnehmerbezüge bleiben lesbar.
- Sensitive data impact: keine neuen PII-Felder. Die Liste enthält nur
  nicht-sensitive Wettkampfmetadaten.
- Offline/cache/export/log/mail impact: Wettbewerbscache und Auswahl werden
  nach angemeldetem Subject und sichtbarer Wettbewerbsmenge getrennt; keine
  Teams/Personen im Cache.
- Production/deploy impact: additive Migration; die 2027-Konfiguration ist
  eine separate, bewusste Produktionsdatenänderung nach Feature-Release.

## Privacy / Security Review

- Sensitive fields touched: keine neuen; Team-/Teilnehmerbezüge dienen nur
  serverseitig als Berechtigungsanker und werden nicht im Listenpayload
  ausgegeben.
- Purpose / data minimization: nur ID, Name, Jahr, Status und erlaubte
  Konfiguration für sichtbare Wettbewerbe.
- Visibility by role/user/API/UI: `PRIVATE`, `PORTAL_USERS`, `PUBLIC` werden
  am Listen- und Einzel-Endpoint geprüft; UI ist nur Darstellung.
- Persistence locations: zwei Enumfelder in PostgreSQL; funktionaler Browser
  Cache nur mit Subject-/Sichtbarkeits-Scope.
- Offline/cache behavior: alter V1-Cache wird nicht weiterverwendet; Logout
  und Subjectwechsel dürfen keine fremde Wettbewerbsliste wiederherstellen.
- Logs/mails/exports/screenshots exposure: keine PII oder Sichtbarkeitslisten
  in technischen Logs.
- Negative checks for unauthorized access or payload leakage: private/portal-
  user Wettbewerbe sind anonym via Liste und expliziter ID nicht lesbar;
  Registrierung ohne sichtbare/passende ID wird abgewiesen.
- Authenticated smoke plan or explicit gap: ADMIN, Portal-User und
  ZEITNAHME/Moderator in 2027/2026; kontrollierte Sessions fehlen derzeit.
- Residual risk: Der neue Wert für 2027 wird erst nach separatem Daten-Gate
  gesetzt; bis dahin bleibt ein Draft für Nicht-Admins geschlossen.

## Data / API Design

- Proposed data model:
  - `Competition.portalVisibility`: `PRIVATE | PORTAL_USERS | PUBLIC | null`
  - `Competition.registrationVisibility`: `CLOSED | PORTAL_USERS | PUBLIC | null`
  - `null` bleibt eine sichere Legacy-Interpretation: Nicht-Draft lesbar,
    Anmeldung nur bei `OPEN`; ein Legacy-Draft ist nicht neu anmeldbar.
- Proposed API shape:
  - `GET /api/competitions` liefert die serverseitig sichtbare Auswahl.
  - `GET /api/competition?id=` erzwingt dieselbe Sichtbarkeit.
  - `POST /api/teams` verlangt `competitionId` und prüft Sichtbarkeit,
    Anmeldesichtbarkeit und Frist serverseitig.
- Backward compatibility: vorhandene OPEN/CLOSED/RUNNING Wettbewerbe bleiben
  lesbar; neue explizite Werte werden über Admin gepflegt.
- Migration/data backfill: Migration ist additiv und schreibt keine
  Wettbewerbskonfiguration. 2027 `PORTAL_USERS`/`PORTAL_USERS` wird erst nach
  separater Freigabe gespeichert.

## Business Invariants

- Lebenszyklus (`DRAFT`, `OPEN`, `RUNNING`, `CLOSED`) ist unabhängig von
  Sichtbarkeit und Anmeldesichtbarkeit.
- `RUNNING` gewinnt nur bei der Standardauswahl, nicht gegen eine explizit
  gespeicherte und weiterhin sichtbare Benutzerwahl.
- Jede Schreibanmeldung hat eine explizite, serverseitig sicht- und
  anmeldbare `competitionId`; es gibt keinen "neuester OPEN"-Write-Fallback.

## Acceptance Criteria

- Anonyme Nutzer sehen weder `PRIVATE` noch `PORTAL_USERS` Wettbewerbe,
  auch nicht über eine erratene ID.
- Angemeldete Portal-User können einen auf `PORTAL_USERS` gesetzten 2027
  Draft auswählen und sich dafür anmelden.
- Standardauswahl erfüllt die dokumentierte Priorität.
- ADMIN behält Tenant-weite Einsicht; operative Rollen erhalten keinen
  operativen Zugriff außerhalb ihrer Grants.
- Keine fremde Wettbewerbsliste wird aus einem Browsercache wiederverwendet.

## Implementation Handoff

- Relevant files: `prisma/schema.prisma`, `lib/competition-context.tsx`,
  `app/api/competition/route.ts`, neue Listenroute, `app/api/teams/route.ts`,
  Registrierung und Admin-Wettkampfeinstellungen.
- Current decisions: 2027 ist anfänglich Portal-User-only; RUNNING übersteuert
  den Standard letzten abgeschlossenen Wettbewerbs.
- Non-goals: kein 2027-Statuswechsel und keine automatische Datenfreigabe.
- Required checks: Visibility-/Default-Matrix, Tenant-Scope-Inventar,
  TypeScript, ESLint, Prisma-Validierung, Build und nach Release
  unauthentifizierte Negativ-Smokes.

## Confirmation Gate

- Gate needed: yes
- Reason: Auth-/Sichtbarkeitssemantik, additive Schema-Migration,
  Registrierungs-Schreibpfad und spätere 2027-Produktionskonfiguration.
- Approved by: Sebastian, lokale Implementierung durch Bestätigung der zwei
  Fachentscheidungen am 2026-07-28 UTC.
- Not approved: Commit/Push auf auto-deployendes `main`, Vercel-Deploy,
  Migration oder Setzen der 2027-Sichtbarkeitswerte.

## Implementation Notes

- Files changed:
  - additive Prisma enums/fields and migration (no `UPDATE`/backfill);
  - shared visibility/default policy and role-aware `/api/competitions` read;
  - explicit-ID registration guard for team, marketplace and MTC submissions;
  - public competition detail guard, subject-scoped competition cache and
    visible competition selector;
  - Admin controls for portal and registration visibility.
- Important decisions during implementation:
  - Existing null values retain a safe legacy interpretation until an admin
    explicitly configures a competition. In particular, a legacy `DRAFT`
    does not remain silently registrable.
  - 2027 is not changed by schema deployment; its Portal-User settings are a
    separate, auditable UI data action after the feature release.

## Verification

- Local checks: Prisma validation, TypeScript, ESLint, tenant-scope inventory
  (81 routes), visibility/default matrix and diff check passed.
- Build: production build passed; `/api/competitions` is in the route manifest.
- Targeted verification: anonymous Portal-User/Draft rejection, authenticated
  Portal-User acceptance, legacy-Draft fail-closed semantics, `RUNNING`
  default precedence, explicit-registration-ID guard and public-detail marker
  are covered by `verify:competition-visibility`.
- Sensitive-data negative checks:
- Authenticated role smoke:

## Deploy

- Deployment needed: yes
- Deployment ID:
- Production alias: https://portal.s5evo.de

## Follow-Ups

- Nach Feature-Release separat 2027 auf `PORTAL_USERS` / `PORTAL_USERS`
  konfigurieren und als eingeloggter Portal-User prüfen.
