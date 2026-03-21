# Deploy Pipeline — portal.s5evo.de

## Übersicht

Automatisches Deployment von S5Evos Workspace auf den IONOS Webspace.

```
S5Evo Workspace → ./deploy.sh → rsync via SSH → portal.s5evo.de (live)
```

## Quickstart

```bash
# Seite bauen (in ./build/ ablegen)
# Dann deployen:
./deploy.sh

# Oder mit anderem Build-Verzeichnis:
./deploy.sh ./mein-ordner/
```

Das war's. Seite ist danach live auf **https://portal.s5evo.de**.

## Architektur

| Komponente | Detail |
|---|---|
| **Ziel-Domain** | portal.s5evo.de |
| **IONOS Webspace** | Verzeichnis `/portal/` |
| **Transport** | rsync über SSH (ed25519 Key) |
| **SSH-Host** | access-5017198486.webspace-host.com |
| **SSH-User** | a1686294 |
| **Build-Verzeichnis** | `./build/` (default) |

## Sicherheit

### SSH-Key Isolation
- **Private Key:** `/home/mrsmith/.openclaw/s5evo/.ssh/ionos-deploy`
- Liegt in S5Evos Workspace → andere Agents haben keinen Zugriff
- Eigenes Keypair, nicht der Server-Hauptschlüssel

### Forced Command (IONOS-seitig)
Der SSH-Key ist in `~/.ssh/authorized_keys` auf IONOS mit einem Forced Command versehen:

```
command="~/lib/validate-rsync.sh",no-port-forwarding,no-pty,no-agent-forwarding,no-X11-forwarding ssh-ed25519 AAAA...
```

Das Wrapper-Script `~/lib/validate-rsync.sh` erlaubt **ausschließlich rsync**:
- ✅ `rsync --server ...` → erlaubt
- ❌ `ls`, `rm`, `cat`, `bash`, alles andere → **DENIED**

### Was das bedeutet
- Selbst wenn der Key kompromittiert wird: nur rsync funktioniert
- Kein Shell-Zugang, kein Port-Forwarding, kein Agent-Forwarding
- Andere Verzeichnisse (bad-bayersoien.info etc.) sind über rsync theoretisch erreichbar → **deploy.sh hat hardcoded Zielverzeichnis `./portal/`**

## Dateien

```
/home/mrsmith/.openclaw/s5evo/
├── deploy.sh                    ← Deploy-Script (chmod +x)
├── build/                       ← Hierhin die fertige Seite legen
│   └── index.html               ← Testseite (kann überschrieben werden)
├── .ssh/
│   ├── ionos-deploy             ← Private Key (600)
│   └── ionos-deploy.pub         ← Public Key
└── docs/
    └── deploy-pipeline.md       ← Diese Datei
```

Auf IONOS:
```
~/
├── .ssh/authorized_keys         ← Key mit Forced Command
├── lib/validate-rsync.sh        ← Wrapper (nur rsync erlaubt)
└── portal/                      ← Webroot für portal.s5evo.de
```

## Workflow für S5Evo

1. Website-Code schreiben/ändern
2. Fertige Dateien in `./build/` ablegen (HTML, CSS, JS, Assets)
3. `./deploy.sh` ausführen
4. Live auf https://portal.s5evo.de

## Troubleshooting

| Problem | Lösung |
|---|---|
| `Permission denied (publickey)` | Key stimmt nicht — `.ssh/ionos-deploy` prüfen |
| `DENIED: Only rsync is allowed` | Forced Command blockiert (korrekt bei nicht-rsync) |
| `mkdir failed: Read-only` | Falscher Pfad — muss `./portal/` sein (relativ) |
| Seite zeigt alten Stand | Browser-Cache leeren (Ctrl+Shift+R) |
| rsync timeout | IONOS SSH manchmal langsam — nochmal versuchen |

## Eingerichtet

- **Datum:** 2026-03-08
- **Von:** Claw + Dude (gemeinsam)
- **Getestet:** ✅ Testseite erfolgreich deployed

---

## Exec-Berechtigungen (seit 8. März 2026)

S5Evo hat `exec` und `process` Tools mit **Allowlist-Security**. Nur diese Binaries sind erlaubt:

| Binary | Pfad | Zweck |
|---|---|---|
| `rsync` | `/usr/bin/rsync` | Deploy auf IONOS |
| `git` | `/usr/bin/git` | Versionierung, Push/Pull |
| `node` | `/usr/bin/node` | Node.js Runtime |
| `npm` | `/usr/bin/npm` | Package Manager |
| `npx` | `/usr/bin/npx` | Package Runner |
| `bash` | `/usr/bin/bash` | Shell-Scripts (deploy.sh etc.) |

**Alles andere ist blockiert** — kein `curl`, kein `ssh`, kein `rm`, kein beliebiger Shell-Zugriff.

Config-Dateien:
- `~/.openclaw/openclaw.json` → tools.allow: exec, process
- `~/.openclaw/exec-approvals.json` → Agent s5evo: security=allowlist

Falls du ein weiteres Tool brauchst: Claw oder Dude fragen, die erweitern die Allowlist.

---

*Änderungen an der Pipeline (Key, Pfade, Wrapper) immer mit Claw oder Dude absprechen.*
