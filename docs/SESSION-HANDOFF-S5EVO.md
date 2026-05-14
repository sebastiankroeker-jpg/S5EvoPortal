# S5Evo — Session Handoff & Projekt-Handout

> Zweck: Dieses Dokument dient als kompakte Übergabe für die nächste Session.
> Es bündelt Methodik, Ordnungssystem, Architektur, Fortschritt, offene Punkte und den aktuellen Arbeitsstand.

**Stand:** 2026-05-14
**Projekt:** S5Evo Portal
**Live:** https://s5-evo-portal.vercel.app
**Aktives App-Verzeichnis:** `/home/ocadmin/.openclaw/workspace/authentik-nextjs-demo`

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
- `docs/REQUIREMENTS.md`

### Operative Steuerung
- `SCOPEBOARD.md`
- `INBOX.md`
- `HEARTBEAT.md`
- `memory/2026-05-14.md` und weitere Tagesnotizen in `memory/`

### Architektur / Auth
- `docs/ADR-auth-konzept.md`
- `docs/auth-setup-guide.md`

### Wichtige Regel
Wenn fachliche Anforderungen und ältere Dokumente widersprechen, gilt **immer** `docs/REQUIREMENTS.md`.

---

## 3. Veraltete oder nur ergänzende Dokumente

### Veraltet
- `docs/5kampf-domain-model.md`
- `ROADMAP.md`
- `memory/5kampf-project-index.md`

### Ergänzend, aber nicht SSOT
- `README.md`
- `docs/STRATEGY.md`
- Spezialdokus in `docs/requirements/`

Konsequenz: Diese Dokumente nur als Kontext lesen, nicht als maßgebliche Quelle.

---

## 4. Projektüberblick

**S5Evo** ist eine Plattform für Mannschaftsfünfkampf, von Anmeldung bis Ergebnisdarstellung.

### Rahmen
- Verein: **ESV Bad Bayersoien**
- Scope: ca. **107 Teams à 5 Teilnehmer**
- Multi-Tenant-fähig
- Wettkampf 2026: **24./25.07.2026**
- Anmeldeschluss laut Requirements: **22.07.2026**

### Rollen
- Administrator
- Moderator
- Teamchef
- Teilnehmer
- Zuschauer

---

## 5. Architektur & Technologien

### Frontend / Backend
- **Next.js 16**
- **React 19**
- **TypeScript**
- **shadcn/ui**
- Next.js App Router + API Routes

### Persistenz
- **Prisma 6**
- **Postgres**

### Auth
- **Authentik** als zentraler IdP
- **NextAuth.js** als OIDC-Client
- Zielbild: SSO über mehrere Apps

### Hosting
- App: **Vercel**
- Authentik: **IONOS VPS**
- Statische Deploys/Webspace: **IONOS Webspace**

### Mail
- **Resend** für Transaktionsmails

### Relevante App
- Codebasis aktuell: `/home/ocadmin/.openclaw/workspace/authentik-nextjs-demo`

---

## 6. Ordnungssystem / Methodik im Projekt

### Aktuelle Leitidee
- `docs/REQUIREMENTS.md` ist fachliche SSOT
- `SCOPEBOARD.md` ist operative SSOT für laufende Scopes
- `memory/*.md` hält Tageswissen und operative Erkenntnisse fest
- `AGENTS.md` definiert Arbeitsregeln, Einstieg und Priorisierung

### Praktische Reihenfolge für die nächste Session
1. `docs/REQUIREMENTS.md` lesen
2. aktuelle Tagesnotiz in `memory/` lesen
3. `SCOPEBOARD.md` lesen
4. dann erst in Detailcode oder Spezialdokus springen

### Ziel der Ordnung
- keine verstreuten Wahrheiten
- klare Trennung zwischen
  - Anforderungen
  - laufender Arbeit
  - Tagesgedächtnis
  - Architekturentscheidungen

### Abgrenzung zum CrewUnited-Kontext
- Übergreifende Methodik, Rollen, A2A-Kommunikation, zentrale Repo-/Infra-/Security-Fragen stehen jetzt separat in:
  - `docs/SESSION-HANDOFF-CREWUNITED.md`
- Dieses S5Evo-Handoff bleibt bewusst **projektspezifisch** für 5-Kampf-Portal, fachlichen Stand und S5Evo-nahe ToDos.

