# Deployment Checklist: feat/wave2-epics-009b-010-011

**Branch:** `feat/wave2-epics-009b-010-011`
**Commits:** `b1b4b71` (pre-flight), `749bca8` (implementation), `bdb9e40` (review fixes)
**Scope:** 14 new SQL migrations, 10 backend services, 12 route files, 40+ frontend components, SSRF utility
**Date:** 2026-02-19
**Risk Level:** HIGH (new tables with financial data, state machines, SECURITY DEFINER functions, escrow logic)

---

## FINDINGS SUMMARY

| Severity          | Count | Items                                                                                                                                                       |
| ----------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P1 (Critical)** | 3     | RPC column name mismatch, RPC type mismatch, missing search_path on SECURITY DEFINER RPCs                                                                   |
| **P2 (High)**     | 5     | Duplicate migration files, missing down migrations, missing env vars, DI dependency map drift, MarketplaceService EventBusService missing                   |
| **P3 (Medium)**   | 4     | No feature flags, constructor side effect in BusinessInvoiceService, update_updated_at_column create-then-drop ordering, duplicate " 2.sql" untracked files |

---

## P1 FINDINGS (Must Fix Before Deploy)

### P1-1: RPC `update_revenue_split_atomic` references non-existent column `revenue_share_bps`

**File:** `/Users/fp/Desktop/Sovren/supabase/migrations/20260220300100_fix_review_264_atomicity_rpc.sql` (line 40)

The RPC function inserts into `content_collaborators` using column `revenue_share_bps`:

```sql
INSERT INTO content_collaborators (content_id, creator_id, revenue_share_bps, status)
```

But the actual column created in `20260220100200_epic010_collaborative_content.sql` (line 18) is named `revenue_split_bps`:

```sql
revenue_split_bps INTEGER NOT NULL
```

The service code in `/Users/fp/Desktop/Sovren/packages/backend/src/services/community/CollaborativeContentService.ts` (line 130) correctly uses `revenue_split_bps`. This RPC will fail at runtime with a "column revenue_share_bps does not exist" error.

**Fix:** Change `revenue_share_bps` to `revenue_split_bps` in the RPC function body.

### P1-2: RPC `update_revenue_split_atomic` and `record_revenue_split_ledger_atomic` accept TEXT for content_id but column is UUID

**File:** `/Users/fp/Desktop/Sovren/supabase/migrations/20260220300100_fix_review_264_atomicity_rpc.sql` (lines 32, 54)

Both RPCs declare `p_content_id TEXT`:

```sql
CREATE OR REPLACE FUNCTION update_revenue_split_atomic(
  p_content_id TEXT, ...
```

But `content_collaborators.content_id` is `UUID NOT NULL REFERENCES content(id)` (from `20260220100200`), and `revenue_split_ledger.content_id` is also `UUID NOT NULL REFERENCES content(id)` (from `20260220100400`).

The `DELETE FROM content_collaborators WHERE content_id = p_content_id` will fail because PostgreSQL will not implicitly cast TEXT to UUID in an equality comparison against a UUID column. Similarly, the INSERT will fail on the FK constraint.

**Fix:** Change `p_content_id TEXT` to `p_content_id UUID` in both functions.

### P1-3: Three SECURITY DEFINER functions missing `SET search_path = ''`

**File:** `/Users/fp/Desktop/Sovren/supabase/migrations/20260220300100_fix_review_264_atomicity_rpc.sql`

The migration in `20260220100000_epic010_creator_circles.sql` correctly sets `SET search_path = ''` on the `get_user_circle_ids` SECURITY DEFINER function. However, the three RPCs in `20260220300100` are all SECURITY DEFINER but lack `SET search_path = ''`:

1. `create_circle_atomic` (line 26)
2. `update_revenue_split_atomic` (line 48)
3. `record_revenue_split_ledger_atomic` (line 76)

Without `SET search_path`, an attacker with ability to modify `search_path` could redirect these functions to malicious table implementations. Since these functions handle financial data (revenue splits, escrow ledger entries), this is a security P1.

**Fix:** Add `SET search_path = ''` to each function and qualify all table references with `public.` schema prefix.

---

## P2 FINDINGS (Should Fix Before Deploy)

### P2-1: Missing down migrations for Wave 2 tables

