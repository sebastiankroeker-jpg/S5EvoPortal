# CHANGELOG — S5Evo Portal

> Chronologische Übersicht aller relevanten Deployments und Änderungen.
> Format: Datum | Version/Scope | Was passiert ist

---

## 2026-04-11

- **P50: Admin-Changelog Feedback**
  - Neue Prisma-Tabelle `ChangelogEntry` inkl. Enums + Migration `20260411025305_add_changelog_entry`
  - Admin-API (`/api/admin/changelog-entries`) mit Create/List/Update + Filterabfragen
  - Changelog-Seite erweitert um Admin-Panel (Form, Filterliste, Status-Aktionen)

## 2026-04-03

- **Testdaten-Generator überarbeitet:**
  - Jungsters-Klasse: Gender von `mixed` → `M` korrigiert (erzeugte fälschlich gemischte Teams)
  - Herren/Damen generieren jetzt korrekt nur M bzw. W
  - Re-Roll funktioniert: Klasse wechseln + Würfel → Teilnehmer 1-4 bekommen frische Daten
  - Teilnehmer 0 (Anmelder) wird **nie** überschrieben — Warnungen zeigen Konflikte in Echtzeit
  - Namenspool verdoppelt (70/70/80) — mehr Generationen-Mix + bayerisch/österreichische Namen

## 2026-04-01

- **REQUIREMENTS.md v3** — Default-Rollen-Fix, Supply-Chain-Security, Stakeholder-Interview-Deadline dokumentiert
- **CHANGELOG.md** angelegt (dieses Dokument)
- **Memory-Eintrag** für 01.04. geschrieben

## 2026-03-31

- Sebastian fordert automatisches Audit-Skript gegen kompromittierten axios-Release (1.14.1 / 0.30.4)
- npm Safety Defaults dokumentiert (min-release-age, ignore-scripts, save-exact)

## 2026-03-30

- **Bugfix:** Neue User konnten keine Mannschaft anmelden — API `/profile/roles` liefert jetzt Default-Rollen (TEAMCHEF + TEILNEHMER) für User ohne Tenant-Rolle
- Live auf Vercel deployed

## 2026-03-26

- **Fehl-Deploy auf portal.s5evo.de** — Subagent hat leeres `/app/`-Projekt gebaut statt `authentik-nextjs-demo/`. Portal zeigte Next-Startertemplate
- Korrekturplan: künftige Builds aus `authentik-nextjs-demo/`, Smoke-Test Pflicht
- Deploy-Pipeline (`docs/deploy-pipeline.md`) dokumentiert

## 2026-03-25

- PDF-Archiv Import Setup gestartet — historische Ergebnis-PDFs nach `data/archiv-pdfs/` hochgeladen

## 2026-03-24

- Authentik SMTP konfiguriert (smtp.ionos.de:587, TLS)
- Google Social Login Test → `redirect_uri_mismatch` → Sebastian kurzzeitig ausgesperrt → Fix via SSH/Django Shell

## 2026-03-23

- **v0.5.0** deployed: Vercel-Style Redesign (Command Pill, Burger-Menü, Theme-Context)
- **v0.4.0** deployed: Teams CRUD, Admin API, Dashboard, Permission-System, Role-Switcher, Changelog-Seite
- **v0.3.0** Prisma Migration `full_domain_model` — 13 Tabellen, 10 Enums
- Prisma Postgres DB aufgesetzt (Vercel Storage Integration)
- SSH Deploy Key für GitHub erstellt
- UI-Redesign Plan (3 Phasen) mit Sebastian abgestimmt

## 2026-03-22

- **ESV-Mode** implementiert (Vereinsbranding #dc2626, Luftbild)
- **Prisma 6.x** Integration (Schema: Users, Teams, Participants)
- Domain-Refactor: `lib/domain/team.ts` mit Zod-Schemas
- Architektur-Visualisierung (`/architecture`)
- 4 Sub-Agenten parallel orchestriert (erster Erfolg!)

## 2026-03-21

- **Projekt-Kickoff:** Authentik auf IONOS VPS installiert + gehärtet
- Next.js Demo erstellt, Authentik OIDC integriert
- Erster Vercel Deploy: https://s5-evo-portal.vercel.app
- Caddy Reverse Proxy für auth.s5evo.de
- SSH-Härtung (Key-only, fail2ban)
- **Security Incident:** SSH-Key versehentlich auf GitHub → sofort bereinigt + rotiert
- Features: Login, Mannschaftsanmeldung, Theme Switcher (Light/Dark/Psychedelic)

---

*Dieses Changelog wird bei jedem Deploy/Milestone aktualisiert.*
