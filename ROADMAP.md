# Roadmap – S5Evo

## Phase 1: Konzeption ✅ (größtenteils abgeschlossen)

- [x] Vision & Scope definieren
- [x] Tech-Stack entscheiden (Next.js + Postgres + Prisma – ADR-0004)
- [x] Scope V1 vs V2+ festgelegt (ADR-0005)
- [x] Domain Model erstellt (Tenant → Competition → Teams → Participants)
- [x] Business Rules definiert (Klassifikation, Approval-Workflow)
- [x] Rollen & Berechtigungen modelliert (Teamchef, Teilnehmer, Admin, Moderator)
- [x] 5 Disziplinen definiert (Laufen, Bankdrücken, Stockschießen, Rennrad, MTB)
- [x] Punktesystem & Wertungslogik spezifiziert (inkl. Stockschießen-Tiebreaker)
- [x] Gesamtwertungen modelliert (Damen Gesamt, Herren Gesamt)
- [x] Datenschutz-Consent als Pflichtfeld verankert
- [ ] Stakeholder-Interviews (Wettkampfleiter, Sportler)

## Phase 2: Design (nächste Phase)

- [x] **Deployment-Pipeline** → portal.s5evo.de via rsync + SSH (siehe [docs/deploy-pipeline.md](docs/deploy-pipeline.md))
- [ ] Service Architecture + API Design
- [ ] Database Schema (Prisma) aus Domain Model ableiten
- [ ] Auth-Konzept: **Authentik (OAuth2/OIDC)** → siehe [ADR](docs/ADR-auth-konzept.md) + [Setup Guide](docs/auth-setup-guide.md)
- [ ] UI/UX Wireframes (Anmelde-Flow, Admin-Dashboard)
- [ ] Datenschutz-Konzept (DSGVO, Einwilligungen, Löschfristen)
- [ ] Deployment-Architektur (Docker Compose + Caddy)

## Phase 3: MVP Implementation

- [ ] Dev-Environment Setup
- [ ] Prisma Schema + Migrations
- [ ] Team-Registration Feature (Anmelde-Flow)
- [ ] Participant-Management + Approval-Workflow
- [ ] Admin-Dashboard + Export (CSV/XLSX)
- [ ] Ergebniserfassung + Auswertung (inkl. Stockschießen-Einzelschüsse)
- [ ] Scoring-Engine (Platzierung, Punkte, Tiebreaker, Gesamtwertungen)
- [ ] Testing (Unit + Integration)

## Phase 4: Launch

- [ ] Pilot mit echtem Wettkampf
- [ ] Feedback einarbeiten
- [ ] Dokumentation (User + Admin)
- [ ] Rollout

## Offene Fragen (blocken Fortschritt)

- ~~Auth-Konzept: Magic Link / Invite-Codes / Passwort?~~ → **Authentik vorgeschlagen** (ADR liegt vor, Freiwillige gesucht!)
- Anmelde-Deadlines für den nächsten Wettkampf
- Bankdrücken Tara-Gewicht: Brutto (inkl. Stange) oder Netto?

---

*Letzte Aktualisierung: 2026-02-16*
