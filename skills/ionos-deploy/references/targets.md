# IONOS Deploy Targets

## Aktive Targets

| Target | IONOS Remote Dir | SSH Key Location | Agent |
|--------|-----------------|------------------|-------|
| `portal.s5evo.de` | `./portal/` | `/home/mrsmith/.openclaw/s5evo/.ssh/ionos-deploy` | S5Evo |
| `alois.cloud` | `./alois-cloud/` | TBD (eigener Key empfohlen) | TBD |

## IONOS Shared Infrastructure

- **SSH Host:** `access-5017198486.webspace-host.com`
- **SSH User:** `a1686294`
- **Hosting-Paket:** IONOS Web Hosting Plus
- **Features:** SSH, Git, rsync, Subdomains frei routbar
- **Security:** Forced Command (`validate-rsync.sh`) — nur rsync erlaubt

## Neues Target hinzufügen

1. Verzeichnis auf IONOS anlegen (via rsync erstmaliger Push)
2. Subdomain in IONOS-Panel routen → neues Verzeichnis
3. SSH-Key erzeugen (pro Agent isoliert) oder bestehenden verwenden
4. Target in `scripts/deploy.sh` TARGETS-Array eintragen
5. Testen mit `--dry-run`

## Sicherheitsmodell

- **Ein Key pro Agent** — S5Evos Key liegt in S5Evos Workspace, nicht global
- **Forced Command** auf IONOS: nur `rsync --server` erlaubt, kein Shell
- **Agent Exec-Allowlist:** rsync muss in der Agent-Allowlist stehen
- **Pre-deploy Checks:** Secrets-Scan, index.html, Größenlimit
