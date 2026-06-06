# Teilnehmer-Bearbeitung: Ergebnis- und Benachrichtigungsflow

Stand: 2026-06-06

## Leitentscheidung

Ein Sportlerboerse-Eintrag ist fachlich ein normaler `Participant`. Der Unterschied liegt im Kontext:

- Mannschaft: `Team.registrationMode = TEAM`, der Teilnehmer ist Teil einer Mannschaft.
- Sportlerboerse: `Team.registrationMode = MARKETPLACE`, das Team ist ein Vermittlungs-Container fuer genau einen Teilnehmer.

Es wird kein zweites Modell wie `SportlerboerseParticipant` eingefuehrt. Suche, Bearbeitung, Claim, Datenschutz, Audit, Export und Benachrichtigung laufen ueber dieselbe Teilnehmer-Entitaet.

Bei einer Sportlerboerse-Meldung ist die Disziplin fachlich Pflicht. `TBD` bleibt fuer Team-Bearbeitungen moeglich, ist aber fuer neue Boersenmeldungen nicht zulaessig.

## Zielbild

Alle Teilnehmer-Bearbeitungen liefern dieselbe strukturierte Ergebnisform:

- direkt gespeichert
- als Review-Antrag eingereicht
- teilweise direkt gespeichert und teilweise Review
- abgelehnt oder gesperrt
- Benachrichtigung gesendet, uebersprungen oder fehlgeschlagen

Die UI darf weiterhin die bestehenden Felder lesen, soll aber schrittweise auf `editResult` wechseln.

## Ergebnisstruktur

```ts
type EditParticipantResult = {
  status: "saved" | "pending_review" | "partial" | "rejected" | "unchanged";
  participantId: string;
  teamId: string;
  context: "TEAM" | "MARKETPLACE";
  fieldResults: Array<{
    field: string;
    label: string;
    decision: "saved" | "review" | "denied";
    before: unknown;
    after: unknown;
    beforeLabel: string;
    afterLabel: string;
    message: string;
  }>;
  validation: {
    blockingErrors: string[];
    warnings: string[];
    info: string[];
  };
  notifications: Array<{
    channel: "email";
    recipient: string;
    template: string;
    status: "sent" | "skipped" | "failed";
    reason?: string;
  }>;
};
```

## Feldpolitik

Direkt speicherbar:

- E-Mail
- T-Shirt-Groesse, solange erlaubt
- Moderationshinweis
- Namensveroeffentlichung

Review-pflichtig fuer Nicht-Admins:

- Vorname
- Nachname
- Geburtsjahr/Geburtsdatum
- Geschlecht
- Disziplin

Admin:

- darf fachliche Aenderungen direkt speichern
- erzeugt Audit
- kann offene Antraege dadurch ueberholen
- ausloesende Benachrichtigungen werden im Ergebnis ausgewiesen

Moderator in globaler Sicht:

- darf aktuell nur Moderationshinweis direkt speichern
- alle anderen Felder bleiben gesperrt

## Sportlerboerse-Synchronisation

Wenn `Team.registrationMode = MARKETPLACE` gilt, bleibt `Participant` die Wahrheit. Container-Daten werden nachgezogen:

- Teilnehmername -> Teamname `Sportlerboerse: Vorname Nachname`
- Teilnehmer-E-Mail -> `Team.contactEmail`
- Kontaktname -> Teilnehmername

Marketplace-Status bleibt am Team, weil er den Vermittlungsprozess beschreibt.

Admin-Bearbeitung der Sportlerboerse trennt deshalb bewusst zwei Oberflaechen:

- Teilnehmer bearbeiten: fachliche Personendaten wie Name, E-Mail, Geburtsjahr, Geschlecht, Disziplin, Shirt und Veroeffentlichungswunsch.
- Boersen-Mannschaft bearbeiten: Container-/Vermittlungsdaten wie Boersen-Status, Boersen-Sichtbarkeit, Team-Veroeffentlichung und Admin-Nachricht.

