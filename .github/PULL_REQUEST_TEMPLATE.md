## Summary

- What changed?
- Why is this needed?

## Scope

- In scope:
- Not in scope:

## Recovery Safety Checklist

- [ ] This PR is intentionally small and isolated.
- [ ] I listed explicit out-of-scope files/areas above.
- [ ] I verified no unrelated safety-branch leftovers are included.
- [ ] I ran and passed:
  - [ ] `npm run verify:team-draft`
  - [ ] `npm run verify:participant-edit-flow`
  - [ ] `npm run build`
- [ ] I confirmed post-deploy smoke expectations:
  - [ ] public routes return `200`
  - [ ] protected routes return `401` without session
  - [ ] known parameter/method checks (`400`/`405`) are expected

## Risk & Rollback

- Risk level: Low / Medium / High
- Rollback command or commit to revert:
- Monitoring notes after deploy:
