# Registration, Confirmation Mails & T-Shirt Workflow

Stand: 2026-04-22
Status: vorgeschlagene Lösung, von Sebastian positiv aufgenommen

## Ausgangslage

Feedback aus dem Sportverein:
- gemischte Gefühle zur Software
- Sorge, Teilnehmer und Anmelder mit Login-/Pflichtschritten zu überfordern
- Wunsch nach weniger Hürde bei der Mannschaftsanmeldung
- zusätzlicher logistischer Bedarf für T-Shirt-Bestellung

## Empfohlene Produktentscheidung

1. **Mannschaftsanmeldung ohne vorherigen Authentik-Login** ermöglichen
2. **Bestätigungsmail** an Anmelder und Verein nach erfolgreicher Anmeldung senden
3. **T-Shirt-Größe pro Teilnehmer** erfassen
4. **T-Shirt-Bestellschluss pro Wettkampf** in den Wettkampf-Parametern pflegen
5. T-Shirt-Thema **fachlich getrennt vom Wettkampfstatus** behandeln, damit es während des Wettkampfs nicht irritiert

## Fachliches Zielbild

### Registration UX
- Anmeldung soll öffentlich und niedrigschwellig möglich sein
- Authentik bleibt für Accounts/Admin/fortgeschrittene Self-Service-Flows wichtig, ist aber **keine Pflicht vor Erst-Anmeldung**
- Nach der Anmeldung erhält der Anmelder einen Bearbeitungslink per Mail
- Optional kann die Mannschaft später mit einem Authentik-Konto verknüpft werden

### T-Shirt UX
- T-Shirt-Größe wird pro Teilnehmer gepflegt
- Normale Nutzer sehen und bearbeiten die Größen nur bis zur definierten Frist
- Nach Fristablauf werden die Felder read-only oder ausgeblendet
- Während des Wettkampfs sollen T-Shirt-Infos außerhalb Admin nicht prominent erscheinen

## User Stories

### US-REG-001 Öffentliche Mannschaftsanmeldung
Als **Team-Anmelder** möchte ich meine Mannschaft **ohne vorherigen Login** anmelden können, damit ich nicht schon am Einstieg durch Kontoanlage ausgebremst werde.

**Akzeptanzkriterien**
- Anmeldung ist ohne Authentik-Login erreichbar
- Teamname, Anmelderdaten und Teilnehmerdaten können öffentlich erfasst werden
- Spam-/Missbrauchsschutz ist vorhanden (mindestens E-Mail-basierter Bearbeitungslink)

### US-REG-002 Bestätigungsmail an Anmelder
Als **Team-Anmelder** möchte ich nach dem Absenden eine **Bestätigungsmail** erhalten, damit ich sicher weiß, dass die Anmeldung eingegangen ist.

**Akzeptanzkriterien**
- Mail wird nach erfolgreicher Anmeldung automatisch versendet
- Mail enthält Teamname, Anmelder, Teilnehmerübersicht und Bearbeitungslink
- Fehlgeschlagene Mailzustellung wird protokolliert

### US-REG-003 Bestätigungsmail an Verein/Orga
Als **Verein/Orga** möchte ich parallel eine **Info-Mail** zu neuen Anmeldungen erhalten, damit ich frühzeitig Überblick über eingehende Teams habe.

**Akzeptanzkriterien**
- Zieladresse ist pro Wettkampf oder Tenant konfigurierbar
- Mail enthält die wichtigsten Anmeldedaten
- Versand erfolgt parallel zur Bestätigung an den Anmelder

### US-REG-004 Bearbeitungslink nach Anmeldung
Als **Team-Anmelder** möchte ich einen **Bearbeitungslink per Mail** erhalten, damit ich Daten später ohne erneuten Voll-Login ergänzen oder korrigieren kann.

**Akzeptanzkriterien**
- Link ist tokenbasiert und ausreichend zufällig
- Link wird serverseitig abgesichert
- Link ist zeitlich/fachlich begrenzt gültig
- Link kann neu versendet und dabei invalidiert werden

