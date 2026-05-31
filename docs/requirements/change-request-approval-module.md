# Generisches ChangeRequest- und Genehmigungsmodul

**Stand:** 2026-05-31  
**Status:** Zielbild fuer den Ausbau des bestehenden `PendingChange`-Workflows

## Ziel

Der bestehende Teilnehmer-Approval-Workflow wird zu einem generischen Aenderungsantragsmodul erweitert. S5Evo nutzt es zuerst fuer Teilnehmerdaten, Teamdaten und administrative Aktionen. Das Muster soll spaeter auf andere Plattformen uebertragbar sein, z. B. Energie-Gemeinschaften mit Mitgliedern, Zaehlern, Vertraegen oder Rollen.

## Leitentscheidungen

- Aenderungen werden nicht blind direkt geschrieben, wenn fachliche Pruefung noetig ist.
- Ein Antrag speichert Zielobjekt, vorherigen Zustand, gewuenschten Zustand, Status und Audit.
- Genehmigen wendet die Aenderung atomar an.
- Ablehnen bleibt nachvollziehbar und benoetigt eine Begruendung, wenn fachlich sinnvoll.
- Rechte, Genehmigungspflicht und Sichtbarkeit liegen in einer Policy-Schicht, nicht verteilt in UI-Komponenten.
- Kein grosses Workflow-Framework im MVP; erst ein schlankes, typisiertes ChangeRequest-Modul.

## Ist-Zustand

Aktuell gibt es `PendingChange` als teilnehmerzentriertes Modell:

- Zielobjekt ist immer `Participant`.
- `changeData` und `beforeData` speichern Snapshots.
- `ApprovalStatus` bildet den Status ab.
- `ParticipantAuditLog` dokumentiert Antrag, Genehmigung, Ablehnung und Direktänderung.
- UI: `ApprovalQueue` zeigt Diff, Impact und Review-Aktionen.

Das ist eine gute Grundlage, aber noch nicht generisch genug fuer Teams, Loeschungen, Rollen oder fremde Plattformobjekte.

## Zielmodell

### ChangeRequest

Pflichtfelder:

- `id`
- `tenantId`
- `competitionId?` oder fachlicher Scope
- `targetType`: z. B. `participant`, `team`, `user`, `contract`, `meteringPoint`
- `targetId`
- `changeType`: z. B. `update`, `delete`, `restore`, `role_change`
- `beforeSnapshot`
- `requestedSnapshot` oder `patch`
- `status`: `DRAFT`, `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`, `APPLIED`
- `requestedById`
- `reviewedById?`
- `createdAt`, `updatedAt`, `reviewedAt?`, `appliedAt?`
- `reviewComment?`

Optionale Felder:

- `priority`
- `source`: `self_service`, `admin`, `import`, `system`
- `metadata`: strukturierte Zusatzdaten fuer UI, Mail, Impact
- `supersedesRequestId?`

### ChangeRequestAuditLog

- `id`
- `changeRequestId`
- `action`: `CREATED`, `UPDATED`, `SUBMITTED`, `APPROVED`, `REJECTED`, `CANCELLED`, `APPLIED`, `FAILED`
- `actorId?`
- `beforeData?`
- `afterData?`
- `message?`
- `createdAt`

## Policy-Regeln

Eine zentrale Policy entscheidet:

- Wer darf einen Antrag stellen?
- Wer darf ihn sehen?
- Wer darf genehmigen oder ablehnen?
- Welche Felder duerfen direkt gespeichert werden?
- Welche Felder brauchen Review?
- Welche Zielobjekte duerfen automatisch angewendet werden?

S5Evo-Beispiele:

- Teilnehmer aendert Name, Geburtsjahr, Geschlecht oder Disziplin: Antrag.
- Teilnehmer aendert T-Shirt-Groesse oder Mail: je nach Konfiguration direkt oder Antrag.
- Teamchef aendert fremdes Team: verboten.
- Admin aendert Teilnehmer: direkt, aber auditieren.
- Team loeschen/wiederherstellen: kurzfristig Admin-direkt, spaeter optional als Antrag.

Energie-Gemeinschaft-Beispiele:

- Mitglied aendert Kontaktdaten: direkt oder einfacher Review.
- Mitglied aendert Zaehlernummer, Bankdaten oder Vertragsdaten: Antrag.
- Rollenwechsel oder Betreiberwechsel: Antrag mit Admin-Genehmigung.

## UI-Anforderungen

### Antrag erstellen

- Nutzer sieht klar, welche Felder direkt gespeichert werden und welche zur Genehmigung gehen.
- Bei gemischten Aenderungen trennt das System Direktänderungen und Review-Aenderungen.
- Nach Absenden gibt es eine eindeutige Rueckmeldung mit Status.

### Genehmigungsqueue

- Liste mit Status, Zielobjekt, Antragsteller, Datum, Prioritaet und Such-/Filtermoeglichkeit.
- Diff vorher/nachher als Hauptinformation.
- Impact-Hinweise pro Domain, z. B. neue Klassifikation oder Regelverletzung.
- Aktionen: genehmigen, ablehnen, kommentieren, Zielobjekt oeffnen.

