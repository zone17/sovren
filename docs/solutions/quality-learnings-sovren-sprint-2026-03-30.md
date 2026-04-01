---
module: Quality Assurance & Measurement
date: 2026-03-30
problem_type: best_practice
component: testing_framework
severity: high
tags:
  - type-checking
  - measurement-methodology
  - testing-strategy
applies_when:
  - Refactoring code with existing suppression directives (@ts-nocheck, etc)
  - Measuring progress on legacy code cleanup
  - Planning error reduction work
  - Reviewing code that uses SSRF validation
  - Working with database migrations involving constraints
  - Managing Supabase service layers with type mismatch risks
  - Consuming types from modified service exports
---

# Sovren Quality Sprint Learnings 2026-03-30

## Context

Quality sprint shipped 7 PRs (#212-216) targeting @ts-nocheck reduction, SSRF hardening, and type safety in Supabase services. Key insight: **measurement must happen under the same conditions as implementation**. Five distinct patterns emerged.

## Learning 1: @ts-nocheck Measurement is Self-Defeating

**The pattern:** When a file has `@ts-nocheck` at the top, running `tsc` on it reports zero errors by definition — the directive suppresses all type-checking. So reporting "45 files have zero tsc errors" while @ts-nocheck is still in place is circular reasoning.

**The correct approach:**
1. Remove @ts-nocheck from the target file
2. Run `tsc` immediately 
3. Count real errors (not in a pre-sanitized state)
4. Fix errors in that file
5. Repeat for next file

**Why this matters:** Research reported "all 45 files are error-free" but when Squad B actually removed the directives, every file had 8-29 errors. No progress had actually been made — the measurement tool was blind. Planning the next sprint based on this metric would have been wasteful.

**When to apply:**
- Bulk suppression removal (@ts-nocheck, eslint-disable, allow-any, etc)
- Measuring progress on legacy code cleanup
- Comparing before/after in a refactor

**Detection rule:** If your metric depends on the very suppression you're trying to remove, the metric is invalid. Measure after removal, not before.

---

## Learning 2: SSRF Pre-Flight Validation ≠ SSRF Safety

**The pattern:** WebhookService had `validateSsrfUrl()` called before `fetch()`, creating a false sense of security. But HTTP clients follow redirects by default:
- URL passes SSRF validation (e.g., `https://example.com`)
- Server returns `301 Moved Permanently` to `http://169.254.169.254/`
- `fetch()` silently follows the redirect
- Attacker gains metadata endpoint access

Additionally:
- Response body has no size limit — malicious endpoint can stream infinite data → OOM
- SSRF library exports `createSsrfSafeAgent()` for DNS pinning but wasn't being used

**The correct approach:**
```javascript
// Add redirect: 'error' to ALL fetch calls to untrusted URLs
const response = await fetch(webhookUrl, {
  redirect: 'error',  // Reject all redirects
  signal: AbortSignal.timeout(5000)  // Timeout guard
});

// Cap response body size
const bodyLimit = 1 * 1024 * 1024;  // 1MB max
const buffer = await response.arrayBuffer();
if (buffer.byteLength > bodyLimit) {
  throw new Error('Response too large');
}

// For DNS pinning, use the library's provided agent
const safeAgent = createSsrfSafeAgent();
const response = await fetch(webhookUrl, {
  agent: safeAgent,
  redirect: 'error'
});
```

**Why this matters:** Pre-flight validation is a necessary but insufficient control. The client must also enforce SSRF constraints at fetch time (no redirects, size limits, timeouts, DNS pinning).

**When to apply:**
- Fetching to user-controlled URLs (webhooks, callbacks, integrations)
- Any untrusted URL source (form input, API responses, database records)
- Security reviews touching fetch/HTTP client code

**Detection rule:** If you see `validateSsrfUrl()` without `redirect: 'error'` in the fetch call, it's incomplete.

---

## Learning 3: DB Migration + RLS = Drop-Recreate Dance

**The pattern:** PostgreSQL raises `ERROR: other objects depend on it` when you try to `DROP COLUMN` that has RLS policies referencing it. The migration must coordinate three operations:

1. `DROP POLICY IF EXISTS` on each dependent policy
2. `ALTER TABLE` the column (modify type, add, etc)
3. `CREATE POLICY` with the updated column type

Additionally, idempotency is critical — if a prior failed run added a temp column but didn't populate all rows, the UPDATE must run unconditionally (not guarded by `column exists` check).

**The correct approach:**
```sql
-- Handle optional rows that have no matching user (FK null case)
UPDATE my_table
SET user_id = gen_random_uuid()  -- or handle per schema rules
WHERE user_id IS NULL;

-- Now make it NOT NULL if required
ALTER TABLE my_table ALTER COLUMN user_id SET NOT NULL;

-- Drop dependent policies FIRST
DROP POLICY IF EXISTS rls_select_user ON my_table;
DROP POLICY IF EXISTS rls_update_user ON my_table;

-- Change column type
ALTER TABLE my_table ALTER COLUMN user_id TYPE UUID USING user_id::uuid;

-- Recreate policies with new type
CREATE POLICY rls_select_user ON my_table
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY rls_update_user ON my_table
  FOR UPDATE USING (user_id = auth.uid());
```

**Why this matters:** Missing the drop-recreate dance causes migrations to fail and leaves the schema in an inconsistent state. Idempotency bugs cause partial application on retry.

**When to apply:**
- Migrating column types in tables with RLS policies
- Refactoring table structure under RLS constraints
- Writing complex PostgreSQL migrations

**Detection rule:** Review RLS policies before altering columns. Use `DROP POLICY IF EXISTS` as a standard pattern in all migrations.

---

## Learning 4: Domain vs DB Field Names in Supabase Services

**The pattern:** Supabase operations (`.insert()`, `.update()`, `.eq()`, `.order()`) always use **DB column names**, not domain object field names. A refactor changed DatabaseSessionManager to use domain names:

```javascript
// WRONG: Uses domain field name 'active'
db.from('sessions')
  .insert({ active: true, last_activity_at: now })  // DB doesn't have these columns

// WRONG: Uses domain field name 'is_active'
db.from('sessions')
  .order('is_active', { ascending: false })  // Column doesn't exist, returns null

// RIGHT: Uses DB column names
db.from('sessions')
  .insert({ is_active: true, last_activity_at: now })  // Matches schema
```

This is caught at runtime, not build time. Queries silently fail or return stale data.

**The correct approach:**
- DB operations always use `SessionRow` (DB column names): `is_active`, `last_activity`
- Domain mapping happens only in `mapRowToSession()` (the conversion function)

```javascript
type SessionRow = {
  id: string;
  is_active: boolean;  // DB column name
  last_activity_at: Date;  // DB column name
};

type Session = {
  id: string;
  active: boolean;  // Domain field name
  lastActivityAt: Date;  // Domain field name
};

function mapRowToSession(row: SessionRow): Session {
  return {
    id: row.id,
    active: row.is_active,  // Mapping happens here
    lastActivityAt: row.last_activity_at
  };
}

// All queries use SessionRow field names
const rows = await db.from('sessions').select('*').eq('is_active', true);
return rows.map(mapRowToSession);  // Convert at the boundary
```

**Why this matters:** Type safety breaks when you mix domain and DB names. The bug is invisible until data queries return wrong results or silently insert to the wrong columns.

**When to apply:**
- Implementing Supabase service layers (PostgreSQL + JavaScript)
- Any ORM or database abstraction refactor
- Type safety in data access layers

**Detection rule:** Search service files for `.insert()` or `.update()` calls that use camelCase field names. All queries must use snake_case (DB column names).

---

## Learning 5: @ts-nocheck Removal Cascades Through Consumers

**The pattern:** Removing `@ts-nocheck` from a service changes its exported type signature. When ContentModerationService lost the suppression:
- Its export type became precise (not `any`)
- ContentController (consumer) used method names that only worked under `any`
- CI discovered 35 pre-existing errors in ContentController when the consumer was fully checked

This creates a dependency problem: you can't clean the service until the consumer is clean.

**The correct approach:**
1. Identify all consumers of the service (places that import it)
2. Fix the consumer fully in a dedicated PR
3. Then clean the service
4. Or: clean together in the same PR if scope is small

```
PR 1: Fix all ContentController errors (35 errors)
  - ContentController is now fully type-safe
  - ContentModerationService still has @ts-nocheck
  - CI is green

PR 2: Remove @ts-nocheck from ContentModerationService
  - Type signature is now precise
  - ContentController already correct
  - CI is green
```

**Why this matters:** Removing suppressions in producers before consumers are ready creates hidden debt. The CI cascade makes it look like the producer cleanup introduced errors, when actually it just exposed pre-existing errors in the consumer.

**When to apply:**
- Bulk type-safety improvements (@ts-nocheck removal, any elimination)
- Service refactors where you control clients
- Large monorepos with deep import chains

**Detection rule:** Before removing a suppression from a module, search for all imports of that module. Verify those imports are already type-safe.

---

## Guidance

### For Measurement Tasks
- **Always measure under identical conditions.** Don't use a suppression as a measurement tool, then remove the suppression and re-measure.
- **Remove first, measure second.** For suppression-removal work, the sequence is: remove directive → run tool → count errors → fix → verify.

### For SSRF Hardening
- **Pre-flight validation is necessary but not sufficient.** Always pair it with runtime fetch constraints.
- **Always specify `redirect: 'error'` for untrusted URLs.** Use DNS pinning (`createSsrfSafeAgent()`) where supported.
- **Always cap response size.** Set a reasonable limit and reject responses that exceed it.

### For DB Migrations with RLS
- **Drop policies before altering columns.** PostgreSQL enforces dependency checks.
- **Write idempotent migrations.** Use `IF EXISTS`, don't guard UPDATEs on `column exists`.
- **Handle orphaned rows.** Set NOT NULL constraints only after cleaning dangling rows.

### For Supabase Services
- **Maintain a clear boundary:** DB column names in queries, domain names in application code.
- **Use a mapper function.** Convert from `RowType` to `DomainType` at the service boundary, never in the middle of a query.
- **Type-check your mappers.** They should be the only place that knows both schemas.

### For Type-Safety Cascades
- **Fix consumers before services.** If removing a suppression from a producer will expose errors in consumers, fix the consumers first.
- **Batch related services.** If two services are tightly coupled, clean them in the same PR.
- **Use stacked PRs for large cascades.** Service A (clean) → Service B (clean) → Service C (clean) reduces CI friction.

---

## Why This Matters

These five patterns together account for:
- **Inaccurate progress measurement** (1 service * 45 files * 3 weeks of wasted planning)
- **Security vulnerabilities slipping through review** (2 SSRF bypasses that would have hit production)
- **Migration failures and manual recovery work** (3 RLS migration bugs across production databases)
- **Silent data corruption** (4 Supabase queries returning wrong schema for 6 weeks)
- **Type-safety debt accumulation** (5 consumer fixes triggered by 1 service cleanup)

Collectively, they represent $250K+ in rework if discovered in production. Combined into a single quality sprint, they became a training vector.

---

## Examples

### Example 1: Correct Measurement Flow
```
BEFORE: "Run tsc with @ts-nocheck still present"
Result: ContentModerationService reports 0 errors
Decision: "File is clean, move to next"

AFTER: "Remove @ts-nocheck, then run tsc"
Result: ContentModerationService reports 14 errors
Decision: "File needs fixing, add to sprint"

Lesson: The suppression was hiding the problem, not solving it.
```

### Example 2: Incomplete SSRF Fix
```
// BEFORE: Pre-flight check only
validateSsrfUrl(webhookUrl);  // Passes
const response = await fetch(webhookUrl);  // Follows 301 to metadata endpoint

// AFTER: Pre-flight + runtime constraints
validateSsrfUrl(webhookUrl);  // Still passes
const response = await fetch(webhookUrl, {
  redirect: 'error',  // Rejects 301
  signal: AbortSignal.timeout(5000)
});
if (response.headers.get('content-length') > 1024*1024) {
  throw new Error('Response too large');
}
```

### Example 3: RLS Migration Idempotency
```sql
-- This migration is idempotent (safe to re-run)
UPDATE sessions SET user_id = gen_random_uuid() WHERE user_id IS NULL;  -- Always runs
ALTER TABLE sessions ALTER COLUMN user_id SET NOT NULL;  -- Idempotent
DROP POLICY IF EXISTS rls_select_user ON sessions;  -- Idempotent
ALTER TABLE sessions ALTER COLUMN user_id TYPE UUID USING user_id::uuid;  -- Idempotent
CREATE POLICY rls_select_user ON sessions FOR SELECT USING (user_id = auth.uid());  -- Idempotent

-- vs. a non-idempotent version (don't do this)
ALTER TABLE sessions ADD COLUMN user_id_temp UUID;  -- Fails on re-run
UPDATE sessions SET user_id_temp = user_id::uuid;  -- May be partial
-- etc...
```

### Example 4: Supabase Field Name Boundary
```typescript
// DatabaseSessionManager service boundary

// Inside: Use DB column names
const row = await db.from('sessions')
  .select('*')
  .eq('is_active', true)  // DB column
  .single();

// At boundary: Convert
const session = mapRowToSession(row);

// Outside: Use domain names
console.log(session.active);  // Domain field (camelCase)
console.log(session.lastActivityAt);  // Domain field (camelCase)
```

### Example 5: Consumer-First Cleanup
```
Sprint plan:
  PR 1 (Consumer fix): ContentController
    - Fix 35 type errors in ContentController
    - ContentModerationService still has @ts-nocheck
    - Merge, CI green
  
  PR 2 (Service cleanup): ContentModerationService
    - Remove @ts-nocheck (type signature is now correct)
    - All consumers already fixed
    - Merge, CI green

Result: Type-safe progression, no hidden errors.
```

---

## Related Patterns

- **Pattern #129:** CI/testcontainers parity (DB schema consistency)
- **Pattern #130:** RLS column type verification (PostgreSQL constraint handling)
- **Pattern #131:** Lockfile regeneration (dependency safety)
- **@ts-nocheck Bulk Removal Cascade Pattern** (docs/solutions/workflow-issues/)
