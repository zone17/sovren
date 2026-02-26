---
title: 'Backend Test Mock Elimination — Live Supabase + Redis'
date: '2026-02-26'
category: 'test-failures'
tags:
  - backend-testing
  - mocks
  - supabase
  - redis
  - vitest
  - test-infrastructure
  - migration-consolidation
module: 'backend-services'
symptoms:
  - '87 failing backend test files (281 tests)'
  - 'Supabase chain mocks incomplete for multi-table queries'
  - '39 broken incremental migrations with timestamp collisions'
  - 'globalThis.fetch mocked — preventing real API calls'
  - 'Tests passing with wrong assertions due to silent mock failures'
severity: 'critical'
status: 'completed'
---

# Backend Test Mock Elimination — Live Supabase + Redis

## Problem

87 out of 129 backend test files failing (281 tests). Root causes:

1. **Broken Supabase mock chains** — services querying 2+ tables got `undefined` from single-chain mocks
2. **39 broken migrations** — timestamp collisions, reserved SQL words, wrong column references (`user_id` vs `payer_id`), macOS Finder copy artifacts (` 2.sql` files)
3. **globalThis.fetch mocked globally** — prevented real HTTP calls in integration tests
4. **Silent mock failures** — mocks returned `undefined` instead of throwing, so tests passed with wrong assertions

## Investigation

1. Read `docs/remaining-test-failures-2026-02-20.md` — catalogued all failures by priority
2. Attempted `supabase start` — config.toml had 6 incompatible keys for CLI v2.54.10
3. Attempted `supabase db reset` — migrations failed cascade (reserved words, missing tables, duplicate timestamps)
4. Tried iterative migration fixes — each fix exposed new issues in downstream migrations
5. **Decision**: Consolidate all 39 migrations into 3 clean ones instead of fixing individually

## Root Cause

The mock infrastructure was fundamentally unsound:

- Single-chain `mockDb.from().select().eq()` can't serve services that query multiple tables
- `vi.clearAllMocks()` doesn't clear `mockResolvedValueOnce` queues (need `vi.resetAllMocks()`)
- Variables used inside `vi.mock()` factories are undefined without `vi.hoisted()`
- `globalThis.fetch = vi.fn()` in setup file prevented any real HTTP calls

## Solution

### Phase 0: Infrastructure Foundation (sequential, solo)

**1. Fix `supabase/config.toml`** for CLI v2.54.10:

- `realtime.ip_version = "IPv4"` (case-sensitive)
- Removed `[graphql]` section, deprecated auth keys, invalid `[edge_runtime]` ports

**2. Consolidate migrations** (39 → 3):

```
supabase/migrations/
├── 20240101000000_baseline_schema.sql    # Core tables from baseline/
├── 20240201000000_additional_tables.sql  # 88 CREATE TABLE IF NOT EXISTS
└── 20240301000000_test_helpers.sql       # truncate_test_tables() RPC
```

**3. Create test infrastructure** (`packages/backend/src/test-infra/`):

```typescript
// Singleton clients — lazy-init, no connection thrashing
export function getTestSupabaseClient(): SupabaseClient; // service_role, bypasses RLS
export function getTestAnonClient(): SupabaseClient; // anon, subject to RLS

// Redis on test port 6380
export function getTestRedisClient(): Redis;
export async function flushTestRedis(): Promise<void>;

// DB helpers — O(1) truncation via RPC
export async function truncateAll(): Promise<void>;
export async function seedTestUser(overrides?): Promise<User>;
```

**4. Update vitest.config.ts**:

- Added `globalSetup: ['./test-utils/backend-global-setup.ts']` for backend project
- Set `maxForks: 1` — real DB tests cannot run in parallel

**5. Update `vitest-backend-setup.ts`**:

- Real env vars pointing to `http://127.0.0.1:54321`
- Removed `globalThis.fetch = vi.fn()` mock

### Phase 1-3: Test Fixes (4-agent parallel team, 8 tasks)