### Parallelarbeit, aber mit Leitplanken
- Tasks dürfen parallel laufen, **wenn ein klarer Owner und ein klares Zielartefakt definiert sind**
- Entscheidungen danach zurück in Doku, nicht nur im Chat lassen
- Vor dem Wettkampf **keine große Repo- oder Strukturmigration** ohne klaren Sofortnutzen

---

## 7. Aktueller Fortschritt

### Zuletzt fachlich/live geliefert
1. **Registration Confirmation Emails** live verifiziert
   - Resend in Production funktional
   - Mails an Anmelder + Orga für 2026 bestätigt
2. **Bugfix Competition-/Tenant-Auswahl**
   - Registrierung bevorzugt jetzt die aktuelle offene Competition statt faktisch den ersten Tenant
3. **UX-Fix Home-Screen**
   - interne Portal-Anmeldung klar von externer Ausschreibung getrennt
4. **Öffentliche Mannschaftsanmeldung ohne Login** live
   - neuer Pfad: `/anmeldung`
5. **Claim-Handoff klarer gemacht**
   - bessere Texte nach anonymer Anmeldung
   - bessere Mail-Texte
   - verständlichere Claim-Seite

### Live relevante Einstiege
- Startseite: `https://s5-evo-portal.vercel.app`
- Öffentliche Anmeldung: `https://s5-evo-portal.vercel.app/anmeldung`

### Letzte relevante Commits
- `a25fe99` `fix: clarify unauthenticated registration entry points`
- `1078de7` `feat: allow public team registration without login`
- `75e7236` `feat: clarify registration claim handoff`
- `0edc1f3` `docs: add s5evo session handoff`

---

## 8. ScopeBoard-Snapshot

### DONE
- `P10` Self-Service Teilnehmerdaten ändern
- `P20` Admin-UI Teilnehmerübersicht + Search
- `P41` Navigation & Home-Flow
- `P51` Registration Confirmation Emails

### REVIEW
- `P05` ScopeBoard Remote Access
- `P50` Admin Changelog Feedback
- `P08` Historische PDF-Import Pipeline

### BLOCKED
- `P40` Design-System & Farben
- `P09` Ergebnis-Engine v1

### BACKLOG
- `P30` Audit/Activity Log
- `P31` Lint Debt Cleanup
- `P42` Admin Separation
- `P99` Fleet Dev Policy

---

## 9. Offene ToDos / Nächste sinnvolle Schritte

### Kurzfristig sinnvoll
1. **Nahtlosen Authentik-Flow Ende-zu-Ende absichern**
   - anonyme Anmeldung
   - Claim
   - Login/Registrierung mit passender E-Mail
   - sauberer Rückweg in den fachlichen Flow
2. **Scope REVIEW sauber abschließen**
   - vor allem `P50`, `P08`, `P05`
3. **Methodik nur minimal-invasiv stärken**
   - Handoff pflegen
   - Rollen/Owner klar halten
   - keine große Strukturmigration vor dem Wettkampf

### Fachlich größere Themen danach
- Public API (Phase 1.5)
- Ergebnis-Engine
- Audit/Activity Log
- Admin Separation

---

## 10. Bekannte Stolperfallen

1. **Falsches Projekt / falscher Deploy-Kontext**
   - relevant ist aktuell `authentik-nextjs-demo`
   - ein erster Deploy ging versehentlich ins falsche Vercel-Projekt

2. **Veraltete Dokumente können irreführen**
   - insbesondere altes Domain Model und Roadmap

3. **Production-Smoke-Daten bleiben sonst liegen**
   - Cleanup ist organisatorisch mitzudenken

4. **CLI-Zugriff auf Production-DB nicht selbstverständlich**
   - `DATABASE_URL` war lokal nicht verfügbar
   - App funktionierte trotzdem, aber Cleanup/DB-Checks wurden dadurch erschwert

5. **Zu viele Wahrheiten gleichzeitig**
   - wenn Requirements, Memory, alte Dokus und Chat auseinanderlaufen, wird das Team langsamer

---

## 11. Konkreter Status vom 2026-05-14

