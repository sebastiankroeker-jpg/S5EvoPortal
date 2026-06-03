# S5Evo Portal – Mannschaftsanmeldung mit Authentik

## Features
- 🔐 Login via Authentik (OAuth2/OpenID Connect)
- 📋 Mannschaftsanmeldung mit vorbefüllten Userdaten
- ☀️ Light Mode / 🌙 Dark Mode / 🍄 Psychedelic Mode
- 🚀 Ready für Vercel Deployment

## Setup

### 1. Environment Variables
Kopiere `.env.local.example` nach `.env.local` und trage die Werte ein:
- `NEXTAUTH_URL` – die oeffentliche Portal-URL, z. B. `https://portal.s5evo.de`
- `NEXTAUTH_SECRET` – generiere mit `openssl rand -base64 32`
- `AUTHENTIK_CLIENT_ID` – aus Authentik Provider
- `AUTHENTIK_CLIENT_SECRET` – aus Authentik Provider
- `AUTHENTIK_ISSUER` – `https://auth.s5evo.de/application/o/s5-evo-portal`
- `CRON_SECRET` – geheimes Token fuer geschuetzte Cron-Routen
- `ENABLE_PENDING_CHANGE_BUNDLES` – `false` (Standard), nur fuer Bundle-MVP auf `true` setzen

### 2. Lokal testen
```bash
npm install
npm run dev
```

### 3. Deployment (Vercel)
Push zu GitHub → Vercel baut automatisch.
Environment Variables im Vercel Dashboard setzen.
`vercel.json` plant einen taeglichen CSV-Export ueber `/api/cron/daily-orga-export`.

## Authentik Konfiguration
- Provider: OAuth2/OpenID
- Redirect URI: `https://portal.s5evo.de/api/auth/callback/authentik`
- Logout URI: `https://portal.s5evo.de/logout`
- Waehrend der Umstellung kann die alte Callback-URL `https://s5-evo-portal.vercel.app/api/auth/callback/authentik` noch temporaer im Provider bleiben.
- Scopes: openid, profile, email
- Registrierung immer aus dem OIDC-Login der Anwendung heraus starten, nicht per direktem Sprung auf einen nackten `/if/flow/.../`-Link.
 
## Domain Cutover
- Die Produktiv-Domain ist `https://portal.s5evo.de`.
- Die alte Vercel-Domain `https://s5-evo-portal.vercel.app` sollte im Projekt hinterlegt bleiben, aber per Redirect auf die Produktiv-Domain zeigen.
- Die taegliche CSV-Automation bleibt unter `/api/cron/daily-orga-export` aktiv und laeuft laut `vercel.json` taeglich um `04:00 UTC`.

## Pending-Change-Bundles (Feature-Flag)
- Status: implementiert, standardmaessig deaktiviert (`ENABLE_PENDING_CHANGE_BUNDLES=false`)
- Zweck: atomare Freigabe von Disziplin-Tausch/Rotation fuer 2+ Teilnehmer
- Backward-Compatibility: bestehende Einzelantraege und bestehende Daten bleiben unveraendert

### API (nur bei aktiviertem Feature-Flag)
- `POST /api/admin/participant-change-bundles`
- `GET /api/admin/participant-change-bundles/:id`
- `PUT /api/admin/participant-change-bundles/:id/decision`

### Rollout-Checkliste (Produktion)
1. Migration deployen (`pending_changes.bundleId/bundleType/bundleStatus` + Indizes)
2. Build in Staging pruefen (`npm run build`)
3. Flag in Staging aktivieren (`ENABLE_PENDING_CHANGE_BUNDLES=true`) und Bundle-Flow testen
4. Flag in Produktion aktivieren
5. Nachkontrolle in Orga-Queue: Bundle-Kachel, Sammel-Genehmigung, Konfliktfall

### Go-Live Runbook (Copy/Paste)
```bash
cd /home/ocadmin/.openclaw/workspace/authentik-nextjs-demo

# 0) optional: sicherstellen, dass alle Commits remote sind
git push origin main

# 1) produktive Migration anwenden (nur additive Felder/Indizes)
npx prisma migrate deploy

# 2) Build-Sicherheit pruefen
npm run build
```

Danach in der produktiven Runtime setzen:
- `ENABLE_PENDING_CHANGE_BUNDLES=true`

Schneller Smoke-Test nach Aktivierung:
1. Zwei offene `PENDING`-Antraege derselben Mannschaft bundlen
2. `/aenderungen` zeigt eine gemeinsame Bundle-Kachel
3. Bundle `approve` -> alle Teilantraege werden gemeinsam `APPROVED`
4. Konfliktfall (Live-Drift) -> Bundle-Status `CONFLICT`, kein Teil-Commit

### Rollback (ohne DB-Rueckmigration)
- Feature sofort deaktivieren: `ENABLE_PENDING_CHANGE_BUNDLES=false`
- Wirkung: Bundle-Endpunkte nicht erreichbar, bestehender Einzelantrags-Flow bleibt aktiv
- DB-Struktur bleibt unveraendert/additiv erhalten
# Force redeploy Sun Mar 22 08:28:25 AM UTC 2026
