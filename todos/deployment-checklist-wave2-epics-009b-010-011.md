# Deployment Checklist: PR #86 -- Wave 2 EPICs 009B, 010, 011

**Branch:** `feat/wave2-epics-009b-010-011`
**PR:** #86
**Date:** 2026-02-19
**Scope:** 295 files changed, +35,185 / -285 lines
**Risk Level:** HIGH -- 16 SQL migrations (new tables with financial data, state machines, SECURITY DEFINER functions, escrow logic), 13 new backend services, 14 route files, 40+ frontend components

---

## CHANGE SUMMARY

| Epic        | What It Adds                                                                                                                           |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| EPIC-009B   | Adaptive inbox polling, NOSTR reply adapter, BYOK encryption for X/Twitter API keys                                                    |
| EPIC-010    | Creator circles, mentorship matching, collaborative content with revenue splits, service marketplace with custodial Lightning escrow   |
| EPIC-011    | Contract templates with red-flag analysis, business invoicing with LNURL-pay, expense tracking, revenue diversification, tax summaries |
| Remediation | 16 SQL migrations total (includes 5 security/review-fix migrations), SSRF hardening, state machine fixes                               |

**Key commits:**

- `b1b4b71` -- Pre-flight: 10 DI tokens, binding stubs, 8 route mounts, shared types
- `749bca8` -- Implementation: services, routes, migrations, tests
- `bdb9e40` -- 36 review findings fixed + pre-commit infrastructure
- `3c72ca2` -- 14 P1 post-remediation findings: RPC hardening, API contracts, SSRF, race guards
- `10fa8da` -- 38 P2/P3 review findings across 6 domains

---

## SECTION 1: DATA INVARIANTS

The following must remain true before AND after deploy:

- [ ] All existing `platform_connections` rows retain their current data (EPIC-009B adds 7 columns with safe defaults)
- [ ] `content` table exists with `id UUID` primary key (required by EPIC-010 FK references on `content_collaborators`, `revenue_split_ledger`)
- [ ] `auth.users` table exists (required by 15+ FK references across all new tables)
- [ ] `update_updated_at()` trigger function exists in baseline (required by remediation migration 300000 which drops the duplicate `update_updated_at_column()`)
- [ ] `inbox_messages` table exists (required by EPIC-009B index creation)
- [ ] None of the 19 new tables exist before migration (they use `CREATE TABLE IF NOT EXISTS`, but pre-existing tables with different schemas would silently skip creation)
- [ ] Foreign key integrity on all financial tables uses `ON DELETE RESTRICT` (prevents cascade deletion of financial records: `contracts`, `business_invoices`, `expenses`, `revenue_entries`, `service_orders`, `order_reviews`, `revenue_split_ledger`, `revenue_split_payments`, `content_collaborators`)
- [ ] `reply_templates.creator_id` values (if table has pre-existing data) must all be valid UUID strings (migration 300000 performs `ALTER COLUMN creator_id TYPE UUID USING creator_id::uuid`)
- [ ] Contract template seed data: exactly 4 system templates after deploy (category: sponsorship, licensing, freelance, collaboration)

---

## SECTION 2: PRE-DEPLOY AUDITS (Read-Only SQL)

Run these queries against the **target database** BEFORE deploying. Save all results as baseline values.

```sql
-- 2.1: Verify prerequisite tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('content', 'platform_connections', 'inbox_messages')
ORDER BY table_name;
-- EXPECTED: All three tables present

-- 2.2: Verify baseline trigger function exists
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
-- EXPECTED: 0 rows (tables do not yet exist)
-- EXCEPTION: reply_templates may exist if EPIC-009A was previously deployed

-- 2.4: If reply_templates exists, verify all creator_id values are valid UUIDs
-- (Migration 300000 casts TEXT -> UUID; non-UUID values will crash the migration)
SELECT count(*) FROM reply_templates;
-- If count > 0, run:
SELECT creator_id FROM reply_templates
WHERE creator_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
-- EXPECTED: 0 rows with non-UUID values. Any non-zero = STOP DEPLOYMENT.

-- 2.5: Baseline count of platform_connections (to verify ALTER TABLE does not lose data)
SELECT count(*) FROM platform_connections;
-- SAVE THIS NUMBER

-- 2.6: Verify content.id column is UUID type (required for FK references)
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'content' AND column_name = 'id';
-- EXPECTED: data_type = 'uuid'

-- 2.7: Check existing migration state
SELECT * FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 10;
-- EXPECTED: Last migration is from the prior deploy. No pending/failed migrations.
```

**Any deviation from expected values = STOP deployment and investigate.**

---

## SECTION 3: MIGRATION STEPS

### 3.1 Migration Execution Order

Supabase runs migrations alphabetically by filename. All 16 migrations are ordered correctly.

