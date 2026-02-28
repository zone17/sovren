---
title: 'refactor: Kill All Mock Tests + Build Real Test Infrastructure'
type: refactor
date: 2026-02-28
---

# Kill All Mock Tests + Build Real Test Infrastructure

## Overview

Delete all 32 excluded broken backend test files. Delete 5,593 LOC of dead test framework code. Fix the `createApp()` eager instantiation bug. Set up testcontainers (PostgreSQL + Redis) with a smoke test to validate the infrastructure. Re-enable the integration test CI job.

**Philosophy:** No more mocks. Every test either runs against real services or it gets deleted. We build the infrastructure to make real tests possible, then write real tests going forward.

## Problem Statement

**Current state:**

- 38 backend test files excluded from CI — all broken
- Integration test CI job permanently skipped (`if: false` in ci.yml)
- Zero integration tests running anywhere
- 9 files labeled "integration" are actually mock-based unit tests
- 180KB dead code in `packages/testing/src/integration-testing/` (zero imports)
- The single "real" integration test starts a PostgreSQL container but ignores it

**The 38 excluded files break down as:**

| Category                                       | Count | Action                                                                                                     |
| ---------------------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------- |
| Route tests (broken import chain + mocks)      | 5     | **DELETE**                                                                                                 |
| Service tests (stale mocks)                    | 16    | **DELETE** — rewrite as real tests later                                                                   |
| Mock "integration" tests                       | 9     | **DELETE** — never were real integration tests                                                             |
| Middleware/session mocks                       | 2     | **DELETE** (`unified-session-service.test.ts`) / **KEEP** (`middleware/__tests__/auth.test.ts` — see note) |
| Environment-specific (benchmarks/docker/smoke) | 5     | Permanent exclusion (not unit tests)                                                                       |
| Security (RLS)                                 | 1     | Permanent exclusion (needs live Supabase)                                                                  |

> **Note on `middleware/__tests__/auth.test.ts`:** This is a 46-line mock-free pure function test of `isAdmin`, `isCreator`, `isAuthenticated`. It was swept into the exclude list but may pass as-is. Run it after Phase 2 — if it passes, un-exclude it. If it fails from the import chain bug, it will pass once Phase 2 lands. Do not delete a healthy pure function test.

**32 files to delete + 6 permanent exclusions = 38 total accounted for.**

## Proposed Solution

Four sequential phases. Each phase is a clean commit with a passing test suite.

### Phase 1: Delete Everything Dead (30 min)

No fixing. No reclassifying. Delete.

**Dead test framework (5,593 LOC, zero imports):**

- [x] `packages/testing/src/integration-testing/IntegrationTestingFramework.ts`
- [x] `packages/testing/src/integration-testing/IntegrationEnvironmentProvisioner.ts`
- [x] `packages/testing/src/integration-testing/IntegrationScenarioGenerator.ts`
- [x] `packages/testing/src/integration-testing/DatabaseIntegrationTester.ts`
- [x] `packages/testing/src/integration-testing/APIContractTester.ts`
- [x] `packages/testing/src/integration-testing/IntegrationTestMonitor.ts`
- [x] `packages/testing/src/integration-testing/IntegrationTestReliabilityOptimizer.ts`
- [x] `packages/testing/src/integration-testing/ThirdPartyIntegrationTester.ts`

**Dead test fixtures:**

- [x] `packages/backend/src/__tests__/fixtures/test-container-setup.ts`
- [x] `packages/backend/src/__tests__/setup/integration-setup.ts`

**Broken mock-based test files (33 files — includes middleware/auth.test.ts which imported non-existent functions):**

Service tests (16):

- [x] `services/__tests__/ai-recommendation-service.test.ts`
- [x] `services/__tests__/EmailService.test.ts`
- [x] `services/__tests__/lightning-service.test.ts`
- [x] `services/__tests__/payment-persistence-atomic.test.ts`
- [x] `services/__tests__/SecretsService.test.ts`
- [x] `services/__tests__/user-service.test.ts`
- [x] `content/__tests__/ContentAnalyticsService.test.ts`
- [x] `content/__tests__/ContentCreationService.test.ts`
- [x] `content/__tests__/ContentModerationService.test.ts`
- [x] `content/__tests__/ContentPublishingService.test.ts`
- [x] `distribution/__tests__/CrossPlatformAnalyticsService.test.ts`
- [x] `distribution/__tests__/crypto.test.ts`
- [x] `distribution/__tests__/InboxPollingService.test.ts`
- [x] `distribution/__tests__/NostrReplyAdapter.test.ts`
- [x] `payment/__tests__/InvoiceService.test.ts`
- [x] `user/__tests__/UserActivityService.test.ts`

