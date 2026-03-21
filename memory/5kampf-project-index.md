# 5Kampf Projekt - Index und Struktur

## Projektübersicht
- **Use Case:** Sport Event Platform für Mannschaftsfünfkampf
- **Teilnehmer:** ca. 107 Teams mit je 5 Teilnehmern
- **Stack:** Next.js + TypeScript + Postgres + Prisma
- **Deployment:** Docker Compose + Caddy
- **Multi-Tenancy** für verschiedene Wettbewerbe und Testinstanzen
- **Rollen:** Teamchef, Teilnehmer, Administrator, Moderator
- **Approval-Workflow:** Teilnehmeränderungen → Admin-Freigabe

## Disziplinen (5, fix)

| Disziplin | Code | Einheit | Sortierung | Typ |
|-----------|------|---------|------------|-----|
| Laufen | RUN | s | ASC | simple |
| Bankdrücken | BENCH | kg (Tara) | DESC | simple |
| Stockschießen | STOCK | pts | DESC | shots (11 Schübe, Streicher) |
| Rennrad | ROAD | s | ASC | simple |
| Mountainbike | MTB | s | ASC | simple |

## Punktevergabe
- Punkte = Teilnehmerzahl der Klasse − (Platz − 1)
- Gleichstand → gleicher Platz, gleiche Punkte
- Stockschießen-Tiebreaker: Streicher → Countback (12er, 11er, ...) → Platzteilung

## Klassifikationssystem 2025
- Schüler A: Jahrgang 2015-2017
- Schüler B: Jahrgang 2012-2014
- Jugend: Jahrgang 2008-2011
- Damen A: Gesamtalter ≤ 150 Jahre
- Damen B: Gesamtalter ≥ 150 Jahre
- Herren A: Gesamtalter ≤ 125 Jahre
- Herren B: Gesamtalter 126-225 Jahre
- Herren C: Gesamtalter ≥ 226 Jahre

## Gesamtwertungen (nur Erwachsene)
- **Damen Gesamt:** Damen A + Damen B
- **Herren Gesamt:** Herren A + Herren B + Herren C
- Schüler & Jugend: Keine Gesamtwertung

## Business Rules
- Team = exakt 5 Teilnehmer
- Teamchef ≠ Participant (kann Betreuer sein)
- Mixed-Team → Herren-Wertung
- Consent (Datenschutz-Einwilligung) = Pflichtfeld pro Teilnehmer
- Klassenänderung → Neuberechnung + Extra-Approval

## Domain Model
```
Tenant → Competition → Teams → Participants
                    → Disciplines → DisciplineResults → Shots (Stockschießen)
                    → Classifications → CompetitionRankings (class + combined)
User → TenantRoles
ApprovalStatus: DRAFT | PENDING | APPROVED | REJECTED
```

## Offene Fragen
- Auth-Konzept (Magic Link / Invite-Codes / Passwort)
- DSGVO: Consent-Text, Löschfristen
- Anmelde-Deadlines
- Bankdrücken Tara: Brutto oder Netto?

---
*Letzte Aktualisierung: 2026-02-16*
