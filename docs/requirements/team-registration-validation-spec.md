# Mannschaftsanmeldung: konsolidierte Pruefspezifikation

Stand: 2026-06-04

## Zielbild

Die Mannschaftsanmeldung hat genau eine fachliche Pruefquelle fuer den aktuellen Team-Draft. Anonyme Neuanmeldung, angemeldete Neuanmeldung und spaetere Team-Bearbeitung duerfen in Klassifikation, Teilnehmerpflichtfeldern, Geburtsdatum-Logik und Disziplinpruefung nicht auseinanderlaufen.

## Pruefmodell

Die zentrale Routine heisst `evaluateTeamDraft(...)` und lebt in der Domain-Schicht. Sie nimmt einen vollstaendigen Draft entgegen:

- Modus: `anonymous-create`, `authenticated-create`, `team-edit`, `admin-edit`
- Teamdaten inklusive Kontaktkontext
- genau fuenf Teilnehmer mit Namen, Geburtsdatum, Geschlecht und Disziplin
- optional bisherige Klassifikation fuer Edit-Flows

Die Routine liefert strukturierte Kategorien:

- `blockingErrors`: rot; fehlende oder unplausible Pflichtangaben
- `warnings`: orange; fachliche Hinweise wie Disziplinen, Grenzfaelle, Mixed-Wertung, Klassenwechsel
- `info`: neutral; erklaerende Hinweise zur Klassifikation
- `classification`: berechnete Klasse aus derselben Logik wie Backend
- `discipline`: Ergebnis der Disziplinpruefung

## Anzeige- und Submit-Regeln

- Live-Anzeige und Button-Pruefung lesen dieselben `blockingErrors` und `warnings`.
- Rote Meldungen verschwinden nur, wenn der konkrete Pflichtfehler im Draft wirklich behoben ist.
- Orange Meldungen werden live reduziert, sobald die Ursache wegfaellt.
- Der Button "Pruefen" darf keine neuen fachlichen Meldungen aus einer zweiten Logik erzeugen.
- Backend-Submit bleibt autoritativ und nutzt weiterhin dieselben Domain-Primitiven.

## Paritaetsregeln

- `anonymous-create` und `authenticated-create` unterscheiden sich nur bei den Kontaktpflichten.
- Teamname, Teilnehmer, Geburtsdatum, Geschlecht, Klassifikation und Disziplinen werden in beiden Modi identisch bewertet.
- UI-Komponenten duerfen keine eigenen Geburtsdatum- oder Disziplinwarnlisten mehr neben der Domain-Routine aufbauen.

## Umsetzungspakete

1. Domain-Basis: `evaluateTeamDraft(...)` einfuehren und in der Registrierungs-UI als einzige Live-Quelle verwenden. Status: umgesetzt.
2. Paritaet: kleine Verifikationsfaelle fuer anonym/angemeldet ergaenzen, inklusive "Geburtsdaten vollstaendig, Namen fehlen". Status: umgesetzt mit `npm run verify:team-draft`.
3. Backend-Feinschliff: API-Routen schrittweise auf `evaluateTeamDraft(...)` hochziehen, sobald die UI stabil ist. Status: umgesetzt fuer `POST /api/teams` und `PUT /api/teams/[id]`.
4. Edit-Flows: Dashboard, Participant-Edit und Admin-Entscheidungen auf dieselbe Ergebnisstruktur umstellen. Status: offen.
5. UX-Nacharbeit: Meldungstexte und Gruppierung nach rot/orange/neutral vereinheitlichen. Status: offen.

## Verifikation

`npm run verify:team-draft` prueft:

- gleicher gueltiger Team-Draft in `anonymous-create` und `authenticated-create`
- alle Geburtsdaten vollstaendig, aber Namen fehlen
- unplausibles Geburtsdatum
- doppelte/offene Disziplinen
