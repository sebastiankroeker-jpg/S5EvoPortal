# CR: Mannschafts-Dashboard Saved Layouts

Status: Draft
Date: 2026-07-09
Type: feature
Risk: medium
Owner: S5Evo

## Context

Sebastian wants SAP ALV-style saved layout customization for the Mannschafts-Dashboard. Users should be able to use saved layouts as personal layouts or global/public layouts. The selected layout should also define how the CSV export is generated.

The dashboard already has local layout-like state: cards/list view, visible list columns, filters, quick filters, date filters, and sorting are persisted in browser localStorage. CSV export is currently fixed and independent from the dashboard state.

## Scope

- In scope:
  - Saved layouts initially only for the Mannschafts-Dashboard.
  - Personal layouts owned by the current user.
  - Global/public layouts visible to all authorized dashboard users.
  - Select, save, update, duplicate, and delete layouts.
  - Layout content should cover view mode, visible columns, sorting, and CSV export columns/order.
  - CSV export should use the selected layout to determine exported columns, column order, headers, row content, and row set based on the currently filtered dashboard rows.
- Out of scope:
  - Other dashboards such as Sportlerboerse-Dashboard, Teilnehmer-Dashboard, Claim-Link-Dashboard, and Ergebnisansichten.
  - Full SAP ALV parity such as grouping, aggregation, formulas, pivoting, subtotals, print variants, or transport management.
  - Non-CSV export formats unless explicitly approved.
  - Sharing personal layouts with selected individual users.
  - Persisting dashboard filters in saved layouts for V1; filters remain per-user/local as today.

## Affected Flows

- User/API/admin flows touched:
  - Mannschafts-Dashboard layout selection and save/manage UI.
  - Dashboard filter/sort/column state.
  - Admin/moderator CSV export from the dashboard.
- Data model impact:
  - Likely new saved layout table with JSON config and scope.
  - Prisma migration expected.
- Auth/permission impact:
  - Personal layouts can be managed by their owner.
  - Global layouts should be created/changed only by ADMIN in V1.
  - All dashboard users can read active global layouts if they can access the Mannschafts-Dashboard.
  - Layout APIs must reuse the dashboard/team access model, including tenant and competition context.
- Production/deploy impact:
  - Requires migration planning and deploy gate.
  - Export endpoint must remain backward compatible when no layout is selected.

## Data / API Design

- Proposed data model:
  - New model, working name `DashboardLayout`.
  - Fields: `id`, `tenantId`, `dashboardKey`, `name`, `scope`, `configVersion`, `config`, `ownerId`, `createdByUserId`, `updatedByUserId`, `competitionId`, `isDefault`, `createdAt`, `updatedAt`, `deletedAt`.
  - `dashboardKey` initially `TEAM_DASHBOARD`.
  - `scope` initially `PERSONAL | GLOBAL`.
  - `config` as Prisma `Json`, versioned as `{ version: 1, viewMode, visibleColumns, sortField, sortDirection, exportColumns }`.
  - Index/uniqueness should include tenant/dashboard/scope/owner/competition/name and soft-delete state.
  - `isDefault` must be defined carefully: personal default is owner-scoped, global default is tenant/competition-scoped.
- Proposed API shape:
  - `GET /api/dashboard-layouts?dashboardKey=TEAM_DASHBOARD&competitionId=...`
  - `POST /api/dashboard-layouts`
  - `PATCH /api/dashboard-layouts/[id]`
  - `DELETE /api/dashboard-layouts/[id]`
  - Extend `GET /api/admin/teams-export?competitionId=...&layoutId=...`
  - CSV export must use server-side `EXPORT_COLUMN_DEFINITIONS` allowlist with column key, header, role/scope permissions, data requirements, and renderer.
  - Export with `layoutId` must receive an explicit allowlisted row identifier set from the filtered dashboard state; export without `layoutId` remains the full competition export.
- Backward compatibility:
  - Existing dashboard localStorage preferences continue to work when no saved layout is selected.
  - Existing CSV export without `layoutId` keeps current fixed export.
  - CR files remain local workspace artifacts for now; Git-backed CR tracking is intentionally deferred.
- Migration/data backfill:
  - No required backfill for existing users.
  - Optional seeded global default layout can be deferred.

## Open Questions

- DECIDED: Global layouts are manageable by ADMIN only in V1.
- DECIDED: Global layouts are tenant-wide by default, with optional `competitionId` support for targeted layouts.
- DECIDED: Filters are not part of saved layouts in V1; they remain per-user/local as today.
- DECIDED: The first version keeps CSV as the file type; layout varies columns/order/headers/content, not delimiter/XLSX.
- Should an unsaved ad-hoc dashboard state be exportable as "current view", or only saved layouts?
- Should one layout be markable as personal default and/or global default?
- DECIDED: With selected layout, CSV export uses currently filtered dashboard rows. Without selected layout, export remains full competition export.