**Finding:** The `supabase/migrations/down/` directory contains rollback scripts only for EPIC-009 and prior migrations (files dated 20260216-20260218). There are NO down migration files for any of the 14 new Wave 2 migrations (20260220\*).

Down migrations embedded as SQL comments exist within each file, but they are not executable as standalone rollback scripts.

**Impact:** If rollback is needed, engineers must manually extract and run SQL from comments, which is error-prone under incident pressure.

**Fix:** Create standalone down migration files in `supabase/migrations/down/` for each of the 14 new migrations.

### P2-2: Duplicate untracked migration files with spaces in filenames

**Finding:** Three untracked files exist in the migrations directory with " 2" appended:

- `20260220300000_fix_review_findings_268_273_288_293_294 2.sql`
- `20260220300100_fix_review_264_atomicity_rpc 2.sql`
- `20260220300200_fix_review_274_toctou_unique_constraints 2.sql`

These are NOT tracked by git (confirmed via `git status`), but they exist on disk. If the Supabase CLI scans the migrations directory alphabetically, files with spaces could:

1. Be picked up as separate migrations and run twice
2. Cause Supabase to error on the space character

**Fix:** Delete the three duplicate files before deploying.

### P2-3: Missing environment variables for new services

**Finding:** Several new services reference environment variables not present in `.env` or `env.example`:

| Variable              | Used By                | File                                                                                             |
| --------------------- | ---------------------- | ------------------------------------------------------------------------------------------------ |
| `BYOK_ENCRYPTION_KEY` | InboxPollingService    | `/Users/fp/Desktop/Sovren/packages/backend/src/services/distribution/InboxPollingService.ts:345` |
| `LNBITS_URL`          | BusinessInvoiceService | `/Users/fp/Desktop/Sovren/packages/backend/src/services/finance/BusinessInvoiceService.ts:205`   |

`BYOK_ENCRYPTION_KEY` is not in `.env`, `env.example`, or `env.development`. The service falls back to `process.env.BYOK_ENCRYPTION_KEY` which will be undefined, causing BYOK decryption to fail.

`LNBITS_URL` has a hardcoded fallback (`https://lnbits.sovren.dev`) but is not documented in env files.

**Fix:** Add both variables to `.env`, `env.example`, and `env.development` with appropriate defaults/documentation.

### P2-4: SERVICE_DEPENDENCIES map declares EventBusService dependency for MarketplaceService but binding does not resolve it

**File:** `/Users/fp/Desktop/Sovren/packages/backend/src/container/types.ts` (line 619)

```typescript
MarketplaceService: ['Database', 'LightningService', 'QueueService', 'EventBusService', 'Logger'],
```

**File:** `/Users/fp/Desktop/Sovren/packages/backend/src/container/bindings/community.bindings.ts` (lines 50-61)

```typescript
registry.registerSingletonFactory(TYPES.MarketplaceService, (container) => {
  const db = container.resolve(TYPES.Database);
  const lightning = container.resolve(TYPES.LightningService);
  const queue = container.resolve(TYPES.QueueService);
  const logger = container.resolve(TYPES.Logger);
  return new MarketplaceService(asDb(db), lightning as any, queue, logger);
});
```

The constructor of MarketplaceService takes `(db, lightning, queue, logger)` and does NOT accept an EventBus parameter. The dependency map says it needs EventBusService, but it is never resolved or injected. This is a documentation drift -- the dependency map will not break startup, but it is misleading.

Similarly, `CollaborativeContentService` is declared with dependencies `['Database', 'NostrService', 'EventBusService', 'Logger']` in the dependency map, but the binding only injects `(db, logger)`. The constructor only accepts `(db, logger)`.

**Fix:** Update `SERVICE_DEPENDENCIES` to match actual constructor signatures.

### P2-5: `BusinessInvoiceService` constructor calls `queueService.createQueue()` synchronously

**File:** `/Users/fp/Desktop/Sovren/packages/backend/src/services/finance/BusinessInvoiceService.ts` (lines 38-46)

The constructor immediately calls `this.queueService.createQueue(...)` which is a side effect during DI resolution. If the QueueService is not yet fully initialized (e.g., Redis not connected), this could throw during bootstrap and prevent the entire DI container from initializing.

**Fix:** Move queue creation to a lazy initialization method or an `initialize()` lifecycle hook.

