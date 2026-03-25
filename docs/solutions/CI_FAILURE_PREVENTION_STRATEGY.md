---
title: CI Failure Prevention Strategy — PR #164 Production Readiness Audit
date: '2026-03-17'
category: prevention
purpose: Systematic prevention strategies for 4 recurring CI failures during production-readiness audit
severity: P1 — Blocks production deployments
---

# CI Failure Prevention Strategy

## Executive Summary

PR #164 production-readiness audit surfaced 4 distinct classes of CI failures that block production deployments. Each class has a specific root cause, detection mechanism, and prevention strategy.

| Failure Class | Cause                                  | Impact                                            | Prevention Mechanism                                       |
| ------------- | -------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------- |
| **Problem 1** | Missing Supabase roles in CI bootstrap | Migration failures during test setup              | Schema parity audit, CI role injection checklist           |
| **Problem 2** | AI agent type mismatch (TEXT vs UUID)  | RLS policy failures in production                 | Schema-first code review + type inference linting          |
| **Problem 3** | Stale vulnerability in undici 7.x      | Security gate blocks CI, production cannot deploy | Nested dependency monitoring + pre-commit audit check      |
| **Problem 4** | Stale nested lockfile dependencies     | npm audit fails despite root overrides            | Lockfile regeneration automation, npm workspace validation |

---

## Problem 1: Missing Supabase Roles in CI Bootstrap

### Root Cause Analysis

**What happened:**

- CI pipeline spins up bare PostgreSQL via testcontainers in `.github/workflows/ci.yml` (lines 193-206)
- The bare database lacks Supabase-specific stubs: `anon`, `authenticated`, `service_role` roles
- Migrations reference these roles with statements like `GRANT EXECUTE ON FUNCTION ... TO authenticated`
- The testcontainers global setup (`packages/backend/src/__tests__/setup/testcontainers-global-setup.ts`) has these role definitions but CI bootstrap didn't mirror them
- Result: Migrations fail during integration tests, blocking the entire CI pipeline

**Why it was missed:**

1. The setup file and CI bootstrap were maintained in separate places
2. No cross-reference validation between testcontainers setup and CI bootstrap
3. No explicit "parity contract" between test infrastructure and CI services

---

### Prevention Checklist

**Phase 1: Audit (Before Next Feature Sprint)**

- [ ] Read entire CI workflow file (`.github/workflows/ci.yml`)
- [ ] Read testcontainers global setup file (`packages/backend/src/__tests__/setup/testcontainers-global-setup.ts`)
- [ ] List all database objects created in testcontainers setup:
  - [ ] Schema creation (auth, public, etc.)
  - [ ] Functions (auth.uid(), auth.role())
  - [ ] Roles (anon, authenticated, service_role)
  - [ ] Extensions enabled
- [ ] Compare against CI PostgreSQL service setup (lines 193-206 of ci.yml)
- [ ] Check migrations for GRANT statements that require specific roles

**Phase 2: Implementation (Synchronization)**

For **every role/function/schema** created in testcontainers setup:

1. Check if it's present in CI PostgreSQL bootstrap
2. If missing, add to CI workflow as a pre-test step (before `npm run test:integration`)
3. Add comment linking to testcontainers file for future maintainers

**Phase 3: Testing (Validation)**

- [ ] Run `npm run test:integration` locally 3 times to ensure consistency
- [ ] Push to feature branch, verify CI integration tests pass
- [ ] Check logs: no "role does not exist" errors
- [ ] Verify all migration files execute without errors

**Phase 4: Documentation (Maintenance Contract)**

- [ ] Update `.github/workflows/ci.yml` with comment block listing all Supabase stubs
- [ ] Update `packages/backend/src/__tests__/setup/testcontainers-global-setup.ts` header with backward-reference to CI workflow
- [ ] Add to CI/CD runbook: "After adding new roles, functions, or schemas to Supabase, sync them to both testcontainers setup AND ci.yml PostgreSQL service bootstrap"

---

### Detection Mechanism

**Where to catch this:**

1. **Pre-commit hook** — New linting rule:

   ```bash
   # Check for GRANT statements in migrations that reference roles
   grep -r "GRANT.*TO (anon|authenticated|service_role)" supabase/migrations/

   # Verify each role exists in CI bootstrap
   for role in anon authenticated service_role; do
     grep -q "CREATE ROLE $role" .github/workflows/ci.yml || echo "FAIL: $role missing in CI"
   done
   ```

