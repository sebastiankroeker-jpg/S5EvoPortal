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
# Force redeploy Sun Mar 22 08:28:25 AM UTC 2026
