# MEMORY.md — S5Evo

Zentrale Memory-Datei. Details in `memory/*.md`.

## Projekt
- S5Evo: Fünfkampf-Plattform für ESV
- Stack: Next.js + TypeScript + Prisma 6.x + PostgreSQL + shadcn/ui
- Wettkampf: 25./26. Juli 2026
- Repo: github.com/sebastiankroeker-jpg/S5EvoPortal
- Live: https://s5-evo-portal.vercel.app

## Team
- Sebastian (Dude) — Solution Architect, Initiator
- S5Evo (ich) — Tech Lead Agent

## Infra
- VM: Proxmox, 8 GB RAM (upgraded 2026-04-03)
- LCM: installiert 2026-04-02
- QMD: installiert 2026-04-03

## Aktueller Stand
- 2026-05-16: Produktiver Authentik-Registrierungsflow wieder funktionsfaehig.
- Root Cause 1 war das fehlende `username`-Feld im produktiven Registrierungsflow.
- Root Cause 2 war ein verlorener OIDC-Rueckweg; App-seitiger Recovery-Fix ist live und der End-to-End-Flow wurde erfolgreich bestaetigt.
- Offene Infrastruktur-Schuld: Redirect-Stage im Registrierungsflow zeigt in Authentik weiterhin statisch auf `https://s5-evo-portal.vercel.app/login` statt den vorbereiteten OIDC-`next`-Rueckweg nativ beizubehalten.