| Agent   | Tasks                                                                          | Tests Fixed |
| ------- | ------------------------------------------------------------------------------ | ----------- |
| agent-1 | User services (6 files), remaining (14 files)                                  | 657         |
| agent-2 | Content/session/NIP-05 (6 files)                                               | 218         |
| agent-3 | Payment/distribution (8 files), subscriptions (3 files), Redis/cache (4 files) | 739         |
| agent-4 | Wellness/provenance (8 files), routes (11 files)                               | 230         |

**Result**: 87 → 40 failing files, 3,027 tests passing (+327)

## Key Patterns Discovered

### 1. `vi.resetAllMocks()` vs `vi.clearAllMocks()`

- `resetAllMocks()` clears `mockResolvedValueOnce` queues — must re-apply implementations in `beforeEach()`
- `clearAllMocks()` only clears call history, preserves implementations

### 2. `vi.hoisted()` for mock factory variables

```typescript
const { mockService } = vi.hoisted(() => ({
  mockService: { doThing: vi.fn() },
}));
vi.mock('./service', () => ({ Service: vi.fn(() => mockService) }));
```

### 3. Table-aware Supabase mock routing

```typescript
mockDb.from = vi.fn((table: string) => {
  switch (table) {
    case 'users':
      return userChain;
    case 'payments':
      return paymentChain;
    default:
      return defaultChain;
  }
});
```

### 4. `structuredClone()` for nested test data

Shallow spread `{ ...obj }` leaks nested references between tests. Use `structuredClone(DEFAULT_PREFERENCES)`.

### 5. `{ default: mockFn }` for ESM default exports

```typescript
vi.mock('ws', () => ({ default: vi.fn(() => mockWs) }));
```

### 6. `process.nextTick` flush for fire-and-forget async

```typescript
await request(app).post('/route').send(data);
await new Promise(process.nextTick); // flush microtask queue
expect(asyncService.method).toHaveBeenCalled();
```

### 7. Class-based mocks survive `vi.resetAllMocks()`

Create fresh instances in `beforeEach()` — class method vi.fn()s get cleared but re-initialized.

### 8. `global.fetch = vi.fn()` must be initialized before service instantiation

Services capture fetch at construction time — mock must exist before `new Service()`.

## Real Source Bugs Found

1. **UserPreferencesService**: `getDefaults()` returned reference to shared `DEFAULT_PREFERENCES` — mutations leaked across tests. Fix: `structuredClone()`.
2. **UserRelationshipService**: `isBlocked`/`isBlockedBy` error messages were swapped.
3. **quality-metrics-service**: Duplicate `export {}` block — 5 classes had both `export class` and re-export.

## Remaining Blockers (40 files)

- **Missing `analytics-service.ts`** — 8+ files crash at import (module never created but imported by `subscription-management-service.ts`)
- **Missing `di/types`** — 2 files crash at import
- **Pre-existing schema mismatches** — rls-security, database-integration tests expect columns not in schema
- **~25 out-of-scope files** — integration, performance, and service tests not in original plan

## Prevention

1. **Never use single-chain mocks for multi-table services** — always route `from()` by table name
2. **Use `vi.hoisted()` for ALL variables referenced inside `vi.mock()` factories**
3. **Use `structuredClone()` for any shared module-level objects returned by services**
4. **Don't suppress test errors in hooks** — `2>/dev/null || true` after test commands hides broken tooling
5. **Run `supabase db reset` in CI** before backend tests to catch migration drift early
6. **Pre-push hook with `--bail 1` catches pre-existing failures** — exclude files with known pre-existing issues or fix them first

## Cross-References

- `docs/remaining-test-failures-2026-02-20.md` — original failure catalog
- `docs/solutions/testing/e2e-mock-elimination-pom-rewrite-20260224.md` — E2E mock elimination (frontend)
- `docs/solutions/testing/phase9-msw-migration-frontend-test-fixes.md` — MSW v2 patterns
- `docs/solutions/infrastructure-issues/quality-pipeline-vitest-migration-20260220.md` — Vitest migration
- `docs/solutions/patterns/common-solutions.md` — patterns #11 (OOM), #12 (git diff), #33-36 (MSW)
