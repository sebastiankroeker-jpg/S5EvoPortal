# CR: Soier Lions Startnummer und Legacy Ergebnis CSV Prep

Status: Applied
Date: 2026-07-22
Type: ops
Risk: high
Owner: S5Evo

## Context

`ESV Soier Lions` und `Schwaigers 5` hatten im Portal fuer den aktiven
Wettkampf 2026 keine Startnummer. Sebastian moechte die Mannschaften mit
Startnummer `96` bzw. `97` einordnen und bereinigte Legacy-Ergebnisdateien
testen, die nur Portal-Startnummern enthalten und deren Legacy-Klasse dem
Portalbestand entspricht.

## Scope

- Production-DB gezielt aktualisieren:
  `Team.startNumber = "96"` fuer `ESV Soier Lions`.
  `Team.startNumber = "97"` fuer `Schwaigers 5`.
- Keine globale STRNR-Loeschung und kein Reimport aller Startnummern.
- Legacy-Ergebnis-CSV-Kopien lokal erzeugen:
  - nur Startnummern, die im Portal vorhanden sind, plus geplante `96`.
  - `Au1Klasse` anhand der Portal-Klasse in Legacy-Klassen-IDs setzen.
  - Originaldateien unveraendert lassen.

## Non-Goals

- Keine Aenderung an offiziellen Ergebnissen.
- Kein Ergebnis-Staging-Import im Rahmen dieses CR.
- Keine Loeschung vorhandener Startnummern.
- Keine Schema- oder Code-Deploy-Aenderung.

## Privacy / Security Review

- Data touched:
  Teamname, Startnummer, Klasse, Teilnehmer:innen-Namen in read-only Checks,
  participant-linked Legacy-Ergebnis-CSV-Zeilen.
- Purpose:
  Startnummern- und Klassenkonsistenz fuer Ergebnisimport-Test herstellen.
- Visibility:
  Startnummer wird im Portal sichtbar. CSV-Dateien bleiben lokale Arbeitsdateien
  fuer Sebastian/Admin-Import.
- Persistence:
  Production DB Team-Record fuer Startnummer; lokale Exportdateien unter
  `exports/legacy-results-portal-startnumbers-2026-07-22/`.
- Logs/mails/exports:
  keine Mails. Terminal-Ausgaben enthalten nur technische Summaries; keine
  vollstaendigen CSV-Payloads im CR.
- Offline/cache:
  keine Aenderung.
- Residual risk:
  Direkte DB-Mutation ohne Admin-UI-Auditlog, deshalb vorher explizites Gate
  und nachher read-only Verification.

## Read-Only Findings

- Aktiver Wettkampf: `cmn3a1piz0002l104372yx9yt`.
- Teams eindeutig:
  - ID: `cmrv6vfd20002l404pbh1a4xr`
  - Name: `ESV Soier Lions`
  - vorherige Startnummer: `null`
  - Klasse: `masters`
- ID: `cmrv4t1pw0002jr0467ytjihq`
  - Name: `Schwaigers 5`
  - vorherige Startnummer: `null`
  - Klasse: `jungsters`
- Startnummern `96` und `97` waren frei.
- Portalbestand: 75 Teams mit Startnummer, 7 ohne Startnummer.
- Legacy-Zeitdateien enthalten `96` und `97`, aber nicht `35`.
- Nach Update bleibt als normales Team ohne Startnummer:
  `Vier Läuche und ein Schrank`; Sportlerbörse-Einträge separat.

## CSV Prep

Output:

- Directory:
  `/home/ocadmin/.openclaw/workspace/exports/legacy-results-portal-startnumbers-2026-07-22`
- Archive:
  `/home/ocadmin/.openclaw/workspace/exports/legacy-results-portal-startnumbers-2026-07-22.tar.gz`

Counts:

- Laufen: 111 -> 76 Raw Records, 76 Drafts, `96` und `97` enthalten, `35`
  fehlt.
- Rennrad: 112 -> 76 Raw Records, 76 Drafts, `96` und `97` enthalten, `35`
  fehlt.
- MTB: 111 -> 76 Raw Records, 76 Drafts, `96` und `97` enthalten, `35` fehlt.
- Bank: 309 -> 204 Raw Records, 76 Drafts, parserseitig 7 Fehler; nicht als
  erster Importtest empfohlen.
- Stock: 1344 -> 924 Raw Records, 77 Drafts, `96`, `97` und `35` enthalten.

## Gate

DB-Mutation wurde nach explizitem Sebastian-Auftrag angewendet:

- Update genau eines Teams: `ESV Soier Lions`.
- Neuer Wert: `startNumber = "96"`.
- Update genau eines Teams: `Schwaigers 5`.
- Neuer Wert: `startNumber = "97"`.
- Verification:
  - Teams danach erneut read-only gelesen.
  - Sicherstellen, dass keine zweite Mannschaft `96` oder `97` hat.
  - `GET /api/results` public smoke: `totalClasses=9`, `totalTeams=82`,
    `buckets=9`.
