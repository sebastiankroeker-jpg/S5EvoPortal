# CR: Direct Participant Changes In Change Overview

Status: Implemented - pending deploy approval
Date: 2026-07-12
Type: hotfix
Risk: low
Owner: S5Evo

## Context

Sebastian hat am 2026-07-11 als Admin eine direkte Teilnehmeraenderung im Team `Die 5 Muskeltiere` vorgenommen und findet dazu keinen Eintrag in der Aenderungsuebersicht.

DB-Pruefung:

- `PendingChange`: kein Eintrag im Zeitraum 2026-07-11 Europe/Berlin.
- `ChangeRequest`: kein Eintrag im Zeitraum 2026-07-11 Europe/Berlin.
- `ParticipantAuditLog`: ein `DIRECT_CHANGE` am 2026-07-11 16:52 UTC fuer `Vinzenz Kronacker`.

Ursache: `/aenderungen` laedt bisher nur Pending-/ChangeRequest-Daten aus `/api/admin/pending-changes`; direkte Admin-Aenderungen liegen separat im Participant-Audit.

## Scope

- In scope: Direkte Admin-Teilnehmeraenderungen in der Aenderungsuebersicht sichtbar machen.
- In scope: Eigener Filter/Status fuer direkte Aenderungen.
- Out of scope: Datenmodell, Migration, Schreiblogik fuer Teilnehmeraenderungen, Audit-Cockpit.
- Out of scope: Performance-Umbau/Pagination.

## Affected Flows

- User/API/admin flows touched: `/aenderungen`, `/api/admin/pending-changes?scope=all`.
- Data model impact: keiner.
- Auth/permission impact: keine Aenderung; bestehende Admin/Moderator-Pruefung bleibt.
- Production/deploy impact: Frontend/API-Hotfix, Deploy nach Freigabe.

## Data / API Design

- Proposed data model: unveraendert.
- Proposed API shape: Bei `scope=all` liefert `/api/admin/pending-changes` zusaetzlich synthetische Eintraege aus `ParticipantAuditLog.DIRECT_CHANGE` mit `status = DIRECT`.
- Backward compatibility: Default-Scope bleibt unveraendert und zeigt weiter nur offene Antraege.
- Migration/data backfill: nicht erforderlich.

## Open Questions

- Keine.

## Acceptance Criteria

- Die direkte Aenderung von `Vinzenz Kronacker` im Team `Die 5 Muskeltiere` ist in `/aenderungen` auffindbar.
- Direkte Aenderungen werden nicht als offene Antraege angezeigt.
- Die Admin-Startseite/embedded Queue bleibt auf offene Antraege fokussiert.
- Suche nach Team, Teilnehmer und Feldwerten findet direkte Aenderungen.

## Implementation Handoff

- Relevant files:
  - `app/api/admin/pending-changes/route.ts`
  - `app/components/approval-queue.tsx`
- Current decisions:
  - Direkte Aenderungen nur fuer `scope=all` beim Seiten-Dashboard laden.
  - UI-Status `DIRECT` als `Direkt geändert` darstellen.
- Open decisions: keine.
- Non-goals: keine neue Datenhaltung, keine Produktiondaten-Mutation.
- Expected implementation steps:
  - Direct-Audit-Logs in API laden und als DecoratedChange-kompatible Eintraege mappen.
  - UI-Statusfilter und Labels um `DIRECT` erweitern.
  - Textstellen von `Antrag` auf `Eintrag` bzw. direkte Aenderung differenzieren.
- Required checks:
  - `pnpm exec eslint app/api/admin/pending-changes/route.ts app/components/approval-queue.tsx`
  - `npx tsc --noEmit`
  - `git diff --check`
  - `npm run build`
- Risks/assumptions:
  - Historische Direct-Audit-Liste bleibt ohne Pagination begrenzt; Performance-Umbau bleibt separater CR.

## Model / Subagent Plan

- Model switch needed: no
- Target model/role: current
- Subagent needed: no
- Subagent role: none
- Handoff source: DB query + code inspection

## Confirmation Gate

- Gate needed: yes
- Reason: Production deploy.
- Approved by:
- Approval timestamp:

## Implementation Notes

- Files changed:
  - `app/api/admin/pending-changes/route.ts`
  - `app/components/approval-queue.tsx`
- Important decisions during implementation:
  - Direct-Audit-Logs werden nur bei `scope=all` geladen, damit die embedded Admin-Queue weiter nur offene Antraege zeigt.
  - Direct-Audit-Logs bekommen synthetisch `status = DIRECT`.
  - Die UI zeigt `Direkt geändert`, `Geändert von` und `Neu` statt Antrags-/Beantragt-Labels.

## Verification

- Local checks:
  - `pnpm exec eslint app/api/admin/pending-changes/route.ts app/components/approval-queue.tsx` gruen mit bestehender Hook-Warnung in `approval-queue.tsx`
  - `npx tsc --noEmit` gruen
  - `git diff --check` gruen
- Build:
  - `npm run build` gruen
- Targeted verification:
  - DB-Pruefung bestaetigt Direct-Audit-Eintrag fuer `Die 5 Muskeltiere` / `Vinzenz Kronacker`.
  - API-Design mappt diesen Log als synthetischen `DIRECT`-Eintrag fuer `/aenderungen`.
- Manual smoke:
  - pending production deploy

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

- Spaeter Pagination/Limitierung fuer historische Aenderungs- und Audit-Listen sauber schneiden.