2. **CI Integration Test Gate** — Add pre-test validation step:

   ```yaml
   - name: Validate database role parity
     run: |
       # Extract roles from migrations
       MIGRATION_ROLES=$(grep -h "GRANT.*TO" supabase/migrations/*.sql | \
         grep -oE "(TO|to) [a-z_]+" | awk '{print $2}' | sort -u)

       # Verify CI has those roles
       for role in $MIGRATION_ROLES; do
         if ! grep -q "CREATE ROLE $role" .github/workflows/ci.yml; then
           echo "ERROR: Role '$role' used in migrations but missing in CI bootstrap"
           exit 1
         fi
       done
   ```

3. **Schema Auditor Script** — New utility in `scripts/`:

   ```bash
   # scripts/validate-schema-parity.sh
   # Compares testcontainers setup with CI bootstrap
   # Reports mismatches with line numbers and suggested fixes
   ```

4. **Code Review Checklist** — In PR template, add:
   - [ ] If modifying `supabase/migrations/*.sql`: verified GRANT roles exist in `testcontainers-global-setup.ts`
   - [ ] If modifying `testcontainers-global-setup.ts`: updated `.github/workflows/ci.yml` to match
   - [ ] If adding new Supabase roles/functions: updated both files synchronously

---

### Best Practice

**Principle: Test Infrastructure Must Mirror Production Infrastructure**

The contract: Testcontainers setup is the **source of truth** for Supabase stub definitions. CI must maintain parity.

1. **Single Source of Truth**: Define Supabase stubs once, in testcontainers setup
2. **CI as Mirror**: CI bootstrap must contain an explicit comment listing all objects from testcontainers
3. **Bidirectional Validation**: Every migration and every role definition must validate against both the testcontainers setup AND the CI bootstrap
4. **Runbook Entry**: Document this contract in the CI/CD runbook so future maintainers understand the parity requirement

**When writing migrations that reference roles:**

```sql
-- Requires roles: anon, authenticated, service_role
-- These MUST be defined in:
--   1. packages/backend/src/__tests__/setup/testcontainers-global-setup.ts
--   2. .github/workflows/ci.yml (PostgreSQL service bootstrap)
GRANT EXECUTE ON FUNCTION delete_all_wellness_data TO authenticated;
```

---

## Problem 2: RLS Type Mismatch (UUID vs TEXT creator_id)

### Root Cause Analysis

**What happened:**

- Security-hardener agent audited RLS policies and assumed `creator_id` was always TEXT
- Added casts: `.where('creator_id::text = auth.uid()::text')`
- Only 4 tables have TEXT creator_id; the other 18+ have UUID
- Type mismatch: `auth.uid()` returns UUID, you cannot safely cast UUID to text for comparison
- Result: RLS policy fails or silently allows/denies wrong users depending on cast behavior

**Why it was missed:**

1. Agent didn't inspect actual schema before generating fixes
2. No type checking on RLS policy expressions during code review
3. No schema-driven code generation safeguards

---

### Prevention Checklist

**Phase 1: Schema Audit (Before Delegating Schema Modifications to Agents)**

- [ ] Extract actual column types from schema:

  ```sql
  SELECT table_name, column_name, data_type
  FROM information_schema.columns
  WHERE column_name = 'creator_id'
  ORDER BY table_name;
  ```

- [ ] Document actual types in accessible format (e.g., `docs/schema/creator_id_types.md`):

  ```
  | Table | creator_id Type | Notes |
  |-------|-----------------|-------|
  | users | UUID | Primary key |
  | posts | UUID | Foreign key reference |
  | platform_connections | TEXT | External ID, not FK |
  ```

- [ ] Run TypeScript type inference on this data:

  ```typescript
  type CreatorIdType = {
    [table: string]: 'UUID' | 'TEXT';
  };

  const creatorIdTypes: CreatorIdType = {
    users: 'UUID',
    posts: 'UUID',
    platform_connections: 'TEXT',
    // ... validate all tables
  };
  ```

**Phase 2: Code Review Hardening**

