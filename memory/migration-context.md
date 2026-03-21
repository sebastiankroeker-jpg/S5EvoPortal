# Migration Context - 5Kampf/S5Evo

*Migriert am: 2026-02-13 aus dem Haupt-Workspace*

## Projekt-Ursprung (2026-02-01)

- **Use Case:** Sport Event Platform für Mannschaftsfünfkampf
- **Scope:** ~107 Teams × 5 Teilnehmer
- **Stack-Entscheidung:** Next.js + Postgres + Prisma (Option 1)
- **Scope:** V1 MVP + V2+ Pipeline für Erweiterungen
- **Namenskonvention:** "5Kampf" als Projektname im Sub-Agent System

## Domain Modeling Session (2026-02-03)

### Architektur-Entscheidungen:
- **Multi-Tenancy:** Ja (verschiedene Wettkämpfe + Testinstanz)
- **User-Rollen:** Teamchef, Teilnehmer, Administrator, Moderator
- **Approval-Workflow:** Teilnehmer-Änderungen müssen durch Admin bestätigt werden
- **Klassifikation:** Geschlecht + Jahrgang, bei Änderungen Neuberechnung nötig
- **Future-Features:** Wetten, Singlebörse, Chat (service-orientiert)

### Business Rules:
- Team = exakt 5 Participants
- Teamchef ist NICHT zwingend Participant (kann Elternteil/Betreuer sein)
- Geschlechtertrennung, bei Mixed → Male-Wertung
- Klassenänderungen triggern Extra-Approval
- Notifications für alle Rollen

### Klassifikationsregeln 2025:
- **Schüler A:** Jahrgang 2015-2017 (individual)
- **Schüler B:** Jahrgang 2012-2014 (individual)
- **Jugend:** Jahrgang 2008-2011 (individual)
- **Damen A:** Gesamtalter ≤ 150 Jahre
- **Damen B:** Gesamtalter ≥ 150 Jahre
- **Herren A:** Gesamtalter ≤ 125 Jahre
- **Herren B:** Gesamtalter 126-225 Jahre
- **Herren C:** Gesamtalter ≥ 226 Jahre

### Domain Model:
Tenant → Competition → Teams → Participants
- User & TenantRole System
- Classifications mit age_rule/gender
- PendingChange für Approval-Workflow

**Vollständiges Domain Model:** siehe `docs/5kampf-domain-model.md`

## Offene Punkte (Stand 2026-02-03)
- Exakte 5 Disziplinen aus Ausschreibung
- Punktesystem pro Disziplin
- Anmelde-Deadlines
- Service Architecture + API Design (Phase 2)

## Team
- **Sebastian (Dude):** Initiator, Solution Architect
- Weitere Mitglieder über Slack-Channel
