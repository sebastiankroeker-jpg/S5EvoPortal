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
| **Teamchef** | Team anlegen, eigene Teilnehmer verwalten | Direkte Änderungen |
| **Teilnehmer** | Nur eigene Daten editieren | Änderungen → Approval-Queue |
| **Zuschauer** | Öffentliche Ergebnistafel (kein Login nötig) | Read-only |

**Authentik-Gruppen-Mapping:**

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
- Schüler/Jugend: Alle Teilnehmer müssen im gleichen Jahrgangsbereich liegen
- **Mindestalter:** Jahrgänge jünger als Schüler A (nach 2018) sind nicht erlaubt
- Erwachsene: Gesamtalter aller 5 Teilnehmer bestimmt Klasse
- Reines Frauenteam (alle 5 weiblich) → Damen-Wertung
- Gemischtes oder reines Männerteam → Herren-Wertung (Jungsters/Herren/Masters nach Gesamtalter)

### Disziplin-Zuordnung (pro Team)
- Jeder Teilnehmer wird **genau einer Disziplin** zugeordnet (Dropdown)
- Doppelnennungen sind erlaubt (z.B. zwei Läufer im selben Team)
- **"TBD"** als Platzhalter ist erlaubt — auch mehrfach innerhalb einer Mannschaft
- TBD muss **vor Wettkampfbeginn** durch eine echte Disziplin ersetzt werden
- Ziel: Teamchef sieht jederzeit, welche Disziplinen bereits besetzt sind

### Default-Rollen (Neu-Registrierung)
- Neue User ohne existierende Tenant-Rolle erhalten automatisch **TEAMCHEF + TEILNEHMER**
- User mit Authentik-Admin-Gruppe erhalten zusätzlich **ADMIN**
- Damit sehen Neu-Registrierte sofort den Anmelde-Tab (Fix vom 30.03.2026)

### Approval-Workflow
- **Teamchef:** Direkte Änderungen an Team + Teilnehmern
- **Teilnehmer:** Nur eigene Daten → Approval-Queue
- **Admin:** Alles + Approvals abarbeiten
- **Klassenänderung durch Datenänderung:** Automatische Neuberechnung + Extra-Approval

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
- 2026-04-22 v4: Neue Anforderungsrichtung aus Vereins-Feedback ergänzt: öffentliche Mannschaftsanmeldung ohne vorgelagerten Authentik-Login, Bestätigungsmails an Anmelder + Verein, T-Shirt-Größe pro Teilnehmer sowie T-Shirt-Bestellschluss in den Wettkampf-Parametern.
- 2026-04-01 v3: Default-Rollen-Fix dokumentiert (neue User ohne Tenant-Rolle bekommen automatisch TEAMCHEF+TEILNEHMER, Admins zusätzlich ADMIN). Supply-Chain-Security ergänzt (axios-Audit, npm Safety Defaults). Deploy-Pipeline-Referenz aktualisiert. CrewUnited-Gruppenchat als Kommunikationskanal notiert.
- 2026-03-22 v2: Teamchef-Regel präzisiert (kann Betreuer ODER Teilnehmer sein), Disziplin-Zuordnung definiert (Dropdown, keine Doppelnennung, TBD erlaubt), Registration-Flow (3 Schritte), Auth Redirect URIs + ENV-Vars ergänzt, Mixed-Wording bereinigt.
- 2026-03-22 v1: Initiale Konsolidierung aus Domain Model, Strategy, Roadmap, ADRs und Memory-Files. Klassifikation auf 2026 aktualisiert.