When reviewing RLS policy changes or agent-generated code:

- [ ] Extract all `.creator_id` column references from the diff
- [ ] For each reference, verify against `docs/schema/creator_id_types.md`:
  - [ ] If `creator_id` is UUID, RLS must use: `.eq('creator_id', auth.uid())`
  - [ ] If `creator_id` is TEXT, RLS must use: `.eq('creator_id', auth.uid()::text)` AND document why
- [ ] Check for unsafe casts like `::text` on UUID comparisons
- [ ] Verify no implicit type coercion is happening

**Phase 3: Type Safety Linting**

Add ESLint rule to catch RLS mismatches (requires custom plugin):

```typescript
// Custom ESLint rule: rls-creator-id-type-match.ts
module.exports = {
  meta: {
    type: 'problem',
    docs: { description: 'Ensure creator_id RLS filters match actual column type' },
  },
  create(context) {
    return {
      CallExpression(node) {
        // Detect patterns like .eq('creator_id', ...)
        // Look up actual column type from schema doc
        // Verify cast compatibility
      },
    };
  },
};
```

**Phase 4: Agent Brief Hardening**

When delegating schema/RLS work to agents:

- [ ] Include schema parity doc in brief: `docs/schema/creator_id_types.md`
- [ ] Add explicit instruction: "Do NOT assume all columns named creator_id have the same type"
- [ ] Provide code snippet of correct RLS patterns for both UUID and TEXT:

  ```typescript
  // UUID creator_id (majority case)
  .eq('creator_id', auth.uid())

  // TEXT creator_id (external IDs only)
  .eq('creator_id', auth.uid()::text)
  ```

- [ ] Require type verification in agent checklist

**Phase 5: Validation (Before Merge)**

- [ ] Run migration on production-like database (can use pg_restore of snapshot)
- [ ] Test RLS policies with both valid and invalid user IDs
- [ ] Verify no type casting errors in logs

---

### Detection Mechanism

**Where to catch this:**

1. **Schema Type Analyzer** — New CI check:

   ```bash
   # scripts/validate-rls-types.sh
   # 1. Extract creator_id types from all tables
   # 2. Find all RLS policy references to creator_id
   # 3. Verify type compatibility
   # 4. Report mismatches with table name and line number
   ```

2. **Code Review Bot Comment** — Post automated analysis on PRs:

   ```
   RLS Policy Type Check:
   ✓ posts.creator_id (UUID) → .eq('creator_id', auth.uid()) [correct]
   ✗ platform_connections.creator_id (TEXT) → .eq('creator_id', auth.uid()) [incorrect cast]
   ```

3. **Migration Dry-Run** — Pre-merge validation:

   ```bash
   # Run migration against test database
   # Check for type errors during POLICY creation
   npm run test:integration -- --grep "RLS policies"
   ```

4. **TypeScript Type Narrowing** — In code generator:
   ```typescript
   // When generating RLS filters, check schema types
   function generateRlsFilter(table: string, authColumn: string): string {
     const columnType = schemaTypes[table][authColumn];
     if (columnType === 'UUID') return `.eq('${authColumn}', auth.uid())`;
     if (columnType === 'TEXT') return `.eq('${authColumn}', auth.uid()::text)`;
     throw new Error(`Unknown type for ${table}.${authColumn}`);
   }
   ```

---

### Best Practice

**Principle: Schema-First Code Generation**

Never assume column types based on naming conventions. Always validate against the actual schema.

1. **Document Column Type Variance**: For columns like `creator_id` that have different types across tables, document this explicitly in `docs/schema/`
2. **Type Lookup Before Coding**: Before writing RLS policies or update statements, look up the actual column type
3. **Unsafe Cast Detection**: Flag any cast operations (`::<type>`) in code review — they indicate a type mismatch that should be fixed at schema level, not papered over with casts
4. **Agent Safeguards**: When delegating schema work, include:
   - Canonical schema doc
   - Correct code pattern for each type variant
   - Explicit prohibition on assuming types based on naming

**When writing RLS policies:**