| #   | Migration File                                         | What It Does                                                                                                                          | Dependencies                                   | Idempotent                     | Est. Time |
| --- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------ | --------- |
| 1   | `20260220000000_epic009b_adaptive_polling.sql`         | ALTER platform_connections (+7 cols), CREATE reply_templates, 2 indexes                                                               | platform_connections, inbox_messages           | Yes (IF NOT EXISTS)            | <5s       |
| 2   | `20260220100000_epic010_creator_circles.sql`           | CREATE creator_circles, circle_members, circle_posts + RLS + get_user_circle_ids() SECURITY DEFINER + update_updated_at_column()      | auth.users                                     | Partial                        | <5s       |
| 3   | `20260220100100_epic010_mentorships.sql`               | CREATE mentor_profiles, mentorships + RLS + indexes                                                                                   | auth.users                                     | Partial                        | <5s       |
| 4   | `20260220100200_epic010_collaborative_content.sql`     | CREATE content_collaborators + validate_revenue_split_sum() trigger                                                                   | content table, auth.users                      | Partial                        | <5s       |
| 5   | `20260220100300_epic010_marketplace.sql`               | CREATE service_listings, service_orders, order_reviews + transition_order_state() + RLS                                               | auth.users, update_updated_at_column() from #2 | Partial                        | <5s       |
| 6   | `20260220100400_epic010_security_hardening.sql`        | ALTER order_reviews, service_orders; CREATE revenue_split_ledger, revenue_split_payments + RLS                                        | #5 service_orders, content table               | Yes (IF NOT EXISTS)            | <5s       |
| 7   | `20260220200000_epic011_contracts.sql`                 | CREATE contract_templates, contracts + RLS + 4 seed templates                                                                         | auth.users                                     | Yes (IF NOT EXISTS)            | <5s       |
| 8   | `20260220200100_epic011_business_invoices.sql`         | CREATE business_invoices + transition_invoice_state() trigger + RLS                                                                   | auth.users                                     | Yes (IF NOT EXISTS)            | <5s       |
| 9   | `20260220200200_epic011_expenses.sql`                  | CREATE expense_categories, expenses + RLS                                                                                             | auth.users                                     | Yes (IF NOT EXISTS)            | <5s       |
| 10  | `20260220200300_epic011_revenue_tracking.sql`          | CREATE revenue_entries, diversification_goals + RLS                                                                                   | auth.users                                     | Yes (IF NOT EXISTS)            | <5s       |
| 11  | `20260220200400_epic011_security_fixes.sql`            | ALTER revenue_entries, expenses, contract_templates, business_invoices (add rate_source, rate_timestamp, created_by, recurrence cols) | #7-#10                                         | Yes (ADD COLUMN IF NOT EXISTS) | <5s       |
| 12  | `20260220300000_fix_review_findings.sql`               | ALTER reply_templates TEXT->UUID, fix FKs, consolidate triggers, add missing updated_at triggers                                      | #1-#6                                          | Partial                        | <10s      |
| 13  | `20260220300100_fix_review_264_atomicity_rpc.sql`      | CREATE 3 atomic RPC functions (SECURITY DEFINER, SET search_path = '', REVOKE/GRANT)                                                  | #2, #4, #6                                     | Yes (CREATE OR REPLACE)        | <5s       |
| 14  | `20260220300200_fix_review_274_toctou.sql`             | CREATE 3 unique indexes for TOCTOU race prevention                                                                                    | #2, #3, #4                                     | Yes (IF NOT EXISTS)            | <5s       |
| 15  | `20260220300300_fix_review_308_release_status.sql`     | ALTER service_orders release_status CHECK to include 'permanently_failed'                                                             | #5                                             | Yes (DROP/ADD constraint)      | <5s       |
| 16  | `20260220300400_fix_review_309_dispute_transition.sql` | REPLACE transition_order_state() to allow escrow_funded -> disputed                                                                   | #5                                             | Yes (CREATE OR REPLACE)        | <5s       |

**Total estimated migration time:** <90 seconds on an idle database. Budget 2-5x for production load.

### 3.2 Dependency Chain (verified correct)

```
#1 (009b)  --> needs platform_connections, inbox_messages (baseline)
#2 (circles) --> needs auth.users (baseline)
#3 (mentorship) --> needs auth.users (baseline)
#4 (collab) --> needs content table (baseline)
#5 (marketplace) --> needs update_updated_at_column() from #2
#6 (security) --> needs service_orders from #5
#7-#10 (011) --> needs auth.users (baseline)
#11 (011 security) --> needs tables from #7-#10
#12 (review fixes) --> needs tables from #1-#6
#13 (RPC) --> needs tables from #2, #4, #6
#14 (TOCTOU) --> needs tables from #2, #3, #4
#15 (release_status) --> needs service_orders from #5
#16 (dispute) --> needs service_orders from #5
```

