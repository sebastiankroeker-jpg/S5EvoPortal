# CR: Admin-Empfaengerauswahl registrierte User

Status: Draft
Date: 2026-07-13
Type: feature
Risk: low
Owner: S5Evo

## Context

Die Admin-Empfaengerauswahl im Messenger zeigt aktuell mehrere Kontexttreffer pro Person. Auf Mobile entsteht dadurch ein langes natives Auswahl-Overlay. Gewuenscht ist eine Einschraenkung auf registrierte Benutzer plus Suche.

## Scope

- In scope:
  - Admin-Zielauswahl nur noch fuer registrierte Portal-Benutzer.
  - Zielpersonen nach User deduplizieren.
  - Suchfeld im Admin-Composer fuer Name/Kontext.
  - Serverseitige Absicherung fuer neue Admin-Threads.
- Out of scope:
  - Neue Datenmodelle oder Migrationen.
  - Freie E-Mail-Empfaenger.
  - Aenderungen am persoenlichen Composer.

## Affected Flows

- User/API/admin flows touched:
  - `GET /api/messages/admin-targets`
  - `POST /api/messages/admin-conversations`
  - Admin-Composer im Nachrichtencenter
- Data model impact:
  - Keine Schema-Aenderung.
- Auth/permission impact:
  - Zieluser muessen weiterhin im aktuellen Mandanten/Kontext erlaubt sein und zusaetzlich ein registriertes Portal-Konto haben.
- Production/deploy impact:
  - UI/API-Fix, normaler Deploy erforderlich.

## Data / API Design

- Proposed data model:
  - Keine Aenderung.
- Proposed API shape:
  - `admin-targets` liefert weiterhin `targets`, aber je registriertem User nur einen Eintrag.
  - Rollen-/Verknuepfungsinformationen bleiben als kurze Beschreibung/Suchbasis erhalten; Team-/Teilnehmernamen werden nicht in der Auswahl ausgeliefert.
- Backward compatibility:
  - Bestehende Composer-Logik bleibt kompatibel.
- Migration/data backfill:
  - Nicht erforderlich.

## Open Questions

- Keine.

## Acceptance Criteria

- Admin-Zielauswahl zeigt nur User mit registriertem Portal-Konto.
- Dieselbe Person erscheint nicht mehrfach wegen mehrerer Teams/Rollen.
- Im Admin-Composer gibt es ein Suchfeld fuer Zielpersonen.
- Neue Admin-Threads koennen nicht an unregistrierte User erstellt werden.
- Keine E-Mail-Adressen werden in der Auswahl angezeigt.

## Implementation Handoff

- Relevant files:
  - `app/api/messages/admin-targets/route.ts`
  - `app/api/messages/admin-conversations/route.ts`
  - `app/components/message-center.tsx`
- Current decisions:
  - Registrierung wird ueber `User.authentikSub != null` gewertet.
  - Suche laeuft clientseitig auf bereits geladenen Zielpersonen.
- Open decisions:
  - Keine.
- Non-goals:
  - Keine DB-Migration.
  - Kein Server-Search pro Tastendruck.
- Expected implementation steps:
  - API-Zielauswahl auf registrierte User filtern und deduplizieren.
  - Admin-Thread-POST gegen unregistrierte Zieluser absichern.
  - Suchfeld und gefilterte Liste im Composer einbauen.
  - Checks und Doku aktualisieren.
- Required checks:
  - `pnpm exec eslint app/components/message-center.tsx app/api/messages/admin-targets/route.ts app/api/messages/admin-conversations/route.ts`
  - `npx tsc --noEmit`
  - `git diff --check`
  - `npm run build`
- Risks/assumptions:
  - `authentikSub` ist das verlaessliche Merkmal fuer registrierte Portal-Benutzer.

## Model / Subagent Plan

- Model switch needed: no
- Target model/role: Codex implementation
- Subagent needed: no
- Subagent role:
- Handoff source:

## Confirmation Gate

- Gate needed: no
- Reason: User requested implementation directly; no schema, production deploy, external send, or data mutation.
- Approved by: Sebastian
- Approval timestamp: 2026-07-13 00:41 UTC

## Implementation Notes

- Files changed:
  - `app/api/messages/admin-targets/route.ts`
  - `app/api/messages/admin-conversations/route.ts`
  - `app/components/message-center.tsx`
- Important decisions during implementation:
  - `GET /api/messages/admin-targets` aggregiert Zielpersonen jetzt nach `userId` statt nach User/Team/Teilnehmer-Kontext.
  - Nur User mit `authentikSub` werden in die Admin-Zielauswahl aufgenommen.
  - Rollen werden als Beschreibung und Suchtext verdichtet, damit mobile keine langen nativen Select-Overlays mehr erzeugen.
  - Team-/Teilnehmernamen werden fuer die Zielauswahl nicht mehr an die UI ausgeliefert.
  - `POST /api/messages/admin-conversations` lehnt unregistrierte Zieluser serverseitig mit `403` ab.
  - Der Composer verwendet ein clientseitiges Suchfeld und eine scrollbare Trefferliste; keine zusaetzlichen API-Requests pro Eingabe.

## Verification

- Local checks:
  - `pnpm exec eslint app/components/message-center.tsx app/api/messages/admin-targets/route.ts app/api/messages/admin-conversations/route.ts` gruen
  - `npx tsc --noEmit` gruen
  - `git diff --check` gruen
- Build:
  - `npm run build` gruen
- Targeted verification:
  - Build enthaelt weiterhin `/api/messages/admin-targets` und `/api/messages/admin-conversations`.
  - TypeScript prueft neue `authentikSub`-Selects und Composer-Suche.
- Manual smoke:
  - Ausstehend im Browser/Production nach Deploy.

## Deploy

- Deployment needed: yes
- Deployment ID:
- Deployment URL:
- Production alias:
- Deployed at:

## Post-Deploy Smoke

- Routes checked:
- API checks:
- Result:

## Follow-Ups

- None
