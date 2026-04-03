# ScopeBoard - S5Evo (Source of Truth)

> One line = one scope. Keep WIP small. Order by Priority.
>
> Format:
> `P<nr> | <STATUS> | S5Evo | Owner:<name> | <Title> | DoD:<short>`
>
> Status values: BACKLOG, READY, IN_PROGRESS, REVIEW, BLOCKED, DONE

## Scopes

P05 | REVIEW | S5Evo | Owner:s5evo | ScopeBoard Remote Access | DoD: HTTPS via `svc:scopeboard` + sanitised dashboard-only root
P10 | DONE | S5Evo | Owner:s5evo | Self-Service Teilnehmerdaten ändern | DoD: User kann eigene Teilnehmerdaten ändern + Approval Workflow greift
P41 | DONE | S5Evo | Owner:s5evo | Phase 2 – Navigation & Home-Flow | DoD: Bottom Tabs, Home-Dashboard, Profil „Darstellung" (Backport ThemeSwitcher)
P20 | DONE | S5Evo | Owner:Sebastian | Admin-UI: Teilnehmerübersicht + Search | DoD: Liste + Suche + Edit-Entrypoint
P30 | BACKLOG | S5Evo | Owner:s5evo | Audit/Activity Log für Änderungen | DoD: Änderungsprotokoll pro Teilnehmer sichtbar
P31 | BACKLOG | S5Evo | Owner:s5evo | Lint Debt Cleanup | DoD: `npm run lint` zero errors/warnings für Portal-Repo
P40 | READY | S5Evo | Owner:s5evo | Phase 1 - Design-System & Farben | DoD: neue Tokens, Light/Dark Feinschliff, reduzierte Borders
P42 | BACKLOG | S5Evo | Owner:s5evo | Phase 3 - Admin Separation | DoD: dedizierte Admin-Sidebar, Role-Switch im Admin-Bereich
P08 | IN_PROGRESS | S5Evo | Owner:s5evo | Historische PDF-Import Pipeline | DoD: CSV/JSON für 2016-2024 + Seed in DB + Multi-Tenant-Switcher
P09 | READY | S5Evo | Owner:s5evo | Ergebnis-Engine v1 | DoD: Ranking + Punkte + Tiebreaks + Regression gegen Archivdaten
P99 | BACKLOG | S5Evo | Owner:s5evo | Fleet Dev Policy | DoD: docs/FLEET-DEV-POLICY.md geschrieben + von Claw reviewed

---

## Inbox

See: INBOX.md
