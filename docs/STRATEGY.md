# S5Evo — Mannschaftsportal Strategie & Features

## 🎯 Was ist S5Evo?

Eine digitale Plattform für unseren Fünfkampf — von der Mannschafts-Anmeldung bis zur Live-Ergebnisanzeige. Selbst gehostet, datenschutzkonform, und gebaut um zu wachsen.

**Domain:** s5evo.de
**Name:** Soier / Super 5Kampf — evolve 💪

---

## 👥 Wer nutzt was?

### 🔧 Admins / Orga-Team
- Wettkämpfe anlegen und konfigurieren (Datum, Disziplinen, Regeln)
- Mannschaften verwalten, freigeben, bei Bedarf sperren
- Ergebnisse eintragen und veröffentlichen
- Übersicht über alle Anmeldungen und Teilnehmerzahlen
- Systemeinstellungen, Benutzerverwaltung

### 🎙️ Moderatoren
- Ergebnisse erfassen (direkt am Wettkampftag, auch mobil)
- Zwischenstände veröffentlichen
- Kommentare / Ankündigungen posten
- Teilnehmer-Rückfragen beantworten

### 🏃 Teilnehmer / Mannschaften
- Mannschaft anmelden (Mannschaftsführer erstellt, lädt Mitglieder ein)
- Eigenes Profil verwalten
- Ergebnisse und Platzierungen einsehen
- Mannschafts-Historie über die Jahre verfolgen
- Einladungslink teilen → Mitmachen mit einem Klick

---

## 🧩 Geplante Features

### Phase 1 — MVP
- [ ] **Mannschafts-Anmeldung** (erstellen, Mitglieder einladen, verwalten)
- [ ] **Wettkampf-Übersicht** (Datum, Disziplinen, Status)
- [ ] **Ergebnis-Erfassung** (mobiltauglich, auch am Wettkampftag)
- [ ] **Öffentliche Ergebnistafel** (kein Login nötig für Zuschauer)
- [ ] **Authentifizierung** via Authentik (siehe unten!)

### Phase 2 — Ausbau
- [ ] Live-Ticker / Zwischenstände
- [ ] Mannschafts-Statistiken & Historie
- [ ] Foto-Upload pro Wettkampf
- [ ] Benachrichtigungen (E-Mail / Push)
- [ ] Anpassbares Regelwerk pro Wettkampf-Typ

### Phase 3 — Vision
- [ ] Ziellinien-Erfassung per Kamera (Edge AI, Jetson Orin Nano + ZED X 📷)
- [ ] Automatische Zeitmessung
- [ ] Zuschauer-Voting / Publikumspreis
- [ ] Integration mit Vereins-Website

---

## 🔐 Authentifizierung — Das Zukunftsthema

### Warum das wichtig ist

Wir bauen nicht nur ein Fünfkampf-Portal. Wir bauen eine **digitale Infrastruktur**, die wachsen kann. Die Authentifizierung ist das Fundament dafür.

**Authentik** ist ein moderner, selbst gehosteter Identity Provider. Das bedeutet:

- **Ein Account für alles.** Mannschaftsportal heute, weitere Vereins-Apps morgen — ein Login.
- **Datensouveränität.** Keine User-Daten bei Google, Auth0 oder anderen Cloud-Diensten. Alles auf unserer Infra.
- **Profi-Features ab Tag 1:** Passwort-Reset, E-Mail-Verifikation, Social Login (Google), Rollen & Gruppen — alles eingebaut.
- **Zukunftssicher:** Wenn der Verein wächst, wächst die Plattform mit. Neue App? Gleicher Login.
- **Standard-Protokolle:** OAuth2/OIDC — das nutzen Google, Microsoft, GitHub. Wir sprechen die gleiche Sprache.

### Was die User sehen

Nichts Kompliziertes! Eine saubere Login-Seite mit unserem Branding:
- "Anmelden" oder "Konto erstellen"
- Optional "Mit Google anmelden"
- Passwort vergessen? Ein Klick.
- Fertig. Fühlt sich an wie jede moderne Website.

### Was unter der Haube passiert

```
User → auth.s5evo.de (Authentik)
         ↓ Login / Registrierung
       ← Token (OAuth2)
         ↓
       app.s5evo.de weiß: "Das ist Hans, Mannschaftsführer der Soier Buam"
```

### 🙋 Wer hat Lust?

**Wir suchen jemanden, der sich dem Thema Authentifizierung annehmen möchte.**

Das ist kein "nice to have" — es ist **die Grundlage für alles was wir bauen**. Wer sich hier einarbeitet, lernt ein Thema das in der gesamten IT-Branche gefragt ist: Identity & Access Management. 

Aufgaben:
- Authentik auf unserer Infrastruktur aufsetzen (Docker, gut dokumentiert)
- Login-Flow konfigurieren (Branding, E-Mail-Templates)
- OAuth2-Anbindung ans Portal (wir helfen!)
- Rollen & Gruppen definieren (Admin, Moderator, Teilnehmer)

**Skill-Level:** Interesse an IT-Infrastruktur reicht. Wir begleiten euch. Und: wer Identity & Access Management kann, hat einen Skill der in jeder Firma Gold wert ist. 🚀

---

## 🏗️ Tech-Stack (Überblick)

| Komponente | Technologie |
|---|---|
| Frontend | HTML/CSS/JS (oder Framework nach Wahl) |
| Backend | Python (FastAPI) oder nach Wahl |
| Auth | Authentik (self-hosted IdP) |
| Hosting | IONOS Webspace (s5evo.de) |
| Deployment | Git Push → Auto-Deploy |
| Infra | Proxmox VMs, Tailscale Mesh |
| Edge AI (Phase 3) | Nvidia Jetson Orin Nano + ZED X |

---

## 💬 Nächste Schritte

1. **Feedback sammeln** — Was fehlt? Was ist am wichtigsten?
2. **Rollen verteilen** — Wer macht Auth? Wer macht Frontend? Wer macht Orga?
3. **MVP definieren** — Was muss zum ersten Wettkampf stehen?
4. **Loslegen** 🏁

---

*"evolve" — weil stillstehen keine Option ist.*
