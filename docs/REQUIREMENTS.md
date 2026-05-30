# S5Evo — Fachliche Anforderungen (Single Source of Truth)

> **Dieses Dokument ist die verbindliche Referenz für alle fachlichen Anforderungen.**
> Bevor du Features implementierst, prüfe hier den aktuellen Stand.
> Änderungen an Anforderungen → hier dokumentieren, nicht anderswo.

**Stand:** 2026-04-23 (v4)
**Maintainer:** Sebastian (Dude) + S5Evo

---

## 1. Produktvision

**S5Evo** ist eine digitale Plattform für den Mannschaftsfünfkampf — von der Anmeldung bis zur Live-Ergebnisanzeige. Selbst gehostet, datenschutzkonform, erweiterbar.

- **Domain:** s5evo.de
- **Name:** Soier / Super 5Kampf — evolve
- **Verein:** ESV (Branding: #dc2626 rot, Luftbild-Ästhetik)
- **Scope:** ~107 Teams à 5 Teilnehmer, Multi-Tenant-fähig
- **Verbindliche Ausschreibung 2026:** Wettkampf am **24./25.07.2026**, Anmeldeschluss **22.07.2026**, Anmeldung über `www.esv-bad-bayersoien.de`

---

## 2. Benutzerrollen & Berechtigungen

| Rolle | Berechtigung | Workflow |
|---|---|---|
| **Administrator** | Vollzugriff: Wettkampf-Setup, User-Verwaltung, Approvals | Direktzugriff |
| **Moderator** | Ergebnis-Erfassung, Startlisten, Export, Kommentare | Read + Erfassung |
| **Teamchef** | Team anlegen, eigene Teilnehmer verwalten | Änderungen → Approval-Queue |
| **Teilnehmer** | Nur eigene Daten editieren | Änderungen → Approval-Queue |
| **Zuschauer** | Öffentliche Ergebnistafel (kein Login nötig) | Read-only |

**Authentik-Gruppen-Mapping:**

> Authentik bleibt primär für Identität/SSO zuständig. Die fachlich maßgeblichen Portal-Rollen werden im Portal über `TenantRole` verwaltet. Authentik-Gruppen sind optional für Bootstrap-/Systemadmin-Zugänge, aber nicht der Standardweg für die laufende Rollenzuordnung.

| Authentik Gruppe | Portal-Rolle |
|---|---|
| `s5evo-admin` | Administrator |
| `s5evo-moderator` | Moderator |
| `s5evo-teamchef` | Teamchef |
| `s5evo-teilnehmer` | Teilnehmer |

---

## 3. Disziplinen (5, fix)

| Disziplin | Code | Einheit | Sortierung | Typ |
|---|---|---|---|---|
| Laufen | RUN | Sekunden | ASC (niedrigere = besser) | simple |
| Bankdrücken | BENCH | kg (relativ: gedrückt − Körpergewicht) | DESC (höher = besser) | simple |
| Stockschießen | STOCK | Punkte | DESC (mehr = besser) | shots (11 Schübe) |
| Rennrad | ROAD | Sekunden | ASC | simple |
| Mountainbike | MTB | Sekunden | ASC | simple |

### Stockschießen — Sonderwertung
- 11 Schübe auf Latten, mögliche Werte: 12, 11, 10, 9, 7, 5, 3, 1, 0
- Schlechtester Schub wird gestrichen ("Streicher") → Summe der 10 besten = Ringe
- **BWZ (Bestweitzahl):** Trefferverteilung als Tie-Break-Schlüssel (Format: XX.XXX.XXX — Anzahl Treffer pro Ringzone von hoch nach niedrig)
- **Tiebreaker-Kaskade:**
  1. Höhere BWZ gewinnt (mehr Treffer in höheren Zonen)
  2. Höherer Streicher-Wert gewinnt (gleichmäßigere Leistung)
  3. Immer noch gleich → Platz wird geteilt

### Bankdrücken — Sonderwertung
- Gewicht ist **relativ**: Gedrücktes Gewicht minus Körpergewicht
- Positive Werte = mehr gedrückt als Körpergewicht
- Negative Werte = weniger gedrückt als Körpergewicht
- **-999** = nicht angetreten → letzter Platz (geteilt)
- Sortierung: Höchstes relatives Gewicht = bester Platz

---

## 4. Klassifikationssystem 2026

> ⚠️ **Aktualisiert für 2026** — ersetzt das 2025er System.

### Jahrgangbasierte Klassen (Einzelalter)

| Klasse | Jahrgänge | Berechnungsart |
|---|---|---|
| Schüler A | 2016–2018 | Individuell (alle im Bereich) — **jüngste erlaubte Klasse** |
| Schüler B | 2013–2015 | Individuell (alle im Bereich) |
| Jugend | 2009–2012 | Individuell (alle im Bereich) |

### Altersbasierte Klassen (Team-Gesamtalter)

| Klasse | Gesamtalter | Geschlecht | Berechnungsart |
|---|---|---|---|
| Jungsters | ≤ 125 Jahre | Beliebig¹ | Summe aller 5 Teilnehmer |
| Herren | 126–225 Jahre | Beliebig¹ | Summe aller 5 Teilnehmer |
| Masters | ≥ 226 Jahre | Beliebig¹ | Summe aller 5 Teilnehmer |
| Damen A | ≤ 150 Jahre | Nur Frauen² | Summe aller 5 Teilnehmer |
| Damen B | > 150 Jahre | Nur Frauen² | Summe aller 5 Teilnehmer |

> ¹ Gemischte Teams (Männer+Frauen) starten in der Herren-Wertung. Es gibt keine eigene Mixed-Kategorie.
> ² Reines Frauenteam = alle 5 Teilnehmerinnen weiblich.

### Änderungen gegenüber 2025
- ❌ **Mixed-Kategorie entfernt** — gemischte Teams starten in der Herren-Wertung
- ✅ **Jungsters** neu (ehemals Herren A, ≤125)
- ✅ **Herren** (ehemals Herren B, 126-225)
- ✅ **Masters** neu (ehemals Herren C, ≥226)
- ✅ Altersberechnung: Stichtag 2026

### Gesamtwertungen (nur Erwachsene)

| Ranking | Typ | Quell-Klassen |
|---|---|---|
| Damen Gesamt | combined | Damen A + Damen B |
| Herren Gesamt | combined | Jungsters + Herren + Masters |

> ⚠️ Schüler & Jugend haben **keine** Gesamtwertung.

---

## 5. Punktevergabe

**Grundregel (alle Disziplinen):**
- Punkte = Anzahl Teilnehmer in der Klasse − (Platz − 1)
- Erster Platz = Teilnehmerzahl der Klasse
- Letzter Platz = 1 Punkt
- **Gleichstand:** Beide erhalten Punkte der besseren Platzierung

**Gesamtwertung:** Eigene Punktevergabe über die kombinierten Klassen (Teilnehmerzahl = Summe aller Teams in den Quell-Klassen).

---

## 6. Team & Teilnehmer — Business Rules

### Harte Regeln
- Team = **exakt 5 Teilnehmer**
- Teamchef kann **Teilnehmer oder reiner Betreuer** sein (z.B. Elternteil bei Kindermannschaften)
- Wenn Teamchef selbst antritt, zählt er als einer der 5 Teilnehmer
- **consentGiven = true** ist Pflicht pro Teilnehmer (DSGVO)
- Pro Teilnehmer kann optional ein **interner Moderationshinweis** gepflegt werden; sichtbar nur intern im Portal und optional für Startlisten-Ausgaben nutzbar
- Schüler/Jugend: Alle Teilnehmer müssen im gleichen Jahrgangsbereich liegen
- **Mindestalter:** Jahrgänge jünger als Schüler A (nach 2018) sind nicht erlaubt
- Erwachsene: Gesamtalter aller 5 Teilnehmer bestimmt Klasse
- Reines Frauenteam (alle 5 weiblich) → Damen-Wertung
- Orga/Admin kann ein **Claim-Link Dashboard** nutzen, um Übernahmelinks intern einzusehen, neue Links für Supportfälle zu erzeugen und aktive Links bei Bedarf zu sperren
- Orga/Admin kann pro Wettkampf konfigurieren, ob neue **Claim-Links** bis zum **Wettkampfende**, bis zum **Anmeldeschluss** oder für eine **feste Anzahl Tage** gültig sind
- Orga/Admin kann pro Wettkampf **rollenbezogene Team-Features** konfigurieren, mindestens:
  - ob Teamchefs im Mannschafts-Dashboard den Filter **„Anleger:in“** sehen
  - ob **Teilnehmer** andere Mannschaften sehen dürfen
  - ob **Zuschauer** andere Mannschaften sehen dürfen
- Orga/Admin kann einen **Competition-Reset** für den aktiven Wettkampf ausführen, um Test- und Probeanmeldungen vor dem offiziellen Start kontrolliert zu entfernen
- Gemischtes oder reines Männerteam → Herren-Wertung (Jungsters/Herren/Masters nach Gesamtalter)
- Sobald mindestens ein männlicher Teilnehmer in der Mannschaft ist, startet das Team in der Herren-Wertung

### Disziplin-Zuordnung (pro Team)
- Jeder Teilnehmer wird **genau einer Disziplin** zugeordnet (Dropdown)
- Jede der 5 Disziplinen muss in einer Mannschaft **genau einmal** vergeben sein
- **"TBD"** ist nur als kurzfristiger UI-Zwischenzustand während der Bearbeitung zulässig, darf aber **nicht gespeichert** werden
- Ziel: Teamchef sieht jederzeit, welche Disziplinen bereits besetzt sind

### Sichtbarkeit & Veröffentlichung
- Fachlich sollen **Zugriffsrechte** und **Veröffentlichungsgrad** getrennt modelliert werden:
  - **Zugriffsrechte** = welche Rolle welche Bereiche/Teams im Portal sehen oder bearbeiten darf
  - **Veröffentlichungsgrad** = welche Team-/Teilnehmerdaten öffentlich oder rollenübergreifend angezeigt werden dürfen
- Teamchef kann pro Team den **Veröffentlichungsgrad** setzen, mindestens mit diesen Stufen:
  - **TEAM_ANONYM** = Team erscheint anonym
  - **TEAMNAME_OEFFENTLICH** = Teamname ist sichtbar, Teilnehmernamen bleiben anonym
  - **ALLES_OEFFENTLICH** = Teamname und freigegebene Teilnehmernamen sind sichtbar
- Teilnehmer kann **nur für die eigene Person** steuern, ob der eigene Name veröffentlicht werden darf:
  - **NAME_VERBERGEN**
  - **NAME_VEROEFFENTLICHEN**
- Bei Konflikten gilt immer die **restriktivere Regel**:
  - Wenn das Team anonym ist, bleiben auch freigegebene Teilnehmernamen unsichtbar
  - Wenn das Team auf `ALLES_OEFFENTLICH` steht, aber ein Teilnehmer `NAME_VERBERGEN` wählt, bleibt genau dieser Teilnehmer anonym
- E-Mail-Adressen, interne Hinweise und Kontaktdaten sind **nie Bestandteil der öffentlichen Veröffentlichung**

### Default-Rollen (Neu-Registrierung)
- Neue User ohne existierende Tenant-Rolle erhalten automatisch **TEAMCHEF + TEILNEHMER**
- **ADMIN wird nie automatisch** bei einer normalen Neu-Registrierung vergeben
- Admin-Rechte werden nur bewusst durch bestehende Admins vergeben
- Damit sehen Neu-Registrierte sofort den Anmelde-Tab (Fix vom 30.03.2026)
- Eingeladene Personen aus einem Team-Kontext erhalten nach erfolgreichem Claim standardmäßig **nur die Rolle TEILNEHMER**
- Eine Hochstufung von **TEILNEHMER** auf **TEAMCHEF** darf nur durch **Admin/Orga** erfolgen, nicht durch andere Teamchefs

### Team-Einladung & Claim-Zuordnung
- In V1 wird pro Teilnehmer **genau eine primäre Kontakt-/Invite-E-Mail-Adresse** gepflegt
- Eine **Telefonnummer wird in V1 nicht pro Teilnehmer geführt**; sie gehört fachlich an den Team-/Teamchef-Kontakt, nicht an den einzelnen Teilnehmer
- Beim erstmaligen Hinterlegen oder erneuten Versenden einer Teilnehmer-E-Mail kann das System eine **Einladungsmail mit Claim-Token** senden
- Wenn für eine Teilnehmer:in eine neue/geänderte E-Mail-Einladung erzeugt wird, werden bestehende offene, nicht eingelöste Claim-Links für diese Teilnehmer:in widerrufen und auditierbar protokolliert
- Das Portal zeigt pro Teilnehmer den Status der E-Mail-Einladung an (z.B. kein Link, versendet/offen, eingelöst, abgelaufen, gesperrt, Konto verknüpft)
- Wenn ein Teilnehmer eine gültige E-Mail-Adresse hat, aber noch keine offene/eingelöste Einladung, kann Orga/Teamchef die **Einladung manuell erneut senden**
- Ein solcher Claim ist fachlich an den konkreten Teilnehmer-Kontext gebunden und führt standardmäßig in eine **TEILNEHMER**-Berechtigung für genau diese Person
- Wenn die eingeladene Person bereits ein Portal-Konto mit der Invite-E-Mail besitzt, kann sie dieses Konto verwenden; ein neues Konto ist dafür nicht erforderlich
- Claim-Links müssen **widerrufbar**, **auditierbar** und mit bestehender Claim-Gültigkeitslogik kombinierbar bleiben
- Falls eine eingeladene E-Mail nicht zur später verwendeten Login-Identität passt, braucht es einen klaren Support-/Admin-Prozess statt stillschweigender Zuordnung
- Wenn eine falsche E-Mail bereits von der falschen Person eingelöst wurde, darf eine spätere E-Mail-Korrektur die Account-Zuordnung **nicht automatisch** ändern; Admin/Orga kann die bestehende Teilnehmer-Account-Verknüpfung explizit lösen, alle alten Tokens sperren und eine neue Einladung an die korrigierte E-Mail senden
- V2-Idee: Teamchef kann eine solche Korrektur anfragen; die eigentliche Entkopplung bleibt bis zu einer bewussten Freigabe Admin/Orga-kontrolliert
- Für die fachliche Teilnehmer-Zuordnung gilt: **E-Mail ist ein Kontakt-/Invite-Kanal, aber nicht die eigentliche Identität**
- Die dauerhafte Zuordnung eines Portal-Accounts zu einem Teilnehmer soll über eine **stabile User-ID-Verknüpfung** erfolgen, nicht über die E-Mail-Adresse allein
- Empfohlene Modellierung:
  - Teilnehmer hat optional genau **einen primären Account-Link** für Self-Service
  - zusätzliche E-Mail-Adressen für Einladung/Benachrichtigung sind **kein V1-Pflichtumfang** und würden bei echtem Bedarf **separat** modelliert
- Claim-Links für Teilnehmer sollen daher **participant-scoped** sein; bestehende team-scoped Claims bleiben nur für Team-Übernahme

### Approval-Workflow
- **Teamchef:** Änderungen an Teilnehmerdaten laufen ebenfalls über die Approval-Queue
- **Teilnehmer:** Nur eigene Daten → Approval-Queue
- **Admin:** Alles + Approvals abarbeiten
- **Klassenänderung durch Datenänderung:** Automatische Neuberechnung + Extra-Approval
- Wenn Geburtsdatum oder Geschlecht zu einer anderen Mannschaftsklasse führen würden, muss der Änderungsflow das direkt als Hinweis anzeigen
- Änderungsanträge sollen für Orga **auditierbar** bleiben (wer, was, wann, alter/neuer Wert, Review-Entscheid)
- Änderungs-Mails an Team/Orga und Review-Entscheidungen sollen die konkret geänderten Felder mit altem und neuem Wert enthalten
- Im UI soll der Status für Änderungsanträge klar sichtbar sein, mindestens **„in Prüfung“** und **„genehmigt“** (optional auch **„abgelehnt“**)
- Folgeausbau nach Testfreigabe: Orga-Mail bei eingereichten Änderungen mit Deep-Link ins Mannschafts-/Admin-Dashboard zur Freigabe
- Pro Teilnehmer ist in V1 **genau eine offene Änderungsanfrage** gleichzeitig erlaubt; weitere Eingaben aktualisieren den bestehenden offenen Antrag
- Direkte Änderungen durch **Admin/Moderator** werden ohne Freigabe angewendet, aber auditierbar protokolliert
- Änderungs-Mails an die Orga gehen an **alle** im Wettbewerb hinterlegten \`registrationNotificationEmail\`-Empfänger
- Änderungen an Teilnehmer-E-Mail-Adressen sind in V1 **nicht genehmigungspflichtig**, weil die E-Mail nur Kontakt-/Invite-Kanal ist; sie werden direkt gespeichert, aber weiterhin auditierbar protokolliert
- Änderungen an der persönlichen **Namensveröffentlichung** (`NAME_VERBERGEN` / `NAME_VEROEFFENTLICHEN`) sind in V1 **nicht genehmigungspflichtig**; sie werden direkt gespeichert und auditierbar protokolliert
- Rückfragen erhalten in V1 **keinen eigenen Workflow-Status**; es gibt zunächst nur \`PENDING\`, \`APPROVED\`, \`REJECTED\`
- Wenn Teilnehmer innerhalb eines Teams die **Disziplin tauschen**, bleibt ihre **Teilnehmer-Identität** bestehen:
  - Moderationshinweis, Audit-Historie, offene Änderungsanträge und Account-Zuordnung hängen am **Teilnehmer**
  - Es wechselt nur die **Disziplin-Zuordnung**
- Die Implementierung darf Teilnehmer bei einem Disziplin-Tausch deshalb **nicht implizit über Listenindex oder Slot-Reihenfolge austauschen**

### Anmelde- & Login-Modi
- Mannschaftsanmeldung muss **ohne vorherigen Login** möglich bleiben
- Zusätzlich soll sich ein Teamchef **optional vor der Anmeldung registrieren und über Authentik anmelden** können
- Beide Einstiege müssen in denselben fachlichen Anmeldeprozess führen
- Ein späterer Claim-/Zuordnungsflow für bereits anonym angelegte Teams bleibt weiterhin möglich
- Validierungs- und Klassifikationshinweise im Anmeldeprozess müssen auf die betroffene **Disziplin** verweisen, damit z.B. fehlende oder unplausible Geburtsdaten nicht nur als generische Sammelmeldung erscheinen

### Datenreset & Wiederherstellung
- Vor dem offiziellen Start darf der aktive Wettkampf **ohne Tenant-Löschung** auf einen sauberen Zustand zurückgesetzt werden
- Der Reset ist **competition-scoped** und betrifft insbesondere Teams, Teilnehmer, Pending Changes, Claim-Tokens, Rankings und Ergebnissätze des gewählten Wettkampfs
- Tenant-Stammdaten, Branding, Rollen, Benutzerkonten und Competition-Stammdaten bleiben beim Reset erhalten
- Vor jedem Reset muss ein **vollständiger Snapshot** der betroffenen Wettkampfdaten erstellt werden, damit eine spätere Wiederherstellung möglich bleibt
- Jeder Reset muss **auditierbar** sein: mindestens mit Ausführendem, Zeitpunkt, Begründung, Umfang und Ergebnis
- Für normale Einzellöschungen bleiben **Soft Deletes** bestehen; der Competition-Reset ist ein eigener administrativer Vorgang mit Snapshot + Audit

### Approval-Status
```
DRAFT → PENDING → APPROVED | REJECTED
```

---

## 7. Domain Model (Kurzfassung)

```
Tenant (Wettkampf-Instanz)
  └── Competition
        ├── Disciplines (5x fix)
        │     └── DisciplineResults → Shots (nur Stockschießen)
        ├── Classifications (Klassen 2026)
        │     └── CompetitionRankings (class + combined)
        └── Teams
              ├── TeamChief (User, nicht Teilnehmer)
              └── Participants (5x)
                    └── PendingChanges → ApprovalStatus

User → TenantRoles (pro Wettkampf)
```

---

## 8. Authentifizierung

**Entscheidung:** Authentik (self-hosted IdP) via OAuth2/OIDC

**Rollenmodell:** Hybrid
- Authentik = Login, SSO, Identität
- Portal-Datenbank (`User`, `TenantRole`) = fachliche Rollen und Berechtigungen
- Optionale Authentik-Gruppen bleiben für spätere Systemadmin-/Bootstrap-Fälle möglich

| Komponente | Detail |
|---|---|
| Identity Provider | Authentik auf IONOS VPS (217.154.65.203) |
| Domain | auth.s5evo.de (Caddy Reverse Proxy, Auto-HTTPS) |
| App-Integration | NextAuth.js mit OIDC Provider |
| Slug | `s5-evo-portal` |
| Discovery URL | `https://auth.s5evo.de/application/o/s5-evo-portal/.well-known/openid-configuration` |
| Scopes | openid, profile, email |
| Social Login | Google (geplant) |
| MFA | Für Admins geplant |

**Redirect URIs:**
- `https://s5-evo-portal.vercel.app/api/auth/callback/authentik`
- `http://localhost:3000/api/auth/callback/authentik` (Dev)

**Vercel ENV-Variablen:**
`NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `AUTHENTIK_CLIENT_ID`, `AUTHENTIK_CLIENT_SECRET`, `AUTHENTIK_ISSUER`, `DATABASE_URL`, `POSTGRES_URL_NON_POOLING`

**Warum Authentik:**
- Ein Account für alle Apps (SSO)
- Datensouveränität (self-hosted)
- Standard-Protokolle (OAuth2/OIDC)
- Kostenlos (Open Source)

---

## 9. Tech-Stack

| Komponente | Technologie |
|---|---|
| Frontend | Next.js + TypeScript + React + shadcn/ui |
| Backend | Next.js API Routes |
| ORM | Prisma 6.x |
| Datenbank | Postgres (Vercel Postgres) |
| Auth | Authentik + NextAuth.js |
| Hosting App | Vercel (s5-evo-portal.vercel.app) |
| Hosting Auth | IONOS VPS (Docker Compose + Caddy) |
| Deployment App | GitHub Push → Vercel Auto-Deploy |
| Deployment Portal | rsync + SSH → portal.s5evo.de (IONOS Webspace) |
| Repo | github.com/sebastiankroeker-jpg/S5EvoPortal |
| Edge AI (Phase 3) | Nvidia Jetson Orin Nano + ZED X |

---

## 10. Feature-Phasen

### Phase 1 — MVP ← **Aktueller Fokus**
- [x] Mannschafts-Anmeldung (3-Schritt-Flow: Team Info → Teilnehmer + Disziplin → Bestätigung)
- [x] Login via Authentik (OAuth2/OIDC)
- [x] Theme System (Light/Dark/Psychedelic/ESV-Mode/Sys-Admin)
- [x] Klassifikation 2026 implementiert
- [ ] Disziplin-basierte Registration (Teilnehmer pro Disziplin)
- [ ] Datenpersistenz (Prisma + Postgres, aktuell nur Frontend-State)
- [ ] Admin-Dashboard + Export (CSV/XLSX)
- [ ] Öffentliche Ergebnistafel (kein Login nötig)
- [ ] Ergebnis-Erfassung (mobiltauglich)
- [ ] Öffentliche Mannschaftsanmeldung ohne vorherigen Authentik-Login
- [ ] Optionale Registrierung / Authentik-Login schon vor der Mannschaftsanmeldung
- [x] Bestätigungsmail an Anmelder + Verein nach erfolgreicher Anmeldung
- [x] T-Shirt-Größe pro Teilnehmer
- [x] T-Shirt-Bestellschluss (`shirtOrderDeadline`) in Wettkampf-Parametern

### Phase 1.5 — Public API (Read-Only)
- [ ] `GET /api/public/teams` — Alle Teams + Klassen (kein Auth)
- [ ] `GET /api/public/results` — Aktuelle Ergebnisse pro Disziplin
- [ ] `GET /api/public/rankings` — Platzierungen pro Klasse + Gesamtwertung
- [ ] API-Dokumentation (Swagger/OpenAPI oder einfache Docs-Seite)

### Phase 2 — Ausbau
- [ ] Scoring-Engine (Platzierung, Punkte, Tiebreaker, Gesamtwertungen)
- [ ] Live-Ticker / Zwischenstände
- [ ] Mannschafts-Statistiken & Historie
- [ ] Foto-Upload pro Wettkampf
- [ ] Benachrichtigungen (E-Mail / Push)
- [ ] Auditierbare Änderungshistorie + Approval-Mail-Workflow für Teilnehmer-/Mannschaftsänderungen
- [ ] Anpassbares Regelwerk pro Wettkampf-Typ

### Phase 3 — Vision
- [ ] Ziellinien-Erfassung per Kamera (Edge AI)
- [ ] Automatische Zeitmessung
- [ ] Zuschauer-Voting / Publikumspreis
- [ ] Wetten/Onlinespiele, Chat-System
- [ ] Integration mit Vereins-Website

---

## 11. Supply-Chain-Security

- **axios-Vorfall (03/2026):** Kompromittierte Versionen 1.14.1 / 0.30.4 identifiziert
- **Audit-Skript:** `authentik-nextjs-demo/scripts/security/axios-audit.sh` — prüft Lockfiles + node_modules
- **GitHub Action:** `security-audit.yml` läuft automatisch auf Push/PR gegen `main`
- **npm Safety Defaults:** `min-release-age 3`, `ignore-scripts true`, `save-exact true`, bevorzugt `npm ci`

---

## 12. Offene Fragen

- [ ] Bankdrücken Tara: Brutto (inkl. Stange) oder Netto?
- [ ] DSGVO: Exakter Consent-Text, Löschfristen
- [ ] Anmelde-Deadlines pro Wettkampf
- [ ] Soll der Bearbeitungslink per E-Mail-Verifikation abgesichert werden oder reicht ein direkter Magic-Link nach Absenden?
- [ ] Social Login (Google) von Anfang an oder später?
- [ ] MFA für Admins verpflichtend?
- [ ] Stakeholder-Interviews (Wettkampfleiter, Moderation, Sportler) — **Zeitkritisch! Wettkampf 25./26. Juli**

---

## Referenzen

| Dokument | Beschreibung | Status |
|---|---|---|
| `docs/5kampf-domain-model.md` | Detailliertes Domain Model (2025er Klassen!) | ⚠️ Veraltet — hier ist aktuell |
| `docs/STRATEGY.md` | Vision, Feature-Ideen, Recruiting-Text | Ergänzend |
| `docs/ADR-auth-konzept.md` | Auth-Entscheidung (ADR) | Gültig |
| `docs/auth-setup-guide.md` | Authentik Setup Schritt-für-Schritt | Gültig |
| `ROADMAP.md` | Implementierungs-Phasen | ⚠️ Veraltet — hier ist aktuell |
| `memory/5kampf-project-index.md` | Kompakt-Index (2025er Klassen!) | ⚠️ Veraltet — hier ist aktuell |

---

*Änderungshistorie:*
- 2026-05-29 v7: Teilnehmer-Einladungsmodell für V1 geschärft: pro Teilnehmer zunächst genau eine primäre Invite-/Kontakt-Mail. Mehrere Empfänger nur bei später nachgewiesenem Bedarf und dann als eigene Struktur, nicht als Feld-Workaround.
- 2026-05-29 v6: Privacy-/Veröffentlichungsmodell für Teams und Teilnehmer präzisiert, inkl. restriktiver Konfliktregel. Einladungs-/Claim-Flow für Teilnehmer-E-Mails ergänzt; eingeladene Personen starten standardmäßig als TEILNEHMER, Upgrade auf TEAMCHEF nur durch Admin/Orga.
- 2026-05-17 v5: Approval-Workflow fachlich erweitert: Änderungsanträge sollen auditierbar sein, UI-Status wie „in Prüfung“ / „genehmigt“ tragen und später per Orga-Mail mit Deep-Link ins Freigabe-Dashboard ausgelöst werden. Umsetzung bewusst nach der ersten Testwelle einplanen.
- 2026-04-22 v4: Neue Anforderungsrichtung aus Vereins-Feedback ergänzt: öffentliche Mannschaftsanmeldung ohne vorgelagerten Authentik-Login, Bestätigungsmails an Anmelder + Verein, T-Shirt-Größe pro Teilnehmer sowie T-Shirt-Bestellschluss in den Wettkampf-Parametern.
- 2026-04-01 v3: Default-Rollen-Fix dokumentiert (neue User ohne Tenant-Rolle bekommen automatisch TEAMCHEF+TEILNEHMER, Admins zusätzlich ADMIN). Supply-Chain-Security ergänzt (axios-Audit, npm Safety Defaults). Deploy-Pipeline-Referenz aktualisiert. CrewUnited-Gruppenchat als Kommunikationskanal notiert.
- 2026-03-22 v2: Teamchef-Regel präzisiert (kann Betreuer ODER Teilnehmer sein), Disziplin-Zuordnung definiert (Dropdown, keine Doppelnennung, TBD erlaubt), Registration-Flow (3 Schritte), Auth Redirect URIs + ENV-Vars ergänzt, Mixed-Wording bereinigt.
- 2026-03-22 v1: Initiale Konsolidierung aus Domain Model, Strategy, Roadmap, ADRs und Memory-Files. Klassifikation auf 2026 aktualisiert.