```sql
-- CORRECT: Lookup actual creator_id type first
-- For UUID columns:
CREATE POLICY "Users can access own posts"
  ON posts
  FOR SELECT
  USING (creator_id = auth.uid());

-- For TEXT columns (document why):
CREATE POLICY "Users can access own connections"
  ON platform_connections
  FOR SELECT
  USING (creator_id = auth.uid()::text);
  -- NOTE: creator_id is TEXT for external API IDs, not Supabase UUID foreign key
```

---

## Problem 3: Stale Vulnerability in undici 7.x

### Root Cause Analysis

**What happened:**

- undici library version 7.x has HIGH severity vulnerability
- `npm audit --audit-level=high` detects this in CI (`security` job, line 172)
- Root package.json has override: `"undici": ">=6.0.0"` (line from previous fix attempt)
- testcontainers dependency chain pulls undici 5.29.0, but other dependencies want newer versions
- Conflict: root override says >=6.0.0, but testcontainers transitively pulls 5.29.0
- CI fails on npm audit
- Simple `npm audit fix` resolves by updating undici to 8.x

**Why it was missed:**

1. Override was too permissive (`>=6.0.0` allows both secure and insecure versions)
2. No transitive dependency validation
3. No distinction between production and dev dependencies in audit scanning

---

### Prevention Checklist

**Phase 1: Identify Stale Dependencies**

- [ ] Run `npm audit --audit-level=high`:

  ```bash
  npm audit --audit-level=high --omit=dev
  ```

- [ ] For each HIGH vulnerability:
  - [ ] Note the package name, current version, required version
  - [ ] Check root `package.json` overrides to see if it's already managed
  - [ ] If override exists, verify it enforces minimum safe version

- [ ] Run full transitive dependency check:
  ```bash
  npm ls undici
  # Shows all paths to undici across workspace
  ```

**Phase 2: Fix Stale Overrides**

For each stale override (allows old versions):

1. Find current minimum safe version from npm registry:

   ```bash
   npm view undici versions | tail -20
   ```

2. Update override to enforce minimum safe version:

   ```json
   {
     "overrides": {
       "undici": ">=8.0.0" // Was >=6.0.0, now enforces secure version
     }
   }
   ```

3. Update nested lockfile:

   ```bash
   npm install  # Regenerates package-lock.json with new constraints
   ```

4. Validate fix:
   ```bash
   npm audit --audit-level=high
   npm ls undici
   ```

**Phase 3: Pre-Merge Validation**

- [ ] Verify `npm audit fix` output shows vulnerability resolved
- [ ] Run `npm test` to ensure new version doesn't break anything
- [ ] Check CI security gate passes: `npm audit --audit-level=high`

**Phase 4: Preventive Automation**

Add to CI (`security` job, after line 172):

```yaml
- name: Validate npm audit fixes
  run: |
    # Record current vulns
    BEFORE=$(npm audit --json 2>/dev/null | jq '.vulnerabilities | length')

    # Apply fixes
    npm audit fix --force

    # Verify improvement
    AFTER=$(npm audit --json 2>/dev/null | jq '.vulnerabilities | length')

    if [ "$AFTER" -gt 0 ]; then
      echo "::warning::$AFTER unresolved vulnerabilities remain"
      npm audit
      exit 1
    fi

    # Ensure lockfile is clean
    git diff --exit-code package-lock.json || {
      echo "::error::npm audit fix modified package-lock.json unexpectedly"
      exit 1
    }
```

---

### Detection Mechanism

**Where to catch this:**

1. **CI Security Gate** (enhanced):

   ```bash
   # .github/workflows/ci.yml security job
   - name: npm audit (production + dev)
     run: |
       # Check production deps
       npm audit --audit-level=high --omit=dev

       # Check dev deps
       npm audit --audit-level=critical --include=dev

       # Check for stale overrides
       npm audit --json | jq '.vulnerabilities | to_entries[] |
         select(.value.via[]?.type == "overrideBefore") |
         "WARN: Override allows vulnerable version: \(.key)"'
   ```

2. **Dependency Monitoring Service** (external):
   - Subscribe to Dependabot alerts (GitHub native)
   - Or use Snyk/WhiteSource for continuous monitoring
   - Alert threshold: HIGH or CRITICAL vulnerabilities

3. **Lockfile Validation** — Ensure no stale nested deps:

   ```bash
   # Pre-commit hook
   npm ls undici | grep -q "5\.29\.0" && {
     echo "ERROR: Stale undici 5.29.0 detected in lockfile"
     echo "Run: npm install"
     exit 1
   }
   ```