Route tests (5):

- [x] `nip05-routes.test.ts`
- [x] `routes/content.routes.test.ts`
- [x] `routes/v1-api-routes.test.ts`
- [x] `routes/webhooks-race-conditions.test.ts`
- [x] `routes/__tests__/auth.test.ts`

Mock "integration" tests (9):

- [x] `database-integration.test.ts`
- [x] `integration/api-endpoints.integration.test.ts`
- [x] `integration/database-transactions.integration.test.ts`
- [x] `integration/event-bus.integration.test.ts`
- [x] `integration/lightning-receipt-integration.test.ts`
- [x] `integration/service-orchestration.integration.test.ts`
- [x] `container/__tests__/ServiceContainer.integration.test.ts`
- [x] `integration/payment-flow-integration.test.ts`
- [x] `payment/__tests__/integration/payment-flow.integration.test.ts`

Other (2):

- [x] `unified-session-service.test.ts`
- [x] `middleware/__tests__/auth.test.ts` — originally planned to keep, but imports `isAdmin`/`isCreator`/`isAuthenticated` which don't exist in `../auth` (functions were never exported). Broken test, deleted.

**Housekeeping:**

- [x] Consolidate `packages/backend/supabase/migrations/20260215000001_add_delete_all_wellness_data_function.sql` into main `supabase/migrations/` directory (already present)
- [x] Remove all 33 deleted entries from `vitest.config.ts` backend exclude list
- [x] Remove all deleted entries from `docs/backlog/excluded-tests.md`
- [x] Grep-verify zero remaining imports to deleted files
- [x] Run `npm test` to confirm no breakage (215 files, 7 pre-existing failures, 207 passed)

### Phase 2: Fix `createApp()` Eager Instantiation Bug (1-2 hours)

This is a **real production code bug**. The route file eagerly instantiates services at module load time.

**Problem:** `packages/backend/src/routes/subscription-tiers.ts` does:

```typescript
// Eager instantiation at module load — breaks any consumer of createApp()
const lightningService = new LightningPaymentService();
lightningService.initialize().catch(...);
const subscriptionService = new SubscriptionManagementService(lightningService);
```

**Fix:** Lazy singleton pattern — defer instantiation to first request.

**Files modified:**

- [x] `packages/backend/src/routes/subscription-tiers.ts` — lazy-load LightningPaymentService + SubscriptionManagementService
- [x] `packages/backend/src/routes/creator-recommendations-simple.ts` — lazy-load CreatorRecommendationService
- [x] `packages/backend/src/routes/creator-recommendations.ts` — lazy-load CreatorRecommendationService
- [x] `packages/backend/src/routes/content-discovery.ts` — lazy-load ContentDiscoveryService + RecommendationService
- [x] Grep for other eager-instantiation patterns in `packages/backend/src/routes/` — found and fixed 3 additional files
- [x] Verify `createApp()` can be imported without side effects
- [x] `middleware/__tests__/auth.test.ts` — deleted in Phase 1 (imported non-existent functions, N/A)
- [x] Run `npm test` to confirm all existing tests still pass (215 files, 207 passed, 7 pre-existing failures)

### Phase 3: Testcontainers Infrastructure + Smoke Test (2-3 hours)

Build the foundation for real integration tests. Validate it with one smoke test.

**Install dependencies:**

- [x] `@testcontainers/postgresql`
- [x] `pg` + `@types/pg` (for raw SQL migration application)
- [x] `testcontainers` bumped to `^11.12.0` in backend (version mismatch with `@testcontainers/postgresql@11.12.0` caused port binding failures)

**Create global setup file:**

- [x] `packages/backend/src/__tests__/setup/testcontainers-global-setup.ts`