---

## P3 FINDINGS (Fix Post-Deploy)

### P3-1: No feature flags for new Wave 2 features

No feature flags gate the new EPIC-010 (Creator Network) or EPIC-011 (Business Manager) routes. All routes are mounted unconditionally in `/Users/fp/Desktop/Sovren/packages/backend/src/routes/v2/index.ts`. If a critical bug is discovered in marketplace escrow logic, the only option is a full rollback rather than disabling a single feature.

### P3-2: `update_updated_at_column()` function created and then dropped in migration sequence

Migration `20260220100000` creates `update_updated_at_column()` (line 110). Migration `20260220100300` uses it for `trg_service_listings_updated_at`. Then migration `20260220300000` (line 87) drops it:

```sql
DROP FUNCTION IF EXISTS update_updated_at_column();
```

...and recreates the triggers using `update_updated_at()` (from baseline). This is correct final state but depends on exact migration ordering. If `20260220300000` runs before `20260220100300`, the marketplace trigger creation will fail because `update_updated_at_column()` does not yet exist. Supabase runs migrations in alphabetical order by filename, so `300000 > 100300` -- the ordering is correct. But this is fragile.

### P3-3: Three untracked duplicate files should be .gitignored or deleted

The " 2.sql" files (macOS Finder copies) should be deleted and a `.gitignore` pattern added to prevent future occurrences.

### P3-4: `reply_templates.creator_id` migration from TEXT to UUID is not reversible without data

Migration `20260220300000` (line 18) does:

```sql
ALTER TABLE reply_templates ALTER COLUMN creator_id TYPE UUID USING creator_id::uuid;
```

This is a one-way type change. If the table already has data with non-UUID text values, this will fail. In a fresh database, this is safe. In an existing database with data, verify all existing `creator_id` values are valid UUIDs first.

---

## SECTION 1: DATA INVARIANTS

The following must remain true before and after deploy:

- [ ] All existing `platform_connections` rows retain their current data (EPIC-009B adds columns with defaults)
- [ ] `content` table exists with `id UUID` primary key (required by EPIC-010 FK references)
- [ ] `auth.users` table exists (required by 15+ FK references across new tables)
- [ ] `update_updated_at()` function exists in baseline (required by remediation migration 300000)
- [ ] No tables named `creator_circles`, `circle_members`, `circle_posts`, `mentor_profiles`, `mentorships`, `content_collaborators`, `service_listings`, `service_orders`, `order_reviews`, `revenue_split_ledger`, `revenue_split_payments`, `contract_templates`, `contracts`, `business_invoices`, `expense_categories`, `expenses`, `revenue_entries`, `diversification_goals`, `reply_templates` exist before migration (all use CREATE TABLE IF NOT EXISTS, but pre-existing tables with different schemas will silently skip creation)
- [ ] Foreign key integrity maintained for all financial tables (ON DELETE RESTRICT prevents cascade deletion)
- [ ] `reply_templates.creator_id` values are valid UUIDs if table has existing data

---

## SECTION 2: PRE-DEPLOY AUDITS (Read-Only SQL)

Run these queries against the target database BEFORE deploying. Save results as baseline.

```sql
-- 2.1: Verify prerequisite tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('content', 'platform_connections', 'inbox_messages')
ORDER BY table_name;
-- EXPECTED: All three tables exist

-- 2.2: Verify baseline function exists
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_name = 'update_updated_at';
-- EXPECTED: 1 row

-- 2.3: Verify no naming collisions with new tables
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'creator_circles', 'circle_members', 'circle_posts',
    'mentor_profiles', 'mentorships', 'content_collaborators',
    'service_listings', 'service_orders', 'order_reviews',
    'revenue_split_ledger', 'revenue_split_payments',
    'contract_templates', 'contracts', 'business_invoices',
    'expense_categories', 'expenses', 'revenue_entries',
    'diversification_goals', 'reply_templates'
  );
-- EXPECTED: 0 rows (tables do not exist yet)
-- EXCEPTION: If EPIC-009A was deployed, reply_templates and inbox_messages may already exist

-- 2.4: Check reply_templates for existing data (if table exists)
SELECT count(*) FROM reply_templates;
-- If > 0: verify all creator_id values are valid UUIDs
SELECT creator_id FROM reply_templates WHERE creator_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
-- EXPECTED: 0 rows with non-UUID creator_id values

-- 2.5: Baseline count of platform_connections (to verify ALTER TABLE does not lose data)
SELECT count(*) FROM platform_connections;
-- SAVE THIS VALUE

-- 2.6: Verify content.id is UUID type
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'content' AND column_name = 'id';
-- EXPECTED: data_type = 'uuid'

-- 2.7: Check existing migration state
SELECT * FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 10;
-- EXPECTED: Last migration should be from the prior deploy
```