4. **Override Strictness Rule** — In code review:
   - [ ] All overrides must pin to major version or higher: `>=X.Y.Z`
   - [ ] Never use `^` or `~` in overrides (allows downgrade)
   - [ ] Add comment explaining why override exists:
     ```json
     {
       "overrides": {
         "undici": ">=8.0.0" // CVE-2024-XXXXX: undici <8.0.0 allows XXX
       }
     }
     ```

---

### Best Practice

**Principle: Explicit Vulnerability Enforcement at Root**

Don't rely on transitive dependency resolution. Explicitly enforce secure versions via overrides.

1. **Override All High-Risk Packages**: For packages that have had vulnerabilities (http, crypto, compression libs), use overrides to pin minimum safe versions
2. **Audit Before Every Release**: Run `npm audit --audit-level=high` as pre-merge CI check
3. **Document Overrides**: Every override must have a comment explaining the vulnerability it fixes
4. **Lockfile as Source of Truth**: Keep `package-lock.json` in git and regenerate only when intentionally updating dependencies
5. **Regular Rotation**: Monthly review of `npm audit` results and vulnerability advisories

**When discovering a new vulnerability:**

```json
{
  "overrides": {
    "vulnerable-package": ">=X.Y.Z"
    // Blocks vulnerable-package <X.Y.Z
    // CVE-2024-XXXXX: [vulnerability description]
    // Announcement: [link to advisory]
    // Fixed by: npm audit fix (applied YYYY-MM-DD)
  }
}
```

---

## Problem 4: Stale Nested Lockfile Dependencies

### Root Cause Analysis

**What happened:**

- Root `package.json` has override: `"undici": ">=6.0.0"`
- packages/backend has `"@testcontainers/postgresql": "^10.28.0"` which transitively pulls undici 5.29.0
- Root override says >=6.0.0, but nested lockfile has 5.29.0 pinned
- `npm install` doesn't regenerate lockfile because it's cached
- `npm audit fix` fails because the fix requires lockfile regeneration
- `npm update` fails because testcontainers version is too old
- Manual lockfile editing fails because of npm's integrity checks
- **Only solution: Full lockfile regeneration** (`rm package-lock.json && npm install`)

**Why it was missed:**

1. Root overrides don't cascade to nested `package-lock.json` files
2. npm workspace inconsistency between root and nested packages
3. No pre-merge validation of lockfile consistency across workspace

---

### Prevention Checklist

**Phase 1: Audit (Quarterly)**

- [ ] Check for stale lockfiles across workspace:

  ```bash
  for pkg in packages/*/package-lock.json; do
    echo "=== $pkg ==="
    npm ls undici --prefix=$(dirname $pkg)
  done
  ```

- [ ] Verify root overrides are reflected in nested lockfiles:

  ```bash
  npm audit --json | jq '.vulnerabilities'
  # Should show 0 vulns if overrides are effective
  ```

- [ ] Run workspace-wide audit:
  ```bash
  npm audit --workspaces
  ```

**Phase 2: Prevention Automation**

Add pre-commit hook (`scripts/validate-lockfile.sh`):

```bash
#!/bin/bash
# Validate lockfile consistency across workspace

echo "Checking lockfile parity..."

# 1. Verify root overrides are present in all nested lockfiles
ROOT_OVERRIDES=$(jq '.overrides' package.json)

for pkg in packages/*/package.json; do
  PKG_DIR=$(dirname "$pkg")
  echo "Validating $PKG_DIR..."

  # Check if root overrides are reflected
  npm ls --prefix="$PKG_DIR" undici | grep -q "5\.29\.0" && {
    echo "ERROR: $PKG_DIR has stale undici 5.29.0"
    echo "SOLUTION: rm $PKG_DIR/package-lock.json && npm install --prefix=$PKG_DIR"
    exit 1
  }
done

# 2. Verify no nested packages override root overrides
for pkg_lock in packages/*/package-lock.json; do
  jq '.overrides' "$pkg_lock" 2>/dev/null | grep -q . && {
    echo "ERROR: $pkg_lock has local overrides (use root only)"
    exit 1
  }
done

echo "Lockfile validation passed"
```

