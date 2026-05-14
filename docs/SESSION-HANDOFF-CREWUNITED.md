# CrewUnited — Session Handoff & Arbeitsmodus

> Zweck: Dieses Dokument bündelt die **agentenübergreifenden** Themen aus dem CrewUnited-Kontext.
> Es ist bewusst getrennt vom projektspezifischen S5Evo-Handoff.

**Stand:** 2026-05-14
**Kontext:** CrewUnited Gruppenchat
**Abgrenzung:** Übergreifende Methodik, Zusammenarbeit, Infrastruktur, Security, A2A-Kommunikation, Rollen, Priorisierung

---

## 1. Wofür dieses Dokument da ist

Dieses Handoff beantwortet für CrewUnited:

- Wer kümmert sich worum?
- Welche Regeln gelten agentenübergreifend?
- Was ist zentral, was bleibt projektspezifisch?
- Wie arbeiten mehrere Agenten parallel, ohne Chaos zu erzeugen?
- Welche Themen haben jetzt Priorität, welche später?

---

## 2. Abgrenzung zu S5Evo

**Nicht hier führen:**
- fachliche 5-Kampf-Anforderungen
- projektspezifische App-Details
- S5Evo-spezifische Handoffs, Reviews, Feature-Stände

**Dafür zuständig:**
- `docs/REQUIREMENTS.md`
- `docs/SESSION-HANDOFF-S5EVO.md`

**Hier führen wir stattdessen:**
- gemeinsames Arbeitsmodell
- Rollen & Verantwortlichkeiten
- A2A-Kommunikation
- übergreifende Security-/Infra-Leitplanken
- Ideen für Agenten-Farm, Hosting, Auditierbarkeit, neue Agenten

---

## 3. Vorläufiges Rollenbild

- **Claw**
  - Orchestrator
  - VM-/Instanz-Sanity
  - zentrale Methodik für agentenübergreifende Zusammenarbeit
  - Infra-/Security-/Betriebsleitplanken

- **S5Evo**
  - 5-Kampf-Fachlichkeit
  - Portal / Produktkontext
  - projektspezifisches Handoff
  - Authentik-Flow im S5Evo-Kontext

- **Alois**
  - Homepage
  - Außenwirkung
  - Marketing / Recruiting / Kampagnen

- **später sinnvoll: Security-Agent**
  - Hardening
  - Secrets
  - Audit-Standards
  - Monitoring
  - Restore-/Incident-Checks

---

## 4. Gemeinsame Arbeitsregeln

- **1 Owner pro Thema/Artefakt**
- **Chat ist Abstimmung, nicht SSOT**
- Entscheidungen zurück in Doku schreiben
- **Parallel nur mit klarem Zielartefakt**
- REVIEW kurz halten
- Änderungen committen und knapp begründen

### Artefakt-Typen
- **SSOT** = verbindliche Wahrheit
- **Runbook** = Betrieb / Deploy / Debug / Recovery
- **Handoff** = aktueller Stand + nächste Schritte
- **Memory** = Tagesnotizen / operative Beobachtungen

---

## 5. Repository-Logik

**Empfohlene Richtung:**

- **Claw lokal:** zentrales Repo für übergreifende Methodik und Betrieb
- **S5Evo lokal:** projektspezifische Fachlichkeit und Projekt-Handoffs
- **Alois lokal:** Homepage-/Marketing-spezifische Themen

### Wichtig
- **Nicht alles zentralisieren**
- zentral nur das Übergreifende
- projektspezifische Wahrheit bleibt im jeweiligen Projektkontext

### Minimale zentrale Dokumente
- `AGENT-OPERATING-MODEL.md`
- `A2A-MESSAGE-SPEC.md`
- `INFRA-RUNBOOK.md`
- `SECURITY-BASELINE.md`
- `AUDIT-LOG-POLICY.md`

---

## 6. A2A-Kommunikation, gewünschter Standard

Jede agentenübergreifende Nachricht sollte möglichst enthalten:
- Kontext
- Ziel
- Owner
- gewünschtes Ergebnis
- betroffene Artefakte
- Dringlichkeit / Deadline
- Freigabestatus, wenn relevant

**Prinzip:** async first, auditierbar, knapp.

---

## 7. Aktuelle Prioritäten

### Jetzt
1. Kommunikation und Kontext-Handling professionalisieren
2. Rollen und Verantwortlichkeiten sauber trennen
3. Kein unnötiger Migrationsaufwand vor dem Wettkampf
4. Fachlich kritische Themen mit Sofortnutzen priorisieren

### Später
- Agenten-Farm / Hosting-Modell
- Security-Learning-Journeys
- gemeinsames Audit-/Monitoring-Modell
- Robotik-/Automaten-/Open-Source-Integrationen
- Recruiting-/Kampagnen-Ideen

---

## 8. Leitplanken bis zum Wettkampf

- **keine große Repo-Migration**
- **kein Struktur-Umbau ohne Sofortnutzen**
- Fokus auf Stabilität, Übergaben, Priorisierung und kritische Produktpfade

---

## 9. Next 3 actions

### 1. Nächster sicherer Schritt
Claw bestätigt oder schärft das zentrale Rollen-, Repo- und A2A-Modell für CrewUnited.

### 2. Größtes Risiko
Zu früh zu viel organisatorisch umbauen und dadurch Produktfokus und Geschwindigkeit verlieren.

### 3. Nicht verwechseln
CrewUnited = übergreifende Methodik und Zusammenarbeit. S5Evo = projektspezifische 5-Kampf-Arbeit.