```typescript
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { GenericContainer } from 'testcontainers';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function setup() {
  // Start containers in parallel
  const [pgContainer, redisContainer] = await Promise.all([
    new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('sovren_test')
      .withTmpFs({ '/var/lib/postgresql/data': 'rw' })
      .withCommand(['postgres', '-c', 'fsync=off', '-c', 'synchronous_commit=off'])
      .start(),
    new GenericContainer('redis:7-alpine').withExposedPorts(6379).start(),
  ]);

  // Bootstrap Supabase-specific stubs (bare PostgreSQL lacks these)
  const client = new pg.Client({ connectionString: pgContainer.getConnectionUri() });
  await client.connect();

  await client.query(`
    -- Supabase auth schema stubs
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid AS $$
      SELECT COALESCE(
        current_setting('request.jwt.claim.sub', true)::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid
      );
    $$ LANGUAGE sql STABLE;
    CREATE OR REPLACE FUNCTION auth.role() RETURNS text AS $$
      SELECT COALESCE(current_setting('request.jwt.claim.role', true), 'anon');
    $$ LANGUAGE sql STABLE;

    -- Supabase-specific roles
    DO $$ BEGIN
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN;
      END IF;
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN;
      END IF;
    END $$;
  `);

  // Apply all migrations in order (glob + sort = deterministic, no hardcoded list)
  const migrationsDir = join(__dirname, '../../../../../supabase/migrations');
  const migrationFiles = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql') && /^\d{14}_/.test(f))
    .sort();

  for (const file of migrationFiles) {
    const sql = readFileSync(join(migrationsDir, file), 'utf-8');
    await client.query(sql);
  }
  await client.end();

  // Set env vars — forks propagate process.env to workers
  process.env.DATABASE_URL = pgContainer.getConnectionUri();
  process.env.REDIS_URL = `redis://${redisContainer.getHost()}:${redisContainer.getMappedPort(6379)}`;

  return { pgContainer, redisContainer };
}

export async function teardown({ pgContainer, redisContainer }) {
  await pgContainer?.stop();
  await redisContainer?.stop();
}
```

> **Note:** `pg` default import may need ESM/CJS interop handling. Verify with `node --input-type=module -e "import pg from 'pg'; console.log(typeof pg.Client)"` during implementation.

> **Note:** RLS policies are created by migrations but bypassed by the superuser connection. This infrastructure does NOT test RLS — `rls-security.test.ts` remains a permanent exclusion for that reason.

**Update integration config:**

- [x] `packages/backend/vitest.integration.config.ts`:
  - Add `globalSetup` pointing to new file
  - Change `poolOptions.threads` → `pool: 'forks'` with `maxForks: 1` (remove the old `poolOptions.threads` block)
  - Remove coverage thresholds entirely
  - Remove `setupFiles` reference to deleted `integration-setup.ts`

**Write smoke integration test:**

- [x] `packages/backend/src/__tests__/integration/smoke.integration.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import pg from 'pg';

