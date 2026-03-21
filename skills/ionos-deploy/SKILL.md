---
name: ionos-deploy
description: >
  Deploy static sites to IONOS Webspace via rsync+SSH. Use when deploying a website,
  pushing a build to production, or checking deploy targets. Supports multiple targets
  (portal.s5evo.de, alois.cloud, future subdomains). Includes pre-deploy validation
  (secrets scan, size check) and post-deploy HTTP verification. NOT for DNS configuration,
  SSL setup, or IONOS panel administration.
---

# IONOS Deploy

Deploy static sites to IONOS Webspace targets via rsync over SSH.

## Quick Deploy

```bash
# Standard deploy
bash <skill-dir>/scripts/deploy.sh <target> <build-dir> <ssh-key>

# Dry run (no changes)
bash <skill-dir>/scripts/deploy.sh <target> <build-dir> <ssh-key> --dry-run
```

### Example (S5Evo → portal.s5evo.de)

```bash
bash <skill-dir>/scripts/deploy.sh portal.s5evo.de /home/mrsmith/.openclaw/s5evo/build /home/mrsmith/.openclaw/s5evo/.ssh/ionos-deploy
```

## Workflow

1. **Build** the site into a directory (HTML, CSS, JS, assets)
2. **Dry-run** first: add `--dry-run` to preview changes
3. **Deploy**: run without `--dry-run` to push live
4. **Verify**: script auto-checks HTTP 200 after deploy

## Pre-deploy Checks (automatic)

- Build directory exists
- SSH key exists
- No secrets in build output (private keys, API tokens, passwords)
- `index.html` present (warns if missing)
- Size warning if >50MB

## Available Targets

See [references/targets.md](references/targets.md) for the full target registry and how to add new ones.

Current targets: `portal.s5evo.de`, `alois.cloud`

## Adding a New Target

1. Add entry to `TARGETS` array in `scripts/deploy.sh`
2. Document in `references/targets.md`
3. Ensure SSH key + IONOS directory exist
4. Test with `--dry-run`

## Security Model

- **SSH keys isolated per agent** — each agent's key lives in its own workspace
- **Forced command on IONOS** — only `rsync --server` allowed, no shell access
- **Secrets scan** — deploy aborts if potential secrets detected in build output
- **Agent exec-allowlist** — agent must have `rsync` in its allowed binaries

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `Permission denied (publickey)` | Check SSH key path and permissions (should be 600) |
| `DENIED: Only rsync is allowed` | Expected — forced command working correctly |
| `Unknown target` | Add target to TARGETS array in deploy.sh |
| HTTP verify fails | DNS might not be routed yet — check IONOS panel |
| Secrets detected | Review flagged files, remove sensitive content |
