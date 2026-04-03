---
title: 'Quality Sprint: Five Hard-Won Learnings from @ts-nocheck Removal, SSRF, Migrations, and Type Cascades'
date: 2026-03-31
category: workflow-issues
module: TypeScript cleanup, database migrations, webhook security, session manager schema sync
problem_type: workflow_issue
component: development_workflow
severity: high
applies_when:
  - Removing @ts-nocheck at scale across service layers
  - Replacing HTTP stubs with real fetch calls to untrusted URLs
  - Modifying database columns that have RLS policy dependencies
  - Refactoring Supabase services between domain types and DB column names
  - Cleaning type suppressions from services that have downstream consumers
tags:
  - ts-nocheck
  - ssrf
  - fetch-redirect
  - rls-policy
  - migration
  - supabase
  - schema-mismatch
  - type-cascade
  - quality-sprint
---

# Quality Sprint: Five Hard-Won Learnings

## Context

During a quality sprint on Sovren (7 PRs, #212-216), we removed @ts-nocheck from 35+ files, replaced a WebhookService HTTP stub with real fetch, fixed a DB migration blocked by RLS policies, and resolved a P0 schema mismatch in DatabaseSessionManager. Each task surfaced a non-obvious failure mode that would have been missed without CE review.

## Guidance

### 1. @ts-nocheck "Zero Errors" Is a Measurement Trap

**Never trust error counts measured with @ts-nocheck still in place.** The directive suppresses ALL TypeScript compiler errors AND all `@typescript-eslint/*` ESLint rules. Running `tsc --noEmit` on a file that has `// @ts-nocheck` will always report zero errors — that's what the directive does.

The correct measurement: remove the directive, THEN count errors. When we actually did this for the 6 "easiest" target files, every one had 8-29 real errors.

**Rule:** Before claiming a file has "zero suppressed errors," verify by removing `@ts-nocheck` in a temporary branch and running both `tsc` and `eslint`.

### 2. SSRF Pre-Flight Validation Needs `redirect: 'error'`

Calling `validateSsrfUrl(url)` before `fetch(url)` is necessary but insufficient. `fetch` follows HTTP redirects by default — an attacker's webhook URL passes validation, then returns a `301` to `http://169.254.169.254/` (cloud metadata). `fetch` silently follows it, bypassing the pre-flight check entirely.

**Three-part fix for untrusted URLs:**

1. `redirect: 'error'` on the fetch options (blocks all redirects)
2. `createSsrfSafeAgent()` for DNS pinning (prevents TOCTOU between validation and fetch)
3. Response body size cap (`response.text().slice(0, 1_048_576)`) to prevent OOM from malicious endpoints

Also: `AbortError` detection should check `error instanceof Error && error.name === 'AbortError'` (not `DOMException`) — Node.js versions vary in which class they throw.

### 3. DB Migration + RLS = Drop-Recreate with Idempotency

PostgreSQL refuses `DROP COLUMN` when RLS policies reference the column. The error is `cannot drop column X because other objects depend on it`. The fix is a three-step dance:

1. `DROP POLICY IF EXISTS` for each dependent policy
2. Alter the column (add temp, populate, drop old, rename)
3. `CREATE POLICY` with updated type comparison

**Critical idempotency requirements:**

- The UPDATE that populates the temp column must run unconditionally — NOT inside the "add column if not exists" guard. A prior failed run may have added the column but crashed before populating all rows.
- Orphaned rows (no matching user in the lookup join) must be explicitly handled — either DELETE or RAISE EXCEPTION — before applying NOT NULL.
- `information_schema.table_constraints` queries should filter by `table_schema = 'public'` to avoid false negatives from other schemas.

### 4. DB Operations Use DB Column Names, Not Domain Names

When refactoring a Supabase service, it's tempting to use domain-type field names (camelCase) everywhere. But Supabase `.insert()`, `.update()`, `.eq()`, `.order()` operate on **database column names** (snake_case).

**P0 example from this sprint:** DatabaseSessionManager was refactored to use `active` and `last_activity_at` (Session domain fields) in Supabase operations. The actual DB columns are `is_active` and `last_activity`. Result: inserts wrote to non-existent columns, `getSessionStats` read stale data — all silently.

**Rule:** All Supabase query/mutation calls use `SessionRow` field names. Domain mapping happens exclusively in `mapRowToSession()` / `toBusinessInvoice()` and similar mappers. Never mix layers.

### 5. @ts-nocheck Removal Cascades Through Consumers

Removing `@ts-nocheck` from a service changes its exported type signatures. Consumers that called non-existent methods or used wrong return types were invisible under the suppression. Touching a consumer file (even one line) makes CI check ALL its errors.

**Example:** ContentModerationService had `moderate()` but ContentController called `moderateContent()`. With @ts-nocheck, this compiled. After removal, fixing the one call in ContentController exposed 35 pre-existing errors.

**Strategy:** Fix consumers fully in a dedicated PR FIRST, then clean the service files. Never touch a consumer as a "quick fix" — it triggers a cascade.

## Why This Matters

- **Measurement trap (#1):** Wrong error counts produce wrong plans. Squad B was briefed "zero errors, just delete the directive" and couldn't clean a single file.
- **SSRF bypass (#2):** Cloud metadata exposure is a real-world vulnerability class. AWS IMDSv1 is reachable via redirect from any SSRF vector.
- **Migration failures (#3):** Blocked CI for weeks. The fix was 3 SQL statements but took multiple review rounds to get idempotency right.
- **Schema mismatch (#4):** A P0 that would have broken session creation for all users in production.
- **Type cascade (#5):** Blocks parallel work. Can't clean services until consumers are fixed.

## When to Apply

- Before any @ts-nocheck removal sprint: verify error counts with directive removed
- Any `fetch` call to a user-provided or externally-configured URL: add `redirect: 'error'`
- Any DB migration touching columns referenced by RLS policies
- Any Supabase service refactoring that maps between domain types and DB types
- Any TypeScript cleanup that removes type suppressions from files with downstream consumers

## Examples

**SSRF fix — before and after:**

```
// BEFORE (vulnerable to redirect bypass)
await validateSsrfUrl(url);
const response = await fetch(url, { method: 'POST', headers, body });

// AFTER (redirect blocked, body capped)
await validateSsrfUrl(url);
const response = await fetch(url, {
  method: 'POST', headers, body,
  redirect: 'error',
  signal: controller.signal,
});
const responseBody = (await response.text()).slice(0, 1_048_576);
```

**Migration RLS dance:**

```sql
-- 1. Drop blocking policies
DROP POLICY IF EXISTS "my_policy" ON my_table;

-- 2. Always re-populate (not inside IF NOT EXISTS guard)
UPDATE my_table SET new_col = ... WHERE new_col IS NULL;

-- 3. Handle orphans before NOT NULL
DELETE FROM my_table WHERE new_col IS NULL;

-- 4. Recreate policies with new type
CREATE POLICY "my_policy" ON my_table USING (col = auth.uid());
```

**Supabase layer separation:**

```
// WRONG: domain names in DB operation
await supabase.from('sessions').update({ active: false, last_activity_at: Date.now() });

// RIGHT: DB column names in DB operation
await supabase.from('sessions').update({ is_active: false, last_activity: new Date().toISOString() });

// Domain mapping happens here only:
function mapRowToSession(row: SessionRow): Session {
  return { active: row.is_active, last_activity_at: new Date(row.last_activity).getTime(), ... };
}
```

## Related

- docs/solutions/workflow-issues/ts-nocheck-bulk-removal-cascade-pattern-20260330.md — Prior sprint's @ts-nocheck methodology (file-by-file approach, CI threshold management)
- docs/solutions/patterns/critical-patterns.md #5 — SSRF prevention pattern
- docs/solutions/remediation/ci-production-readiness-audit-2026-03-17.md — RLS type verification, lockfile regeneration
- docs/solutions/security-issues/discovery-mvp-r2-postgrest-view-security-20260227.md — RLS policy security
- PRs: #212-216 (this sprint's work)