**Phase 3: CI Validation Gate**

Add to `.github/workflows/ci.yml` (`security` job, after npm audit):

```yaml
- name: Validate workspace lockfile parity
  run: |
    # Check for stale nested lockfiles
    for pkg in packages/*/package.json; do
      PKG_DIR=$(dirname "$pkg")
      npm audit --json --prefix="$PKG_DIR" | \
        jq '.vulnerabilities | length' | \
        grep -q '^[1-9]' && {
          echo "::error::$PKG_DIR has unresolved vulnerabilities"
          npm audit --prefix="$PKG_DIR"
          exit 1
        }
    done

    # Ensure no nested package-lock.json has overrides
    for pkg_lock in packages/*/package-lock.json; do
      if [ -f "$pkg_lock" ]; then
        jq '.overrides' "$pkg_lock" 2>/dev/null | grep -q '[a-z]' && {
          echo "::error::$pkg_lock must not have local overrides"
          exit 1
        }
      fi
    done
```

**Phase 4: Regeneration Protocol**

When lockfile becomes inconsistent:

1. **Identify problem**:

   ```bash
   npm audit
   # Reports: undici 5.29.0 found, override requires >=6.0.0
   ```

2. **Regenerate affected package lockfile**:

   ```bash
   cd packages/backend
   rm package-lock.json
   npm install
   ```

3. **Verify fix**:

   ```bash
   npm audit --prefix=packages/backend
   npm ls undici --prefix=packages/backend
   ```

4. **Root lockfile regeneration** (if needed):

   ```bash
   # Only if multiple packages are affected
   cd /repo/root
   rm package-lock.json
   npm install --workspaces
   ```

5. **Verify all packages**:
   ```bash
   npm audit --workspaces
   npm ls undici --workspaces
   ```

---

### Detection Mechanism

**Where to catch this:**

1. **Pre-Commit Validation** (runs on every commit):

   ```bash
   # .husky/pre-commit (or similar)
   ./scripts/validate-lockfile.sh
   ```

2. **CI Lockfile Health Check** (enforced before merge):

   ```yaml
   - name: Workspace lockfile health
     run: npm audit --workspaces --audit-level=high
   ```

3. **Nested Package Audit** (per-package validation):

   ```bash
   # For each package in workspace
   for pkg in packages/*/; do
     npm audit --prefix="$pkg" --audit-level=high || exit 1
   done
   ```

4. **npm-check-updates** (optional, for monitoring):
   ```bash
   # Detect outdated dependencies across workspace
   npx npm-check-updates --workspaces
   ```

---

### Best Practice

**Principle: Root Overrides + Workspace Validation = Lockfile Consistency**

The workspace has a single override strategy enforced at the root. Nested packages must inherit this, never override locally.

1. **Central Override Authority**: All overrides live in root `package.json` only
2. **No Nested Overrides**: Nested packages cannot have their own `overrides` field
3. **Audit All Packages**: CI validates `npm audit` passes for all workspace packages
4. **Regenerate Together**: When regenerating a nested lockfile, verify root lockfile is also up to date
5. **Document Override Purpose**: Every override must include a comment explaining what vulnerability it blocks

**Workflow for adding an override:**

1. Identify vulnerability from `npm audit --workspaces`
2. Add to root `package.json` with comment:
   ```json
   {
     "overrides": {
       "undici": ">=8.0.0"
       // CVE-2024-XXXXX: undici <8.0.0 allows HTTP smuggling
       // Affects: @testcontainers/postgresql transitively
     }
   }
   ```
3. Regenerate all lockfiles:
   ```bash
   rm packages/*/package-lock.json package-lock.json
   npm install --workspaces
   ```
4. Verify no vulnerabilities remain:
   ```bash
   npm audit --workspaces --audit-level=high
   ```

---

## Meta-Pattern: AI Agent-Generated Code with Incorrect Schema Assumptions

### Root Cause (Problem 2 Generalized)

When delegating code generation to AI agents (security hardener, auto-fixer, refactorer):

1. **Agent lacks full context** — Makes assumptions based on naming (e.g., `creator_id = TEXT everywhere`)
2. **Agent doesn't validate assumptions** — No schema introspection step before code generation
3. **Code passes syntax check** — TypeScript doesn't catch type mismatches in dynamic SQL
4. **Only caught in runtime/review** — By which time the code is in a PR