Alphabetical ordering by filename satisfies ALL dependencies.

### 3.3 Destructive/Irreversible Steps

| Step                                                   | What Changes                              | Reversibility                                                                 | Risk                                                 |
| ------------------------------------------------------ | ----------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------- |
| Migration #1: ALTER platform_connections               | Adds 7 columns with defaults              | Columns can be dropped                                                        | LOW -- defaults preserve existing data               |
| Migration #12: reply_templates.creator_id TEXT -> UUID | Type change with `USING creator_id::uuid` | UUID->TEXT revert requires FK drop first                                      | MEDIUM -- fails if non-UUID data exists              |
| Migration #12: Drop update_updated_at_column()         | Removes duplicate function                | Would need to recreate                                                        | LOW -- triggers already point to update_updated_at() |
| Migration #7: INSERT seed templates                    | 4 system contract templates               | DELETE FROM contract_templates WHERE created_by IS NULL                       | LOW                                                  |
| Migration #15: DROP/ADD CHECK constraint               | Widens release_status enum                | Narrowing back requires checking no rows have 'permanently_failed'            | LOW                                                  |
| Migration #16: REPLACE transition_order_state()        | Widens state machine                      | Narrowing back requires checking no rows transitioned escrow_funded->disputed | LOW                                                  |

---

## SECTION 4: NEW ROUTE ENDPOINTS (14 route files, 8 new mounts)

### 4.1 Route Mount Map

All routes mount under `/api/v2/` in `/Users/fp/Desktop/Sovren/packages/backend/src/routes/v2/index.ts`:

| Mount Path                   | Route File                   | Epic | Auth Required                                     | Rate Limit                                                    |
| ---------------------------- | ---------------------------- | ---- | ------------------------------------------------- | ------------------------------------------------------------- |
| `/api/v2/circles`            | circles.routes.ts            | 010  | Yes (authenticate + requireCreator)               | readOnly + mutation 20/min                                    |
| `/api/v2/mentorship`         | mentorship.routes.ts         | 010  | Yes                                               | readOnly + mutation 20/min                                    |
| `/api/v2/content`            | collaboration.routes.ts      | 010  | Yes                                               | readOnly + mutation 20/min                                    |
| `/api/v2/marketplace`        | marketplace.routes.ts        | 010  | Yes                                               | readOnly + mutation 20/min + escrow 5/min + transition 10/min |
| `/api/v2/business/contracts` | business-contracts.routes.ts | 011  | Mixed (templates public read, CRUD authenticated) | readOnly + mutation 20/min                                    |
| `/api/v2/business/invoices`  | business-invoices.routes.ts  | 011  | Yes                                               | readOnly + mutation 20/min                                    |
| `/api/v2/business/revenue`   | business-revenue.routes.ts   | 011  | Yes                                               | readOnly + mutation 20/min                                    |
| `/api/v2/business/tax`       | business-tax.routes.ts       | 011  | Yes                                               | readOnly + mutation 20/min                                    |

### 4.2 Rate Limiting Configuration

All mutation routes have per-user rate limiters. The marketplace has three tiers:

| Endpoint Category                          | Window | Max Requests | Key          | Notes                                            |
| ------------------------------------------ | ------ | ------------ | ------------ | ------------------------------------------------ |
| Read-only (all v2 routes)                  | 60s    | 100/IP       | IP-based     | Applied via `router.use(readOnlyRateLimiter)`    |
| General mutations                          | 60s    | 20/user      | NOSTR pubkey | Listings, reviews, contracts, invoices, expenses |
| Escrow creation (POST /marketplace/orders) | 60s    | 5/user       | NOSTR pubkey | Each call creates external Lightning state       |
| Order transitions (start/complete/dispute) | 60s    | 10/user      | NOSTR pubkey | Looser than escrow, stricter than general        |

Rate limiting uses Redis store when available (production) and falls back to in-memory store (development).

### 4.3 Route Ordering Verification

- `/api/v2/circles/suggested` is registered BEFORE `/:id` -- CORRECT (prevents "suggested" matching as UUID param)
- `/api/v2/business/contracts/templates` DELETE is registered BEFORE `/:id` DELETE -- CORRECT
- `/api/v2/content` mount does NOT conflict with any existing `/api/v2/content/*` routes (verified: no other routes use this prefix in v2)

---

## SECTION 5: DI CONTAINER VERIFICATION

### 5.1 New Service Bindings (13 services)

Registered in `/Users/fp/Desktop/Sovren/packages/backend/src/bootstrap.ts` via three binding modules:

