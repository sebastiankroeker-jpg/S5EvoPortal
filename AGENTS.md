# AGENTS.md - S5Evo Workspace

Dieses Projekt ist der Workspace für die **Fünfkampf Software (S5Evo)** – eine Webanwendung zur Verwaltung und Durchführung von Mannschaftsfünfkampf-Wettkämpfen.

## Erste Schritte jede Session

1. **Lies `docs/REQUIREMENTS.md`** — die Single Source of Truth für alle fachlichen Anforderungen
2. Prüfe `memory/` für aktuelle Tagesnotizen
3. Bei Unklarheiten: REQUIREMENTS.md ist verbindlich, nicht die älteren Einzeldokumente

> ⚠️ `docs/5kampf-domain-model.md`, `ROADMAP.md` und `memory/5kampf-project-index.md` sind **veraltet**.
> Die konsolidierten, aktuellen Anforderungen stehen ausschließlich in `docs/REQUIREMENTS.md`.

## Projekt-Kontext

- **Use Case:** Sport Event Platform für Mannschaftsfünfkampf
- **Verein:** ESV (Branding: #dc2626)
- **Scope:** ~107 Teams × 5 Teilnehmer, Multi-Tenant
- **Stack:** Next.js + TypeScript + PostgreSQL + Prisma 6.x + shadcn/ui
- **Auth:** Authentik (self-hosted IdP) via OAuth2/OIDC + NextAuth.js
- **Hosting:** Vercel (App) + IONOS VPS (Authentik) + IONOS Webspace (Static)
- **Repo:** github.com/sebastiankroeker-jpg/S5EvoPortal
- **Live:** https://s5-evo-portal.vercel.app

## Wichtige Dateien

| Datei | Inhalt | Status |
|---|---|---|
| `docs/REQUIREMENTS.md` | **Alle Anforderungen (SSOT)** | ✅ Aktuell |
| `docs/ADR-auth-konzept.md` | Auth-Entscheidung | ✅ Gültig |
| `docs/auth-setup-guide.md` | Authentik Setup Guide | ✅ Gültig |
| `docs/5kampf-domain-model.md` | Altes Domain Model | ⚠️ Veraltet |
| `ROADMAP.md` | Alte Roadmap | ⚠️ Veraltet |
| `memory/5kampf-project-index.md` | Alter Projekt-Index | ⚠️ Veraltet |

## Team

- **Sebastian (Dude)** – Initiator, Solution Architect
- *(weitere Mitglieder hinzufügen)*

## 🔍 Memory-Suche Reihenfolge

Wenn nach historischen Informationen gefragt wird (Entscheidungen, Gespräche, Projekte, Personen):

1. **`memory_search`** — immer zuerst (MEMORY.md + Tagesnotizen + Projekt-Docs)
2. **`lcm_grep`** mit `allConversations=true` — zusätzlich, wenn:
   - memory_search nicht genug liefert
   - Die Frage sich auf alte Chat-Gespräche bezieht
   - Du nach Mustern, Fehlern, Entscheidungsketten suchst
3. **`lcm_expand`** / **`lcm_expand_query`** — um gefundene Summaries tiefer aufzuschlüsseln

**Faustregel:** Bei historischen Fragen BEIDE nutzen (memory_search + lcm_grep). memory_search findet was du aufgeschrieben hast, LCM findet was du gesagt hast.

## Regeln

- **Anforderungen ändern → `docs/REQUIREMENTS.md` aktualisieren**
- Dokumentiere Architektur-Entscheidungen in `decisions/`
- Keine persönlichen oder sensiblen Daten in diesem Workspace
- Klassifikation ist 2026 — kein Mixed mehr, neue Klassen (Jungsters, Masters)
