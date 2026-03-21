# 5-Kampf Projekt - Domain Model & Architektur

## Projekt-Übersicht
- **Name:** Mannschaftsfünfkampf Webanwendung
- **Stack:** Next.js + TypeScript + Postgres + Prisma
- **Deployment:** Docker Compose + Caddy
- **Scope:** ~107 Teams à 5 Teilnehmer, Multi-Tenant, Approval-Workflow
- **Status:** Domain Modeling Phase (Phase 1)

## User Rollen & Berechtigungen

| Rolle | Berechtigung | Workflow |
|-------|-------------|----------|
| **Teamchef** | Team anlegen, eigene Teilnehmer verwalten | Direkte Änderungen |
| **Teilnehmer** | Nur eigene Daten editieren | Änderungen → Approval-Queue |
| **Administrator** | Alles + Wettkampf-Setup + Approvals | Vollzugriff |
| **Moderator** | Read-only: Startlisten + Notizen | Export/Druck |

## Core Domain Entities

### 1. Multi-Tenant Foundation
```
Tenant (Wettkampf-Instanz)
├── name: "5-Kampf Bad Bayersoien 2025"
├── status: draft | active | completed  
├── settings: CompetitionSettings
└── created_by: Administrator
```

### 2. User & Role System
```
User
├── email (unique)
├── profile: UserProfile
└── tenant_roles: TenantRole[]

TenantRole  
├── tenant_id
├── user_id
├── role: teamchef | participant | admin | moderator
└── permissions: Permission[]
```

### 3. Competition Structure
```
Competition (per Tenant)
├── disciplines: Discipline[] (5x, fix)
├── classifications: Classification[]
├── rankings: CompetitionRanking[]
├── teams: Team[]
└── settings: CompetitionSettings

Classification
├── name: "Schüler A" | "Damen B" | "Herren C" etc.
├── gender: male | female | mixed
├── age_rule: by_individual_year | by_total_age
├── rules: ClassificationRule

ClassificationRule (konkrete Regeln 2025):
├── Schüler A: Jahrgang 2015-2017 (individual)
├── Schüler B: Jahrgang 2012-2014 (individual)  
├── Jugend: Jahrgang 2008-2011 (individual)
├── Damen A: Gesamtalter ≤ 150 Jahre (total)
├── Damen B: Gesamtalter ≥ 150 Jahre (total)
├── Herren A: Gesamtalter ≤ 125 Jahre (total)
├── Herren B: Gesamtalter 126-225 Jahre (total)
└── Herren C: Gesamtalter ≥ 226 Jahre (total)
```

### 4. Disciplines (fix – 5 Disziplinen)

```
Discipline
├── name: string
├── code: string (unique)
├── unit: string
├── sortDirection: ASC | DESC
├── resultType: simple | shots
└── results: DisciplineResult[]
```

| Disziplin | Code | Einheit | Sortierung | Typ |
|-----------|------|---------|------------|-----|
| Laufen | RUN | s | ASC (niedrigere Zeit = besser) | simple |
| Bankdrücken | BENCH | kg (Tara) | DESC (höheres Gewicht = besser) | simple |
| Stockschießen | STOCK | pts | DESC (mehr Punkte = besser) | shots |
| Rennrad | ROAD | s | ASC (niedrigere Zeit = besser) | simple |
| Mountainbike | MTB | s | ASC (niedrigere Zeit = besser) | simple |

### 5. Ergebnis-Erfassung

```
DisciplineResult
├── participant_id
├── discipline_id
├── classification_id
├── resultValue: float?        // Zeit (s) oder Gewicht (kg) – für simple-Disziplinen
├── rank: int                  // Platz innerhalb der Klasse (berechnet)
├── points: int                // Platzierungspunkte (berechnet)
├── shots: Shot[]              // Nur für Stockschießen
└── timestamps

Shot (nur Stockschießen)
├── disciplineResult_id
├── shotNumber: 1-11
├── value: 12|11|10|9|7|5|3|1
├── isDropped: boolean         // true = Streicher (niedrigster Wert)
└── @@unique(disciplineResult_id, shotNumber)
```

### 6. Punktevergabe & Platzierung

**Grundregel (alle Disziplinen):**
- Punkte = Anzahl Teilnehmer in der Klasse − (Platz − 1)
- Erster Platz = Teilnehmerzahl der Klasse
- Letzter Platz = 1 Punkt
- **Gleichstand:** Beide erhalten Punkte der besseren Platzierung

**Stockschießen – Wertung & Tiebreaker:**
1. 11 Schübe auf Latten, mögliche Werte pro Schub: 12, 11, 10, 9, 7, 5, 3, 1
2. Schlechtester Schub wird gestrichen ("Streicher") → Summe der 10 besten
3. **Tiebreaker-Kaskade bei Punktgleichheit:**
   - TB1: Höherer Streicher-Wert gewinnt
   - TB2: Countback – mehr 12er? → besser. Gleich viele 12er → mehr 11er? usw. abwärts
   - TB3: Immer noch gleich → Platz wird geteilt