| Module                  | File                    | Services                                                                                 | Lifetime  |
| ----------------------- | ----------------------- | ---------------------------------------------------------------------------------------- | --------- |
| Phase8ServicesModule    | `phase8.bindings.ts`    | InboxPollingService, NostrReplyAdapter (+ 5 existing EPIC-009 services)                  | Singleton |
| CommunityServicesModule | `community.bindings.ts` | CreatorCircleService, MentorshipService, CollaborativeContentService, MarketplaceService | Singleton |
| FinanceServicesModule   | `finance.bindings.ts`   | ContractService, BusinessInvoiceService, RevenueService, TaxService                      | Singleton |

### 5.2 Service Dependencies

Each new service depends on infrastructure services that must already be bound:

| Service                     | Dependencies                                     | Risk                                                                 |
| --------------------------- | ------------------------------------------------ | -------------------------------------------------------------------- |
| InboxPollingService         | Database, PlatformConnectionService, Logger      | PlatformConnectionService must resolve first                         |
| NostrReplyAdapter           | Database, Logger                                 | LOW                                                                  |
| CreatorCircleService        | Database, Logger                                 | LOW                                                                  |
| MentorshipService           | Database, Logger                                 | LOW                                                                  |
| CollaborativeContentService | Database, Logger                                 | LOW                                                                  |
| MarketplaceService          | Database, LightningService, QueueService, Logger | QueueService requires Redis connection                               |
| ContractService             | Database, Logger                                 | LOW                                                                  |
| BusinessInvoiceService      | Database, QueueService, Logger                   | QueueService requires Redis connection; lazy queue init (P2-5 fixed) |
| RevenueService              | Database, CacheService, Logger                   | CacheService requires Redis                                          |
| TaxService                  | Database, CacheService, Logger                   | CacheService requires Redis                                          |

### 5.3 DI Startup Verification

```bash
# Bootstrap validates all dependencies on startup
NODE_ENV=test npx ts-node packages/backend/src/bootstrap.ts
# EXPECTED: "Bootstrap complete" with no resolution errors

# Run the community and finance test suites
npx jest --config packages/backend/jest.community.config.js
npx jest --config packages/backend/jest.finance.config.js
```

---

## SECTION 6: ENVIRONMENT VARIABLES

### 6.1 Required Environment Variables (Must Exist in Target Environment)

| Variable                    | Used By                                      | Status                   | Default/Fallback                      |
| --------------------------- | -------------------------------------------- | ------------------------ | ------------------------------------- |
| `SUPABASE_URL`              | All services                                 | Existing                 | None -- required                      |
| `SUPABASE_ANON_KEY`         | All services                                 | Existing                 | None -- required                      |
| `LNBITS_URL`                | BusinessInvoiceService, MarketplaceService   | Existing in .env.example | Fallback: `https://lnbits.sovren.dev` |
| `LNBITS_API_KEY`            | MarketplaceService (escrow invoice creation) | Existing in .env.example | None -- required for escrow           |
| `REDIS_HOST` / Redis config | QueueService, CacheService, Rate Limiters    | Existing                 | Falls back to localhost               |
| `JWT_SECRET`                | Auth middleware on all routes                | Existing                 | None -- required                      |

### 6.2 New Environment Variables (NOT YET IN .env.example)

| Variable                        | Used By                                             | Impact If Missing                                                        | Action Required                                |
| ------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------- |
| `BYOK_ENCRYPTION_KEY`           | InboxPollingService (X/Twitter BYOK key decryption) | BYOK decryption will throw at runtime; only affects X/Twitter BYOK users | **Add to production secrets and .env.example** |
| `PLATFORM_TOKEN_ENCRYPTION_KEY` | PlatformConnectionService (OAuth token encryption)  | Existing from EPIC-009; verify it exists in production                   | Verify only                                    |

**BYOK_ENCRYPTION_KEY specification:**

- Must be a 64-character hex string (32 bytes / 256 bits)
- MUST be different from `PLATFORM_TOKEN_ENCRYPTION_KEY` (security requirement C-5)
- Generate: `openssl rand -hex 32`
- If not set, BYOK features (X/Twitter API key storage) will fail, but other features work normally

---

## SECTION 7: FRONTEND DEPLOYMENT

### 7.1 New Feature Modules

| Module           | Path                                              | Components                                                                                                                                                                |
| ---------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Business Manager | `packages/frontend/src/features/business/`        | ContractEditor, ContractLibrary, InvoiceDashboard, InvoiceEditor, ExpenseTracker, RevenueMix, TaxSummary, DiversificationGoals, RedFlagReport, BusinessNav, ErrorBoundary |
| Creator Network  | `packages/frontend/src/features/creator-network/` | CircleFeed, CircleManagement, CirclesBrowser, CollaborationInvite, RevenueSplitEditor, AudienceOverlap                                                                    |
| Multi-Platform   | `packages/frontend/src/features/multi-platform/`  | AudienceOverlap                                                                                                                                                           |