### US-SHIRT-001 T-Shirt-Größe je Teilnehmer
Als **Team-Anmelder** möchte ich pro Teilnehmer eine **T-Shirt-Größe** erfassen, damit die Bestellung gesammelt vorbereitet werden kann.

**Akzeptanzkriterien**
- Teilnehmer besitzt ein Feld `shirtSize`
- Zulässige Größen sind standardisiert (z. B. Kindergrößen + XS–XXXL)
- Größe ist in Anmeldung, Bearbeitung und Admin sichtbar

### US-SHIRT-002 T-Shirt-Bestellschluss pro Wettkampf
Als **Administrator** möchte ich einen **T-Shirt-Bestellschluss** in den Wettkampf-Parametern pflegen, damit Größen nur bis zu einem klaren Zeitpunkt änderbar sind.

**Akzeptanzkriterien**
- Wettkampf besitzt Feld `shirtOrderDeadline`
- Frist ist im Admin pflegbar
- Nach Fristablauf sind T-Shirt-Felder für normale Nutzer gesperrt oder ausgeblendet
- Admin darf Größen bei Bedarf weiterhin sehen und korrigieren

### US-SHIRT-003 Entzerrte Oberfläche während des Wettkampfs
Als **Team-Anmelder/Teilnehmer** möchte ich während des Wettkampfs keine irrelevanten T-Shirt-Hinweise sehen, damit mich Logistikthemen dann nicht verwirren.

**Akzeptanzkriterien**
- T-Shirt-Hinweise werden nach Fristablauf reduziert
- Während laufendem Wettkampf sind T-Shirt-Infos außerhalb Admin nicht prominent
- Stattdessen erscheint höchstens ein knapper Hinweis „Bestellfrist abgeschlossen“

## Technische Empfehlung

### Empfohlener Schnitt

#### Paket A — kleiner bis mittlerer Aufwand
- `Participant.shirtSize`
- `Competition.shirtOrderDeadline`
- Formulare + Admin-Parameter + Locking nach Deadline

#### Paket B — mittlerer Aufwand
- transaktionale Bestätigungsmails
- Versand an Anmelder + Verein
- Logging/Retry-Strategie

#### Paket C — mittlerer bis größerer Aufwand
- öffentliche Anmeldung ohne Login
- tokenbasierter Bearbeitungslink
- optional späteres Claiming via Authentik

## Architekturentscheidung (empfohlen)

### Authentik
Authentik bleibt der Identity Provider für reguläre Accounts, Admins und spätere Self-Service-Logins.

### Bearbeitungslink
Der Bearbeitungslink sollte **nicht** über Authentik gemanaged werden, sondern über einen eigenen S5Evo-Token-Mechanismus.

**Empfehlung:**
- eigener Token-Datensatz in S5Evo
- Token serverseitig gehashed speichern
- standardmäßige Gültigkeit z. B. 14 Tage
- zusätzlich fachliche Begrenzung durch Anmelde- oder T-Shirt-Deadline
- nach Frist optional read-only statt Hard-Fail

## Offene Produktentscheidungen

1. Soll E-Mail-Verifikation vor endgültiger Anlage Pflicht sein oder reicht Bearbeitungslink nach Absenden?
2. Soll der Verein eine zentrale Ziel-Mailadresse je Wettkampf pflegen oder je Tenant global?
3. Welche T-Shirt-Größenliste ist fachlich korrekt (Kindergrößen ja/nein)?
4. Dürfen Admins nach Fristablauf Größen noch ändern? (Empfehlung: ja)

## Empfehlung für Umsetzung

1. Paket A zuerst
2. danach Paket B
3. Paket C als bewusstes UX-/Auth-Paket separat

So entsteht früh Nutzen, ohne die Registrierung in einem großen Umbau unnötig riskant zu machen.
