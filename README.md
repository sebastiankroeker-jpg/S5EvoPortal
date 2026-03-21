# S5Evo Portal – Mannschaftsanmeldung mit Authentik

## Features
- 🔐 Login via Authentik (OAuth2/OpenID Connect)
- 📋 Mannschaftsanmeldung mit vorbefüllten Userdaten
- ☀️ Light Mode / 🌙 Dark Mode / 🍄 Psychedelic Mode
- 🚀 Ready für Vercel Deployment

## Setup

### 1. Environment Variables
Kopiere `.env.local.example` nach `.env.local` und trage die Werte ein:
- `NEXTAUTH_URL` – deine Vercel-URL
- `NEXTAUTH_SECRET` – generiere mit `openssl rand -base64 32`
- `AUTHENTIK_CLIENT_ID` – aus Authentik Provider
- `AUTHENTIK_CLIENT_SECRET` – aus Authentik Provider
- `AUTHENTIK_ISSUER` – `https://auth.s5evo.de/application/o/s5evo-portal`

### 2. Lokal testen
```bash
npm install
npm run dev
```

### 3. Deployment (Vercel)
Push zu GitHub → Vercel baut automatisch.
Environment Variables im Vercel Dashboard setzen.

## Authentik Konfiguration
- Provider: OAuth2/OpenID
- Redirect URI: `https://s5-evo-portal.vercel.app/api/auth/callback/authentik`
- Scopes: openid, profile, email
