# ADR: Authentifizierung via Authentik (OAuth2/OIDC)

**Status:** Vorgeschlagen
**Datum:** 2026-03-08
**Entscheider:** Team (offen)

## Kontext

Das Mannschaftsportal braucht ein Auth-Konzept. Bisher offen: Magic Links, Invite-Codes, Passwort oder externer Identity Provider?

Gleichzeitig planen wir weitere Anwendungen (Lab Portal, Vereins-Tools), die ebenfalls Authentifizierung brauchen.

## Optionen

### A) NextAuth.js standalone (Magic Links / Credentials)
- ✅ Schnell implementiert, alles in der App
- ❌ Auth-Logik in jeder App neu
- ❌ Kein SSO über Apps hinweg
- ❌ Kein zentrales User-Management

### B) Auth0 / Clerk / externe SaaS
- ✅ Schnell, managed
- ❌ Vendor Lock-in
- ❌ Daten bei Drittanbieter (DSGVO-Risiko)
- ❌ Kosten skalieren mit Usern

### C) Authentik (self-hosted IdP) ⭐ Empfehlung
- ✅ **Ein Account für alles** — SSO über alle Apps
- ✅ **Datensouveränität** — alles auf eigener Infra
- ✅ **Standard-Protokolle** — OAuth2/OIDC (wie Google, Microsoft, GitHub)
- ✅ **Profi-Features built-in:** Passwort-Reset, E-Mail-Verifikation, Social Login, MFA
- ✅ **Rollen & Gruppen** zentral verwaltet
- ✅ **Zukunftssicher** — neue App? Gleicher Login.
- ✅ **Kostenlos** (Open Source, self-hosted)
- ⚠️ Initialer Setup-Aufwand (~1-2h)
- ⚠️ Braucht eigene VM/Container auf Proxmox

## Entscheidung

**Authentik als zentraler Identity Provider**, angebunden via NextAuth.js OIDC Provider.

## Technische Integration

```
User → auth.s5evo.de (Authentik)
         ↓ Login / Registrierung
       ← OAuth2 Token
         ↓
       app.s5evo.de (NextAuth.js als OIDC Client)
         ↓
       Session mit User-Info + Rollen
```

### NextAuth.js bleibt!
Das bestehende `pages/api/auth/[...nextauth].js` wird nicht ersetzt, sondern bekommt einen OIDC Provider:

```js
// pages/api/auth/[...nextauth].js
import NextAuth from "next-auth"

export default NextAuth({
  providers: [
    {
      id: "authentik",
      name: "S5Evo Login",
      type: "oidc",
      issuer: "https://auth.s5evo.de/application/o/s5evo/",
      clientId: process.env.AUTHENTIK_CLIENT_ID,
      clientSecret: process.env.AUTHENTIK_CLIENT_SECRET,
    }
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (profile) {
        token.groups = profile.groups || []
      }
      return token
    },
    async session({ session, token }) {
      session.user.groups = token.groups
      return session
    }
  }
})
```

### Authentik Rollen → NextAuth Groups

| Authentik Gruppe | Portal-Rolle | Berechtigung |
|---|---|---|
| `s5evo-admin` | Administrator | Vollzugriff, Wettkampf-Setup, Approvals |
| `s5evo-moderator` | Moderator | Ergebnis-Erfassung, Startlisten, Export |
| `s5evo-teamchef` | Teamchef | Team anlegen, Teilnehmer verwalten |
| `s5evo-teilnehmer` | Teilnehmer | Eigene Daten editieren (→ Approval) |

### Authentik Setup (Kurzfassung)

1. **VM/Container** auf Proxmox (Docker Compose)
2. **Domain:** `auth.s5evo.de` (Subdomain auf Authentik routen)
3. **Application** in Authentik anlegen: "S5Evo Mannschaftsportal"
4. **OAuth2 Provider** konfigurieren (Client ID + Secret generieren)
5. **Gruppen** anlegen (admin, moderator, teamchef, teilnehmer)
6. **Branding** anpassen (Logo, Farben, E-Mail-Templates)

## Konsequenzen

- Authentik wird zur shared Dependency für alle Apps
- Braucht eigene VM mit Monitoring (oder Docker auf bestehendem Host)
- User-Management zentral statt pro App
- Jede neue App ist Auth-mäßig in ~1h angebunden
- **Skill-Aufbau:** Wer Authentik betreut, lernt Identity & Access Management — branchenweiter Top-Skill

## Offene Punkte

- [ ] Wer setzt Authentik auf? (Freiwillige vor! 🙋)
- [ ] VM-Sizing: Authentik braucht ~2 vCPU, 2GB RAM, 10GB Disk
- [ ] SSL: Let's Encrypt via Caddy oder Traefik
- [ ] Social Login (Google) von Anfang an oder später?
- [ ] MFA (2-Faktor) für Admins verpflichtend?

---

*Siehe auch: [STRATEGY.md](./STRATEGY.md) für Gesamtbild*