### 7.2 Frontend Build Verification

```bash
# Build verifies all imports resolve and bundles correctly
npm run build
# EXPECTED: Successful build with no missing module errors

# Verify new feature modules are included in the bundle
ls -la packages/frontend/dist/assets/js/
# New chunk files should appear for business and creator-network features
```

### 7.3 Frontend API Dependencies

All frontend hooks (useContracts, useBusinessInvoices, useRevenue, etc.) call v2 API endpoints. The frontend can deploy independently of the backend, but **features will show errors until the backend is deployed with the v2 routes active**.

**Recommended deployment order:** Backend first (with migrations), then frontend.

---

## SECTION 8: PRE-COMMIT HOOK CHANGES

File: `/Users/fp/Desktop/Sovren/.husky/pre-commit`

Changes made:

1. Added anti-pattern scanner as step 0 (runs `scripts/check-antipatterns.sh`)
2. Added `npm run test:pre-commit` which runs both `jest.community.config.js` and `jest.finance.config.js`

The anti-pattern scanner checks 4 patterns on staged files:

- Unsafe `any` types in source (not test) TypeScript files
- FK references without ON DELETE clause in SQL files
- Route files using `req.body` without Zod validation
- Mutation routes without rate limiters

**Impact:** Developers will see these checks on their next commit. No deployment risk.

---

## SECTION 9: POST-DEPLOY VERIFICATION (Within 5 Minutes)

### 9.1 Database Verification

```sql
-- 9.1.1: Verify all 19 new tables were created
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

-- 9.1.2: Verify all 7 RPC/trigger functions exist
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

-- 9.1.3: Verify RLS is enabled on ALL new tables
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
-- EXPECTED: ALL rowsecurity = true (19 rows, all true)

-- 9.1.4: Verify platform_connections data preserved
SELECT count(*) FROM platform_connections;
-- EXPECTED: Same count as pre-deploy baseline from Section 2.5

-- 9.1.5: Verify new columns on platform_connections
SELECT column_name FROM information_schema.columns
WHERE table_name = 'platform_connections'
  AND column_name IN ('poll_interval', 'last_active_at', 'instance_url',
                       'api_key_encrypted', 'api_key_iv', 'api_key_auth_tag', 'key_version')
ORDER BY column_name;
-- EXPECTED: 7 rows

-- 9.1.6: Verify contract template seed data
SELECT count(*) FROM contract_templates WHERE created_by IS NULL;
-- EXPECTED: 4 (system templates: sponsorship, licensing, freelance, collaboration)

-- 9.1.7: Verify 7 triggers exist
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

-- 9.1.8: Verify TOCTOU unique constraints
SELECT indexname FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'idx_circle_members_unique_membership',
    'idx_mentorships_unique_active',
    'idx_collaborations_unique_active'
  );
-- EXPECTED: 3 rows

-- 9.1.9: Verify reply_templates.creator_id type is now UUID
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'reply_templates' AND column_name = 'creator_id';
-- EXPECTED: data_type = 'uuid'

-- 9.1.10: Verify ON DELETE RESTRICT on financial tables
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
-- EXPECTED: All financial FK columns use RESTRICT

-- 9.1.11: Verify escrow state machine allows escrow_funded -> disputed
-- (Migration 300400 fix)
BEGIN;
INSERT INTO service_orders (listing_id, buyer_id, seller_id, status, amount_sats, idempotency_key)
VALUES (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 'pending', 1000, gen_random_uuid());
-- Simulate: pending -> escrow_funded -> disputed
UPDATE service_orders SET status = 'escrow_funded' WHERE amount_sats = 1000;
UPDATE service_orders SET status = 'disputed' WHERE amount_sats = 1000;
-- EXPECTED: No error on disputed transition
ROLLBACK;

-- 9.1.12: Verify release_status allows 'permanently_failed'
-- (Migration 300300 fix)
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'service_orders'::regclass
  AND conname = 'service_orders_release_status_check';
-- EXPECTED: CHECK includes 'permanently_failed'
```

### 9.2 API Endpoint Verification

```bash
# Verify v2 info endpoint lists all 14 endpoints
curl -s https://api.sovren.dev/api/v2/ | jq '.data.endpoints | keys'
# EXPECTED: 14 keys including circles, mentorship, marketplace,
#           business_contracts, business_invoices, business_revenue, business_tax

# Verify contract templates endpoint (public, no auth needed)
curl -s https://api.sovren.dev/api/v2/business/contracts/templates | jq '.data | length'
# EXPECTED: 4

# Verify auth-protected endpoints return 401 without token
curl -s -o /dev/null -w "%{http_code}" https://api.sovren.dev/api/v2/circles
# EXPECTED: 401

# Verify rate limiting headers are present
curl -s -I https://api.sovren.dev/api/v2/business/contracts/templates | grep -i ratelimit
# EXPECTED: RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset headers present
```

