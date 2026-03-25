---
title: CI Failure Prevention — Quick Reference Checklist
date: '2026-03-17'
category: checklist
purpose: Daily checklist for preventing 4 classes of CI failures from PR #164
usage: Copy into PR description or run before every commit
---

# CI Failure Prevention — Quick Reference

Use this checklist for every commit and PR. See `CI_FAILURE_PREVENTION_STRATEGY.md` for detailed explanations.

---

## Pre-Commit Checklist (Run Locally)

Run these before `git commit`:

```bash
# 1. Check migrations against Supabase roles
grep -r "GRANT.*TO (anon|authenticated|service_role)" supabase/migrations/ && \
  echo "✓ Found GRANT statements — verifying CI bootstrap has roles..." || \
  echo "✓ No GRANT statements to verify"

# 2. Check npm audit (vulnerability scan)
npm audit --audit-level=high --omit=dev && \
  echo "✓ No HIGH/CRITICAL production vulnerabilities" || \
  echo "✗ FAIL: Run 'npm audit fix'"

# 3. Check workspace audit
npm audit --workspaces --audit-level=high && \
  echo "✓ No workspace vulnerability" || \
  echo "✗ FAIL: Run 'npm audit fix --workspaces'"

# 4. Check for stale nested lockfiles
npm ls undici | grep "5\.29\.0" && \
  echo "✗ FAIL: Stale undici detected. Run: rm package-lock.json && npm install" || \
  echo "✓ No stale undici"
```

---

## Code Changes Checklist

### If you modified `supabase/migrations/*.sql`:

- [ ] Reviewed migration for GRANT statements
- [ ] For each GRANT statement:
  - [ ] Verified role exists in `packages/backend/src/__tests__/setup/testcontainers-global-setup.ts`
  - [ ] Verified role exists in `.github/workflows/ci.yml` (PostgreSQL service bootstrap)
- [ ] Added comment to migration explaining any new roles:
  ```sql
  -- Requires roles: anon, authenticated, service_role (defined in testcontainers setup + CI bootstrap)
  GRANT EXECUTE ON FUNCTION delete_all_wellness_data TO authenticated;
  ```

### If you modified `packages/backend/src/__tests__/setup/testcontainers-global-setup.ts`:

- [ ] Added corresponding role/function/schema to `.github/workflows/ci.yml` (lines 193-206)
- [ ] Added bidirectional comment:
  - In testcontainers setup: "Sync this with ci.yml PostgreSQL service bootstrap"
  - In ci.yml: "Sync this with testcontainers-global-setup.ts"

### If you modified RLS policies or WHERE clauses:

- [ ] For each `creator_id` reference:
  - [ ] Looked up actual type in `docs/schema/creator_id_types.md`
  - [ ] Used correct pattern:
    - [ ] UUID column → `.eq('creator_id', auth.uid())`
    - [ ] TEXT column → `.eq('creator_id', auth.uid()::text)` with comment explaining why
- [ ] Did NOT assume column type based on naming
- [ ] Did NOT add unsafe casts without type verification

### If you modified `package.json` or dependencies:

- [ ] If updating `undici`: verified it fixes `npm audit` findings
- [ ] If adding new dependencies: checked for transitive vulnerabilities:
  ```bash
  npm install --save <package>
  npm audit --audit-level=high
  ```
- [ ] If needed new override: added to root `package.json` ONLY with comment:
  ```json
  {
    "overrides": {
      "vulnerable-lib": ">=X.Y.Z"
      // CVE-2024-XXXXX: [brief description]
    }
  }
  ```

### If delegating work to an AI agent:

- [ ] Provided schema documentation (column types, not assumptions)
- [ ] Provided correct code patterns (show both UUID and TEXT variants)
- [ ] Added explicit checklist item: "Verify column types in schema doc before coding"
- [ ] Planned to review agent-generated code for:
  - [ ] Schema assumptions (did they look up types?)
  - [ ] Pattern conformance (does code match documented patterns?)
  - [ ] Type safety (any casts? are they justified?)

---

## PR Description Template

Add this checklist to your PR description:

```markdown
### CI Failure Prevention Checklist

- [ ] Problem 1 (Supabase roles):
  - [ ] No migrations modified, OR
  - [ ] Migrations reviewed, roles verified in both testcontainers + CI bootstrap

- [ ] Problem 2 (RLS type mismatch):
  - [ ] No RLS/schema modified, OR
  - [ ] All creator_id references verified against schema doc, correct patterns used

- [ ] Problem 3 (stale vulnerabilities):
  - [ ] `npm audit --audit-level=high` passes
  - [ ] `npm audit --workspaces` passes

- [ ] Problem 4 (stale lockfiles):
  - [ ] No stale undici or nested lockfiles detected
  - [ ] Workspace audit clean
```

---

## CI Job Monitoring Checklist

When CI runs, verify these gates pass:

| Gate                 | Location                            | What It Checks                                                |
| -------------------- | ----------------------------------- | ------------------------------------------------------------- |
| **npm audit**        | `.github/workflows/ci.yml` line 172 | HIGH/CRITICAL vulnerabilities blocked                         |
| **workspace audit**  | CI enhanced security job (if added) | All packages clean                                            |
| **test-integration** | Line 254-275                        | testcontainers setup bootstrap works (includes role creation) |
| **lockfile parity**  | CI enhanced security job (if added) | No stale nested lockfiles                                     |

If any gate fails:

