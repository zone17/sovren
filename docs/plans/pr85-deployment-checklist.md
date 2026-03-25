# Deployment Checklist: PR #85 - Phase 1 Epics (EPIC-009 Multi-Platform Hub)

**Branch:** `feature/phase1-epics`
**Date:** 2026-02-16
**Risk Level:** HIGH - 6 new database tables, 13 new services, encrypted credential storage, BullMQ queue dependency
**Estimated Deployment Duration:** 15-25 minutes (migrations + verification)

---

## Table of Contents

1. [Data Invariants](#1-data-invariants)
2. [Pre-Deploy Checklist (RED)](#2-pre-deploy-checklist-red)
3. [SQL Verification Queries - Pre-Deploy](#3-sql-verification-queries---pre-deploy)
4. [Deploy Steps (YELLOW)](#4-deploy-steps-yellow)
5. [Post-Deploy Verification (GREEN) - Within 5 Minutes](#5-post-deploy-verification-green---within-5-minutes)
6. [Post-Deploy SQL Verification](#6-post-deploy-sql-verification)
7. [Post-Deploy Monitoring (BLUE) - 24 Hours](#7-post-deploy-monitoring-blue---24-hours)
8. [Rollback Procedure](#8-rollback-procedure)
9. [Known Risks and Mitigations](#9-known-risks-and-mitigations)

---

## 1. Data Invariants

These conditions MUST remain true before and after deployment:

- [ ] All 5 existing table schemas are unchanged (users, content, payments, etc.)
- [ ] All existing RLS policies on pre-existing tables are unmodified
- [ ] No existing data is modified or deleted by any of the 6 migrations
- [ ] All 5 new tables are created with RLS enabled from the start
- [ ] All 5 new tables enforce `creator_id` isolation via RLS policies
- [ ] The `platform_connections` table encrypts all tokens at rest (no plaintext columns)
- [ ] The `platform` CHECK constraints match exactly: `('mastodon','bluesky','twitter','youtube')` on platform_connections, cross_posts, repurposed_content; and `('mastodon','bluesky','twitter','youtube','nostr')` on inbox_messages, platform_metrics_history
- [ ] UNIQUE constraints enforced: `(creator_id, platform)` on platform_connections; `(creator_id, platform, platform_message_id)` on inbox_messages; `(creator_id, platform, recorded_at)` on platform_metrics_history
- [ ] Zero rows exist in new tables immediately after migration (additive-only, no backfill)
- [ ] `PLATFORM_TOKEN_ENCRYPTION_KEY` is exactly 64 hex characters (32 bytes / 256 bits)
- [ ] Redis is reachable and BullMQ can create the `cross-publish` queue

---

## 2. Pre-Deploy Checklist (RED)

### 2.1 Environment Variables - REQUIRED

Verify ALL of the following are set in the target environment BEFORE deploying.
Missing any of these will cause runtime failures.

**Critical (App will crash without these):**

| Variable                                 | Format                              | Validation                                                        | Used By                                           |
| ---------------------------------------- | ----------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------- |
| `PLATFORM_TOKEN_ENCRYPTION_KEY`          | 64-char hex string                  | `echo -n "$PLATFORM_TOKEN_ENCRYPTION_KEY" \| wc -c` must equal 64 | `crypto.ts` - AES-256-GCM encryption              |
| `API_BASE_URL`                           | URL (e.g. `https://api.sovren.dev`) | Must be publicly reachable for OAuth callbacks                    | `PlatformConnectionService` - OAuth callback URLs |
| `REDIS_URL` or `REDIS_HOST`+`REDIS_PORT` | Redis connection string             | `redis-cli ping` must return PONG                                 | `lib/redis.ts` - BullMQ queues                    |

**Platform OAuth Credentials (graceful degradation if missing -- adapter skipped):**

| Variable                 | Format | Required For            |
| ------------------------ | ------ | ----------------------- |
| `MASTODON_CLIENT_ID`     | String | Mastodon OAuth connect  |
| `MASTODON_CLIENT_SECRET` | String | Mastodon OAuth connect  |
| `BLUESKY_CLIENT_ID`      | String | Bluesky OAuth connect   |
| `BLUESKY_CLIENT_SECRET`  | String | Bluesky OAuth connect   |
| `TWITTER_CLIENT_ID`      | String | Twitter/X OAuth connect |
| `TWITTER_CLIENT_SECRET`  | String | Twitter/X OAuth connect |
| `YOUTUBE_CLIENT_ID`      | String | YouTube OAuth connect   |
| `YOUTUBE_CLIENT_SECRET`  | String | YouTube OAuth connect   |

**Optional (defaults exist):**

| Variable       | Default                 | Purpose                                                        |
| -------------- | ----------------------- | -------------------------------------------------------------- |
| `FRONTEND_URL` | `http://localhost:3000` | OAuth redirect after callback, backlinks in repurposed content |

**Verification commands:**

```bash
# Verify encryption key length (must output 64)
echo -n "$PLATFORM_TOKEN_ENCRYPTION_KEY" | wc -c

# Generate a new key if needed (DO NOT USE IN PRODUCTION WITHOUT SECURE STORAGE)
openssl rand -hex 32

# Verify Redis connectivity
redis-cli -u "$REDIS_URL" ping
# Expected: PONG

# Verify API_BASE_URL is reachable
curl -s -o /dev/null -w "%{http_code}" "$API_BASE_URL/health"
# Expected: 200

# Verify OAuth callback URL is routable (for each platform)
curl -s -o /dev/null -w "%{http_code}" "$API_BASE_URL/api/v2/platforms/callback/mastodon"
# Expected: 4xx (no code/state) -- confirms route exists
```

**BLOCKING FINDING: `.env.example` was NOT updated in this PR.** The following variables are missing from `packages/backend/.env.example`:

- `PLATFORM_TOKEN_ENCRYPTION_KEY`
- `API_BASE_URL`
- `MASTODON_CLIENT_ID` / `MASTODON_CLIENT_SECRET`
- `BLUESKY_CLIENT_ID` / `BLUESKY_CLIENT_SECRET`
- `TWITTER_CLIENT_ID` / `TWITTER_CLIENT_SECRET`
- `YOUTUBE_CLIENT_ID` / `YOUTUBE_CLIENT_SECRET`
- `FRONTEND_URL`

This MUST be fixed before merge to prevent future developers from missing required variables.

### 2.2 Infrastructure Prerequisites

- [ ] Redis is running and reachable from the backend deployment target
- [ ] Redis has sufficient memory for BullMQ queues (min recommended: 256MB available)
- [ ] Supabase project is accessible and accepting connections
- [ ] Supabase migration CLI (`supabase`) is available on the deployment host
- [ ] Database backup has been taken within the last hour
- [ ] Current deployment commit hash is recorded for rollback: `git rev-parse HEAD`

### 2.3 Staging Verification

- [ ] All 6 migrations have been run successfully on staging
- [ ] All backend unit tests pass (`npm run test:unit`)
- [ ] Integration tests pass for distribution services
- [ ] OAuth flow tested end-to-end on staging with at least one platform
- [ ] BullMQ cross-publish queue creates successfully on staging
- [ ] Health endpoint returns `healthy` on staging after deploy

---

## 3. SQL Verification Queries - Pre-Deploy

Run these BEFORE deployment to establish baselines. Save the output.

```sql
-- ============================================================================
-- BASELINE 1: Verify new tables do NOT exist yet
-- All should return 0 rows / false
-- ============================================================================

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'platform_connections',
    'cross_posts',
    'repurposed_content',
    'inbox_messages',
    'platform_metrics_history'
  );
-- EXPECTED: 0 rows (tables don't exist yet)

-- ============================================================================
-- BASELINE 2: Existing table counts (save these for post-deploy comparison)
-- ============================================================================

SELECT
  (SELECT COUNT(*) FROM auth.users) AS user_count,
  (SELECT COUNT(*) FROM content) AS content_count;
-- EXPECTED: Record current values. Must be unchanged after deploy.

-- ============================================================================
-- BASELINE 3: Verify existing RLS policies are intact
-- ============================================================================

SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
-- EXPECTED: Record current list. No policies should be removed after deploy.

-- ============================================================================
-- BASELINE 4: Count existing indexes (for before/after comparison)
-- ============================================================================

SELECT COUNT(*) AS existing_index_count
FROM pg_indexes
WHERE schemaname = 'public';
-- EXPECTED: Record value. After deploy this should increase by 16.
```

---

## 4. Deploy Steps (YELLOW)

### 4.1 Migration Execution Order

Migrations MUST be run in this exact sequence. Each depends on the previous.

| Step | Migration File                                        | What It Does                                                                               | Estimated Runtime | Rollback SQL                                                                                                             |
| ---- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 1    | `20260216200000_epic009_platform_connections.sql`     | Creates `platform_connections` table, 3 indexes, RLS policy                                | < 1 sec           | `DROP TABLE IF EXISTS platform_connections CASCADE;`                                                                     |
| 2    | `20260216200100_epic009_cross_posts.sql`              | Creates `cross_posts` table, 4 indexes, RLS policy                                         | < 1 sec           | `DROP TABLE IF EXISTS cross_posts CASCADE;`                                                                              |
| 3    | `20260216200200_epic009_repurposed_content.sql`       | Creates `repurposed_content` table, 2 indexes, RLS policy                                  | < 1 sec           | `DROP TABLE IF EXISTS repurposed_content CASCADE;`                                                                       |
| 4    | `20260216200300_epic009_inbox_messages.sql`           | Creates `inbox_messages` table, 4 indexes, RLS policy                                      | < 1 sec           | `DROP TABLE IF EXISTS inbox_messages CASCADE;`                                                                           |
| 5    | `20260216200400_epic009_platform_metrics_history.sql` | Creates `platform_metrics_history` table, 2 indexes, RLS policy                            | < 1 sec           | `DROP TABLE IF EXISTS platform_metrics_history CASCADE;`                                                                 |
| 6    | `20260216200500_add_refresh_token_iv_columns.sql`     | Adds `refresh_token_iv` + `refresh_token_auth_tag` BYTEA columns to `platform_connections` | < 1 sec           | `ALTER TABLE platform_connections DROP COLUMN IF EXISTS refresh_token_iv, DROP COLUMN IF EXISTS refresh_token_auth_tag;` |

**Execution command:**

```bash
# Via Supabase CLI (recommended)
supabase db push

# Or manual execution in order
psql "$DATABASE_URL" -f supabase/migrations/20260216200000_epic009_platform_connections.sql
psql "$DATABASE_URL" -f supabase/migrations/20260216200100_epic009_cross_posts.sql
psql "$DATABASE_URL" -f supabase/migrations/20260216200200_epic009_repurposed_content.sql
psql "$DATABASE_URL" -f supabase/migrations/20260216200300_epic009_inbox_messages.sql
psql "$DATABASE_URL" -f supabase/migrations/20260216200400_epic009_platform_metrics_history.sql
psql "$DATABASE_URL" -f supabase/migrations/20260216200500_add_refresh_token_iv_columns.sql
```

**IMPORTANT NOTE ON MIGRATION 6:** Migration 6 adds columns to the table created by migration 1. If migration 1 fails, migration 6 will also fail. If running manually, verify migration 1 succeeded before running migration 6.

### 4.2 Backend Service Deployment

```bash
# 1. Deploy the new backend code
# (Automated via CI/CD pipeline -- triggers on merge to main)

# 2. Verify DI container initializes all Phase 8 services
# The server will fail to start if any TYPES.* token cannot resolve.
# Monitor server startup logs for:
#   - "[QueueService] Queue "cross-publish" created"
#   - No "Cannot resolve" errors for Phase 8 tokens
```

### 4.3 Deployment Sequence

```
1. [ ] Take database backup
2. [ ] Run migrations 1-6 in order
3. [ ] Verify migrations (Section 6 SQL queries)
4. [ ] Deploy backend code (new services + routes)
5. [ ] Wait for healthy startup (check /health/detailed)
6. [ ] Verify BullMQ queue creation (check /health/detailed queues section)
7. [ ] Run post-deploy verification (Section 5)
```

---

## 5. Post-Deploy Verification (GREEN) - Within 5 Minutes

### 5.1 Health Endpoint Checks

```bash
# Basic health
curl -s "$API_BASE_URL/health" | jq '.status'
# EXPECTED: "healthy"

# Detailed health (includes Redis, DB, queues)
curl -s "$API_BASE_URL/health/detailed" | jq '{
  status: .status,
  db: .services.database.status,
  redis: .services.redis.status,
  queues: .services.queues.status,
  queue_names: .services.queues.details.queues
}'
# EXPECTED:
# {
#   "status": "healthy",
#   "db": "healthy",
#   "redis": "healthy",
#   "queues": "healthy",
#   "queue_names": ["cross-publish", ...]
# }

# Readiness probe
curl -s "$API_BASE_URL/ready" | jq '.status'
# EXPECTED: "ready"

# API v2 info endpoint
curl -s "$API_BASE_URL/api/v2" | jq '.data.endpoints'
# EXPECTED: Must include platforms, distribute, inbox, analytics_crossplatform
```

### 5.2 DI Container Resolution Test

All 5 Phase 8 services must resolve from the DI container. These are verified implicitly
by hitting their route endpoints. If ANY of these return a 500 with "Cannot resolve", the
DI container is misconfigured.

```bash
# Platform status (requires auth -- test with a valid token)
curl -s -H "Authorization: Bearer $TEST_TOKEN" \
  "$API_BASE_URL/api/v2/platforms/status" | jq '.success'
# EXPECTED: true (returns empty array of platform statuses)

# Inbox messages (requires auth)
curl -s -H "Authorization: Bearer $TEST_TOKEN" \
  "$API_BASE_URL/api/v2/inbox/messages?status=all" | jq '.success'
# EXPECTED: true (returns empty messages array)

# Analytics overview (requires auth)
curl -s -H "Authorization: Bearer $TEST_TOKEN" \
  "$API_BASE_URL/api/v2/analytics/cross-platform/overview" | jq '.success'
# EXPECTED: true (returns zeroed overview)
```

**Services that must resolve:**

| DI Token                              | Service Class                   | Depends On                                                |
| ------------------------------------- | ------------------------------- | --------------------------------------------------------- |
| `TYPES.PlatformConnectionService`     | `PlatformConnectionService`     | Database, Logger                                          |
| `TYPES.CrossPostService`              | `CrossPostService`              | Database, QueueService, PlatformConnectionService, Logger |
| `TYPES.RepurposingService`            | `RepurposingService`            | Database, Logger                                          |
| `TYPES.UnifiedInboxService`           | `UnifiedInboxService`           | Database, PlatformConnectionService, Logger               |
| `TYPES.CrossPlatformAnalyticsService` | `CrossPlatformAnalyticsService` | Database, PlatformConnectionService, Logger               |
| `TYPES.QueueService`                  | `QueueService`                  | Logger (+ Redis at runtime)                               |

### 5.3 BullMQ Queue Health

```bash
# Via detailed health endpoint
curl -s "$API_BASE_URL/health/detailed" | jq '.services.queues'
# EXPECTED:
# {
#   "status": "healthy",
#   "responseTime": <number>,
#   "details": {
#     "queueCount": >= 1,
#     "queues": ["cross-publish", ...]
#   }
# }

# If Bull Board admin is mounted:
# Visit $API_BASE_URL/admin/queues to visually inspect queue state
```

### 5.4 OAuth Flow Smoke Test (If Platform Credentials Are Configured)

```bash
# Initiate a Mastodon connection (requires auth)
curl -s -X POST -H "Authorization: Bearer $TEST_TOKEN" \
  "$API_BASE_URL/api/v2/platforms/connect/mastodon" | jq '.'
# EXPECTED: { "success": true, "data": { "authorization_url": "https://..." } }
# DO NOT follow the URL in production. This confirms the adapter initialized.

# Verify invalid platform is rejected
curl -s -X POST -H "Authorization: Bearer $TEST_TOKEN" \
  "$API_BASE_URL/api/v2/platforms/connect/invalid" | jq '.'
# EXPECTED: 400/422 validation error
```

---

## 6. Post-Deploy SQL Verification

Run these IMMEDIATELY after deployment completes.

```sql
-- ============================================================================
-- CHECK 1: All 5 new tables exist
-- ============================================================================

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'platform_connections',
    'cross_posts',
    'repurposed_content',
    'inbox_messages',
    'platform_metrics_history'
  )
ORDER BY table_name;
-- EXPECTED: Exactly 5 rows:
--   cross_posts
--   inbox_messages
--   platform_connections
--   platform_metrics_history
--   repurposed_content

-- ============================================================================
-- CHECK 2: RLS is enabled on ALL 5 new tables
-- ============================================================================

SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'platform_connections',
    'cross_posts',
    'repurposed_content',
    'inbox_messages',
    'platform_metrics_history'
  )
ORDER BY tablename;
-- EXPECTED: All 5 rows show rowsecurity = true

-- ============================================================================
-- CHECK 3: RLS policies exist for all 5 tables
-- ============================================================================

SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'platform_connections',
    'cross_posts',
    'repurposed_content',
    'inbox_messages',
    'platform_metrics_history'
  )
ORDER BY tablename;
-- EXPECTED: 5 rows, one per table, each with:
--   cmd = '*' (ALL operations)
--   qual containing: creator_id = current_setting('app.current_user_id'...

-- ============================================================================
-- CHECK 4: All 16 new indexes exist (3 + 4 + 2 + 4 + 2 + the PKs)
-- ============================================================================

SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'platform_connections',
    'cross_posts',
    'repurposed_content',
    'inbox_messages',
    'platform_metrics_history'
  )
ORDER BY tablename, indexname;
-- EXPECTED indexes:
--
-- platform_connections (3 + PK + UNIQUE):
--   platform_connections_pkey
--   platform_connections_creator_id_platform_key (UNIQUE)
--   idx_platform_connections_creator
--   idx_platform_connections_status
--   idx_platform_connections_expires
--
-- cross_posts (4 + PK):
--   cross_posts_pkey
--   idx_cross_posts_creator
--   idx_cross_posts_content
--   idx_cross_posts_status
--   idx_cross_posts_scheduled
--
-- repurposed_content (2 + PK):
--   repurposed_content_pkey
--   idx_repurposed_creator
--   idx_repurposed_source
--
-- inbox_messages (4 + PK + UNIQUE):
--   inbox_messages_pkey
--   inbox_messages_creator_id_platform_platform_message_id_key (UNIQUE)
--   idx_inbox_creator
--   idx_inbox_creator_unread
--   idx_inbox_creator_platform
--   idx_inbox_fetched
--
-- platform_metrics_history (2 + PK + UNIQUE):
--   platform_metrics_history_pkey
--   platform_metrics_history_creator_id_platform_recorded_at_key (UNIQUE)
--   idx_platform_metrics_creator
--   idx_platform_metrics_recorded

-- ============================================================================
-- CHECK 5: refresh_token_iv/auth_tag columns exist on platform_connections
-- ============================================================================

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'platform_connections'
  AND column_name IN ('refresh_token_iv', 'refresh_token_auth_tag')
ORDER BY column_name;
-- EXPECTED: 2 rows:
--   refresh_token_auth_tag | bytea | YES
--   refresh_token_iv       | bytea | YES

-- ============================================================================
-- CHECK 6: New tables are empty (no data corruption during migration)
-- ============================================================================

SELECT
  (SELECT COUNT(*) FROM platform_connections) AS platform_connections_count,
  (SELECT COUNT(*) FROM cross_posts) AS cross_posts_count,
  (SELECT COUNT(*) FROM repurposed_content) AS repurposed_content_count,
  (SELECT COUNT(*) FROM inbox_messages) AS inbox_messages_count,
  (SELECT COUNT(*) FROM platform_metrics_history) AS platform_metrics_history_count;
-- EXPECTED: All 5 counts = 0

-- ============================================================================
-- CHECK 7: Existing data unchanged (compare with pre-deploy baseline)
-- ============================================================================

SELECT
  (SELECT COUNT(*) FROM auth.users) AS user_count,
  (SELECT COUNT(*) FROM content) AS content_count;
-- EXPECTED: Same values as pre-deploy baseline (Section 3)

-- ============================================================================
-- CHECK 8: CHECK constraints are properly defined
-- ============================================================================

SELECT conname, conrelid::regclass AS table_name, consrc
FROM pg_constraint
WHERE contype = 'c'
  AND conrelid::regclass::text IN (
    'platform_connections',
    'cross_posts',
    'repurposed_content',
    'inbox_messages',
    'platform_metrics_history'
  )
ORDER BY table_name, conname;
-- EXPECTED: CHECK constraints for platform enum values and status enum values
-- on each table as defined in the migration files
```

---

## 7. Post-Deploy Monitoring (BLUE) - 24 Hours

### 7.1 Metrics and Alerts

| Metric / Log                       | Alert Condition                             | Where to Check                         |
| ---------------------------------- | ------------------------------------------- | -------------------------------------- |
| Backend error rate (5xx)           | > 1% for 5 minutes                          | Application logs, error monitoring     |
| `/health/detailed` status          | != "healthy" for 2 minutes                  | Health check monitoring                |
| Redis connection errors            | Any `[Redis] Connection error` log          | Application logs                       |
| QueueService errors                | Any `[QueueService] Worker error` log       | Application logs                       |
| BullMQ queue depth (cross-publish) | > 1000 waiting jobs for 10 min              | Bull Board admin or `/health/detailed` |
| OAuth state store size             | `oauthStateStore.size >= 10000` logged      | Application logs (DoS eviction)        |
| Token decryption failures          | Any `Encryption key must be 32 bytes` error | Application logs                       |
| DI resolution failures             | Any `Cannot resolve` in startup logs        | Application logs                       |
| Platform adapter errors            | Any `Platform "X" is not configured`        | Application logs                       |
| Database migration drift           | Tables missing or columns wrong             | Run CHECK queries from Section 6       |

### 7.2 Scheduled Verification Cadence

```bash
# +15 minutes: Quick health check
curl -s "$API_BASE_URL/health/detailed" | jq '{status, queues: .services.queues.status}'

# +1 hour: Full verification
curl -s "$API_BASE_URL/health/detailed" | jq '.'
# Also run all Section 6 SQL checks

# +4 hours: Spot check
# Check error logs for any Phase 8 / distribution / cross-publish errors
# Verify queue is not growing unboundedly

# +24 hours: Final verification
# Run all Section 6 SQL checks one more time
# Check for any orphaned queue jobs
# Close deployment ticket
```

### 7.3 Console Spot Checks (Run at +1 hour)

```typescript
// In a backend REPL or admin console:

// 1. Verify DI container has all Phase 8 services
import { container } from './container';
import { TYPES } from './container/types';

const services = [
  'PlatformConnectionService',
  'CrossPostService',
  'RepurposingService',
  'UnifiedInboxService',
  'CrossPlatformAnalyticsService',
  'QueueService',
];

for (const svc of services) {
  try {
    container.resolve(TYPES[svc]);
    console.log(`[OK] ${svc} resolves`);
  } catch (e) {
    console.error(`[FAIL] ${svc}: ${e.message}`);
  }
}

// 2. Verify QueueService health
const queueService = container.resolve(TYPES.QueueService);
const healthy = await queueService.isHealthy();
console.log('Queue health:', healthy);
console.log('Active queues:', queueService.getQueueNames());

// 3. Verify encryption key is loadable
import { getEncryptionKey } from './services/distribution/crypto';
try {
  const key = getEncryptionKey();
  console.log('[OK] Encryption key loaded, length:', key.length, 'bytes');
} catch (e) {
  console.error('[FAIL] Encryption key:', e.message);
}
```

---

## 8. Rollback Procedure

### 8.1 Can We Roll Back?

- [x] **YES -- Full rollback is possible.** All 6 migrations are additive (CREATE TABLE, ADD COLUMN). No existing data is modified. Rolling back means dropping the new tables and columns.
- [x] No backfill is performed, so no data restoration is needed.
- [x] All new tables start empty, so no user data loss on rollback.

### 8.2 Rollback Decision Matrix

| Symptom                         | Severity | Action                                                            |
| ------------------------------- | -------- | ----------------------------------------------------------------- |
| Migration fails partway         | CRITICAL | Roll back completed migrations in reverse order                   |
| Server won't start after deploy | CRITICAL | Deploy previous commit, then assess if migration rollback needed  |
| Redis unreachable               | HIGH     | Server starts degraded; fix Redis. No migration rollback needed   |
| OAuth callbacks returning 500   | MEDIUM   | Check env vars. No migration rollback needed                      |
| One platform adapter fails      | LOW      | Missing env var for that platform. Other platforms unaffected     |
| Encryption key invalid          | CRITICAL | Fix `PLATFORM_TOKEN_ENCRYPTION_KEY`. No migration rollback needed |

### 8.3 Rollback Steps (Full)

**Step 1: Revert backend code**

```bash
# Deploy the previous commit
git revert <merge-commit-sha>
# OR
gh workflow run automated-rollback.yml -f environment=production
```

**Step 2: Roll back migrations (REVERSE ORDER -- migration 6 first, migration 1 last)**

```sql
-- Rollback migration 6: Remove refresh_token_iv columns
ALTER TABLE platform_connections
  DROP COLUMN IF EXISTS refresh_token_iv,
  DROP COLUMN IF EXISTS refresh_token_auth_tag;

-- Rollback migration 5: Drop platform_metrics_history
DROP TABLE IF EXISTS platform_metrics_history CASCADE;

-- Rollback migration 4: Drop inbox_messages
DROP TABLE IF EXISTS inbox_messages CASCADE;

-- Rollback migration 3: Drop repurposed_content
DROP TABLE IF EXISTS repurposed_content CASCADE;

-- Rollback migration 2: Drop cross_posts
DROP TABLE IF EXISTS cross_posts CASCADE;

-- Rollback migration 1: Drop platform_connections
DROP TABLE IF EXISTS platform_connections CASCADE;
```

**Step 3: Verify rollback**

```sql
-- Confirm all new tables are gone
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'platform_connections',
    'cross_posts',
    'repurposed_content',
    'inbox_messages',
    'platform_metrics_history'
  );
-- EXPECTED: 0 rows

-- Confirm existing data is intact
SELECT
  (SELECT COUNT(*) FROM auth.users) AS user_count,
  (SELECT COUNT(*) FROM content) AS content_count;
-- EXPECTED: Same as pre-deploy baseline
```

**Step 4: Clean up BullMQ queue data in Redis (optional)**

```bash
# Remove the cross-publish queue from Redis
redis-cli -u "$REDIS_URL" KEYS "bull:cross-publish:*" | xargs redis-cli -u "$REDIS_URL" DEL
```

**Step 5: Verify health**

```bash
curl -s "$API_BASE_URL/health" | jq '.status'
# EXPECTED: "healthy"
```

### 8.4 Partial Rollback: Code Only (Keep Tables)

If the tables are fine but the code has a bug:

```bash
# Deploy the previous commit
git revert <merge-commit-sha>
# Tables remain. v2 API routes will return 404 (route file doesn't exist in old code).
# Existing v1 API routes are unaffected.
```

---

## 9. Known Risks and Mitigations

### 9.1 CRITICAL: In-Memory OAuth State Store

**Risk:** `PlatformConnectionService` uses an in-memory `Map` for OAuth CSRF state tokens
(line 24 of `/Users/fp/Desktop/Sovren/packages/backend/src/services/distribution/PlatformConnectionService.ts`).
If the server restarts during an active OAuth flow, all pending state tokens are lost and those OAuth flows will fail.

**Mitigation:**

- The state tokens have a 10-minute TTL, limiting the blast radius.
- A DoS eviction guard caps the store at 10,000 entries (line 99).
- For multi-instance deployments, this MUST be migrated to Redis-backed state storage. File a follow-up ticket.

### 9.2 HIGH: Encryption Key Rotation

**Risk:** If `PLATFORM_TOKEN_ENCRYPTION_KEY` is changed after tokens are stored, ALL existing encrypted tokens become undecryptable. Users must re-authorize all platforms.

**Mitigation:**

- Document the current key hash (NOT the key itself) in the secrets vault.
- NEVER rotate this key without a migration plan that re-encrypts existing tokens.
- Consider adding a `key_version` column to `platform_connections` for future key rotation support.

### 9.3 MEDIUM: Missing .env.example Update

**Risk:** The PR does not update `packages/backend/.env.example` with the 10 new environment variables. Future developers setting up local environments will miss required configuration.

**Mitigation:** Update `.env.example` before or immediately after merge. The following block should be added:

```env
# Multi-Platform Hub (EPIC-009)
PLATFORM_TOKEN_ENCRYPTION_KEY=  # 64-char hex string. Generate: openssl rand -hex 32
API_BASE_URL=http://localhost:3001
FRONTEND_URL=http://localhost:3000
MASTODON_CLIENT_ID=
MASTODON_CLIENT_SECRET=
BLUESKY_CLIENT_ID=
BLUESKY_CLIENT_SECRET=
TWITTER_CLIENT_ID=
TWITTER_CLIENT_SECRET=
YOUTUBE_CLIENT_ID=
YOUTUBE_CLIENT_SECRET=
```

### 9.4 MEDIUM: BullMQ Worker Not Registered at Startup

**Risk:** The `CrossPublishProcessor` (the BullMQ Worker that actually publishes content) is defined but there is no visible registration of it as a processor via `queueService.registerProcessor()` in the DI bindings or server startup. Jobs will be enqueued to the `cross-publish` queue but may not be processed.

**Mitigation:** Verify that `CrossPublishProcessor` is registered as a worker during server startup. Check `server.ts` or the container bootstrap for a `registerProcessor` call. If missing, jobs will queue but never execute -- they won't be lost, but will be stale until the processor is registered.

### 9.5 LOW: No Foreign Key to `content` Table

**Risk:** `cross_posts.content_id` and `repurposed_content.source_content_id` reference content by UUID but have no `REFERENCES content(id)` foreign key constraint. If content is deleted, orphaned cross-post/repurposed records remain.

**Mitigation:** Acceptable for MVP. The application layer handles this. Consider adding FK constraints with `ON DELETE CASCADE` in a follow-up migration.

### 9.6 LOW: `creator_id` is TEXT, Not UUID

**Risk:** All 5 new tables use `creator_id TEXT NOT NULL` rather than a UUID foreign key to a users table. This allows any string value and provides no referential integrity.

**Mitigation:** This matches the existing pattern in the codebase (NOSTR pubkeys are hex strings, not UUIDs). Acceptable, but document that `creator_id` values are NOSTR public keys.

---

## Summary: Go/No-Go Decision

Before proceeding, ALL of the following must be true:

| #   | Criterion                                                  | Status |
| --- | ---------------------------------------------------------- | ------ |
| 1   | `PLATFORM_TOKEN_ENCRYPTION_KEY` is set and is 64 hex chars | [ ]    |
| 2   | `API_BASE_URL` is set and reachable                        | [ ]    |
| 3   | Redis is running and `PING` returns `PONG`                 | [ ]    |
| 4   | Database backup taken within last hour                     | [ ]    |
| 5   | Pre-deploy SQL baselines recorded                          | [ ]    |
| 6   | Staging deployment succeeded with all 6 migrations         | [ ]    |
| 7   | Unit tests passing                                         | [ ]    |
| 8   | Rollback plan reviewed by deploying engineer               | [ ]    |
| 9   | At least one platform OAuth credential pair is configured  | [ ]    |
| 10  | `.env.example` updated (or follow-up ticket created)       | [ ]    |

**If ANY criterion is not met: NO-GO. Fix the issue and re-evaluate.**

---

_Generated by Deployment Verification Agent for PR #85 on branch `feature/phase1-epics`_
_Covers: 6 migrations, 13 backend services, 4 v2 route files, BullMQ queue infrastructure_
_Protected artifacts (not flagged): `docs/plans/_.md`, `docs/solutions/_.md`_
