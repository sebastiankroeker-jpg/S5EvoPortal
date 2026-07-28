# CR: Admin-only Projektstand und Release-Update

Status: Draft
Date: 2026-07-28
Type: content
Risk: medium
Owner: S5Evo

## Context

Die Versionsplakette oben links führt auf „Feedback & Projektstand“. Die
Plakette wird zwar derzeit in der Header-UI nach der aktiven Rolle verborgen,
die Zielseite und das Erstellen von Feedback-Requests sind aber für jedes
angemeldete Portal-Konto erreichbar. Sebastian möchte diese Oberfläche nur
für Admins zugänglich machen und den dort veröffentlichten Release-Stand
aktualisieren.

## Scope

- Header-Link bleibt nur für Admins sichtbar und wird gegen simulierte oder
  direkte Routenaufrufe serverseitig abgesichert.
- `/changelog` verweigert Nicht-Admins den Zugriff auf die
  Projektstands-/Feedback-Oberfläche.
- Das zugehörige Feedback-POST akzeptiert nur Admins, damit die geschützte
  Oberfläche nicht direkt über die API umgangen wird.
- App-Version und Changelog erhalten einen aktuellen Release-Eintrag;
  Projektstand und nächste Schritte werden auf den produktiven Stand 2026/27
  gebracht.

## Non-goals

- Keine Änderung an bestehenden Changelog-/Feedback-Datensätzen.
- Keine Änderung von Wettkampf-, Teilnehmer-, Rollen- oder
  Berechtigungsdaten.
- Keine neue Feedback-Oberfläche für Nicht-Admins.

## Affected Flows

- Header-Version und direkter Aufruf von `/changelog`.
- Lesen und Erstellen von Changelog-Requests.
- Statische Versions- und Projektstandstexte.

## Privacy / Security Review

- Betroffene Daten: bestehende Feedback-Einträge können Namen und E-Mail der
  Ersteller enthalten; sie bleiben ausschließlich über die bestehende
  Admin-API lesbar.
- Zugriff: Nicht-Admins erhalten für die Seite keine Projektstands-/
  Feedback-Oberfläche und für das Schreiben einen serverseitigen 401/403.
- Persistenz/Logs/Exports: unverändert; keine neuen Daten, Caches, Logs,
  E-Mails oder Exporte.
- Negativcheck: Nicht-Admin- bzw. anonyme Zugriffe auf Seite und POST werden
  getestet; der bestehende Admin-Lesezugriff bleibt erhalten.
- Restrisiko: kein kontrolliertes authentifiziertes Nicht-Admin-Produktions-
  Cookie vorhanden; lokale/unauthenticated API-Prüfung wird dokumentiert.

## Acceptance Criteria

- Nur ein tatsächlicher Tenant-Admin sieht die Header-Version als Link und
  kann `/changelog` inhaltlich nutzen.
- Ein direkter Nicht-Admin-Aufruf kann weder Feedback-Formular noch
  Projektstand nutzen; POST ist serverseitig geschützt.
- `APP_VERSION`, Changelog und Statuskarten beschreiben die aktuellen
  produktiven Meilensteine korrekt.
- Öffentliche Portal-Smokes bleiben grün.

## Implementation Handoff

- Relevante Dateien: `app/components/nav-bar.tsx`, `app/changelog/page.tsx`,
  `app/api/admin/changelog-entries/route.ts`, `lib/version.ts`,
  `lib/data/changelog.ts`.
- Entscheidung: „nur für Admins erreichbar“ wird als echte Server-/API-
  Autorisierung umgesetzt, nicht als UI-Ausblendung.
- Checks: TypeScript, gezielter Auth/API-Negativcheck, Production-Build,
  Diff-Check, anschließend Vercel-Deploy und öffentlicher Smoke.

## Implementation Notes

- Header, Suche, Command-Pill/Sidebar und Orga-Links verwenden die reale
  `ADMIN`-Rolle für den Changelog-Einstieg; eine simulierte Ansicht erweitert
  den Zugang nicht.
- Die Changelog-Seite zeigt erst nach dem Rollen-Ladevorgang Inhalte an und
  rendert für Nicht-Admins eine Zugriffsmeldung statt Projektstand,
  Feedback-Formular oder Inbox.
- `POST /api/admin/changelog-entries` verwendet nun dieselbe
  `requireAnyTenantRoles(..., ["ADMIN"])`-Prüfung wie Lesen und Verwalten.
- Die Release-Kennzeichnung ist `v0.8.0`; der neue Eintrag und die
  Statuskarten fassen die produktiven Wettkampf-/2027-Meilensteine zusammen.

## Verification

- `npx tsc --noEmit` passed.
- Targeted ESLint: no errors (four pre-existing unused-catch-variable
  warnings in `app/changelog/page.tsx`).
- `npm run build` passed.
- `git diff --check` passed.
- Authenticated non-admin smoke requires a controlled portal-user session and
  remains pending for post-deploy validation.

## Confirmation Gate

- Gate needed: yes
- Reason: Änderung von Rollen-/Zugriffssemantik und Push auf das
  auto-deployende `main`.
- Sensitive-data reason: vorhandene Feedback-Einträge mit Autor-Metadaten
  werden enger, nicht breiter, geschützt.
- Approved by: pending

## Follow-Ups

- Falls Nicht-Admin-Feedback künftig benötigt wird, erhält es eine separate,
  bewusst gestaltete und scope-geprüfte Erfassung statt der Admin-Seite.