**Any deviation from expected values = STOP deployment and investigate.**

---

## SECTION 3: MIGRATION STEPS

### Migration Execution Order (Supabase runs alphabetically by filename)

| #   | Migration File                                                | Creates/Modifies                                                                                                           | Dependencies                                                                                         | Estimated Runtime | Idempotent                                    |
| --- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------- | --------------------------------------------- |
| 1   | `20260220000000_epic009b_adaptive_polling.sql`                | ALTER platform_connections (7 cols), CREATE reply_templates, CREATE 2 indexes                                              | platform_connections exists                                                                          | < 5s              | Yes (IF NOT EXISTS, ADD COLUMN IF NOT EXISTS) |
| 2   | `20260220100000_epic010_creator_circles.sql`                  | CREATE creator_circles, circle_members, circle_posts + RLS + triggers + get_user_circle_ids() + update_updated_at_column() | auth.users                                                                                           | < 5s              | Partial (indexes not IF NOT EXISTS)           |
| 3   | `20260220100100_epic010_mentorships.sql`                      | CREATE mentor_profiles, mentorships + RLS + indexes                                                                        | auth.users                                                                                           | < 5s              | Partial                                       |
| 4   | `20260220100200_epic010_collaborative_content.sql`            | CREATE content_collaborators + validate_revenue_split_sum() trigger                                                        | content table, auth.users                                                                            | < 5s              | Partial                                       |
| 5   | `20260220100300_epic010_marketplace.sql`                      | CREATE service_listings, service_orders, order_reviews + transition_order_state() + RLS                                    | auth.users, update_updated_at_column() from #2                                                       | < 5s              | Partial                                       |
| 6   | `20260220100400_epic010_security_hardening.sql`               | ALTER order_reviews, service_orders; CREATE revenue_split_ledger, revenue_split_payments                                   | service_orders from #5, content table                                                                | < 5s              | Yes (IF NOT EXISTS)                           |
| 7   | `20260220200000_epic011_contracts.sql`                        | CREATE contract_templates, contracts + RLS + seed data                                                                     | auth.users                                                                                           | < 5s              | Yes (IF NOT EXISTS)                           |
| 8   | `20260220200100_epic011_business_invoices.sql`                | CREATE business_invoices + transition_invoice_state() + RLS                                                                | auth.users                                                                                           | < 5s              | Yes (IF NOT EXISTS)                           |
| 9   | `20260220200200_epic011_expenses.sql`                         | CREATE expense_categories, expenses + RLS                                                                                  | auth.users                                                                                           | < 5s              | Yes (IF NOT EXISTS)                           |
| 10  | `20260220200300_epic011_revenue_tracking.sql`                 | CREATE revenue_entries, diversification_goals + RLS                                                                        | auth.users                                                                                           | < 5s              | Yes (IF NOT EXISTS)                           |
| 11  | `20260220200400_epic011_security_fixes.sql`                   | ALTER revenue_entries, expenses, contract_templates, business_invoices                                                     | Tables from #7-#10                                                                                   | < 5s              | Yes (IF NOT EXISTS, ADD COLUMN IF NOT EXISTS) |
| 12  | `20260220300000_fix_review_findings_268_273_288_293_294.sql`  | ALTER reply_templates type, ALTER FKs, DROP+RECREATE triggers, CREATE indexes IF NOT EXISTS                                | All tables from #1-#6                                                                                | < 10s             | Partial                                       |
| 13  | `20260220300100_fix_review_264_atomicity_rpc.sql`             | CREATE 3 RPC functions (SECURITY DEFINER)                                                                                  | creator_circles, circle_members, content_collaborators, revenue_split_ledger, revenue_split_payments | < 5s              | Yes (CREATE OR REPLACE)                       |
| 14  | `20260220300200_fix_review_274_toctou_unique_constraints.sql` | CREATE 3 unique indexes                                                                                                    | circle_members, mentorships, content_collaborators                                                   | < 5s              | Yes (IF NOT EXISTS)                           |

