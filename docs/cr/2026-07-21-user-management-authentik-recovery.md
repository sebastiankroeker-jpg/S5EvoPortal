# CR: User Management Authentik Visibility And Recovery

Status: Partially deployed
Date: 2026-07-21
Type: feature | ops
Risk: high
Owner: S5Evo

## Context

Sebastian reports that `schmid905@gmx.de` exists in Authentik but is not visible in the portal user administration.
Password reset functionality is still missing. Sebastian explicitly called this sensitive and requested a structured approach with rollback.

Read-only portal DB check on 2026-07-21 found one local Portal user row for `schmid905@gmx.de`:

- Email: `schmid905@gmx.de`
- Name: `Marco Schmid`
- `authentikSub`: `null`
- `deletedAt`: `null`
- Tenant roles: none
- Owned teams: none
- Linked participants: none

The current admin user list loads only users with at least one tenant role in the scoped tenant.
Therefore this user is not visible there even though a Portal placeholder exists.

Relevant Authentik docs checked on 2026-07-21:

- User credentials recovery requires a configured recovery flow and active brand default recovery flow.
- Authentik supports admin-created recovery links and email recovery links.
- User self-service password reset is available when a recovery flow is applied to the brand.
- Recovery flows normally identify the user, optionally verify via email/MFA/CAPTCHA, then prompt for a new password and write it.

## Scope

- In scope:
  - Diagnose and document why Authentik-only or placeholder users are missing from Portal user management.
  - Make Portal user management show/handle relevant placeholder users safely, or add a clear account-link/recovery state.
  - Add a safe password-reset entry point that delegates to Authentik recovery, not Portal-owned password handling.
  - Add explicit rollback and staging/test steps before any Authentik flow/provider change.
- Out of scope:
  - Portal storing, resetting, or validating passwords directly.
  - Broad Authentik redesign.
  - Automatic role assignment from Authentik without a separate role-mapping decision.
  - Production Authentik flow mutation without explicit approval.

## Affected Flows

- User/API/admin flows touched:
  - Admin user management search/list.
  - Login/account linking via NextAuth/AuthentiK OIDC.
  - Password recovery entry point.
- Data model impact:
  - Possibly none for V1 if existing `User` rows and `authentikSub` are used.
  - Possible audit events for admin-triggered recovery actions.
- Auth/permission impact:
  - High: account recovery and account-link state.
  - Admin-only controls must be tightly scoped.
- Sensitive data impact:
  - Email addresses, Authentik subject IDs, account-link status, recovery events.
- Offline/cache/export/log/mail impact:
  - No offline cache of recovery links or tokens.
  - No recovery tokens in logs, UI telemetry, exported files, or screenshots.
  - Email delivery is controlled by Authentik.
- Production/deploy impact:
  - Portal deploy gate required.
  - Authentik flow/provider changes require separate explicit ops gate and rollback package.

## Privacy / Security Review

- Sensitive fields touched:
  - User email, name, `authentikSub`, roles, account-link state, recovery action metadata.
- Purpose / data minimization:
  - Show only account state needed for support and role management.
  - Never expose recovery token/link except in the Authentik-controlled flow or admin-confirmed operation.
- Visibility by role/user/API/UI:
  - Admin user management only.
  - Users see only their own login/recovery surfaces.
- Persistence locations:
  - Portal DB `users`, `tenantRoles`, optional `AuditEvent`.
  - Authentik stores credentials and recovery flow state.
- Offline/cache behavior, TTL/invalidation/logout clearing:
  - Recovery links/tokens must not be stored in localStorage/IndexedDB.
  - Logout/session invalidation stays with existing Authentik/NextAuth setup.
- Logs/mails/exports/screenshots exposure:
  - Redact token, code, link, secret, password, session, cookie, authorization data.
- Negative checks for unauthorized access or payload leakage:
  - Unauthenticated user-management/recovery APIs return 401.
  - Non-admin recovery actions return 403.
  - Recovery endpoints never return credentials or raw recovery tokens to public users.
- Authenticated smoke plan or explicit gap:
  - Admin browser smoke for the affected user.
  - Test-user recovery flow smoke before production rollout.
- Residual risk:
  - Misconfigured Authentik recovery flow can lock out users or send broken recovery links.
  - Recovery email content and SMTP config must be verified outside Portal.

## Data / API Design

- Proposed data model:
  - Prefer existing `User.authentikSub` and `TenantRole`.
  - Optional audit event for admin-triggered recovery actions.
- Proposed API shape:
  - Read-only user-management API can include placeholder users without tenant roles when they are relevant to the scoped competition/support context, or expose a separate diagnostic/admin search endpoint.
  - Password reset button should either link to Authentik self-service recovery or trigger Authentik's recovery-email action through a narrowly scoped admin API after explicit design approval.
- Backward compatibility:
  - Existing logged-in users and tenant-role based admin list behavior must remain intact.
- Migration/data backfill:
  - No migration required for initial diagnostic/UI visibility if using existing rows.
  - For `schmid905@gmx.de`, expected reconciliation is email-match on next successful login, which will populate `authentikSub`.

## Open Questions

- Decision: Users without tenant roles appear in the main admin user list with explicit "ohne Rolle" filtering/status.
- Should Portal expose only a "Passwort vergessen" link to Authentik, or should admins be able to send recovery emails from Portal?
- Which Authentik recovery flow/brand is currently active in production, and is email delivery already configured and tested?

## Acceptance Criteria