describe('Testcontainers Infrastructure', () => {
  it('PostgreSQL has schema from migrations', async () => {
    const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    const result = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name LIMIT 5"
    );
    expect(result.rows.length).toBeGreaterThan(0);
    await client.end();
  });

  it('Redis is accessible', async () => {
    const url = new URL(process.env.REDIS_URL!);
    // Basic TCP connectivity check
    const net = await import('net');
    await new Promise<void>((resolve, reject) => {
      const socket = net.createConnection({ host: url.hostname, port: parseInt(url.port) }, () => {
        socket.end();
        resolve();
      });
      socket.on('error', reject);
    });
  });
});
```

**Cleanup — deleted 4 old mock integration tests that imported deleted `test-container-setup` fixture:**

- [x] `cache-layer.integration.test.ts`
- [x] `concurrent-operations.integration.test.ts`
- [x] `error-recovery.integration.test.ts`
- [x] `external-services.integration.test.ts`

**Verify:**

- [x] `npm run test:integration` starts containers, applies migrations, runs smoke test, exits cleanly (2 files, 18 tests, all pass)
- [x] Containers cleaned up properly via module-level teardown (Vitest forks pool doesn't pass setup return to teardown)
- [x] Debugging notes: testcontainers v10 port binding fails on Docker Desktop macOS (IPv6 format), Ryuk disabled, version mismatch was root cause

### Phase 4: Re-enable CI Integration Test Job (30 min)

- [ ] Remove `if: false` from `test-integration` job in `.github/workflows/ci.yml`
- [ ] Remove old `supabase start` step and `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` env vars from the job
- [ ] Remove `services.redis` block (testcontainers manages Redis now)
- [ ] Add `continue-on-error: true` — makes integration tests **advisory-only** during stabilization (CI stays green even if they fail). Remove `continue-on-error` once stable.
- [ ] Set `TESTCONTAINERS_RYUK_DISABLED: 'true'` in env
- [ ] Verify `test-gate` job handles results correctly
- [ ] Push and verify CI passes

## Permanent Exclusions (6 files)

These files stay excluded — they need dedicated CI jobs, not the unit test suite:

| File                                       | Reason                          | Future Home                      |
| ------------------------------------------ | ------------------------------- | -------------------------------- |
| `performance/api-performance.test.ts`      | Benchmark, needs running server | Perf CI job                      |
| `performance/database-performance.test.ts` | Benchmark, needs live DB        | Perf CI job                      |
| `performance/payment-performance.test.ts`  | Benchmark, needs live services  | Perf CI job                      |
| `production-docker.test.ts`                | Docker container test           | Docker CI job                    |
| `smoke-tests.test.ts`                      | Needs running server            | Post-deploy step                 |
| `rls-security.test.ts`                     | Needs Supabase RLS policies     | Future Supabase-specific testing |

## Acceptance Criteria

- [ ] 32 mock-based test files deleted
- [ ] 5,593+ LOC of dead framework code deleted
- [ ] `createApp()` eager instantiation bug fixed
- [ ] `middleware/__tests__/auth.test.ts` un-excluded and passing
- [ ] Testcontainers global setup works locally (PostgreSQL + Redis)
- [ ] Smoke integration test passes (`npm run test:integration`)
- [ ] Supabase `auth.uid()` / `auth.role()` stubs applied before migrations
- [ ] `anon` / `authenticated` roles created before migrations
- [ ] Integration test CI job active and advisory (`continue-on-error: true`)
- [ ] Old `supabase start` / Redis service removed from CI job
- [ ] All existing passing tests still pass (`npm test`)
- [ ] Backend exclude list reduced from 38 to 6 permanent exclusions
- [ ] `docs/backlog/excluded-tests.md` updated

## Success Metrics

- **Mock test files deleted:** 32
- **Dead code removed:** ~8,000+ LOC (framework + mock tests + fixtures)
- **Backend exclude list:** 38 → 6
- **Testcontainers infrastructure:** operational with smoke test
- **CI integration job:** skipped → active (advisory)
- **Pure function test rescued:** `middleware/__tests__/auth.test.ts`

## Implementation Order

```
Phase 1 (delete + consolidate migration)  ──→ 30 min, commit
Phase 2 (fix createApp bug + un-exclude)  ──→ 1-2 hrs, commit
Phase 3 (testcontainers + smoke test)     ──→ 2-3 hrs, commit
Phase 4 (CI re-enable + cleanup old job)  ──→ 30 min, commit
```

Strictly sequential. Each phase is a clean commit. No parallelism.

**Total estimated effort: 4-6 hours**

## References

### Internal

- Excluded tests backlog: `docs/backlog/excluded-tests.md`
- Vitest config: `vitest.config.ts:86-134` (backend excludes)
- CI workflow: `.github/workflows/ci.yml` (test-integration job)
- Route file with eager instantiation bug: `packages/backend/src/routes/subscription-tiers.ts`
- Dead test framework: `packages/testing/src/integration-testing/` (8 files)
- Backend-local migration to consolidate: `packages/backend/supabase/migrations/20260215000001_add_delete_all_wellness_data_function.sql`
- Migration files: `supabase/migrations/` (5 files + 1 to consolidate, ~1,900 total lines)
- Common solutions: `docs/solutions/patterns/common-solutions.md`

### Key Technical Notes (from plan review rounds 1+2)

- Bare PostgreSQL lacks `auth.uid()`, `auth.role()`, `anon`/`authenticated` roles — must stub before migrations
- Use `import.meta.url` not `__dirname` (ESM project)
- Use `process.env` not `provide/inject` — forks propagate env vars
- Glob-based migration discovery (sorted) prevents silent schema drift vs hardcoded list
- Set `TESTCONTAINERS_RYUK_DISABLED=true` in CI
- Optional chaining in teardown for partial setup failures
- RLS is NOT tested by this infrastructure — superuser bypasses it
- `continue-on-error: true` makes CI advisory-only — remove once stable
- ESM/CJS interop risk with `pg` default import — verify during implementation
- Budget extra time for migration compatibility (extensions, SECURITY DEFINER, etc.)

### Related Work

- PR #86: Vitest migration
- PR #98: Backend test mock elimination
- PR #102: PaymentTestHarness (real services pattern — the model for future tests)