**Total estimated migration time:** < 60 seconds on an idle database. Add 2-5x buffer for production load.

### Dependency Chain Analysis

```
Migration #1 (009b) --> standalone (only needs platform_connections)
Migration #2 (circles) --> standalone (only needs auth.users)
Migration #3 (mentorships) --> standalone
Migration #4 (collab) --> needs content table (baseline)
Migration #5 (marketplace) --> needs update_updated_at_column() from #2
Migration #6 (security_hardening) --> needs service_orders from #5, content table
Migration #7-#10 (011) --> standalone (only needs auth.users)
Migration #11 (011 security) --> needs #7-#10
Migration #12 (review fixes) --> needs #1-#6
Migration #13 (atomicity RPC) --> needs #2, #4, #6 [P1: HAS BUGS - see findings]
Migration #14 (TOCTOU) --> needs #2, #3, #4
```

Alphabetical ordering by filename satisfies all dependencies. Migration ordering is CORRECT.

---

## SECTION 4: POST-DEPLOY VERIFICATION (Within 5 Minutes)

```sql
-- 4.1: Verify all 19 new tables were created
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'creator_circles', 'circle_members', 'circle_posts',
    'mentor_profiles', 'mentorships', 'content_collaborators',
    'service_listings', 'service_orders', 'order_reviews',
    'revenue_split_ledger', 'revenue_split_payments',
    'contract_templates', 'contracts', 'business_invoices',
    'expense_categories', 'expenses', 'revenue_entries',
    'diversification_goals', 'reply_templates'
  )
ORDER BY table_name;
-- EXPECTED: 19 rows

-- 4.2: Verify RPC functions exist
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'create_circle_atomic',
    'update_revenue_split_atomic',
    'record_revenue_split_ledger_atomic',
    'get_user_circle_ids',
    'validate_revenue_split_sum',
    'transition_order_state',
    'transition_invoice_state'
  )
ORDER BY routine_name;
-- EXPECTED: 7 rows

-- 4.3: Verify RLS is enabled on all new tables
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'creator_circles', 'circle_members', 'circle_posts',
    'mentor_profiles', 'mentorships', 'content_collaborators',
    'service_listings', 'service_orders', 'order_reviews',
    'revenue_split_ledger', 'revenue_split_payments',
    'contract_templates', 'contracts', 'business_invoices',
    'expense_categories', 'expenses', 'revenue_entries',
    'diversification_goals', 'reply_templates'
  )
ORDER BY tablename;
-- EXPECTED: All rowsecurity = true

-- 4.4: Verify platform_connections has new columns and no data loss
SELECT count(*) FROM platform_connections;
-- EXPECTED: Same count as pre-deploy baseline

SELECT column_name FROM information_schema.columns
WHERE table_name = 'platform_connections'
  AND column_name IN ('poll_interval', 'last_active_at', 'instance_url',
                       'api_key_encrypted', 'api_key_iv', 'api_key_auth_tag', 'key_version')
ORDER BY column_name;
-- EXPECTED: 7 rows

-- 4.5: Verify contract template seed data
SELECT count(*) FROM contract_templates WHERE created_by IS NULL;
-- EXPECTED: 4 (system templates)

-- 4.6: Verify state machine triggers exist
SELECT trigger_name, event_object_table FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name IN (
    'trg_order_state_machine',
    'trg_invoice_state_machine',
    'trg_validate_revenue_split',
    'trg_creator_circles_updated_at',
    'trg_service_listings_updated_at',
    'trg_contracts_updated_at',
    'trg_diversification_goals_updated_at'
  )
ORDER BY trigger_name;
-- EXPECTED: 7 rows

-- 4.7: Verify unique constraints for TOCTOU prevention
SELECT indexname FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'idx_circle_members_unique_membership',
    'idx_mentorships_unique_active',
    'idx_collaborations_unique_active'
  );
-- EXPECTED: 3 rows

-- 4.8: Verify reply_templates.creator_id is UUID type (P1 fix)
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'reply_templates' AND column_name = 'creator_id';
-- EXPECTED: data_type = 'uuid'

-- 4.9: Verify ON DELETE behaviors on financial tables
SELECT
  tc.table_name,
  kcu.column_name,
  rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.referential_constraints rc
  ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN ('contracts', 'business_invoices', 'expenses',
                         'revenue_entries', 'service_orders', 'order_reviews',
                         'revenue_split_ledger', 'revenue_split_payments',
                         'content_collaborators')
ORDER BY tc.table_name, kcu.column_name;
-- EXPECTED: Financial tables use RESTRICT, non-financial use CASCADE
```