### 9.3 State Machine Smoke Tests

```sql
-- Invoice state machine: draft -> paid should fail
BEGIN;
INSERT INTO business_invoices (creator_id, client_name, line_items, total_sats, status)
VALUES ('00000000-0000-0000-0000-000000000001', 'Test', '[]', 1000, 'draft');
UPDATE business_invoices SET status = 'paid' WHERE client_name = 'Test';
-- EXPECTED: ERROR: Invalid invoice state transition: draft -> paid
ROLLBACK;

-- Revenue split validation: total > 10000 bps should fail
BEGIN;
INSERT INTO content_collaborators (content_id, creator_id, revenue_split_bps, status)
VALUES (gen_random_uuid(), gen_random_uuid(), 6000, 'accepted');
INSERT INTO content_collaborators (content_id, creator_id, revenue_split_bps, status)
VALUES (
  (SELECT content_id FROM content_collaborators LIMIT 1),
  gen_random_uuid(), 5000, 'accepted'
);
-- EXPECTED: ERROR: Revenue split sum would exceed 10000 bps
ROLLBACK;
```

---

## SECTION 10: ROLLBACK PLAN

### 10.1 Can We Roll Back?

- [x] **Yes, with caveats** -- All migrations are DDL (CREATE TABLE, ALTER TABLE, CREATE FUNCTION) with no data transformation except:
  - 4 contract template seed INSERTs (easily re-inserted)
  - reply_templates.creator_id TEXT->UUID type change (requires FK drop before revert)
- [ ] Down migrations exist as inline SQL comments but NOT as standalone executable rollback files
- [ ] No feature flags gate the new routes (all-or-nothing rollback)

### 10.2 Rollback Decision Matrix

| Scenario                                           | Action                                                                            |
| -------------------------------------------------- | --------------------------------------------------------------------------------- |
| Migration fails partway through                    | Fix the failing migration, re-run. Supabase tracks which migrations have run.     |
| Backend crashes on startup (DI resolution failure) | Revert to previous git commit. Migrations can stay (tables exist but are unused). |
| Financial data corruption in escrow/invoicing      | Restore from pre-deploy database backup immediately.                              |
| Non-critical bug in one feature (e.g., circles)    | Leave deployed, fix forward with a hotfix commit.                                 |
| Rate limiting too aggressive / too loose           | Adjust rate limit constants in route files, redeploy. No migration needed.        |

### 10.3 Full Rollback Steps

**Step 1: Code Rollback**

```bash
# Revert the merge commit
git revert <merge-commit-sha> --no-edit
git push origin main
# Triggers automatic staging redeployment
```

**Step 2: Database Rollback (only if data integrity is compromised)**

```bash
# OPTION A: Restore from backup (recommended)
# Restore the pre-deploy database snapshot taken in Section 2

# OPTION B: Manual DDL rollback (error-prone, use only if backup unavailable)
# Run in reverse order -- see inline DOWN comments in each migration file
# Full rollback SQL is ~100 lines; see migration 300000-300400 DOWN comments
```

**Step 3: Verify Rollback**

```sql
-- Re-run Section 2 baseline queries
-- All values should match the pre-deploy baseline
SELECT count(*) FROM platform_connections;
-- EXPECTED: Matches pre-deploy count

SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'creator_circles';
-- EXPECTED: 0 rows (if full DB restore) or 1 row (if code-only rollback)
```

---

## SECTION 11: POST-DEPLOY MONITORING (First 24 Hours)

### 11.1 Alert Conditions

| Metric/Log                  | Alert Condition                                     | Where to Check                     |
| --------------------------- | --------------------------------------------------- | ---------------------------------- |
| Backend error rate          | > 1% for 5 minutes                                  | Supabase dashboard, backend stderr |
| DI resolution failures      | Any `resolve()` error in logs                       | Backend startup logs               |
| Migration failures          | Any error in `supabase_migrations`                  | Supabase dashboard > Migrations    |
| 500 responses on /api/v2/\* | > 0 in first 30 minutes                             | API gateway logs                   |
| RPC function errors         | Any `RAISE EXCEPTION` from new functions            | Supabase PostgreSQL logs           |
| Queue connection failures   | BullMQ "ECONNREFUSED" or timeout                    | Redis connectivity logs            |
| BYOK decryption failures    | "BYOK_ENCRYPTION_KEY" in error logs                 | InboxPollingService logs           |
| Rate limiter errors         | Redis store errors                                  | Rate-limit-middleware logs         |
| Frontend JS errors          | New errors in business/ or creator-network/ modules | Browser console, error tracking    |

### 11.2 Monitoring Schedule

