# GitHub Guardrails Setup

Manual one-time setup in GitHub repository settings.

## 1) Protect `main`

Open:

- `Settings` -> `Branches` -> `Branch protection rules` -> `Add rule`

Use:

- Branch name pattern: `main`
- Enable:
  - Require a pull request before merging
  - Require approvals: at least `1`
  - Dismiss stale pull request approvals when new commits are pushed
  - Require status checks to pass before merging
  - Require branches to be up to date before merging
  - Restrict who can push to matching branches (optional, recommended)
  - Do not allow bypassing the above settings

Required status checks:

- `verify` (from workflow `CI Main Guardrails`)
- `axios-scan` (from workflow `Security Audit`)

## 2) Production deployment policy

In Vercel project settings:

- Connect production deployments to `main` only.
- Disable ad-hoc manual production deployments from non-`main` branches for regular operation.

## 3) Team policy

- Recovery changes only as small PR packages.
- Each PR must fill:
  - scope / out-of-scope
  - risk and rollback
  - verification checklist

