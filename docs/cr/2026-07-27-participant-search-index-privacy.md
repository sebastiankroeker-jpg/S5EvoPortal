# CR: Teilnehmerdaten vor Suchmaschinen verstecken

## Kontext

Sebastian fragte nach dem GPX-Kartenupdate, ob Teilnehmerdaten vor Suchmaschinen
versteckt werden koennen.

## Ziel

- Teilnehmer-, Team-, Ergebnis-, Claim-, MTC-, Nachrichten-, Zeitnahme- und
  Admin-Daten sollen nicht in Suchmaschinenindexe aufgenommen werden.
- Die Massnahme soll ohne Auth-Umbau auskommen.
- `robots.txt` ist nur ergaenzend; die wirksame Steuerung erfolgt per
  `X-Robots-Tag`.

## Umsetzung

- `next.config.ts`
  - zentrale `X-Robots-Tag: noindex, nofollow, noarchive` Header fuer sensible
    HTML-Routen und JSON/API-Routen.
  - `/` ist eingeschlossen, weil Teilnehmer-/Live-/Ergebnisansichten im Portal
    teilweise ueber Hash-Tabs auf der Startseite laufen und Suchmaschinen Hashes
    nicht als getrennte Server-Routen sehen.
- `public/robots.txt`
  - ergaenzende Disallow-Regeln fuer dieselben sensiblen Pfade.

## Nicht-Ziele

- Kein Login-/Auth-Umbau.
- Kein Entfernen bestehender oeffentlicher Ergebnisdaten.
- Kein Loeschen bereits eventuell gecrawlter Daten aus externen Suchmaschinen.

## Verifikation

- `npx tsc --noEmit --incremental false`
- `npm run build`
- `git diff --check`
- Header-Smoke lokal/live:
  - `/`
  - `/teilnehmer`
  - `/api/results`