---

### Prevention Strategy for AI Agent Code

**Before delegating work to an AI agent, provide:**

1. **Schema Document** — Canonical list of all relevant tables, columns, and types:

   ```markdown
   # Schema Reference for [Agent Task]

   ## creator_id Variance

   | Table                | Type | Usage        | Notes                      |
   | -------------------- | ---- | ------------ | -------------------------- |
   | users                | UUID | Primary key  | Supabase auth.users        |
   | posts                | UUID | FK reference | Normalized ID              |
   | platform_connections | TEXT | External ID  | Third-party API ID, not FK |
   ```

2. **Correct Code Pattern** — Show the exact pattern for each variant:

   ```typescript
   // Pattern 1: UUID columns (majority)
   .eq('creator_id', auth.uid())

   // Pattern 2: TEXT columns (external IDs)
   .eq('creator_id', auth.uid()::text)  // With explanation
   ```

3. **Prohibition on Assumptions** — Explicit instruction:

   ```
   DO NOT assume column types based on naming convention.
   ALWAYS look up the actual type from the schema doc above.
   If the schema doc doesn't list a table, ask before proceeding.
   ```

4. **Validation Checklist** — Agent must verify:
   - [ ] For each `creator_id` reference, verified actual type in schema doc
   - [ ] Code pattern matches the correct variant (UUID vs TEXT)
   - [ ] No unsafe casts (`::<type>`) on type-mismatched comparisons
   - [ ] All RLS policies use consistent type handling

5. **Post-Generation Code Review** — Reviewer checks:
   - [ ] Agent-generated code matches one of the documented patterns
   - [ ] No deviations from approved patterns without explanation
   - [ ] Schema assumptions validated against actual schema

---

### Detection via Code Review

**When reviewing agent-generated code, ask:**

1. **Schema Assumption Check**:

   ```
   Q: How did you determine the type of [column_name]?
   A: I looked at [schema_doc_reference]
   ```

2. **Pattern Conformance**:

   ```
   Q: Why did you use [specific pattern]?
   A: Because [column_name] is [type], which requires [pattern]
   ```

3. **Variance Handling**:

   ```
   Q: Did you check all tables that have this column?
   A: Yes, verified in [file]. Only TABLE_X uses TEXT variant because [reason].
   ```

4. **Type Safety**:
   ```
   Q: Are there any casts in your code?
   A: Only [specific cast], required because [reason]. Verified type safety with [method].
   ```

---

## Summary: Prevention Checklist Across All 4 Problems

### Before Committing Code

- [ ] **Problem 1**: If touching migrations, verified Supabase roles exist in both:
  - testcontainers setup file
  - CI bootstrap (`.github/workflows/ci.yml`)
- [ ] **Problem 2**: If generating RLS policies or touching schema:
  - Looked up actual column types (didn't assume based on naming)
  - Verified type compatibility in RLS filters
  - No unsafe casts without documented reason
- [ ] **Problem 3**: Ran `npm audit --audit-level=high`:
  - No vulnerabilities reported
  - Overrides enforce minimum safe versions
- [ ] **Problem 4**: Ran `npm audit --workspaces`:
  - All packages report 0 high/critical vulnerabilities
  - No stale nested lockfiles
  - All overrides in root, not nested

### Before Merging PR

- [ ] CI integration tests pass (includes testcontainers setup)
- [ ] CI security audit passes (npm audit gate)
- [ ] Code review verified all 4 problem areas above
- [ ] If agent-generated code: reviewer checked schema assumptions against docs

### Before Deploying to Production

- [ ] Staging deployment health checks pass
- [ ] All migrations execute successfully
- [ ] RLS policies verified with test queries against production schema
- [ ] Vulnerability scans (npm audit, Trivy) report 0 issues

---

## Runbook References

- **CI/CD Automation**: `docs/solutions/prevention-ci-cd-automation.md`
- **Critical Patterns**: `docs/solutions/patterns/critical-patterns.md`
- **Common Solutions**: `docs/solutions/patterns/common-solutions.md`
- **Deployment Integration**: `docs/development/DEPLOYMENT_INTEGRATION_STANDARDS.md`