---

## SECTION 5: ROLLBACK PLAN

**Can we roll back?**

- [x] Yes, with caveats -- all migrations are DDL (CREATE TABLE, ALTER TABLE, CREATE FUNCTION). No data transforms.
- [ ] Down migrations exist as inline SQL comments but NOT as standalone rollback files (P2-1)
- [ ] Seed data in `contract_templates` would need to be re-inserted if rolled back and re-deployed

**Rollback Order (reverse of deploy, must run in this exact order):**

```sql
-- Step 14: Drop TOCTOU constraints
DROP INDEX IF EXISTS idx_collaborations_unique_active;
DROP INDEX IF EXISTS idx_mentorships_unique_active;
DROP INDEX IF EXISTS idx_circle_members_unique_membership;

-- Step 13: Drop atomicity RPCs
DROP FUNCTION IF EXISTS record_revenue_split_ledger_atomic(TEXT, BIGINT, UUID, JSONB);
DROP FUNCTION IF EXISTS update_revenue_split_atomic(TEXT, JSONB);
DROP FUNCTION IF EXISTS create_circle_atomic(TEXT, TEXT, TEXT, INT, UUID);

-- Step 12: Revert review fixes (complex -- FK changes, trigger changes, type changes)
-- WARNING: reply_templates.creator_id UUID->TEXT revert will fail if FK exists
-- Must drop FK first, then alter type, then recreate with TEXT RLS policies
ALTER TABLE reply_templates DROP CONSTRAINT IF EXISTS reply_templates_creator_id_fkey;
ALTER TABLE reply_templates ALTER COLUMN creator_id TYPE TEXT;
-- ... (full rollback is 50+ lines, see inline comments in migration 300000)

-- Steps 11-1: Drop tables in reverse dependency order
-- See inline DOWN comments in each migration file
```

**Recommendation:** For a full rollback, restore from a database backup taken before deploy. The DDL rollback is complex and error-prone.

---

## SECTION 6: BACKEND STARTUP VERIFICATION

```bash
# Verify DI container resolves all new bindings
# The bootstrap validates dependencies on startup
NODE_ENV=test npx ts-node packages/backend/src/bootstrap.ts

# Verify all route files import correctly
npx tsc --noEmit --project packages/backend/tsconfig.json 2>&1 | head -50

# Run backend tests for new services
npx jest --config packages/backend/jest.community.config.js
npx jest --config packages/backend/jest.finance.config.js
```

**Route Conflict Analysis:**

- `/api/v2/circles` -- no conflicts
- `/api/v2/circles/suggested` -- placed BEFORE `/:id` (correct, avoids param matching)
- `/api/v2/mentorship` -- no conflicts
- `/api/v2/content` -- **NOTE:** This shares prefix with any existing `/api/v2/content/*` routes. Verify no pre-existing `/api/v2/content` mount.
- `/api/v2/marketplace` -- no conflicts
- `/api/v2/business/contracts` -- no conflicts
- `/api/v2/business/invoices` -- no conflicts
- `/api/v2/business/revenue` -- no conflicts
- `/api/v2/business/tax` -- no conflicts
- `/api/v2/inbox` -- no conflicts
- `/api/v2/analytics/cross-platform` -- no conflicts
- `/api/v2/platforms` -- no conflicts

All route mounts use distinct prefixes. `/circles/suggested` is correctly ordered before `/:id`. No conflicts detected.

---

## SECTION 7: POST-DEPLOY MONITORING (First 24 Hours)