## Acceptance Criteria

- A user can save the current Mannschafts-Dashboard setup as a personal layout.
- Authorized users can create a global layout if the permission decision allows them.
- A user can select a saved layout and the dashboard applies its configured state.
- A user can update or delete only layouts they are allowed to manage.
- CSV export with a selected layout uses that layout for exported columns, order, headers, and row content.
- CSV export with a selected layout exports the currently filtered dashboard row set, validated server-side by row identifiers and access checks.
- CSV export without a selected layout remains compatible with the current export behavior.
- Layout config is versioned so later layout changes can be migrated or ignored safely.
- Layouts are tenant-isolated; users cannot read/write/export with layouts from another tenant or inaccessible competition.
- Unknown, stale, or unauthorized layout config keys are rejected or ignored deterministically.
- CSV layout export cannot expose fields outside the server-side export allowlist.
- Invalid or inaccessible `layoutId` returns 403/404 and never silently falls back to the default export.
- Deleting a selected layout falls back cleanly to local/default dashboard state.
- LocalStorage fallback remains unchanged when no saved layout is selected.

## Review Findings

Read-only review subagent `Locke` completed on 2026-07-09.

- Data model:
  - Add explicit `tenantId`; competition membership alone is not enough for clean layout isolation.
  - Keep `competitionId` optional so global layouts can be tenant-wide or competition-specific.
  - Treat default semantics carefully because personal default and global default have different uniqueness scopes.
- Auth:
  - Prefer ADMIN-only global layout writes in V1 because global layouts can influence shared dashboard and export behavior.
  - Personal layout CRUD can be available to authenticated users who can access the Mannschafts-Dashboard.
  - Layout APIs should mirror dashboard/team access logic, not only check broad tenant roles.
- CSV:
  - Highest risk area. Current export loading includes sensitive data not necessarily emitted in the fixed CSV.
  - Dynamic export must never map arbitrary JSON keys into row data.
  - Implement a server-side allowlist such as `EXPORT_COLUMN_DEFINITIONS` and validate selected layout columns against it.
- UX/state:
  - Current dashboard state is split between localStorage preferences and visible-column storage.
  - Introduce clear modes: unsaved local preferences, selected saved layout, dirty selected layout.
  - Applying a layout must not auto-save back to the server; server update only on explicit save.
  - Saved filters may surprise users; Sebastian decided V1 excludes filters because filters are already remembered per user.

## Implementation Handoff

Use before model switch or subagent delegation.

- Relevant files:
  - `app/components/dashboard.tsx`
  - `app/api/admin/teams-export/route.ts`
  - `lib/team-csv-export.ts`
  - `prisma/schema.prisma`
  - new API routes under `app/api/dashboard-layouts/`
- Current decisions:
  - Start only with Mannschafts-Dashboard.
  - Keep existing fixed CSV export as fallback when no layout is selected.
  - Store layout config server-side, not only in localStorage.
  - Keep CR files local for now; do not change `.git/info/exclude` as part of this CR.
  - Use explicit tenant isolation in the persisted layout model.
  - Use a server-side export column allowlist; layout JSON never directly controls data access.
  - Treat the selected saved layout as explicit named state; do not auto-save changes back without user action.
  - Global layout writes are ADMIN-only in V1.
  - Global layouts are tenant-wide by default; `competitionId` remains optional.
  - Saved layouts do not persist filters in V1.
  - CSV remains the only file format in V1.
  - Layout export uses the currently filtered dashboard row set; no-layout export remains full competition export.
- Open decisions:
  - Whether an unsaved ad-hoc dashboard state should be exportable as "current view", or only saved layouts.
  - Whether one layout can be marked as personal/global default and precedence if both exist.
- Non-goals:
  - No full SAP ALV clone.
  - No non-CSV file type unless explicitly approved.
  - No rollout to other dashboards in this CR.
- Expected implementation steps:
  - Finalize decisions at confirmation gate.
  - Add Prisma model/enums and migration.
  - Add server-side layout validation and API routes.
  - Add dashboard layout picker/manage UI.
  - Wire selected layout into dashboard state.
  - Add export column definition allowlist and validate layout export columns server-side.
  - Extend CSV export to accept a layout and filtered team ids, then build allowlisted columns dynamically after server-side access validation.
  - Add targeted tests/verification.