| Timeframe | What to Check                                                                     |
| --------- | --------------------------------------------------------------------------------- |
| +5 min    | Run Section 9 verification queries; check error dashboard                         |
| +30 min   | Check for any 500s on new v2 routes; verify rate limiting is working              |
| +1 hour   | Run console verification below; spot-check contract templates                     |
| +4 hours  | Check for BYOK decryption errors; verify queue processing                         |
| +24 hours | Review full error logs; confirm no data integrity issues; close deployment ticket |

### 11.3 Console Verification (Run at +1 hour)

```sql
-- Are users creating data in new tables?
SELECT 'creator_circles' as tbl, count(*) FROM creator_circles
UNION ALL SELECT 'service_listings', count(*) FROM service_listings
UNION ALL SELECT 'contracts', count(*) FROM contracts
UNION ALL SELECT 'contract_templates', count(*) FROM contract_templates
UNION ALL SELECT 'business_invoices', count(*) FROM business_invoices;
-- contract_templates expected: >= 4 (seed data)
-- Others may be 0 if no users have tried the features yet

-- Verify no orphaned/corrupt data
SELECT count(*) FROM circle_members cm
LEFT JOIN creator_circles cc ON cm.circle_id = cc.id
WHERE cc.id IS NULL;
-- EXPECTED: 0

SELECT count(*) FROM service_orders so
LEFT JOIN service_listings sl ON so.listing_id = sl.id
WHERE sl.id IS NULL;
-- EXPECTED: 0
```

---

## GO/NO-GO CHECKLIST

### BLOCKERS (Must resolve before deploy)

Previous P1 findings status:

- [x] ~~P1-1: `revenue_share_bps` -> `revenue_split_bps`~~ FIXED in commit `3c72ca2`
- [x] ~~P1-2: `p_content_id TEXT` -> `UUID`~~ FIXED in commit `3c72ca2`
- [x] ~~P1-3: Missing `SET search_path = ''`~~ FIXED in commit `3c72ca2`

Remaining blockers:

- [ ] **ENV-1:** Add `BYOK_ENCRYPTION_KEY` to production secrets (generate with `openssl rand -hex 32`; must differ from `PLATFORM_TOKEN_ENCRYPTION_KEY`)
- [ ] **ENV-2:** Verify `LNBITS_URL` and `LNBITS_API_KEY` are set in production (required for marketplace escrow)
- [ ] **ENV-3:** Verify Redis is accessible (required by QueueService, CacheService, rate limiters; 4 services depend on it)
- [ ] **CLEAN-1:** Confirm no " 2.sql" duplicate migration files exist on disk (macOS Finder copies)

### PRE-DEPLOY (Required)

- [ ] Run ALL Section 2 baseline SQL queries and save results
- [ ] Confirm Supabase migration state is clean (no pending/failed migrations)
- [ ] Take database backup/snapshot
- [ ] Verify staging environment tests passed (pre-commit hook runs build + community + finance tests)
- [ ] Confirm rollback plan reviewed by at least one other engineer
- [ ] Verify target environment has all required env vars (Section 6)
- [ ] Run `npm run test:pre-commit` locally and confirm all tests pass

### DEPLOY STEPS

1. [ ] Merge branch `feat/wave2-epics-009b-010-011` to main (triggers staging deployment)
2. [ ] Monitor Supabase migration dashboard -- all 16 migrations should complete in <2 minutes
3. [ ] Verify backend starts without DI resolution errors in logs
4. [ ] Verify frontend build succeeds and deploys

### POST-DEPLOY (Within 5 Minutes)

- [ ] Run Section 9.1 database verification queries (all 12 checks)
- [ ] Run Section 9.2 API endpoint verification (4 curl checks)
- [ ] Hit `GET /api/v2/` info endpoint -- verify all 14 route endpoints listed
- [ ] Hit `GET /api/v2/business/contracts/templates` -- verify 4 system templates returned
- [ ] Check error dashboard for any 500s on new v2 routes
- [ ] Run Section 9.3 state machine smoke tests

### MONITORING (24 Hours)

- [ ] Check metrics at +5min, +30min, +1h, +4h, +24h (Section 11.2)
- [ ] Run Section 11.3 console verification at +1 hour
- [ ] Monitor for BYOK decryption errors in InboxPollingService logs
- [ ] Monitor for queue connection failures (BullMQ/Redis)
- [ ] Watch for RPC function errors in Supabase PostgreSQL logs
- [ ] Confirm no frontend JS errors in business/ or creator-network/ modules

### ROLLBACK (If Needed)

1. [ ] Determine rollback scope (code-only vs. code+database)
2. [ ] If code-only: `git revert <merge-sha>` and push to main
3. [ ] If code+database: Restore database from pre-deploy snapshot
4. [ ] Verify rollback with Section 2 baseline queries
5. [ ] Notify team and create incident report

