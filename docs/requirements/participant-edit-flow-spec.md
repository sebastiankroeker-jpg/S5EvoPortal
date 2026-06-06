# Teilnehmer-Bearbeitung: Ergebnis- und Benachrichtigungsflow

Stand: 2026-06-06

## Leitentscheidung

Ein Sportlerboerse-Eintrag ist fachlich ein normaler `Participant`. Der Unterschied liegt im Kontext:

- Mannschaft: `Team.registrationMode = TEAM`, der Teilnehmer ist Teil einer Mannschaft.
- Sportlerboerse: `Team.registrationMode = MARKETPLACE`, das Team ist ein Vermittlungs-Container fuer genau einen Teilnehmer.

Es wird kein zweites Modell wie `SportlerboerseParticipant` eingefuehrt. Suche, Bearbeitung, Claim, Datenschutz, Audit, Export und Benachrichtigung laufen ueber dieselbe Teilnehmer-Entitaet.

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

## Umsetzungspakete

1. Gemeinsame Ergebnisstruktur einfuehren und in `PUT /api/participants/[id]` ausgeben. Status: umgesetzt.
2. Bestehende Benachrichtigungen als strukturierte `notifications` zurueckgeben. Status: umgesetzt fuer Teilnehmer-Edit und Mail-Helper.
3. Direkte Admin-Aenderungen mit Aenderungsinfo-Mail ausstatten. Status: umgesetzt fuer direkte Teilnehmer-Aenderungen.
4. Sportlerboerse-Containerdaten bei Teilnehmer-Aenderungen synchronisieren. Status: umgesetzt fuer Teilnehmer-Edit.
5. UI auf `editResult.fieldResults` und `editResult.notifications` umstellen. Status: umgesetzt fuer Participant-Edit-Dialog.
6. Globalen Sportlerboerse-Sichtbarkeitsschalter in Wettkampf-Admin und Team-API ergaenzen. Status: umgesetzt.
7. Admin-Entscheidungen und Bundle-Entscheidungen auf dieselbe Ergebnisform erweitern. Status: offen.
8. Verifikationsfaelle fuer Team-Teilnehmer und Sportlerboerse-Teilnehmer ergaenzen. Status: offen.
