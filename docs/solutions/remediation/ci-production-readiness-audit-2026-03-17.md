---
title: 'Production-Readiness Audit: 4 CI Failures (DB Roles, RLS Type Mismatch, undici CVEs, Lockfile)'
date: 2026-03-17
category: remediation
tags:
  - ci-pipeline
  - supabase
  - postgresql
  - rls
  - type-safety
  - npm-audit
  - trivy
  - testcontainers
  - undici
  - lockfile
  - security-audit
  - db-migration-validation
module:
  - .github/workflows/ci.yml
  - supabase/migrations
  - packages/backend/package.json
  - package-lock.json
symptom: "4 distinct CI failures across 4 iterations: (1) DB migration validation — role 'authenticated' does not exist; (2) integration tests — operator does not exist: uuid = text; (3) npm audit — undici 7.x HIGH CVE; (4) Trivy — undici 5.29.0 HIGH CVEs from stale testcontainers"
root_cause: 'CI bootstrap incomplete (missing Supabase roles); security-hardener agent assumed TEXT types on UUID columns; transitive dependency vulnerabilities; stale nested lockfile entries persisted despite root overrides'
severity: P1
recurrence_risk: high
pr_number: 164
---

# Production-Readiness Audit: 4 CI Failures Remediated

PR #164 (`feat/squad-b/production-readiness-audit`) — 38+ commits, 4 CI fix iterations to achieve full green.

## Problem Summary

After a 5-agent production-readiness audit remediated 47 findings across 6 phases, the CI pipeline revealed 4 distinct failures that required iterative fixes:

| #   | Failure                      | Job                     | Error                                  | Iterations |
| --- | ---------------------------- | ----------------------- | -------------------------------------- | ---------- |
| 1   | Missing Supabase roles       | DB Migration Validation | `role "authenticated" does not exist`  | 1          |
| 2   | RLS type mismatch            | Integration Tests       | `operator does not exist: uuid = text` | 1          |
| 3   | undici 7.x vulnerability     | Security Audit (npm)    | HIGH severity CVE                      | 1          |
| 4   | undici 5.29.0 stale lockfile | Security Audit (Trivy)  | 2 HIGH CVEs                            | 4 attempts |

---

## Solution 1: Missing Supabase Roles in CI Bootstrap

### Symptom

DB Migration Validation job failed:

```
ERROR: role "authenticated" does not exist
```

Triggered by `20260215000001_add_delete_all_wellness_data_function.sql` which references the `authenticated` role.

### Root Cause

The CI bootstrap step (added in a prior commit) created `auth.uid()`, `auth.role()`, and `supabase_realtime` publication — but forgot the three Supabase roles (`anon`, `authenticated`, `service_role`). The testcontainers setup (`packages/backend/src/__tests__/setup/testcontainers-global-setup.ts`) already had these roles, but CI bootstrap didn't mirror it.

### Fix

Added role creation to the CI bootstrap step in `.github/workflows/ci.yml`:

```sql
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN;
  END IF;
END $$;
```

### Key Insight

**CI bootstrap and testcontainers setup must maintain parity.** Both create a vanilla PostgreSQL environment that mimics Supabase. When one adds a feature (roles, schemas, functions, publications), the other must match. Use the testcontainers setup as the source of truth.

---

## Solution 2: RLS uuid=text Type Mismatch

### Symptom

Integration tests failed:

```
ERROR: operator does not exist: uuid = text
```

in `20260307000004_rls_financial_tables_phase1.sql`.

### Root Cause

The security-hardener agent (from the production-readiness audit) wrote RLS policies with `auth.uid()::text` for columns that are actually UUID. It incorrectly assumed `creator_id` was TEXT on 4 tables.

### Investigation

Checked actual table definitions in `20240201000000_additional_tables.sql`:

| Table                | creator_id Type | Cast Needed?             |
| -------------------- | --------------- | ------------------------ |
| platform_connections | TEXT NOT NULL   | Yes — `auth.uid()::text` |
| business_invoices    | UUID NOT NULL   | No — `auth.uid()`        |
| expenses             | UUID NOT NULL   | No — `auth.uid()`        |
| revenue_entries      | UUID NOT NULL   | No — `auth.uid()`        |
| contracts            | UUID NOT NULL   | No — `auth.uid()`        |

Also verified `20260310000002_rls_content_community_tables.sql` — its `::text` casts are correct (cross_posts, repurposed_content, inbox_messages, platform_metrics_history genuinely have TEXT `creator_id`).

### Fix

Removed incorrect `::text` casts on 4 tables:

```sql
-- BEFORE (incorrect — creator_id is UUID, not TEXT):
CREATE POLICY "business_invoices_select_own" ON business_invoices
  FOR SELECT USING (creator_id = auth.uid()::text);

-- AFTER (correct — UUID = UUID):
CREATE POLICY "business_invoices_select_own" ON business_invoices
  FOR SELECT USING (creator_id = auth.uid());
```

Same fix applied to `expenses`, `revenue_entries`, and `contracts`.

### Key Insight

**AI agents must verify column types before writing RLS policies.** The security-hardener assumed TEXT because the migration comments said "creator_id is TEXT" for `platform_connections` and then incorrectly applied the same pattern to other tables. Always check the actual CREATE TABLE definition, not comments or assumptions.

**Pattern: Schema-First Code Generation** — Before writing any SQL that references a column, look up its actual type in the migration that created the table. Never infer types from similar-looking columns on other tables.

---

## Solution 3: undici 7.x Vulnerability

### Symptom