### Historie

- Am Zielobjekt sichtbar: offene, genehmigte und abgelehnte Aenderungen.
- Admins sehen Audit und Review-Kommentare.
- Normale Nutzer sehen nur eigene Antraege und deren Status.

## Entwicklungspakete

### Paket 0 - Scope und Kompatibilitaet sichern

**Ziel:** Bestehenden `PendingChange`-Flow stabil halten.

**Arbeiten:**

- aktuelle API-Pfade und UI-Queue dokumentieren
- Feldgruppen definieren: direkt, genehmigungspflichtig, verboten
- Regression fuer vorhandene Teilnehmerantraege festlegen

**Definition of Done:**

- bestehende Teilnehmerantraege funktionieren unveraendert
- Zielmodell und Migrationsstrategie sind abgestimmt

### Paket 1 - Generisches Datenmodell vorbereiten

**Ziel:** Neues Modell einfuehren, ohne Big-Bang.

**Arbeiten:**

- `ChangeRequest` und `ChangeRequestAuditLog` in Prisma modellieren
- Status, TargetType und ChangeType typisieren
- Migrationspfad von `PendingChange` definieren
- Indizes fuer Queue und Zielobjektzugriff setzen

**Definition of Done:**

- Migration laeuft
- bestehende Daten bleiben lesbar
- neue Requests koennen parallel angelegt werden

### Paket 2 - ChangeRequest-Service

**Ziel:** Fachlogik aus API-Routen herausziehen.

**Arbeiten:**

- Service fuer create/update/submit/approve/reject/apply
- Snapshot-/Patch-Validierung
- atomare Anwendung der genehmigten Aenderung
- Audit-Events zentral schreiben

**Definition of Done:**

- API-Routen rufen Service statt eigener Speziallogik
- Transaktionen sichern Apply + Audit
- Fehler beim Anwenden bleiben nachvollziehbar

### Paket 3 - Policy-Schicht

**Ziel:** Regeln konfigurierbar und wiederverwendbar machen.

**Arbeiten:**

- Policy-Funktionen pro TargetType
- Rollenpruefung fuer Antragsteller und Reviewer
- Feldklassifikation: direct, review, denied
- Domain-Impact vorbereiten

**Definition of Done:**

- Teilnehmer-Policy entspricht heutigem Verhalten
- neue TargetTypes koennen ohne UI-Umbau ergänzt werden

### Paket 4 - Approval-Queue generisch machen

**Ziel:** Bestehende Queue von Participant-only auf TargetType erweitern.

**Arbeiten:**

- generische Request-Karten mit TargetLabel, ChangeType, Status
- Diff-Komponente wiederverwendbar machen
- Domain-spezifische Impact-Renderer als Erweiterungspunkt
- Filter nach Status, TargetType, Team/Scope, Antragsteller

**Definition of Done:**

- Teilnehmerantraege sehen mindestens so gut aus wie heute
- generische Targets koennen angezeigt werden
- Admin kann genehmigen/ablehnen

### Paket 5 - S5Evo-Use-Cases anbinden

**Ziel:** Konkreten Nutzwert im Portal liefern.

**Arbeiten:**

- Teilnehmer-Self-Service auf ChangeRequest umstellen
- Team-Edit fuer genehmigungspflichtige Felder anbinden
- Team loeschen/wiederherstellen optional als ChangeRequest vorbereiten
- Mail- und Audit-Protokolle am Request verknuepfen

**Definition of Done:**

- bestehender MVP-Flow bleibt nutzbar
- Admins sehen offene Antraege gesammelt
- Nutzer sehen Status ihrer eigenen Antraege

### Paket 6 - Plattformfaehigkeit

**Ziel:** Wiederverwendung fuer andere Plattformen absichern.

**Arbeiten:**

- TargetType-Konfiguration dokumentieren
- Beispielprofil `energy-community` skizzieren
- neutrale Begriffe in Service und Datenmodell verwenden
- Domain-spezifische Labels nur in Mapping/Renderer

**Definition of Done:**

- S5Evo bleibt erste Implementierung
- Energie-Gemeinschaft kann mit neuen TargetTypes ohne Grundumbau starten

## Testanforderungen

- Antrag erstellen, aktualisieren, genehmigen, ablehnen
- Direktänderung und genehmigungspflichtige Änderung im selben Formular
- parallele offene Anträge auf dasselbe Zielobjekt
- veralteter Antrag bei geaendertem Live-Zustand
- Rechtepruefung Antragsteller/Reviewer
- Audit-Rekonstruktion vorher/nachher
- Build: `npm run build`

## Empfohlene Reihenfolge

1. Paket 0
2. Paket 1
3. Paket 2
4. Paket 3
5. Paket 4
6. Paket 5
7. Paket 6

## Kurzurteil

Das Modul ist generisch sinnvoll, wenn Datenmodell, Service, Policy und UI sauber getrennt werden. Fuer V1 reicht ein schlankes ChangeRequest-Modul. Ein grosses BPM-/Workflow-System waere aktuell zu schwer.