---

## APPENDIX A: FILE INVENTORY

### Backend Services (13 new)

| Service                       | File                                                                                                   |
| ----------------------------- | ------------------------------------------------------------------------------------------------------ |
| InboxPollingService           | `/Users/fp/Desktop/Sovren/packages/backend/src/services/distribution/InboxPollingService.ts`           |
| NostrReplyAdapter             | `/Users/fp/Desktop/Sovren/packages/backend/src/services/distribution/NostrReplyAdapter.ts`             |
| CreatorCircleService          | `/Users/fp/Desktop/Sovren/packages/backend/src/services/community/CreatorCircleService.ts`             |
| MentorshipService             | `/Users/fp/Desktop/Sovren/packages/backend/src/services/community/MentorshipService.ts`                |
| CollaborativeContentService   | `/Users/fp/Desktop/Sovren/packages/backend/src/services/community/CollaborativeContentService.ts`      |
| MarketplaceService            | `/Users/fp/Desktop/Sovren/packages/backend/src/services/community/MarketplaceService.ts`               |
| ContractService               | `/Users/fp/Desktop/Sovren/packages/backend/src/services/finance/ContractService.ts`                    |
| BusinessInvoiceService        | `/Users/fp/Desktop/Sovren/packages/backend/src/services/finance/BusinessInvoiceService.ts`             |
| RevenueService                | `/Users/fp/Desktop/Sovren/packages/backend/src/services/finance/RevenueService.ts`                     |
| TaxService                    | `/Users/fp/Desktop/Sovren/packages/backend/src/services/finance/TaxService.ts`                         |
| CrossPlatformAnalyticsService | `/Users/fp/Desktop/Sovren/packages/backend/src/services/distribution/CrossPlatformAnalyticsService.ts` |
| PlatformConnectionService     | `/Users/fp/Desktop/Sovren/packages/backend/src/services/distribution/PlatformConnectionService.ts`     |
| RepurposingService            | `/Users/fp/Desktop/Sovren/packages/backend/src/services/distribution/RepurposingService.ts`            |

### DI Binding Files

| File                                                                                     | Services Bound               |
| ---------------------------------------------------------------------------------------- | ---------------------------- |
| `/Users/fp/Desktop/Sovren/packages/backend/src/container/bindings/phase8.bindings.ts`    | 7 (5 EPIC-009 + 2 EPIC-009B) |
| `/Users/fp/Desktop/Sovren/packages/backend/src/container/bindings/community.bindings.ts` | 4 (EPIC-010)                 |
| `/Users/fp/Desktop/Sovren/packages/backend/src/container/bindings/finance.bindings.ts`   | 4 (EPIC-011)                 |

### Validator Files

| File                                                                    | Schemas Exported                                                                                                                                                                                                                                                                                             |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/Users/fp/Desktop/Sovren/packages/backend/src/validators/community.ts` | CreateCircleSchema, CreateCirclePostSchema, RegisterMentorSchema, RequestMentorshipSchema, RespondMentorshipSchema, UpdateMentorProfileSchema, InviteCollaboratorSchema, RespondCollaborationSchema, UpdateRevenueSplitSchema, CreateListingSchema, UpdateListingSchema, PlaceOrderSchema, ReviewOrderSchema |
| `/Users/fp/Desktop/Sovren/packages/backend/src/validators/finance.ts`   | LineItemSchema, CreateContractSchema, UpdateContractSchema, AnalyzeContractSchema, CreateTemplateSchema, InvoiceSchema, UpdateInvoiceStatusSchema, RecordRevenueSchema, SetDiversificationGoalsSchema, ExpenseSchema, CreateExpenseCategorySchema                                                            |

### SQL Migration Files (16)

All in `/Users/fp/Desktop/Sovren/supabase/migrations/`:

- `20260220000000_epic009b_adaptive_polling.sql`
- `20260220100000_epic010_creator_circles.sql`
- `20260220100100_epic010_mentorships.sql`
- `20260220100200_epic010_collaborative_content.sql`
- `20260220100300_epic010_marketplace.sql`
- `20260220100400_epic010_security_hardening.sql`
- `20260220200000_epic011_contracts.sql`
- `20260220200100_epic011_business_invoices.sql`
- `20260220200200_epic011_expenses.sql`
- `20260220200300_epic011_revenue_tracking.sql`
- `20260220200400_epic011_security_fixes.sql`
- `20260220300000_fix_review_findings_268_273_288_293_294.sql`
- `20260220300100_fix_review_264_atomicity_rpc.sql`
- `20260220300200_fix_review_274_toctou_unique_constraints.sql`
- `20260220300300_fix_review_308_release_status.sql`
- `20260220300400_fix_review_309_dispute_transition.sql`