- [ ] Check job logs for specific error
- [ ] If `npm audit` fails: run locally, apply `npm audit fix`, recommit
- [ ] If integration tests fail with "role does not exist": verify roles in both testcontainers AND ci.yml
- [ ] If lockfile inconsistency: regenerate with `rm package-lock.json && npm install`

---

## During Code Review

As a reviewer, ask these questions:

### Problem 1: Supabase Roles

```
Q: Were any migrations modified?
A: Yes/No

Q (if yes): Are the new roles created in both:
  - testcontainers-global-setup.ts?
  - ci.yml PostgreSQL bootstrap?
```

### Problem 2: RLS Type Mismatch

```
Q: Were any RLS policies or creator_id references modified?
A: Yes/No

Q (if yes): Did you verify the actual column type in docs/schema/creator_id_types.md?
A: [Show evidence — schema doc reference]

Q: Does the code use the correct pattern for that type?
A: [Show code snippet matching pattern]
```

### Problem 3: Vulnerabilities

```
Q: Did npm audit pass?
A: Yes (✓ passes in CI) / No (✓ fixed with npm audit fix)
```

### Problem 4: Lockfiles

```
Q: Are there any lockfile changes in the diff?
A: Yes — explain why
   No — ✓ expected

Q (if yes): Did you regenerate with `npm install` (not manual edit)?
A: Yes / No (should regenerate)
```

---

## Hotfix Protocol (If CI Blocks Deployment)

### Scenario 1: npm audit HIGH vulnerability blocks merge

```bash
# 1. Update locally
npm audit fix

# 2. If it doesn't work, manually update override
# Edit package.json:
# "undici": ">=X.Y.Z"  (increase minimum version)

# 3. Regenerate all lockfiles
rm package-lock.json
npm install

# 4. Verify fix
npm audit --audit-level=high
npm audit --workspaces --audit-level=high

# 5. Commit and push
git add package.json package-lock.json
git commit -m "fix(ci): resolve npm audit HIGH vulnerability"
```

### Scenario 2: Integration test fails with "role does not exist"

```bash
# 1. Find the failing migration
# Check CI logs for: "Migration failed: 20260XXX_*.sql"

# 2. Identify required role
grep -o "GRANT.*TO [a-z_]*" supabase/migrations/20260XXX_*.sql

# 3. Add to testcontainers-global-setup.ts (lines 63-74)

# 4. Add to ci.yml (lines 193-206, or new pre-test step)

# 5. Test locally
npm run test:integration

# 6. Commit with both changes
git add packages/backend/src/__tests__/setup/testcontainers-global-setup.ts
git add .github/workflows/ci.yml
git commit -m "fix(ci): add missing Supabase roles to CI bootstrap"
```

### Scenario 3: Lockfile inconsistency blocks merge

```bash
# 1. Regenerate nested package lockfile
cd packages/backend  # (or whichever package has the issue)
rm package-lock.json
npm install

# 2. Go back to root and regenerate root lockfile
cd /repo/root
rm package-lock.json
npm install --workspaces

# 3. Verify clean
npm audit --workspaces --audit-level=high
npm ls undici --workspaces

# 4. Commit
git add package-lock.json packages/*/package-lock.json
git commit -m "chore(ci): regenerate lockfiles for workspace consistency"
```

---

## Files to Know

| File                                                                  | Purpose                                                          | When to Check                  |
| --------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------ |
| `docs/solutions/CI_FAILURE_PREVENTION_STRATEGY.md`                    | Detailed explanation of all 4 problems                           | Understanding root causes      |
| `docs/schema/creator_id_types.md`                                     | Canonical list of creator_id column types                        | Modifying RLS or where clauses |
| `packages/backend/src/__tests__/setup/testcontainers-global-setup.ts` | Test database bootstrap (source of truth for roles)              | Adding new Supabase stubs      |
| `.github/workflows/ci.yml`                                            | CI pipeline definition (must mirror testcontainers setup)        | Adding roles or services to CI |
| `package.json` (root)                                                 | Workspace overrides (single source of truth for vulnerabilities) | Fixing npm audit findings      |
| `.github/workflows/ci.yml` security job                               | npm audit gate                                                   | Pre-merge verification         |

---

## FAQ

**Q: Why do I need to update both testcontainers setup AND ci.yml for roles?**
A: They're separate systems that need to stay in sync. testcontainers is for local testing; ci.yml is for GitHub Actions CI. Both spin up bare PostgreSQL, so both need the same Supabase stubs.

**Q: Can I assume creator_id is always UUID?**
A: No. Check `docs/schema/creator_id_types.md`. 4 tables have TEXT, others have UUID. Always verify.

**Q: What if npm audit fix doesn't resolve the vulnerability?**
A: Manually update the override in `package.json` to a higher minimum version, then run `npm install` to regenerate lockfiles.

**Q: Can I edit package-lock.json manually?**
A: No. Always use `npm install` to regenerate. Manual edits bypass npm's integrity checks.

**Q: What's the difference between `npm audit fix` and `npm audit fix --force`?**
A: `--force` allows major version updates. Use only if the minor/patch version doesn't resolve the vulnerability.

**Q: How often should I audit for stale dependencies?**
A: Run `npm audit` before every PR. Run full workspace audit (`npm audit --workspaces`) before merge.

---

## Contact & Escalation

If you're unsure:

1. Check `docs/solutions/CI_FAILURE_PREVENTION_STRATEGY.md` for detailed guidance
2. Ask in code review — this checklist is a learning document
3. Pair program on first pass if delegating to agent or new contributor
