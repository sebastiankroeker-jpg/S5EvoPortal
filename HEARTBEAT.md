# HEARTBEAT.md — S5Evo
## Reihenfolge (jeder Heartbeat, von oben nach unten)

### 0. INBOX.md prüfen (IMMER ZUERST)
- Neue Brieftauben oder Aufträge? → Sofort bearbeiten
- Inbox schlägt alles andere

### 1. ScopeBoard durchgehen
- `cat SCOPEBOARD.md`
- Gibt es IN_PROGRESS Scopes? → Daran weiterarbeiten
- Gibt es REVIEW Scopes? → Prüfen ob Feedback da ist, ggf. auf DONE setzen
- Kein WIP offen? → Nächsten READY Scope auf IN_PROGRESS ziehen und anfangen
- **Max 2 Scopes gleichzeitig IN_PROGRESS.** Fertig machen vor Neuem.

### 2. Build & Commit Check
- `cd ~/workspace && git status`
- Uncommitted changes? → Committen mit sinnvoller Message
- `npm run build` — bricht der Build? → Fixen hat Vorrang vor neuen Features

### 3. Blocker melden (wenn nötig)
- BLOCKED Scopes prüfen: Gibt es neue Infos die den Blocker lösen?
- Wenn >1 Tag blockiert ohne Fortschritt → Brieftaube an Claw mit konkreter Frage
- Nicht warten, nicht hoffen — eskalieren

### 4. Deploy-Check (1x/Tag)
- Vercel Deploy Status: läuft Production?
- Wenn letzter Deploy >3 Tage her und es gibt fertige Features → deployen
- **Vor jedem Deploy:** Build lokal grün? Build-Output korrekt (nicht das Starter-Template)? Smoke-Test nach Deploy!

## Regeln
- Nachtmodus (22:00–07:00 Europe/Berlin): HEARTBEAT_OK
- **Scope-Arbeit > alles andere** (außer Inbox)
- Kein Housekeeping während offener Feature-Scopes
- Wenn blockiert: bauen was geht, nicht warten
- ⏰ **Wettkampf: 25./26. Juli 2026** — jeder Heartbeat zählt
