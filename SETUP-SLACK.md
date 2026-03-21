# Slack-Integration für S5Evo

## Schritt 1: Slack App erstellen

1. Gehe zu **https://api.slack.com/apps**
2. Klick **Create New App** → **From scratch**
3. App Name: `S5Evo Bot`
4. Workspace: Dein Team-Workspace
5. **Create App**

## Schritt 2: Socket Mode aktivieren

1. Linke Sidebar: **Socket Mode**
2. **Enable Socket Mode** → ON
3. Token Name: `s5evo-socket`
4. **Generate** → Kopiere den `xapp-...` Token

## Schritt 3: Bot Permissions

1. Linke Sidebar: **OAuth & Permissions**
2. Unter **Bot Token Scopes** hinzufügen:
   - `app_mentions:read`
   - `channels:history`
   - `channels:read`
   - `chat:write`
   - `groups:history` (für private Channels)
   - `groups:read`
   - `im:history` (für DMs)
   - `im:read`

## Schritt 4: Event Subscriptions

1. Linke Sidebar: **Event Subscriptions**
2. **Enable Events** → ON
3. Unter **Subscribe to bot events** hinzufügen:
   - `app_mention`
   - `message.channels`
   - `message.groups`
   - `message.im`

## Schritt 5: App installieren

1. Linke Sidebar: **Install App**
2. **Install to Workspace**
3. Authorize
4. Kopiere den **Bot User OAuth Token** (`xoxb-...`)

## Schritt 6: OpenClaw Config

Editiere `/home/mrsmith/.openclaw/openclaw.json`:

```json
"slack": {
  "enabled": true,   // ← von false auf true ändern
  "botToken": "xoxb-DEIN-BOT-TOKEN",      // ← hier einfügen
  "appToken": "xapp-DEIN-APP-TOKEN",      // ← hier einfügen
  "socketMode": true
}
```

## Schritt 7: Gateway neu starten

```bash
openclaw gateway restart
```

## Schritt 8: Bot zum Channel hinzufügen

1. In Slack: Gehe zum gewünschten Channel
2. `/invite @S5Evo Bot`
3. Teste: `@S5Evo Bot Hallo!`

---

## Troubleshooting

**Bot antwortet nicht:**
- Prüfe ob `enabled: true` in der Config
- Prüfe Gateway Logs: `openclaw gateway logs`
- Prüfe ob Bot im Channel ist

**"not_allowed_token_type" Fehler:**
- Socket Mode erfordert `appToken` (xapp-...), nicht nur `botToken`

**Nur Mentions:**
- Der Bot reagiert standardmäßig nur auf @mentions
- Für alle Messages: Channel-spezifische Config nötig
