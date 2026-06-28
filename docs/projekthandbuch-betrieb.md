# Projekthandbuch: Betrieb, Migrationen und Releases

Stand: 2026-06-06

## Zweck

Dieses Dokument sammelt operative Learnings fuer sichere Aenderungen im Produktivbetrieb. Es ergaenzt die fachlichen Anforderungen und die Deploy-Pipeline.

## Pre-Flight vor Produktivdeploy

Vor einem Deploy mit Datenbankbezug immer pruefen:

- Session-Handoff lesen, sofern vorhanden.
- `git status --short` pruefen und nur produktive App-Aenderungen stagen.
- Workspace-/Agent-Dateien wie `AGENTS.md`, `HEARTBEAT.md`, `MEMORY.md`, `SOUL.md` nicht in App-Commits aufnehmen.
- Bei isolierten Snapshot-Deploys sicherstellen, dass der Snapshot nicht auf einem aelteren technischen Basisstand ohne benoetigte Runtime-/Prisma-Anpassungen basiert.
- TypeScript, Lint und Build ausfuehren.
- Prisma-Migrationsstatus gegen die konfigurierte Datenbank pruefen.
- Bei Produktivdaten ein Backup ziehen oder vorhandene Backup-Option bestaetigen.

## Pflicht-Smoke-Test nach Produktivdeploy

Ein `HTTP 200` auf `/` reicht nicht als Produktionsfreigabe. Nach jedem Produktivdeploy muessen mindestens diese Checks erfolgreich sein:

```bash
curl -I -L https://portal.s5evo.de
curl -sS https://portal.s5evo.de/api/competition
```

Erwartung:

- `/` liefert `HTTP 200`
- `/api/competition` liefert JSON mit Wettbewerbsdaten, nicht nur eine generische Fehlerantwort

Wenn der Deploy Prisma, Datenbankzugriffe oder serverseitige Runtime betrifft, zusaetzlich mindestens eine weitere betroffene API- oder Auth-Route pruefen.

## Datenbank, Prisma und Migrationen

Die Datenbank ist der echte Zustand: Tabellen, Spalten und Datensaetze. `prisma/schema.prisma` ist der gewuenschte Modellstand im Code. Migrationen sind die nachvollziehbaren SQL-Schritte, die den Datenbankzustand auf diesen Modellstand bringen.

Wichtige Regeln:

- Produktiv-Migrationen muessen im Git-Commit enthalten sein.
- Additive Migrationen sind bevorzugt: neue Spalten mit Defaults, neue Enums, neue Indizes.
- Drops/Deletes nur bewusst und nach Datenpruefung.
- Prisma kann lokale Migrationsordner erzeugen, die wegen Ignore-Regeln nicht automatisch im Commit landen. Dann explizit mit `git add -f prisma/migrations/...` aufnehmen.
- Nach Migrationen aktive Daten kurz zaehlen, z.B. Teams, Teilnehmer, User.

## Manuelles Backup

Wenn kein Cloud-Snapshot verfuegbar ist, lokal einen PostgreSQL-Dump ziehen:

```bash
pg_dump --dbname="$DATABASE_URL" --format=custom --no-owner --no-privileges --file="backups/<name>.dump"
pg_restore --list "backups/<name>.dump"
```

Learnings aus Prisma Postgres:

- Client und Server-Version muessen kompatibel sein.
- Bei Postgres 17 sollte auch ein `pg_dump` 17 verwendet werden.
- Backup-Dateien enthalten Produktivdaten und duerfen nicht committed oder verschickt werden.
- `backups/` bleibt lokal/ignoriert.
- Nach dem Dump Groesse, SHA256 und `pg_restore --list` pruefen.

## Git-Staging

Staging ist die Vorauswahl fuer den naechsten Commit:

- Arbeitsverzeichnis: Dateien wurden geaendert.
- Staging Area: Aenderungen sind fuer den Commit vorgemerkt.
- Commit: Der vorgemerkte Stand wird als feste Version gespeichert.

Bei dieser Plattform koennen Ignore-Regeln neue App- oder Migrationsdateien ausblenden. Deshalb vor jedem Commit kontrollieren:

```bash
git status --short
git diff --cached --stat
```

Wenn eine erwartete neue Datei fehlt, gezielt mit `git add -f <datei>` aufnehmen.

## Sportlerboerse MVP: Release-Learnings

- Die Sportlerboerse wurde bewusst als Erweiterung des bestehenden Team-/Teilnehmermodells gebaut, nicht als paralleles Datenmodell.
- Die oeffentliche Anmeldung hat eine eigene Route `/sportlerboerse`, nutzt aber denselben Backend-Flow wie die Mannschaftsanmeldung.
- Die Mannschaftsanmeldung bleibt separat unter `/anmeldung`.
- `registrationMode = MARKETPLACE` trennt Boerseneintraege fachlich von echten Teams.
- Auswertungen wie Teamanzahl muessen echte Teams filtern und Boerseneintraege ausschliessen.
- Claim-Token und Mailflow sind sensible Bestandteile und nach Aenderungen besonders zu pruefen.

## Incident-Learning 2026-06-28

- Eine fachlich harmlose UI-Aenderung kann beim isolierten Snapshot-Deploy trotzdem produktiv scheitern, wenn der Snapshot auf einem aelteren technischen Stand basiert.
- Im konkreten Fall fehlte im deployten Basisstand der Prisma-`binaryTargets`-Eintrag fuer `rhel-openssl-3.0.x`; der Build wirkte nach aussen erfolgreich, die Runtime schlug aber auf `/api/competition` fehl.
- Konsequenz: Bei Snapshot-Deploys immer auch technische Begleitdateien wie `prisma/schema.prisma`, Build-Skripte und Runtime-Konfiguration gegenpruefen.
- Konsequenz: Produktionsfreigabe nie nur auf Landing-Page-Checks stuetzen.