Teamname, Kontaktname und Kontakt-E-Mail bleiben aus dem Teilnehmer abgeleitet, damit der Container nicht fachlich von der Teilnehmer-Entitaet driftet.

## Sportlerboerse-Sichtbarkeit

Die globale Veroeffentlichung der Sportlerboerse wird am aktiven Wettkampf gesteuert:

- `SELECTIVE`: einzelne Boersenmeldungen folgen ihrer eigenen Sichtbarkeit (`PUBLIC`, `MARKETPLACE_USERS`, `PORTAL_USERS`, `ADMIN_MANAGEMENT_ONLY`) plus den Teilnehmer-/Team-Veroeffentlichungseinstellungen.
- `OFFLINE`: Boersenmeldungen werden im normalen Mannschafts-Dashboard und in oeffentlichen/teilnehmernahen Sichten nicht ausgeliefert. Orga/Admin sieht sie weiterhin im Sportlerboerse-Dashboard.

Der Schalter gehoert bewusst nicht zum Teilnehmer. Teilnehmer bleiben fachliche Personen; die Frage, ob die Boerse als Ganzes sichtbar ist, ist ein Wettkampf-/Orga-Parameter.

## Benachrichtigungsregeln

Bei Review-Antrag:

- Orga bekommt eine Mail, wenn Orga-Adresse gepflegt ist.
- Teamkontakt bekommt eine Eingangsbestätigung, wenn Kontaktadresse gepflegt ist.
- Bei Sportlerboerse ist der Teamkontakt in der Regel der Teilnehmerkontakt.

Bei direkter Admin-Aenderung:

- Betroffene Kontaktadresse bekommt eine Aenderungsinfo.
- Claim-/Einladungsmails bleiben ein eigener Benachrichtigungstyp.
- Mailfehler blockieren die gespeicherte Aenderung nicht, werden aber im Ergebnis sichtbar.

Bei Review-Entscheidung:

- Genehmigt/abgelehnt wird an Teilnehmer oder Teamkontakt gemeldet.
- Kommentar der Orga wird mitgegeben.
- Einzel- und Bundle-Entscheidungen liefern ein strukturiertes `decisionResult` mit Feldentscheidungen, Kontext und Mailstatus zurueck.

## Umsetzungspakete

1. Gemeinsame Ergebnisstruktur einfuehren und in `PUT /api/participants/[id]` ausgeben. Status: umgesetzt.
2. Bestehende Benachrichtigungen als strukturierte `notifications` zurueckgeben. Status: umgesetzt fuer Teilnehmer-Edit und Mail-Helper.
3. Direkte Admin-Aenderungen mit Aenderungsinfo-Mail ausstatten. Status: umgesetzt fuer direkte Teilnehmer-Aenderungen.
4. Sportlerboerse-Containerdaten bei Teilnehmer-Aenderungen synchronisieren. Status: umgesetzt fuer Teilnehmer-Edit.
5. UI auf `editResult.fieldResults` und `editResult.notifications` umstellen. Status: umgesetzt fuer Participant-Edit-Dialog.
6. Globalen Sportlerboerse-Sichtbarkeitsschalter in Wettkampf-Admin und Team-API ergaenzen. Status: umgesetzt.
7. Admin-Entscheidungen und Bundle-Entscheidungen auf dieselbe Ergebnisform erweitern. Status: umgesetzt fuer API und Approval-Queue-Ergebnisblock.
8. Verifikationsfaelle fuer Team-Teilnehmer und Sportlerboerse-Teilnehmer ergaenzen. Status: umgesetzt mit `npm run verify:participant-edit-flow`.
9. Mail-/Audit-Nachvollziehbarkeit fuer Teilnehmer- und Sportlerboerse-Aenderungen ergaenzen. Status: umgesetzt fuer zentrale Mail-Events und Boersen-Container-Audit.

## Aktueller Fortschritt 2026-06-06

Paket B ist admin-first weitgehend rund:

- Sportlerboerse-Teilnehmer bleibt `Participant`; Boersen-Kontext kommt ueber `Team.registrationMode = MARKETPLACE`.
- Teilnehmer-Bearbeitung liefert `editResult` mit Kontext, Feldentscheidungen, Validierung und Benachrichtigungsstatus.
- Participant-Edit-Dialog zeigt gespeicherte, review-pflichtige und blockierte Felder inklusive Mailstatus.
- Review-Queue und Bundle-Entscheidungen liefern `decisionResult` mit Feldentscheidungen und Benachrichtigungen.
- Sportlerboerse-Anmeldung verlangt eine konkrete Disziplin; `TBD`/`Noch offen` ist fuer neue Boersenmeldungen nicht mehr zulaessig.
- Sportlerboerse-Anmeldung zeigt am Schritt `Weiter zur Pruefung` eine standardmaessig zugeklappte Fehler-/Hinweisuebersicht.
- Wettkampf-Admin hat einen globalen Boersen-Sichtbarkeitsschalter: `SELECTIVE` oder `OFFLINE`.
- Sportlerboerse-Dashboard zeigt den globalen Sichtbarkeitsstatus als Pille und verlinkt ins Customizing.
- Tenant- und Wettkampf-Parameter sind im Admin-Bereich wieder als eigene Reiter getrennt; Sportlerboerse sitzt sichtbar im Wettkampf-Reiter.
- Admins koennen neben dem Teilnehmer auch die Boersen-Mannschaft bearbeiten: Status, Boersen-Sichtbarkeit, Team-Veroeffentlichung, Admin-Nachricht.
- Boersen-Dashboard hat Admin-Filter und Kennzahlen fuer Status, Boersen-Sichtbarkeit, Veroeffentlichung und potenzielle Sichtbarkeit.
- Teilnehmer-Mailstatus wird als `PARTICIPANT_CHANGE_MAIL` im zentralen Mail-Protokoll sichtbar.
- Boersen-Mannschaftsaenderungen erzeugen `MARKETPLACE_TEAM_UPDATED` mit vorher/nachher.

Zuletzt deployte Referenz-Commits:

- `7f6cef7` - Admin-Boersenworkflow mit Sichtbarkeits-/Veroeffentlichungsfiltern.
- `c683304` - Mail-/Audit-Nachvollziehbarkeit fuer Teilnehmer- und Boersen-Aenderungen.

## Gemerkte Folgeaktivitaeten

Spaeter fortsetzen mit:

1. Sportlerboerse-Dashboard als Arbeitsliste abrunden.
   - kompakte Box `Braucht Aktion`
   - Zaehler fuer z.B. neu, nur intern sichtbar, ohne Nachricht, in Vermittlung, zurueckgezogen
   - Klick setzt direkt den passenden Filterzustand
2. Admin-Detailansicht schaerfen.
   - `Person` und `Boersensteuerung` klar nebeneinanderstellen
   - letzte Aenderung, letzter Audit-Hinweis und letzter Mailstatus direkt im Kontext anzeigen
   - weniger Wechsel ins Mail-Protokoll noetig machen
3. Review-Queue lesbarer machen.
   - Boersen-Kontext staerker labeln
   - normale Team-Aenderung und Sportlerboerse-Teilnehmer eindeutig unterscheiden
4. Self-Service-Rechte erst danach definieren.
   - welche Boersenfelder darf der Meldende selbst aendern?
   - welche Felder laufen in Review?
   - welche bleiben Admin-only?

## Verifikation

`npm run verify:participant-edit-flow` prueft:

- Sportlerboerse-Meldung akzeptiert eine konkrete Disziplin und lehnt `TBD` ab.
- Teilnehmer-Bearbeitung unterscheidet die Kontexte `TEAM` und `MARKETPLACE`.
- Review-Entscheidungen liefern Feldentscheidungen und strukturierte Mailstatus.
- Teilnehmer-Mailstatus wird als `PARTICIPANT_CHANGE_MAIL` fuer das zentrale Mail-Protokoll auditierbar.
- Claim-Einladungsmails werden als Benachrichtigung normalisiert.
- Globaler Sportlerboerse-Offline-Modus sperrt Nicht-Orga, laesst Admin/Orga aber weiter sehen.