### Bestätigt
- Production-Deploy erfolgreich
- Registration-Mails für 2026 fachlich live bestätigt
- öffentliche Anmeldung ohne Login live
- Claim-Handoff-UX live verbessert
- Cross-Agent-Abstimmung gestartet: Handoff wird als gemeinsames Projekt-Handout genutzt
- Ein kleines, zentrales Git-Repo für Methodik/Betrieb ist als sinnvolle Richtung festgehalten, aber **erstmal ohne große Migration vor dem Wettkampf**

### Noch offen
- Authentik-Flow Ende-zu-Ende fachlich final absichern
- REVIEW-Scopes konsequent abräumen
- gemeinsames Agenten-Betriebsmodell nach dem Wettkampf sauber ausformulieren

---

## 12. Next 3 actions

### 1. Nächster sicherer Schritt
Authentik-/Claim-Handoff einmal Ende-zu-Ende mit echter Mail und echtem Login verifizieren.

### 2. Größtes Risiko
Vor dem Wettkampf zu viel Methodik-, Repo- oder Infra-Umbau anzustoßen und dadurch Fokus von der fachlich kritischen Authentik-/Anmeldekette abzuziehen.

### 3. Nicht verwechseln
`docs/REQUIREMENTS.md` ist fachliche SSOT. Chat ist nur Abstimmung, nicht Wahrheit. Operativer Stand steckt in `memory/2026-05-14.md`, `SCOPEBOARD.md` und diesem Handoff.

---

## 13. Empfohlener Start für die nächste Session

### In 5 Minuten orientieren
- `docs/REQUIREMENTS.md`
- `memory/2026-05-13.md`
- `SCOPEBOARD.md`
- dieses Dokument hier

### Dann entscheiden
- entweder **Review/Abschlussarbeit** sauber fertig machen
- oder **genau einen** neuen Scope aktiv ziehen

Nicht beides gleichzeitig.

---

## 14. Verbesserungsvorschläge für unsere Methodik

### 1. Standardisiertes Handout pro Projekt einführen
Empfehlung:
- pro Projekt genau **ein** `docs/SESSION-HANDOFF-<projekt>.md`
- gleiches Raster für alle Projekte

Nutzen:
- bessere Übergaben
- weniger Re-Discovery in jeder Session
- schnelleres Onboarding für Agenten und Menschen

### 2. Klare Dateiklassen erzwingen
Empfehlung:
- **SSOT**: fachliche Wahrheit
- **Runbook**: wie arbeite/deploye/debugge ich
- **Handoff**: aktueller Zustand + nächste Schritte
- **Memory**: Tagesnotizen / operative Ereignisse

Nutzen:
- weniger Vermischung von dauerhaftem Wissen und Tagesrauschen

### 3. REVIEW-Status härter behandeln
Aktuell sammeln sich REVIEW-Scopes.

Empfehlung:
- REVIEW maximal kurz halten
- pro Session zuerst REVIEW leerräumen, bevor neuer Scope gezogen wird

Nutzen:
- weniger halbfertige Baustellen
- klarerer Projektzustand

### 4. Stale-Doku sichtbarer markieren
Empfehlung:
- veraltete Dateien oben mit großem Banner markieren
- optional in Archiv-Ordner verschieben

Nutzen:
- weniger Fehlgriffe
- weniger mentale Reibung

### 5. Session-Ende standardisieren
Empfehlung:
vor jeder Compaction oder Session-Pause kurz pflegen:
- `memory/YYYY-MM-DD.md`
- `SCOPEBOARD.md`
- `docs/SESSION-HANDOFF-S5EVO.md` nur wenn sich der operative Status wirklich geändert hat

Nutzen:
- sauberer Wissensübergang
- weniger Chat-Abhängigkeit

### 6. “Next 3 actions” Pflichtfeld einführen
Empfehlung:
jedes Handoff enthält immer genau diese drei Punkte:
- nächster sicherer Schritt
- größtes Risiko
- was man auf keinen Fall verwechseln darf

Nutzen:
- extrem gute Wiederanlaufgeschwindigkeit

---

## 15. Meine klare Empfehlung

Ja, ich würde das **als Standard auf jedes Projekt anwenden**.

Aber nicht als lose Idee, sondern als verbindliches Muster:
- ein Handout pro Projekt
- ein einheitliches Format
- Session-Übergabe immer dort konsolidieren

Für S5Evo ist dieses Dokument jetzt der erste brauchbare Stand dafür.
