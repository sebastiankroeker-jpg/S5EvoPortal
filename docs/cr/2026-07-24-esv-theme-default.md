# CR: ESV theme as default for users without explicit theme selection

Status: Implemented locally, pending deploy approval
Date: 2026-07-24
Type: hotfix
Risk: low
Owner: S5Evo

## Context

Sebastian requested that users who have not actively selected a theme should
see the ESV theme by default.

## Scope

- In scope:
  - Use ESV as the browser theme fallback when no stored theme choice exists.
  - Preserve existing stored user choices for Light, Dark, Bunt, or ESV.
  - Keep the admin tenant configuration fallback aligned with ESV.
- Out of scope:
  - No database migration.
  - No forced overwrite of existing `localStorage` theme values.
  - No visual redesign of the ESV theme.

## Affected Flows

- User/API/admin flows touched:
  - Global theme provider initial state.
  - Admin tenant settings fallback display.
- Data model impact:
  - None.
- Auth/permission impact:
  - None.
- Sensitive data impact:
  - None.
- Offline/cache/export/log/mail impact:
  - Local browser theme preference handling only.
- Production/deploy impact:
  - Requires production deploy to affect portal users.

## Data / API Design

- Proposed data model:
  - No change.
- Proposed API shape:
  - No change.
- Backward compatibility:
  - Existing saved theme keys remain supported.
  - Default ESV is not persisted as an explicit selection until the user changes
    the theme.
- Migration/data backfill:
  - None.

## Acceptance Criteria

- Users without a stored theme see ESV by default.
- Users with a stored theme keep their chosen theme.
- The fallback does not force-write ESV into local storage as an explicit user
  selection.
- Admin tenant settings use ESV as fallback when a tenant theme is missing.

## Implementation Handoff

- Relevant files:
  - `lib/theme-context.tsx`
  - `app/admin/page.tsx`
- Current decisions:
  - ESV is the default fallback.
  - Stored explicit theme values still win.
- Open decisions:
  - Production deploy approval.
- Non-goals:
  - No schema migration or DB backfill.
- Expected implementation steps:
  - Change fallback theme resolution.
  - Keep existing saved theme resolution.
  - Run targeted lint, TypeScript, build, diff check.
- Required checks:
  - `npx eslint lib/theme-context.tsx app/admin/page.tsx`
  - `npx tsc --noEmit`
  - `npm run build`
  - `git diff --check`
- Privacy/security checks:
  - Verify no personal data, API serializers, exports, or auth behavior changed.
- Risks/assumptions:
  - Functional-storage consent may prevent reading a previously stored theme;
    in that case the non-persisted default is ESV.
- Context read before implementation:
  - `SESSION_HANDOFF.md` top block: yes
  - Relevant source files: yes

## Confirmation Gate

- Gate needed: yes
- Reason: production deploy.
- Sensitive-data/production-data reason: none.
- Approved by:
- Approval timestamp:

## Implementation Notes

- Files changed:
  - `lib/theme-context.tsx`
  - `app/admin/page.tsx`
- Important decisions during implementation:
  - Introduced an explicit theme marker so fallback ESV is not treated as a
    user-selected theme.

## Verification

- Local checks:
  - `npx eslint lib/theme-context.tsx app/admin/page.tsx` -> pass
  - `npx tsc --noEmit` -> pass
  - `git diff --check` -> pass
- Build:
  - `npm run build` -> pass
- Targeted verification:
  - Code review: existing stored theme keys still win before ESV fallback.
  - Code review: fallback ESV is not persisted unless the user actively changes
    the theme.
- Sensitive-data negative checks:
  - Not applicable; no sensitive data/API behavior touched.
- Authenticated role smoke:
  - Not applicable for the theme fallback.
- Manual smoke:
  - Pending.

## Deploy

- Deployment needed: yes
- Deployment ID:
- Deployment URL:
- Production alias:
- Deployed at:

## Post-Deploy Smoke

- Routes checked:
- API checks:
- Sensitive-data/API leakage checks:
  - Not applicable.
- Result:

## Follow-Ups

- None.
