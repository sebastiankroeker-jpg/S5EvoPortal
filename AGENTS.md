<<<<<<< HEAD
# AGENTS.md - S5Evo Workspace

Dieses Projekt ist der Workspace für die **Fünfkampf Software (S5Evo)** – eine Webanwendung zur Verwaltung und Durchführung von Mannschaftsfünfkampf-Wettkämpfen.

## Erste Schritte jede Session

1. Lies `docs/5kampf-domain-model.md` – das vollständige Domain Model
2. Lies `memory/5kampf-project-index.md` – Schnellreferenz mit Klassifikation und Business Rules
3. Prüfe `ROADMAP.md` für aktuellen Projektstand
4. Prüfe `memory/` für aktuelle Tagesnotizen

## Projekt-Kontext

- **Use Case:** Sport Event Platform für Mannschaftsfünfkampf
- **Scope:** ~107 Teams × 5 Teilnehmer, Multi-Tenant
- **Stack:** Next.js + TypeScript + PostgreSQL + Prisma (ADR-0004)
- **Scope-Strategie:** V1 MVP first, V2+ später (ADR-0005)
- **Deployment:** Docker Compose + Caddy (geplant)

## V1 MVP Features

- Online-Anmeldung (Team-Registration)
- Mannschaftsdaten pflegen (Participants, Classifications)
- Approval-Workflow (Teilnehmer-Änderungen → Admin-Freigabe)
- Admin-Ansicht + Export (CSV/XLSX)
- Ergebniserfassung + Auswertung

## V2+ Pipeline (geparkt)

- Chat (Matrix-Integration evaluieren)
- Games/Wetten (rechtlich/vereinsintern prüfen)
- Singlebörse

## Offene Fragen (aktiv verfolgen!)

- [ ] Exakte 5 Disziplinen aus der Ausschreibung
- [ ] Punktesystem pro Disziplin
- [ ] Auth-Konzept: Passwort? Magic Link? Invite-Codes?
- [ ] Datenschutz/Einwilligung (Teilnahme + Ergebnisveröffentlichung)
- [ ] Anmelde-Deadlines
- [ ] Hosting: Heimserver + Cloud (Docker)

## Team

- **Sebastian (Dude)** – Initiator, Solution Architect
- *(weitere Mitglieder hinzufügen)*

## Wichtige Dateien

| Datei | Inhalt |
|-------|--------|
| `docs/5kampf-domain-model.md` | Vollständiges Domain Model + Business Rules |
| `memory/5kampf-project-index.md` | Schnellreferenz (Klassifikation, Entities) |
| `memory/migration-context.md` | Ursprung + Architektur-Entscheidungen |
| `ROADMAP.md` | Phasen und aktueller Stand |

## Regeln

- Dokumentiere Entscheidungen in `decisions/`
- Halte `ROADMAP.md` aktuell
- Keine persönlichen oder sensiblen Daten in diesem Workspace
=======
<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
>>>>>>> 637a14a (initial commit: Next.js Demo + Authentik README)