- Admins can find `schmid905@gmx.de` or receive a clear explanation why the account is not yet linked/role-visible.
- The UI distinguishes:
  - Portal placeholder exists, no Authentik login linked yet.
  - Authentik-linked Portal account exists.
  - Tenant role assigned.
- No Portal code handles raw passwords.
- Password reset uses Authentik recovery flow.
- Authentik changes are backed up/exported before mutation and can be rolled back.
- Sensitive recovery tokens are never logged or stored in Portal client storage.

## Implementation Handoff

- Relevant files:
  - `SESSION_HANDOFF.md`
  - `app/api/admin/users/route.ts`
  - `app/components/user-management.tsx`
  - `lib/current-user.ts`
  - `app/api/auth/[...nextauth]/route.ts`
  - `lib/auth-flow.ts`
  - `docs/auth-setup-guide.md`
  - `docs/ADR-auth-konzept.md`
- Current decisions:
  - Portal must not reset passwords itself.
  - Authentik remains source of truth for credentials.
  - Production Authentik changes require explicit gate.
- Open decisions:
  - Main list vs explicit search for users without tenant roles.
  - Self-service link vs admin-triggered recovery email.
  - Authentik recovery flow/brand details.
- Non-goals:
  - Password storage or password token generation in Portal.
  - Blind Authentik flow mutation.
- Expected implementation steps:
  - Finish read-only Authentik/Portal reconciliation inventory.
  - Decide visibility UX for no-role placeholder users.
  - Implement Portal-side user-management visibility first.
  - Add recovery entry point only after Authentik flow export and test plan.
  - Stage/test with a dedicated test user.
  - Deploy Portal changes after checks and explicit approval.
- Required checks:
  - Targeted ESLint.
  - `npx tsc --noEmit --incremental false`.
  - `git diff --check`.
  - `npm run build`.
  - `npm run smoke:public`.
- Privacy/security checks:
  - Unauthorized admin user API calls remain 401/403.
  - No secrets, recovery URLs, tokens, cookies, or passwords in logs.
  - Existing admin role protections remain intact.
- Risks/assumptions:
  - Current Portal row for `schmid905@gmx.de` has no tenant roles; the existing admin list filters it out.
  - User login should link the placeholder via email and set `authentikSub`.
  - Authentik docs indicate recovery needs an active brand recovery flow and email stage for emailed recovery links.
- Context read before implementation:
  - `SESSION_HANDOFF.md` top block: yes
  - Relevant prior CR(s): participant claim/user placeholder CRs if changing placeholder behavior
  - Relevant source files: user admin API/UI, auth flow, current user resolver

## Rollback Plan

- Portal-only changes:
  - Revert the Portal deployment to the previous Vercel production deployment if user management or login behavior regresses.
  - Keep DB migrations out of the first pass if possible.
- Authentik changes:
  - Before mutation, export or screenshot/document current Brand default flows, Provider settings, recovery flow bindings, and relevant stages.
  - Change only a cloned/new recovery flow first.
  - Test with a non-admin test user.
  - If broken, restore the previous Brand recovery flow/provider binding.
  - Keep an Authentik admin recovery path available before touching live flows.

## Model / Subagent Plan

- Model switch needed: no
- Target model/role: Codex with high-risk auth checklist
- Subagent needed: no
- Subagent role:
- Handoff source: this CR

## Confirmation Gate

- Gate needed: yes
- Reason: Auth/account recovery and possible Authentik production configuration changes.
- Sensitive-data/production-data reason: Credentials recovery, user identity, roles, and recovery emails.
- Approved by:
- Approval timestamp:

## Implementation Notes

- Files changed:
  - `app/api/admin/users/route.ts`
  - `app/components/user-management.tsx`
- Important decisions during implementation:
  - No Authentik mutation.
  - No automatic role grant.
  - Roleless/unscoped Portal users are returned only after existing admin authorization.
  - User dashboard gets an "ohne Rolle" quick filter and standalone account-link status for users without teams.

## Verification

- Local checks:
  - `npx eslint app/components/user-management.tsx app/api/admin/users/route.ts`
  - `git diff --check -- ...`
- Build:
  - `npx tsc --noEmit --incremental false`
  - `npm run build`
- Targeted verification:
  - Read-only DB diagnosis found `schmid905@gmx.de` as a local user with no tenant roles or team/participant links.
- Sensitive-data negative checks:
  - `/api/admin/users` still requires admin authorization before any user data is returned.
  - No password, Authentik token, recovery link, or secret handling added.
- Authenticated role smoke:
  - Not run locally; needs browser/admin session.
- Manual smoke:
  - Pending.

## Deploy

- Deployment needed: yes
- Deployment ID: `dpl_AuuSHhAjmqZDReQWt1Nc1NkD3pUY`
- Deployment URL: `https://s5-evo-portal-rngodacmx-sebastiankroeker-2781s-projects.vercel.app`
- Production alias: `https://portal.s5evo.de`
- Deployed at: 2026-07-21 21:23 UTC

## Post-Deploy Smoke

- Routes checked:
  - `npm run smoke:public`: passed.
- API checks:
  - Unauthenticated `GET /api/admin/users`: 401.
  - Read-only DB verification after migration still shows `schmid905@gmx.de` as a roleless Portal user.
- Sensitive-data/API leakage checks:
  - Admin user API remains protected without session.
  - No password reset, Authentik mutation, recovery token, or recovery email behavior was deployed.
- Result: User visibility portion deployed; password reset remains open and gated.

## Follow-Ups

- Consider an explicit "Account status" panel in user management for Authentik/Portal/role state.
