---
title: Creator ID Column Type Reference
date: '2026-03-17'
category: schema
purpose: Canonical reference for creator_id type variance across tables. Use when modifying RLS, WHERE clauses, or schema-related code.
---

# Creator ID Type Reference

## Purpose

The `creator_id` column appears in 20+ tables but has **different data types** across tables:

- **UUID** (18 tables) — Supabase auth.users foreign key reference
- **TEXT** (4 tables) — External API IDs, not database foreign keys

This document prevents AI agents and code generators from assuming all `creator_id` columns are the same type.

**USE THIS BEFORE:**

- Writing RLS policies
- Modifying WHERE clauses that reference creator_id
- Generating migration SQL
- Delegating schema work to AI agents

---

## Summary Table

| Table                       | Type | Usage                   | RLS Pattern                           | Notes                           |
| --------------------------- | ---- | ----------------------- | ------------------------------------- | ------------------------------- |
| **users**                   | UUID | PK / FK to auth.users   | `.eq('creator_id', auth.uid())`       | Supabase auth reference         |
| **posts**                   | UUID | FK to users             | `.eq('creator_id', auth.uid())`       | User-generated content          |
| **comments**                | UUID | FK to users             | `.eq('creator_id', auth.uid())`       | User-generated content          |
| **likes**                   | UUID | FK to users             | `.eq('creator_id', auth.uid())`       | User interaction                |
| **subscriptions**           | UUID | FK to users (creator)   | `.eq('creator_id', auth.uid())`       | Creator subscription management |
| **payments**                | UUID | FK to users (creator)   | `.eq('creator_id', auth.uid())`       | Payment tracking                |
| **wellness_data**           | UUID | FK to users             | `.eq('creator_id', auth.uid())`       | Wellness/analytics              |
| **analytics_events**        | UUID | FK to users             | `.eq('creator_id', auth.uid())`       | Event tracking                  |
| **discovery_creators**      | UUID | FK to users             | `.eq('creator_id', auth.uid())`       | Discovery feed                  |
| **content_recommendations** | UUID | FK to users             | `.eq('creator_id', auth.uid())`       | Recommendation engine           |
| **user_sessions**           | UUID | FK to users             | `.eq('creator_id', auth.uid())`       | Session management              |
| **notifications**           | UUID | FK to users (recipient) | `.eq('creator_id', auth.uid())`       | User notifications              |
| **user_preferences**        | UUID | FK to users             | `.eq('creator_id', auth.uid())`       | User settings                   |
| **content_drafts**          | UUID | FK to users             | `.eq('creator_id', auth.uid())`       | Draft content                   |
| **revenue_splits**          | UUID | FK to users             | `.eq('creator_id', auth.uid())`       | Revenue distribution            |
| **follower_relationships**  | UUID | FK to users (follower)  | `.eq('creator_id', auth.uid())`       | Social graph                    |
| **creator_stats**           | UUID | FK to users             | `.eq('creator_id', auth.uid())`       | Aggregate statistics            |
| **content_categories**      | UUID | FK to users             | `.eq('creator_id', auth.uid())`       | Content classification          |
| **platform_connections**    | TEXT | External API ID         | `.eq('creator_id', auth.uid()::text)` | **⚠️ Different type**           |
| **external_accounts**       | TEXT | External API ID         | `.eq('creator_id', auth.uid()::text)` | **⚠️ Different type**           |
| **third_party_profiles**    | TEXT | External API ID         | `.eq('creator_id', auth.uid()::text)` | **⚠️ Different type**           |
| **payment_providers**       | TEXT | External provider ID    | `.eq('creator_id', auth.uid()::text)` | **⚠️ Different type**           |

---

## RLS Pattern Reference

### Pattern 1: UUID creator_id (Majority — 18 tables)

**When to use:** For tables where creator_id is a Supabase UUID foreign key.

```sql
-- Example RLS policy
CREATE POLICY "Users can view own posts"
  ON posts
  FOR SELECT
  USING (creator_id = auth.uid());
```

**TypeScript/Supabase JS pattern:**

```typescript
// ✓ CORRECT
const { data } = await supabase
  .from('posts')
  .select('*')
  .eq('creator_id', auth.uid()) // No cast needed
  .single();
```

**Why it works:**

- `auth.uid()` returns `uuid`
- Column `posts.creator_id` is `uuid`
- Types match — no cast needed

---

### Pattern 2: TEXT creator_id (External IDs — 4 tables)

**When to use:** For tables where creator_id stores external API IDs (not database foreign keys).

```sql
-- Example RLS policy for platform_connections
CREATE POLICY "Users can view own platform connections"
  ON platform_connections
  FOR SELECT
  USING (creator_id = auth.uid()::text);  -- Explicit cast
```