- Required checks:
  - `npx prisma validate`
  - `npx tsc --noEmit`
  - `npm run build`
  - targeted API/export verification for personal/global layout permissions
  - targeted CSV allowlist verification
  - localStorage/default-state regression check
  - `npm run smoke:public` after production deploy
- Risks/assumptions:
  - Medium risk because this touches persisted data, permissions, dashboard state, and export behavior.
  - Dynamic exports can accidentally expose fields if layout config is not allowlisted.
  - Exporting the currently filtered dashboard row set requires server-side validation of all submitted team ids.
  - Because filters are excluded from saved layouts in V1, local filter persistence must remain stable and understandable.

## Model / Subagent Plan

- Model switch needed: yes
- Target model/role: Codex implementation after confirmation
- Subagent needed: yes, recommended before implementation
- Subagent role: review/design risk check for data model, auth, and export allowlist
- Handoff source: this CR plus `SESSION_HANDOFF.md` and targeted files listed above
- Review subagent:
  - Approved by Sebastian via Telegram "Go" on 2026-07-09 21:10 UTC.
  - Spawned as `Locke` (`019f48b7-a7b8-7ad0-b45b-464897546875`) for read-only CR/design review.
  - Scope: no implementation, no file edits.

## Confirmation Gate

- Gate needed: yes
- Reason: Schema/migration, auth behavior, dashboard UX, export semantics, and implementation/model switch.
- Approved by: Sebastian approved implementation via Telegram "Go"; Sebastian approved read-only review subagent on 2026-07-09 21:10 UTC.
- Approval timestamp: 2026-07-09 21:44 UTC

## Implementation Notes

- Files changed:
  - `prisma/schema.prisma`
  - `prisma/migrations/20260709214500_add_dashboard_layouts/migration.sql`
  - `lib/dashboard-layout-config.ts`
  - `app/api/dashboard-layouts/route.ts`
  - `app/api/dashboard-layouts/[id]/route.ts`
  - `lib/team-csv-export.ts`
  - `app/api/admin/teams-export/route.ts`
  - `app/components/dashboard.tsx`
- Important decisions during implementation:
  - Layout config validation/sanitization lives in `lib/dashboard-layout-config.ts`.
  - Dashboard layout export uses `POST /api/admin/teams-export` with `layoutId` and filtered `teamIds`; legacy `GET` remains full competition export.
  - Dynamic CSV export uses server-side `TEAM_EXPORT_COLUMN_DEFINITIONS`; layout JSON never names arbitrary data paths.
  - Dashboard UI keeps filters local and only saves view mode, visible columns, sorting, and derived export columns.
  - Global layout writes are enforced as ADMIN-only in the layout API; export remains ADMIN/MODERATOR.
  - UI was sharpened after implementation feedback: compact default layout row, management controls behind `Verwalten`, explicit dirty badge, and `CSV (Layout)` label when a saved layout is active.

## Verification

- Local checks:
  - `npx prisma validate` gruen
  - `npx prisma generate` gruen
  - `npx tsc --noEmit` gruen
  - `git diff --check` gruen
- Build:
  - `npm run build` gruen
  - `npm run build` gruen again after UI sharpening
- Targeted verification:
  - Inline `tsx` check fuer layout config sanitization und CSV allowlist/filtered row rendering gruen
- Manual smoke:
  - Pending; local browser smoke not yet run

## Deploy

- Deployment needed: yes
- Commit: `36efa09 Add saved dashboard layouts`
- Deployment ID: `dpl_EAtRbHGp4vntJ54oT5djDUemUKf8`
- Deployment URL: `https://s5-evo-portal-die3r3mq3-sebastiankroeker-2781s-projects.vercel.app`
- Production alias: `https://portal.s5evo.de`
- Ready state: `READY`
- Deployed at: 2026-07-09T22:14:15Z
- Production migration:
  - `npx prisma migrate deploy` applied `20260709214500_add_dashboard_layouts`
  - Result: all migrations successfully applied

## Post-Deploy Smoke

- Routes checked:
  - `/` -> 200
  - `/login` -> 200
  - `/anmeldung` -> 200
  - `/aenderungen` -> 200
  - `/sportlerboerse` -> 200
  - `/sportlerboerse/mtc` -> 200
- API checks:
  - `/api/competition` -> 200
  - `/api/results` -> 200
  - `/api/teams` without session -> 401
  - `/api/admin/pending-changes` without session -> 401
  - `/api/dashboard-layouts` without session -> 401
  - `/api/admin/teams-export` without session -> 401
- Result: green

## Follow-Ups

- Decide whether to make the Sportlerboerse-Dashboard use the same layout infrastructure later.
- Consider a future "export current view" mode after saved-layout V1 is stable.
