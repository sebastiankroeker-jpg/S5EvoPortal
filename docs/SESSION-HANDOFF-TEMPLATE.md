# <Projektname> — Session Handoff & Projekt-Handout

> Zweck: Dieses Dokument dient als kompakte Übergabe für die nächste Session.
> Es bündelt Methodik, Ordnungssystem, Architektur, Fortschritt, offene Punkte und den aktuellen Arbeitsstand.

**Stand:** YYYY-MM-DD
**Projekt:** <Name>
**Live:** <URL oder n/a>
**Aktives Code-/App-Verzeichnis:** `<pfad>`

---

## 1. Wofür dieses Dokument da ist

Dieses Dokument soll pro Session schnell beantworten:

- Was ist das Projekt?
- Welche Doku ist verbindlich?
- Wo liegt der relevante Code?
- Was ist gerade live?
- Was wurde zuletzt geändert?
- Was ist als Nächstes dran?
- Welche Risiken, Altlasten oder Stolperfallen gibt es?

---

## 2. Verbindliche Quellen

### Fachliche SSOT
- `<zentrale Anforderungen / PRD / REQUIREMENTS>`

### Operative Steuerung
- `<ScopeBoard / Kanban / TODO-Datei>`
- `<Inbox / offene Fragen>`
- `<Heartbeat / Runbook / Ops-Hinweise>`
- `<memory / Tagesnotizen / changelog>`

### Architektur / Betrieb
- `<ADR / Architekturübersicht / Setup-Guide>`

### Wichtige Regel
Wenn fachliche Anforderungen und ältere Dokumente widersprechen, gilt **immer** die definierte SSOT.

---

## 3. Veraltete oder nur ergänzende Dokumente

### Veraltet
- `<Datei A>`
- `<Datei B>`

### Ergänzend, aber nicht SSOT
- `<Datei C>`
- `<Datei D>`

Konsequenz: Diese Dokumente nur als Kontext lesen, nicht als maßgebliche Quelle.

---

## 4. Projektüberblick

**<Projektname>** ist <Kurzbeschreibung>.

### Rahmen
- Kunde/Verein/Owner: <...>
- Scope: <...>
- Ziel / Deadline: <...>
- Nutzergruppen: <...>

---

## 5. Architektur & Technologien

### Frontend / Backend
- `<Frameworks>`

### Persistenz
- `<DB / ORM / Storage>`

### Auth
- `<Auth-Stack>`

### Hosting / Infra
- `<Hosting / Deployment-Ziele>`

### Relevante Verzeichnisse
- App: `<pfad>`
- Docs: `<pfad>`
- weitere wichtige Ordner: `<pfad>`

---

## 6. Ordnungssystem / Methodik im Projekt

### Aktuelle Leitidee
- `<fachliche SSOT>` ist fachliche Wahrheit
- `<operative Datei>` ist operative Wahrheit
- `<memory>` hält Tageswissen und operative Erkenntnisse fest
- `<Agent-/Team-Regeln>` definiert Einstieg und Arbeitsweise

### Praktische Reihenfolge für die nächste Session
1. `<SSOT lesen>`
2. `<Tagesnotiz / Memory lesen>`
3. `<ScopeBoard / TODO lesen>`
4. dann erst in Detailcode oder Spezialdokus springen

### Ziel der Ordnung
- keine verstreuten Wahrheiten
- klare Trennung zwischen Anforderungen, laufender Arbeit, Tagesgedächtnis und Architekturentscheidungen

---

## 7. Aktueller Fortschritt

### Zuletzt geliefert
1. `<letzte relevante Änderung>`
2. `<letzte relevante Änderung>`
3. `<letzte relevante Änderung>`

### Live relevante Einstiege
- `<URL / Route / Endpoint>`
- `<URL / Route / Endpoint>`

### Letzte relevante Commits
- `<sha>` `<message>`
- `<sha>` `<message>`
- `<sha>` `<message>`

---

## 8. ScopeBoard- / Status-Snapshot

### DONE
- `<Scope / Feature>`

### REVIEW
- `<Scope / Feature>`

### IN_PROGRESS
- `<Scope / Feature>`

### BLOCKED
- `<Scope / Feature>`

### BACKLOG
- `<Scope / Feature>`

---

## 9. Offene ToDos / Nächste sinnvolle Schritte

### Kurzfristig sinnvoll
1. `<nächster sicherer Schritt>`
2. `<zweiter sinnvoller Schritt>`
3. `<dritter sinnvoller Schritt>`

### Fachlich größere Themen danach
- `<Thema A>`
- `<Thema B>`
- `<Thema C>`

---

## 10. Bekannte Stolperfallen

1. `<Verwechslungsgefahr / Deploy-Falle / Altlast>`
2. `<falsche Datei / veraltete Doku / fehlende ENV>`
3. `<technischer oder fachlicher Stolperstein>`

---

## 11. Konkreter Status zum Stand dieses Dokuments

### Bestätigt
- `<was ist sicher wahr>`
- `<was ist live>`
- `<was ist getestet>`

### Noch offen
- `<was fehlt noch>`
- `<was muss verifiziert werden>`

---

## 12. Next 3 actions

### 1. Nächster sicherer Schritt
`<ein klarer nächster Schritt>`

### 2. Größtes Risiko
`<wichtigstes Risiko oder offene Unklarheit>`

### 3. Nicht verwechseln
`<wichtigster Kontext, der in neuen Sessions schnell falsch verstanden wird>`

---

## 13. Empfohlener Start für die nächste Session

### In 5 Minuten orientieren
- `<SSOT>`
- `<heutige Memory-Datei>`
- `<ScopeBoard / TODO>`
- dieses Dokument

### Dann entscheiden
- entweder **Review/Abschlussarbeit** sauber fertig machen
- oder **genau einen** neuen Scope aktiv ziehen

Nicht beides gleichzeitig.

---

## 14. Methodik-Verbesserungen (optional projektbezogen)

### Beobachtungen
- `<was bremst>`
- `<was gut funktioniert>`

### Empfehlungen
1. `<Verbesserung>`
2. `<Verbesserung>`
3. `<Verbesserung>`

---

## 15. Pflege-Regeln für dieses Dokument

Dieses Dokument soll **nicht** jede Kleinigkeit mitschreiben.

Aktualisieren, wenn sich etwas ändert an:
- SSOT / Referenzlage
- aktivem Verzeichnis oder Repo
- Live-Status
- Scope-Status
- nächsten Schritten
- bekannten Risiken / Stolperfallen

Nicht aufblähen mit:
- jedem einzelnen Chat-Detail
- flüchtigen Gedanken
- kurzlebigem Debug-Rauschen ohne Dauerwert