**Einfache Disziplinen (Laufen, Bankdrücken, Rennrad, MTB):**
- Gleiches Ergebnis → gleicher Platz (bessere Platzierung geteilt)

### 7. Gesamtwertungen (Combined Rankings)

```
CompetitionRanking
├── type: class | combined
├── classification_ids: []     // Bei combined: Quell-Klassen
├── name: string
└── results: RankingResult[]
```

| Ranking | Typ | Quell-Klassen |
|---------|-----|---------------|
| Schüler A | class | Schüler A |
| Schüler B | class | Schüler B |
| Jugend | class | Jugend |
| Damen A | class | Damen A |
| Damen B | class | Damen B |
| **Damen Gesamt** | **combined** | **Damen A + Damen B** |
| Herren A | class | Herren A |
| Herren B | class | Herren B |
| Herren C | class | Herren C |
| **Herren Gesamt** | **combined** | **Herren A + Herren B + Herren C** |

> ⚠️ Schüler & Jugend haben **keine** Gesamtwertung.

Gesamtwertungen verwenden dieselbe Punktelogik: Teilnehmerzahl der kombinierten Klassen bestimmt Maximalpunktzahl.

### 8. Team & Participants

```
Team
├── name: "FC Bayern Allstars"
├── classification_id
├── team_chief: User (NICHT Participant! z.B. Elternteil)
├── participants: Participant[] (5x exactly)
├── contact_person: User (falls ≠ team_chief)
├── approvalStatus: ApprovalStatus
└── pending_changes: PendingChange[]

Participant
├── user_id
├── team_id  
├── first_name, last_name
├── gender: male | female
├── birth_year
├── consentGiven: boolean      // PFLICHT – Einwilligung Datenverarbeitung/Ergebnisveröffentlichung
├── notes: string (für Moderator)
├── status: active | inactive
├── approvalStatus: ApprovalStatus
└── pending_changes: PendingChange[]
```

### 9. Approval-Workflow

```
enum ApprovalStatus {
  DRAFT
  PENDING
  APPROVED
  REJECTED
}

PendingChange
├── entity_type: "team" | "participant"
├── entity_id
├── field_name: "birth_year" | "gender" | etc.
├── old_value
├── new_value
├── requested_by: User
├── requested_at: timestamp
├── status: ApprovalStatus
├── reviewed_by: User?
├── reviewed_at: timestamp?
├── triggers_reclassification: boolean
└── notes: string
```

## Business Rules

1. **Team-Klassifikation:**
   - Bei Participant-Änderung → Classification neu berechnen
   - Falls Klassen-Wechsel → Extra Approval nötig
   - **Schüler/Jugend:** Alle Participants müssen im gleichen Jahrgangbereich sein
   - **Erwachsene:** Gesamtalter aller 5 Participants bestimmt Klasse
   - Mixed Teams → automatisch Herren-Wertung

2. **Approval-Chain:**
   - Teamchef: Direkte Änderungen an Team + allen Team-Participants
   - Participants: Nur eigene Daten → Approval-Queue
   - Admin: Alles + Approvals abarbeiten

3. **Constraints:**
   - Team = exakt 5 Participants
   - Teamchef ≠ Participant (kann Elternteil/Betreuer sein)
   - Gender-Mix → Male-Wertung (automatisch)
   - Geschlechtertrennung üblich, Mixed möglich
   - Klassifikation: Zwei Berechnungsarten (Individual-Jahrgang vs. Gesamtalter)
   - **consentGiven = true** Pflicht für Teilnahme

4. **Punktevergabe:**
   - Pro Disziplin: Platzierungspunkte innerhalb der Klasse
   - Gleichstand → gleicher Platz, gleiche Punkte (bessere Platzierung)
   - Stockschießen: Tiebreaker-Kaskade (Streicher → Countback → Platzteilung)
   - Gesamtwertung Damen/Herren: Eigene Punktevergabe über kombinierte Klassen

## Offene Fragen

- ~~Exakte 5 Disziplinen aus Ausschreibung~~ ✅ Geklärt
- ~~Punktesystem pro Disziplin~~ ✅ Geklärt
- Auth-Konzept: Magic Link / Invite-Codes / Passwort?
- Datenschutz-Details (DSGVO-konformer Consent-Text, Löschfristen)
- Anmelde-Deadlines für den nächsten Wettkampf
- Bankdrücken: Tara = Brutto inkl. Stange oder Netto ohne Stange? (Anzeige-Frage)

## Zukunfts-Features (V2+, geparkt)
- Wetten/Onlinespiele
- Singlebörse  
- Chat-System (Matrix-Integration evaluieren)
- → Service-orientierte Architektur für Erweiterbarkeit

---
*Erstellt: 2026-02-03 | Letzte Aktualisierung: 2026-02-16*
