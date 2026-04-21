# OpenClaw Runtime Runbook

Stand: 2026-04-21

## Zielbild

OpenClaw und QMD sollen im Service-Betrieb ausschließlich mit der System-Node-Laufzeit laufen.

- Node: `/usr/bin/node`
- OpenClaw: `/usr/bin/openclaw`
- QMD: `/usr/bin/qmd`
- Service-PATH: `/usr/bin:/usr/local/bin:/bin`

## Root Cause

Instabile Zustände entstehen, wenn mehrere Installationen parallel aktiv sind:

- `nvm`-Node in der User-Shell
- systemweite Node für den Gateway-Service
- zusätzliche globale Installationen via `pnpm`
- native Module (z. B. `better-sqlite3`) mit ABI-Bindung an die falsche Node-Version

Typische Folgen:

- `ERR_DLOPEN_FAILED`
- Gateway-Startfehler
- inkonsistentes Verhalten zwischen Service und Shell
- QMD-/Tool-Ausfälle

## Verifizierter guter Zustand

### Service

Der laufende Gateway-Prozess ist sauber, wenn gilt:

- Prozess-EXE zeigt auf `/usr/bin/node`
- Environment enthält keinen `nvm`- oder `pnpm`-Pfad
- `PATH=/usr/bin:/usr/local/bin:/bin`

### Config

Folgende QMD-Einstellungen sind auf kleinen CPU-VMs sinnvoll:

```json
{
  "memory": {
    "qmd": {
      "update": {
        "onBoot": false,
        "waitForBootSync": false
      }
    }
  }
}
```

Tradeoff:
- schneller/stabiler Start
- Recall kann nach Boot kurz weniger aktuell sein

## Aktueller Befund vom 2026-04-21

### Sauber

- Gateway läuft mit `/usr/bin/node`
- Service-PATH ist bereinigt
- geladene Config ist valide
- `memory.qmd.update.onBoot = false`
- `memory.qmd.update.waitForBootSync = false`
- `channels.telegram.streaming.mode = "partial"`

### Noch unsauber

In der interaktiven User-Shell existieren weiterhin konkurrierende Installationen:

- `~/.nvm/versions/node/v22.22.1/bin/node`
- `~/.nvm/versions/node/v22.22.1/bin/openclaw`
- `~/.nvm/versions/node/v22.22.1/bin/qmd`
- `~/.local/share/pnpm/openclaw`
- zusätzlich systemweit:
  - `/usr/bin/openclaw`
  - `/usr/bin/qmd`

Das ist für den Service tolerierbar, aber für Debugging/CLI-Betrieb riskant.

## Empfohlene Stabilisierung

### 1. Service strikt systemweit lassen

Keine Änderung nötig, solange der Service mit sauberem PATH läuft.

### 2. QMD explizit pinnen (empfohlen)

Optional, aber robust:

```json
{
  "memory": {
    "qmd": {
      "command": "/usr/bin/qmd"
    }
  }
}
```

Damit hängt QMD im Gateway nicht mehr implizit am PATH.

### 3. Shell und Admin-CLI entwirren

Ziel: auch manuelle Wartungsbefehle sollen die System-Installation nutzen.

Pragmatische Varianten:

#### Variante A, sicher und minimal
Nur für Admin-Kommandos saubere Umgebung nutzen:

```bash
env -i HOME=$HOME PATH=/usr/bin:/usr/local/bin:/bin /usr/bin/openclaw status
```

#### Variante B, dauerhaft sauberer
User-Shell-PATH so anpassen, dass `/usr/bin` vor `~/.nvm/...` steht oder OpenClaw/QMD nicht mehr aus `nvm` geladen werden.

#### Variante C, konsequent aufräumen
Alte globale `nvm`- und `pnpm`-Installationen von `openclaw` und `qmd` entfernen, wenn sie nicht mehr benötigt werden.

## Wichtiger Hinweis zu npm

`/usr/bin/npm` ist ein Node-Skript mit `#!/usr/bin/env node`.
Wenn in der Shell `nvm`-Node zuerst im PATH steht, kann selbst `/usr/bin/npm` wieder die falsche Node-Version verwenden.

Für wirklich systemweite npm-Aufrufe daher entweder:

```bash
env -i HOME=$HOME PATH=/usr/bin:/usr/local/bin:/bin /usr/bin/npm ...
```

oder direkt mit sauberem PATH arbeiten.

## Schnellchecks

### Service prüfen

```bash
pid=$(pgrep -f '^openclaw-gateway$' | head -n1)
readlink -f /proc/$pid/exe
strings /proc/$pid/environ | grep '^PATH='
```

Erwartung:

- `/usr/bin/node`
- `PATH=/usr/bin:/usr/local/bin:/bin`

### System-Binaries prüfen

```bash
env -i HOME=$HOME PATH=/usr/bin:/usr/local/bin:/bin /bin/sh -c 'which node openclaw qmd; node -v; openclaw --version; qmd --version'
```

## Empfehlung

Für diese VM ist das aktuelle Service-Setup gut.

Die wichtigste Restarbeit ist nicht der Gateway-Service, sondern die Bereinigung der interaktiven Shell, damit künftige Debug-/Update-Befehle nicht wieder versehentlich gegen `nvm` oder `pnpm` laufen.