**TypeScript/Supabase JS pattern:**

```typescript
// ✓ CORRECT (when column is TEXT)
const { data } = await supabase
  .from('platform_connections')
  .select('*')
  .eq('creator_id', auth.uid().toString()) // Convert UUID to string
  .single();

// OR (if auth.uid() returns string directly):
const userId = auth.uid(); // May be string in some contexts
const { data } = await supabase
  .from('platform_connections')
  .select('*')
  .eq('creator_id', userId) // Already string
  .single();
```

**Why it needs a cast:**

- `auth.uid()` returns `uuid` (binary type)
- Column `platform_connections.creator_id` is `text` (string type)
- Cannot compare uuid directly to text — must cast: `auth.uid()::text`

**Important:** Add a comment explaining why the cast exists:

```sql
-- creator_id is TEXT for external API IDs (not a database FK)
-- Requires explicit cast from UUID to TEXT
CREATE POLICY "Users can access own connections"
  ON platform_connections
  FOR SELECT
  USING (creator_id = auth.uid()::text);
```

---

## Why This Matters

### Problem Scenario: Type Mismatch in RLS

```sql
-- ✗ WRONG: Applied to platform_connections (TEXT column)
CREATE POLICY "Users can access own connections"
  ON platform_connections
  FOR SELECT
  USING (creator_id = auth.uid());  -- UUID vs TEXT type mismatch
```

**Result:**

- RLS policy compiles but behaves unpredictably
- Type coercion may silently allow/deny access
- Security vulnerability: users may access other users' data

### Correct Solution:

```sql
-- ✓ CORRECT: Cast UUID to TEXT for TEXT columns
CREATE POLICY "Users can access own connections"
  ON platform_connections
  FOR SELECT
  USING (creator_id = auth.uid()::text);  -- Explicit cast with comment
```

---

## Verification Checklist

Before modifying RLS or WHERE clauses:

1. **Identify all creator_id references in your change**
2. **For each reference, look up the actual column type:**

   ```bash
   # Find the table
   grep -r "platform_connections\|posts\|..." your_migration.sql

   # Check the column type in baseline schema
   grep -A 5 "CREATE TABLE platform_connections" supabase/migrations/baseline/*.sql
   ```

3. **Verify the pattern matches the type:**
   - UUID column → Use Pattern 1 (no cast)
   - TEXT column → Use Pattern 2 (with `::text` cast and comment)
4. **Add comment explaining the type if not obvious:**
   ```sql
   -- creator_id is TEXT for external API IDs
   USING (creator_id = auth.uid()::text);
   ```

---

## For AI Agent Code Generation

When delegating schema or RLS work to an AI agent, **provide this document in the brief** with explicit instructions:

```
SCHEMA CONSTRAINT: creator_id column type variance

Before generating any RLS policy or WHERE clause:
1. Check docs/schema/creator_id_types.md for the actual column type
2. Never assume type based on column naming
3. Use the correct RLS pattern:
   - UUID columns: .eq('creator_id', auth.uid())
   - TEXT columns: .eq('creator_id', auth.uid()::text) with comment

Examples provided:
- UUID pattern (majority): [link to Pattern 1 above]
- TEXT pattern (external IDs): [link to Pattern 2 above]

Verification requirement:
- [ ] For every creator_id reference, verified actual type in schema doc
- [ ] Code uses correct pattern (UUID vs TEXT)
- [ ] Added comments explaining TEXT casts
```

---

## Migration: Detecting Unsafe Casts

To find RLS policies with potential type mismatches:

```bash
# Find all RLS policies with auth.uid() casts
grep -n "auth.uid()::text\|CAST(auth.uid()\|creator_id.*auth.uid()" \
  supabase/migrations/*.sql

# For each match, verify the column type
# grep -A 5 "CREATE TABLE [table_name]" supabase/migrations/baseline/*.sql
```

---

## Historical Context

**PR #164 Finding:** Security-hardener agent assumed all `creator_id` columns were TEXT and added `::text` casts universally. This caused type mismatches on UUID columns and created RLS policy failures during migrations.

**Prevention:** This document was created to ensure future code generation validates column types before applying type-specific patterns.

---

## Related Files

- `docs/solutions/CI_FAILURE_PREVENTION_STRATEGY.md` — Problem 2 detailed explanation
- `docs/solutions/patterns/critical-patterns.md` — Authorization at Service Layer pattern
- `.github/workflows/ci.yml` — Integration test gate that catches RLS policy failures
- `packages/backend/src/__tests__/setup/testcontainers-global-setup.ts` — Test schema bootstrap
