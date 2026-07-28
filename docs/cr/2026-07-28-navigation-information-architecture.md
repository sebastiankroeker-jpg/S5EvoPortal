# CR: Navigation und Informationsarchitektur

Status: Local implementation complete; release approval pending
Date: 2026-07-28
Type: feature
Risk: standard
Owner: S5Evo

## Problem

Sidebar, mobile Command-Pill und Suche enthalten historisch gewachsene,
teilweise getrennt gepflegte Menülisten. Sie gruppieren Funktionen
unterschiedlich, zeigen technische Admin-Bezeichnungen und wiederholen
Navigation in mehreren Oberflächen. Dadurch ist die Portalstruktur für
Teilnehmer, Orga und Admin nicht mehr unmittelbar aufgabenorientiert.

## Scope

- Ein deklaratives, rollen- und wettkampfscope-bewusstes Navigationsmodell als
  gemeinsame Quelle für Sidebar, Suche und mobile Navigation.
- Aufgabenorientierte Gruppen:
  - **Wettkampf:** Start, Anmeldung/Mein Team, Live, Karte.
  - **Arbeiten:** Mannschaften, Änderungen, Zeitnahme, Sportlerbörse.
  - **Verwalten:** Wettkampf & Inhalte, Ergebnisse, Benutzer & Rollen,
    Betrieb & Audits.
  - **Konto:** Profil, Nachrichten, Changelog, Abmelden; Darstellung bleibt
    eine Konto-/Einstellung und keine Hauptnavigation.
- Permission- und Claim-Route-Filter bleiben serverseitig unverändert; die
  Navigation bildet nur bereits erlaubte Ziele ab.
- Einheitliche Labels, Icons, Reihenfolge, Suchkeywords und Zieldefinitionen.

## Non-goals

- Keine Änderung an Route-Guards, Rollen, Tenant-/Competition-Auflösung oder
  API-Verträgen.
- Keine Änderung von Teams, Teilnehmern, Ergebnissen, Klassen oder 2027-Daten.
- Keine neue Offline-Persistenz oder Erweiterung der Suche um zusätzliche
  personenbezogene Daten.

## Risk and Privacy Review

- Die Navigation ist keine Berechtigungsinstanz. Jeder Link wird weiterhin
  durch die bestehende API-/Seitenautorisierung abgesichert.
- Die existierende Teamsuche bleibt nur für die jeweils erlaubte
  Competition-/Rollenansicht aktiv. Es werden keine neuen Teilnehmerfelder
  abgefragt, gespeichert oder geloggt.
- Haupt-Risiko sind verlorene oder falsch gruppierte Links. Deshalb wird die
  vollständige aktuelle Zielmenge gegen die neue deklarative Quelle getestet;
  verborgenes UI gilt nie als Zugriffsschutz.

## Acceptance Criteria

- Sidebar, Suche und mobile Command-Pill verwenden dieselbe erlaubte
  Navigationseintragsquelle.
- Jede Rolle sieht ausschließlich die bereits erlaubten Ziele, jedoch in
  nachvollziehbaren Aufgabengruppen.
- Claim-Links bleiben auf ihre eingeschränkte Navigationsmenge begrenzt.
- Desktop und Mobile enthalten dieselben fachlichen Ziele; Darstellung und
  Konto-/Theme-Steuerung dürfen sich unterscheiden.
- Menü-Suche liefert Labels und Keywords der sichtbaren Struktur.

## Initial Audit

- `app/components/sidebar.tsx` pflegt eine eigene, flache Sidebar mit
  Orga-Team-Block und Theme-Steuerung.
- `lib/navigation-menu.ts` speist Suche und enthält eine zweite, anders
  benannte Zielmenge.
- `app/components/search-overlay.tsx` und `command-pill.tsx` duplizieren die
  Zielauflösung jeweils per `switch`.
- Die mobile Command-Pill enthält zusätzlich Platzhalter für nicht angebundene
  Ergebnisse/Ranglisten und ist nicht deckungsgleich mit Sidebar/Suche.

## Implementation Handoff

- Zuerst wird die Navigation als typisiertes Modell mit Gruppe, Sichtbarkeit,
  Label, Keywords und Ziel beschrieben.
- Danach werden Sidebar, Such-Overlay und mobile Command-Pill auf diese Quelle
  umgestellt. Bestehende Router-/Tab-Details werden zentral ausgeführt statt
  pro Oberfläche erneut implementiert.
- Checks: Navigation-/Claim-Matrix, TypeScript, ESLint, Diff-Check,
  Production-Build sowie nach Freigabe Desktop-/Mobile-Manual-Smoke für
  ZUSCHAUER, TEAMCHEF, ZEITNAHME und ADMIN.

## Implementation Notes

- `lib/navigation-menu.ts` now defines the shared task groups and derives the
  permitted groups from the existing navigation/permission filter. It also
  corrects the map entry to its established `portal.map.view` permission,
  matching the Friends map-access policy.
- Desktop sidebar consumes those shared groups instead of maintaining its own
  flat `Navigation` / `Orga-Team` list. Theme controls remain presentation
  settings below the task navigation.
- Mobile Command-Pill consumes the same groups and no longer renders obsolete
  result/ranking placeholders. Search already used the shared item source and
  therefore now inherits the same grouping/order/labels.
- Existing route targets and their handlers remain unchanged. This CR does not
  rely on UI hiding for access control.

## Verification

- Targeted ESLint passed for sidebar, command-pill, search overlay and the
  shared navigation model.
- `npx tsc --noEmit` passed.
- `git diff --check` passed.
- Navigation matrix passed locally: an all-permission Admin receives the four
  groups (Wettkampf, Arbeiten, Verwalten, Konto); a claim route is limited to
  its permitted competition/account subset and labels `my-teams` as
  `Mein Team`.
- `npm run build` passed; 78 production pages/routes generated successfully.

## Release Gate

- Required: explicit approval for complete commit/push to auto-deploying
  `main`, Vercel production deploy and public/unauthenticated smoke.
- Manual smoke after deploy: verify task groups and link targets as
  ZUSCHAUER, TEAMCHEF, ZEITNAHME and ADMIN; verify a Friends account sees the
  Karte but no admin surfaces.

## Confirmation Gate

- Local implementation: covered by Sebastian's instruction to proceed with
  the proposed Navigation-/IA-CR after the successful clone dry-run.
- Commit/push/deploy: separate confirmation required because `main`
  auto-deploys to production.