npm audit found HIGH severity in `undici 7.0.0-7.23.0` (via `@elastic/transport`).

### Fix

```bash
npm audit fix
```

Updated undici to 7.24.3. Straightforward resolution.

---

## Solution 4: undici 5.29.0 — Stale Nested Lockfile Entry

### Symptom

Trivy filesystem scan found `undici 5.29.0` with 2 HIGH CVEs. This was a separate, older version pulled by `testcontainers@10.28.0` in the backend workspace.

### Root Cause

`packages/backend/package.json` had `"testcontainers": "^10.28.0"` (not `^11.12.0`). testcontainers 10.x depends on `undici@^5.29.0`. Despite root `overrides: { "undici": ">=6.0.0" }`, npm kept the stale nested lockfile entry at `packages/backend/node_modules/testcontainers@10.28.0`.

### What Failed (4 attempts)

| Attempt | Command                 | Result                                      |
| ------- | ----------------------- | ------------------------------------------- |
| 1       | `npm audit fix`         | Did not resolve nested entry                |
| 2       | `npm update`            | Did not update nested testcontainers        |
| 3       | `npm audit fix --force` | No effect on nested entry                   |
| 4       | Manual lockfile editing | npm regenerated stale entry on next install |

### Working Fix

1. Updated `packages/backend/package.json`: `"testcontainers": "^10.28.0"` → `"^11.12.0"`
2. Deleted `package-lock.json` entirely
3. Ran `npm install` to regenerate fresh lockfile
4. Result: **0 vulnerabilities**

### Key Insight

**Root overrides don't fix stale nested lockfile entries.** When a workspace package has a pinned dependency in the lockfile, npm preserves it even if the root `overrides` field should force a different version. The only reliable fix is:

1. Update the source dependency in the workspace `package.json`
2. Delete `package-lock.json`
3. Regenerate with `npm install`

This is a known npm behavior — lockfile entries take precedence over overrides for already-resolved packages.

---

## Prevention Strategies

### For CI Bootstrap Parity (Problem 1)

- **Checklist:** When modifying `testcontainers-global-setup.ts`, check if `.github/workflows/ci.yml` DB Migration Validation bootstrap needs the same change (and vice versa)
- **Detection:** Add a CI comment linking the two files as a parity contract
- **Principle:** Test infrastructure must mirror production infrastructure

### For RLS Type Safety (Problem 2)

- **Checklist:** Before writing any RLS policy, run `\d table_name` or check the CREATE TABLE migration to verify column types
- **Detection:** Integration tests with testcontainers catch type mismatches at parse time
- **Principle:** Schema-first code generation — never assume types from comments or similar tables
- **Agent brief addition:** "When writing RLS policies, ALWAYS check the actual column type in the CREATE TABLE migration. UUID columns use `auth.uid()`, TEXT columns use `auth.uid()::text`."

### For Dependency Vulnerabilities (Problems 3 & 4)

- **Checklist:** After any dependency update, run both `npm audit` AND `npx trivy fs .` locally
- **Detection:** CI runs both npm audit and Trivy filesystem scan
- **Principle:** npm audit misses transitive dev dependencies; Trivy catches them
- **For stale lockfiles:** If `npm audit fix` doesn't resolve a vulnerability, check for stale nested entries with `grep -r "vulnerable-package" package-lock.json` and regenerate if needed

### For AI Agent Schema Assumptions (Meta-Pattern)

- **Require agents to cite the specific migration file and line number** when referencing column types
- **Include a schema reference table** in agent briefs for tables being modified
- **Run integration tests** before pushing — they catch type mismatches that unit tests miss

---

## Cross-References

| Document                                                                              | Relevance                                          |
| ------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `docs/solutions/infrastructure-issues/pr111-cicd-pipeline-zero-failures-20260228.md`  | Prior CI pipeline recovery (PR #111)               |
| `docs/solutions/infrastructure-issues/dependency-update-pr99-patterns.md`             | Lockfile staleness and npm overrides (PR #99)      |
| `docs/solutions/test-failures/backend-test-mock-elimination-20260226.md`              | Testcontainers setup with Supabase stubs (PR #100) |
| `docs/solutions/security-issues/discovery-mvp-r2-postgrest-view-security-20260227.md` | PostgreSQL VIEW security and RLS patterns          |
| `docs/solutions/patterns/critical-patterns.md` Pattern #8                             | Test infrastructure integration points             |
| `docs/solutions/patterns/critical-patterns.md` Pattern #12                            | PostgreSQL VIEW Security Barrier                   |
| `docs/solutions/patterns/common-solutions.md` #27                                     | Environment validation in CI                       |

---

## Commits

| SHA       | Description                                                                     |
| --------- | ------------------------------------------------------------------------------- |
| `5c2911f` | fix(ci): resolve DB migration validation, test mocks, and integration failures  |
| `0655f03` | fix(ci): add Supabase roles to CI bootstrap and fix RLS uuid=text type mismatch |
| `f4128c1` | fix(ci): update undici to 7.24.3 to resolve HIGH severity CVEs                  |
| `b80dde6` | fix(ci): upgrade testcontainers to 11.12.0, eliminate undici 5.29 vulnerability |

## Timeline

- **CI Run 1:** DB Migration Validation FAILED + Integration Tests FAILED
- **CI Run 2:** DB Migration + Integration PASSED, Security Audit FAILED (undici 7.x)
- **CI Run 3:** npm audit PASSED, Trivy FAILED (undici 5.29.0)
- **CI Run 4:** ALL JOBS PASSED (12/12 green)
