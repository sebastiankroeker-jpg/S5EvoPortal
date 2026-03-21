# Authentik Setup Guide — S5Evo

> Für denjenigen, der sich dem Thema annimmt. Schritt für Schritt, keine Vorkenntnisse nötig.

## Voraussetzungen

- Zugang zu einer VM (Proxmox) oder einem Linux-Server mit Docker
- Domain `auth.s5evo.de` (Subdomain bei IONOS anlegen)
- ~1-2 Stunden Zeit
- Neugier 😊

## Phase 1: Authentik installieren (~30 Min)

### 1.1 Docker + Docker Compose

```bash
# Falls noch nicht installiert
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Neu einloggen!
```

### 1.2 Authentik deployen

```bash
mkdir -p ~/authentik && cd ~/authentik

# Offizielles Docker Compose holen
wget https://goauthentik.io/docker-compose.yml

# Secrets generieren
echo "PG_PASS=$(openssl rand -base64 36 | tr -d '\n')" >> .env
echo "AUTHENTIK_SECRET_KEY=$(openssl rand -base64 60 | tr -d '\n')" >> .env
echo "AUTHENTIK_ERROR_REPORTING__ENABLED=false" >> .env

# E-Mail Konfiguration (optional, für Passwort-Reset)
cat >> .env << 'EOF'
# AUTHENTIK_EMAIL__HOST=smtp.ionos.de
# AUTHENTIK_EMAIL__PORT=587
# AUTHENTIK_EMAIL__USERNAME=noreply@s5evo.de
# AUTHENTIK_EMAIL__PASSWORD=xxx
# AUTHENTIK_EMAIL__USE_TLS=true
# AUTHENTIK_EMAIL__FROM=noreply@s5evo.de
EOF

# Starten!
docker compose pull
docker compose up -d
```

### 1.3 Erster Login

- Browser: `http://<server-ip>:9000/if/flow/initial-setup/`
- Admin-Account anlegen (E-Mail + Passwort)
- Das ist der "akadmin" — der Master-Account

## Phase 2: S5Evo als Application anlegen (~20 Min)

### 2.1 Application erstellen

1. Authentik Admin → **Applications → Create**
2. Name: `S5Evo Mannschaftsportal`
3. Slug: `s5evo`
4. Provider: "Create new" → **OAuth2/OpenID Provider**

### 2.2 OAuth2 Provider konfigurieren

| Feld | Wert |
|---|---|
| Name | S5Evo OAuth2 |
| Authorization flow | default-provider-authorization-implicit-consent |
| Client type | Confidential |
| Redirect URIs | `https://app.s5evo.de/api/auth/callback/authentik` |
| Signing Key | authentik Self-signed Certificate |

→ **Client ID** und **Client Secret** notieren! Braucht die App.

### 2.3 Scopes

Standardmäßig aktiviert lassen:
- `openid`
- `email`
- `profile`

Zusätzlich einen **Custom Scope** für Gruppen:
1. Property Mappings → Create → Scope Mapping
2. Name: `groups`
3. Scope name: `groups`
4. Expression:
```python
return {
    "groups": [group.name for group in request.user.ak_groups.all()],
}
```
5. Im Provider unter "Scopes" hinzufügen

## Phase 3: Gruppen & Rollen anlegen (~10 Min)

### 3.1 Gruppen erstellen

Authentik Admin → **Directory → Groups → Create:**

| Gruppe | Beschreibung |
|---|---|
| `s5evo-admin` | Vollzugriff, Wettkampf-Setup |
| `s5evo-moderator` | Ergebnisse erfassen, Startlisten |
| `s5evo-teamchef` | Team anlegen & verwalten |
| `s5evo-teilnehmer` | Eigene Daten bearbeiten |

### 3.2 Default-Gruppe für neue User

- Settings → **Default Groups** → `s5evo-teilnehmer` hinzufügen
- Jeder der sich registriert ist erstmal Teilnehmer
- Teamchef/Moderator/Admin wird manuell vergeben

## Phase 4: Branding (~15 Min)

### 4.1 Login-Seite anpassen

1. Admin → **Flows → default-authentication-flow**
2. Appearance Settings:
   - Logo hochladen (S5Evo Logo)
   - Hintergrundfarbe / Bild
   - Titel: "S5Evo — Anmelden"

### 4.2 E-Mail Templates (optional)

- Unter **Admin → Stages → Email** anpassbar
- Willkommensmail, Passwort-Reset, etc.

## Phase 5: SSL mit Caddy (Reverse Proxy)

```bash
# Caddyfile
cat > ~/authentik/Caddyfile << 'EOF'
auth.s5evo.de {
    reverse_proxy localhost:9000
}
EOF

# Caddy starten (holt automatisch Let's Encrypt Zertifikat)
caddy run --config ~/authentik/Caddyfile
```

## Testen

1. Browser: `https://auth.s5evo.de` → Login-Seite sollte erscheinen
2. Neuen User registrieren → erscheint in Authentik Admin
3. Im Portal: NextAuth mit den Client-Credentials konfigurieren (siehe ADR)
4. Login-Button klicken → Redirect zu Authentik → zurück zum Portal mit Session

## Troubleshooting

| Problem | Lösung |
|---|---|
| Authentik startet nicht | `docker compose logs -f` prüfen |
| Redirect-Fehler | Redirect URI in Provider prüfen (exakt!) |
| Gruppen kommen nicht an | Custom Scope "groups" zum Provider hinzufügen |
| SSL-Fehler | DNS für auth.s5evo.de prüfen, Caddy Logs checken |

## Ressourcen

- [Authentik Docs](https://goauthentik.io/docs/)
- [NextAuth OIDC Provider](https://next-auth.js.org/providers/oidc)
- [Authentik + NextAuth Tutorial](https://goauthentik.io/integrations/services/nextauth/)

---

*Bei Fragen: @S5Evo oder @Claw fragen — wir helfen!*