| Metric/Log                  | Alert Condition                        | What to Check                                                                |
| --------------------------- | -------------------------------------- | ---------------------------------------------------------------------------- |
| Backend error rate          | > 1% for 5 min                         | Supabase logs, backend stderr                                                |
| DI resolution failures      | Any `resolve()` error in logs          | Bootstrap output, container validation                                       |
| Migration failure           | Any `supabase_migrations` error        | Supabase dashboard > Migrations                                              |
| 500 responses on /api/v2/\* | > 0 in first 30 min                    | API gateway logs                                                             |
| RPC function errors         | Any `RAISE EXCEPTION` in Supabase logs | `create_circle_atomic`, `transition_order_state`, `transition_invoice_state` |
| Queue connection failures   | BullMQ connection refused              | Redis connectivity, REDIS_HOST env                                           |
| BYOK decryption failures    | `BYOK_ENCRYPTION_KEY` undefined errors | InboxPollingService logs                                                     |

**Console verification (run 1 hour after deploy):**

```sql
-- Quick sanity: are any new tables populated?
SELECT 'creator_circles' as tbl, count(*) FROM creator_circles
UNION ALL SELECT 'service_listings', count(*) FROM service_listings
UNION ALL SELECT 'contracts', count(*) FROM contracts
UNION ALL SELECT 'contract_templates', count(*) FROM contract_templates;
-- contract_templates expected: 4 (seed data)

-- Verify state machine triggers work
-- Test: create a draft invoice, try invalid transition
BEGIN;
INSERT INTO business_invoices (creator_id, client_name, line_items, total_sats, status)
VALUES ('00000000-0000-0000-0000-000000000001', 'Test', '[]', 1000, 'draft');
-- Attempt invalid transition: draft -> paid (should fail)
UPDATE business_invoices SET status = 'paid' WHERE client_name = 'Test';
-- EXPECTED: ERROR: Invalid invoice state transition: draft -> paid
ROLLBACK;
```

---

## GO/NO-GO CHECKLIST

### BLOCKERS (Must resolve before deploy)

- [ ] **P1-1 FIX:** Change `revenue_share_bps` to `revenue_split_bps` in `20260220300100_fix_review_264_atomicity_rpc.sql` line 40
- [ ] **P1-2 FIX:** Change `p_content_id TEXT` to `p_content_id UUID` in `update_revenue_split_atomic` and `record_revenue_split_ledger_atomic` (lines 32, 54)
- [ ] **P1-3 FIX:** Add `SET search_path = ''` to all three SECURITY DEFINER functions and prefix table references with `public.`
- [ ] **P2-2 FIX:** Delete the three " 2.sql" duplicate files from `supabase/migrations/`
- [ ] **P2-3 FIX:** Add `BYOK_ENCRYPTION_KEY` and `LNBITS_URL` to env files (or verify they exist in production secrets)

### PRE-DEPLOY (Required)

- [ ] Run all Section 2 baseline SQL queries and save results
- [ ] Confirm Supabase migration state is clean (no pending migrations)
- [ ] Take database backup (snapshot)
- [ ] Verify staging tests passed (pre-commit hook runs build + tests)
- [ ] Confirm rollback plan reviewed by team
- [ ] Verify target environment has required env vars (BYOK_ENCRYPTION_KEY, LNBITS_URL, NOSTR_RELAYS, REDIS_HOST)

### DEPLOY STEPS

1. [ ] Merge branch to main (triggers staging deployment)
2. [ ] Monitor Supabase migration logs -- all 14 migrations should complete
3. [ ] Verify backend starts without DI resolution errors
4. [ ] Run Section 4 post-deploy verification queries

### POST-DEPLOY (Within 5 Minutes)

- [ ] Run Section 4 verification queries -- compare with baseline
- [ ] Hit `/api/v2/` info endpoint -- verify all 14 endpoints listed
- [ ] Attempt `GET /api/v2/business/contracts/templates` -- should return 4 system templates
- [ ] Check error dashboard for 500s on new routes
- [ ] Verify state machine triggers work (Section 7 console test)

### MONITORING (24 Hours)

- [ ] Check metrics at +1h, +4h, +24h
- [ ] Monitor for BYOK decryption errors (if BYOK feature is used)
- [ ] Monitor for queue connection failures (BullMQ/Redis)
- [ ] Watch for RPC function errors in Supabase logs

### ROLLBACK (If Needed)

1. [ ] Restore database from pre-deploy backup
2. [ ] Deploy previous commit (revert merge)
3. [ ] Verify with Section 2 baseline queries -- counts should match pre-deploy
4. [ ] Notify team of rollback
