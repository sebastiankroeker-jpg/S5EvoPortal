# CR: Change Dashboard Consolidated History

Status: Deployed
Date: 2026-07-12
Type: feature
Risk: medium
Owner: S5Evo

## Context

After the direct participant change hotfix, `/aenderungen` can show direct admin participant changes in addition to pending/reviewed change requests. Sebastian wants the change dashboard consolidated so all changes are findable in one place.

## Scope

- In scope:
  - Define `/aenderungen` as the central change history and review dashboard.
  - Consolidate pending requests, approved/rejected requests, direct participant changes, and relevant audit-backed changes where appropriate.
  - Make clear which entries are actionable requests and which are historical/audit entries.
  - Keep existing admin audit cockpit for operational audits, but avoid making it the only place for user-facing change discovery.
- Out of scope:
  - Replacing all audit screens.
  - Full event-sourcing redesign.
  - Data model migration unless a clear gap is found.

## Affected Flows

- User/API/admin flows touched:
  - `/aenderungen`
  - `/api/admin/pending-changes`
  - possibly `/api/admin/participant-audit` or a new consolidated endpoint
- Data model impact: none expected initially.
- Auth/permission impact: Admin/Moderator-only access remains.
- Production/deploy impact: frontend/API feature deploy.

## Data / API Design

- Proposed data model:
  - Prefer no schema change; create normalized view-model entries from existing `ChangeRequest`, `PendingChange`, `ParticipantAuditLog`, and selected `AuditEvent` records.
- Proposed API shape:
  - Either extend `/api/admin/pending-changes?scope=all` further or create `/api/admin/change-history`.
  - Return normalized fields: `kind`, `status`, `entity`, `actor`, `createdAt`, `updatedAt`, `fields`, `source`.
- Backward compatibility:
  - Keep existing review actions untouched.
  - Embedded pending queue should stay focused on open actionable items.
- Migration/data backfill: not expected.

## Open Questions

- Which audit categories belong in `/aenderungen` v1 besides participant direct changes?
- Should team-level changes be included now or deferred until team edit auditing is normalized?
- How far back should the initial history load go before pagination is implemented?

## Acceptance Criteria

- Admins can find pending, reviewed, and direct participant changes in `/aenderungen`.
- Entries clearly distinguish `Offen`, `Genehmigt`, `Abgelehnt`, and `Direkt geändert`.
- Historical entries are not accidentally actionable.
- Search by participant, team, actor, field, and changed value works once the search/filter CR lands.
- Embedded admin queue remains focused on open review work.

## Implementation Handoff

- Relevant files:
  - `app/api/admin/pending-changes/route.ts`
  - `app/api/admin/participant-audit/route.ts`
  - `app/components/approval-queue.tsx`
  - possible new `lib/change-history.ts`
- Current decisions:
  - Consolidation should be in `/aenderungen`, not spread across hidden admin tabs.
  - Keep actionability explicit.
- Open decisions:
  - Endpoint shape: extend existing vs new consolidated endpoint.
  - Which audit categories are v1.
- Non-goals:
  - Replacing all low-level audits.
  - Pagination unless needed for acceptable performance.
- Expected implementation steps:
  - Inventory existing change/audit sources.
  - Define normalized view model.
  - Update UI grouping/status display.
  - Add targeted verification for direct and pending entries.
- Required checks:
  - targeted eslint
  - `npx tsc --noEmit`
  - `git diff --check`
  - `npm run build`
  - `npm run smoke:public` after deploy
- Risks/assumptions:
  - Combining audit and approval data can blur semantics; labels must stay explicit.

## Model / Subagent Plan

- Model switch needed: no
- Target model/role: current Codex
- Subagent needed: optional
- Subagent role: code review of normalized data semantics
- Handoff source: this CR and current deployed hotfix CRs

## Confirmation Gate

- Gate needed: yes
- Reason: production deploy; possible API surface changes.
- Approved by:
- Approved by: Sebastian
- Approval timestamp: 2026-07-12 09:18 UTC

## Implementation Notes

- Files changed:
  - `app/components/approval-queue.tsx`
- Important decisions during implementation:
  - Seitenmodus von `/aenderungen` startet jetzt mit Status `ALL`, damit offene, entschiedene und direkte Aenderungen standardmaessig gemeinsam sichtbar sind.
  - Embedded Queue bleibt bei `PENDING`, damit Admin-Startseite weiter nur offene Arbeit zeigt.
  - Direkte Aenderungen bleiben nicht-aktionierbare Historieneintraege.

## Verification

- Local checks:
  - `pnpm exec eslint app/components/message-center.tsx app/components/approval-queue.tsx` gruen mit bestehender Hook-Warnung in `approval-queue.tsx`
  - `npx tsc --noEmit` gruen
  - `git diff --check` gruen
- Build:
  - `npm run build` gruen
- Targeted verification:
  - Default-Status ist je nach Variante getrennt: Page `ALL`, embedded `PENDING`.
- Manual smoke:
  - `npm run smoke:public` gegen Production-Alias gruen
  - `/aenderungen`: 200
  - `/api/admin/pending-changes?scope=all` ohne Session: 401

## Deploy

- Deployment needed: yes
- Deployment ID: `dpl_881AguqPcGbhDUBNUewE5iXJHbPu`
- Deployment URL: `https://s5-evo-portal-a5rb0h4ce-sebastiankroeker-2781s-projects.vercel.app`
- Production alias: `https://portal.s5evo.de`
- Deployed at: 2026-07-12 09:24 UTC

## Post-Deploy Smoke

- Routes checked:
  - `/aenderungen`: 200
- API checks:
  - `/api/admin/pending-changes?scope=all` without session: 401
- Result: green

## Follow-Ups

- Add pagination/lazy-loading once consolidated history grows.
