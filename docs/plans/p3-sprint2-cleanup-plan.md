# P3 Sprint 2: API Gaps, Caching, Docker, Frontend Cleanup — Architecture Plan

## Overview

Sprint 2 of the P3 cleanup addresses 20 remaining findings from PR #73 code review. After verification against actual source code, several items are partially or fully resolved, and several large items warrant deferral.

**Branch**: `feature/US-007-error-boundaries-rebased`
**Sprint 1 Reference**: `docs/solutions/code-quality/p3-sprint1-cleanup-dead-code-architecture.md`

## Verification Summary (Stale Todo Detection)

Per Sprint 1 lesson: "Always verify against source before implementing."

| Todo | Verification Result |
|------|-------------------|
| 035 | **PARTIALLY STALE**: `setup-vault.sh` no longer exists (deleted in prior sprint). Docker ports already bound to `127.0.0.1`. Redis health check and ICC issues remain valid. |
| 059 | **MOSTLY STALE**: `console.log` in `deployment-monitoring.ts` already cleaned (0 hits). `_next` already fixed (line 56). No emojis remain. **Only Docker ICC + Redis health check remain** (overlap with 035). |
| 085 | **VALID BUT SCOPE LARGE**: `Math.random()` used in ~90+ locations. Most are in test files (acceptable). ~15 production usages for ID generation exist across services. |
| 109 | **STALE/RESOLVED**: Zero " 2" directories found in `packages/backend/src/`. Sprint 1 (todo 014) already cleaned these. Only `node_modules` has them (irrelevant). |
| 130 | **VALID**: N+1 patterns confirmed in recommendation-service.ts and lightning-service.ts. But these are placeholder implementations. |
| 132 | **VALID**: Mock database at bootstrap.ts:231-237 confirmed — returns `{ rows: [], rowCount: 0 }`. |
| 106 | **VALID BUT DIFFERENT**: Error boundaries import from `../../monitoring/ErrorBoundary`, NOT `@/components/ErrorBoundary` as todo states. Pattern matches (identical wrappers, only featureName differs). 7 files total (including analytics). |

## Decision Matrix: IMPLEMENT vs DEFER

### IMPLEMENT (14 items)

| Todo | Title | Size | Batch | Rationale |
|------|-------|------|-------|-----------|
| 109 | macOS artifact directories | Trivial | 0 (pre-work) | Already resolved — mark as complete, no code changes needed |
| 083 | Zod error drops metadata | Small | 1 | Quick win — add `expected`/`received` to validation error details |
| 084 | Health endpoints 307 redirects | Small | 1 | Quick win — replace redirects with direct responses in health.ts |
| 085 | Weak UUID generation | Small | 1 | Replace `Math.random()` UUID patterns with `crypto.randomUUID()` in production code only (skip tests) |
| 105 | Sensitive fields over-matching | Small | 1 | Replace broad `'key'`/`'auth'` with specific patterns in sensitive-fields.ts |
| 132 | Mock database in DI | Small | 1 | Change mock to throw NotImplementedError instead of silent empty results |
| 104 | TTLCache implementation issues | Medium | 2 | Fix stale size, add LRU eviction, fix mutation in values() |
| 131 | Unbounded polling timers | Small | 2 | Clear intervals on terminal state in lightning-payment-service.ts |
| 133 | Scheduled publish in-memory | Small | 2 | Add startup recovery for scheduled jobs in ContentPublishingService.ts |
| 134 | Unhandled async constructor | Small | 2 | Add explicit `initialize()` method to LightningPaymentService |
| 106 | Identical error boundaries | Small | 3 (frontend) | Create factory function, refactor 6 identical files (ai, dashboard, nostr, content, subscriptions, analytics) |
| 035+059 | Docker security hardening | Small | 4 (docker) | Merged: Fix Redis health check (use REDISCLI_AUTH env var), fix ICC setting. Skip deleted vault items. |
| 130 | N+1 recommendation service | Small | 5 | Add WHERE clauses to placeholder queries (prepares for real DB) |
| 018 | OpenAPI docs payment/user routes | Medium | 6 | Add OpenAPI JSDoc annotations to payment.routes.ts and user.routes.ts matching content.routes.ts pattern |

### DEFER (6 items)

| Todo | Title | Size | Deferral Reason |
|------|-------|------|----------------|
| 086 | Agent API key auth | Large | New feature, not cleanup. Requires API key table design, CRUD endpoints, rate-limit integration. Needs dedicated feature sprint. |
| 087 | Missing content CRUD v1 | Medium | Overlaps with todo 146. Content listing/CRUD endpoints should be part of the v1 API migration effort, not piecemeal. |
| 146 | v1 API route fragmentation | Large | 24 missing endpoints across content/payments/users. Multi-week phased migration. Needs its own sprint with API design review. |
| 145 | God classes decomposition | Large | 5 classes >500 lines (4,800+ lines total). High-risk refactor touching core services. Needs dedicated refactoring sprint with extensive test coverage. Sprint 1 also deferred this. |
| 060 | Agent-native metrics/error APIs | Medium | New feature requiring 3 new endpoints, agent authentication, rate-limit normalization. Should follow after 086 (agent auth). |
| 059 | Docker hardening (remaining unique items) | N/A | **Merged into 035** — the only remaining valid items (ICC + Redis health) are shared with 035. Console logging and emoji issues already resolved. |

## Batch Implementation Order

### Batch 0: Pre-Work (No Code Changes)

**Purpose**: Mark already-resolved items as complete.

- **Todo 109**: macOS artifact directories — already cleaned in Sprint 1. Mark as complete.
- **Todo 059**: Merge remaining valid items into 035. Console/emoji/`_next` already fixed. Mark 059 as complete with note.

### Batch 1: Quick Wins — Small Backend Fixes (Independent)

**Purpose**: Low-risk, high-value fixes that can be done in parallel.

#### 1a. Todo 083 — Zod Error Metadata
- **File**: `packages/backend/src/middleware/error-handler-middleware.ts`
- **Change**: Add `expected` and `received` fields from Zod error issues to validation error response (lines 119-123)
- **Approach**: Map `err.expected` and `err.received` (available on ZodInvalidTypeIssue) into the validation error details
- **Complexity**: Trivial

#### 1b. Todo 084 — Health Endpoint Redirects
- **File**: `packages/backend/src/routes/health.ts` (lines 82-86)
- **Change**: Replace `res.redirect(307, '/health/ready')` and `res.redirect(307, '/health/live')` with direct health check responses
- **Approach**: Import the health check logic and return response directly from `/ready` and `/live`
- **Complexity**: Trivial

#### 1c. Todo 085 — Weak UUID Generation
- **Files**: Production files only (not tests):
  - `packages/backend/src/interfaces/shared/IEventBus.ts:142` — `evt_` ID generation
  - `packages/backend/src/services/EventBusService.ts:575` — `sub_` ID generation
  - `packages/backend/src/services/supabase-realtime-service.ts:547,735` — ID generation
  - `packages/backend/src/services/email-integration-service.ts:254,500,608,745` — various ID generation
  - `packages/backend/src/services/nip05-monitoring-service.ts:248` — alert ID generation
  - `packages/backend/src/services/payment/PaymentProcessingService.ts:863` — subscription ID
  - `packages/backend/src/services/payment/PaymentAnalyticsService.ts:1279,1301,1426,1515` — various IDs
  - `packages/backend/src/services/payment/CurrencyService.ts:782` — subscription ID
  - `packages/backend/src/services/payment/RefundService.ts:1533` — subscription ID
  - `packages/backend/src/services/lightning/receipt-service.ts:659` — random string
  - `packages/backend/src/services/lightning/lightningService.ts:116,147,235` — mock randomness (acceptable)
  - `packages/backend/src/services/user/UserProfileService.ts:1251` — user ID
  - `packages/backend/src/services/user/UserRelationshipService.ts:1270` — relationship ID
  - `packages/backend/src/services/user/UserAnalyticsService.ts:2009` — export ID
  - `packages/backend/src/services/creator-recommendation-service.ts:456` — recommendation ID
  - `packages/backend/src/factories/user/UserServiceFactory.ts:218,219,258,259,289,290` — mock tokens (acceptable in factory)
  - `packages/backend/src/services/session-service.ts:491,496,506` — mock data (acceptable)
  - `packages/backend/src/routes/nip05.ts:489-496` — mock stats (acceptable)
- **Change**: Replace `Math.random().toString(36).substring(N)` with `crypto.randomUUID()` or `crypto.randomBytes(N).toString('hex')` for production ID generation
- **Scope**: Focus on services that generate IDs for real data (payments, receipts, events). Skip mock/test/placeholder data.
- **Approach**: Create a utility function `generateId(prefix: string): string` using `crypto.randomUUID()` and replace usages
- **Complexity**: Small (mechanical replacement, ~15 files)

#### 1d. Todo 105 — Sensitive Fields Over-Matching
- **File**: `packages/backend/src/lib/sensitive-fields.ts`
- **Change**: Remove `'key'` (line 22) and `'auth'` (line 21) from SENSITIVE_FIELDS array. These are already covered by specific patterns: `apiKey`, `api_key`, `privateKey`, `private_key`, `authorization`
- **Add**: `'authToken'`, `'authSecret'`, `'accessToken'`, `'refreshToken'`, `'sessionToken'`, `'encryptionKey'`, `'signingKey'`, `'secretKey'`, `'secret_key'`
- **Complexity**: Trivial (array modification)

#### 1e. Todo 132 — Mock Database Throws
- **File**: `packages/backend/src/bootstrap.ts` (lines 231-237)
- **Change**: Replace silent mock `{ rows: [], rowCount: 0 }` with throw that says `Database not configured — resolve TYPES.Database with a real implementation`
- **Complexity**: Trivial

### Batch 2: Architecture Fixes — Caching & Services

**Purpose**: Slightly more complex fixes requiring understanding of service internals. Should follow Batch 1 to build on any utility changes.

**Dependencies**: Batch 1c (UUID utility) should be done first since Batch 2 services may use IDs.

#### 2a. Todo 104 — TTLCache Refactor
- **File**: `packages/backend/src/utils/ttl-cache.ts`
- **Changes**:
  1. Add `lastAccessed: number` to cache entries
  2. Update `get()` to track access time
  3. Change eviction from FIFO to LRU (evict entry with oldest `lastAccessed`)
  4. Fix `size` getter to exclude expired entries
  5. Fix `values()` to collect expired keys, then delete them after iteration (no mutation during iteration)
  6. Add `cleanExpired()` public method
- **Tests**: Update existing tests, add LRU eviction test cases
- **Complexity**: Medium

#### 2b. Todo 131 — Unbounded Polling Timers
- **File**: `packages/backend/src/services/lightning-payment-service.ts` (lines 649-689)
- **Change**: Store interval IDs in a Map keyed by invoice ID. Clear interval when invoice transitions to paid/expired/cancelled. Add a `maxPollingDuration` timeout (e.g., 1 hour) after which polling auto-stops.
- **Complexity**: Small

#### 2c. Todo 133 — Scheduled Publish Recovery
- **File**: `packages/backend/src/services/content/ContentPublishingService.ts`
- **Change**: Add `recoverScheduledJobs()` method that queries for content with status='scheduled' and publishAt > now, then re-registers timers. Call this from service initialization.
- **Complexity**: Small

#### 2d. Todo 134 — Async Constructor Fix
- **File**: `packages/backend/src/services/lightning-payment-service.ts` (lines 134, 141-151)
- **Change**: Option B — Add explicit `async initialize()` method. Remove `this.initializeService()` from constructor. Add initialization guard pattern (throw if methods called before initialize()). Update bootstrap/DI to call `await service.initialize()` after construction.
- **Complexity**: Small

### Batch 3: Frontend — Error Boundary Factory

**Purpose**: Frontend-only change, completely independent of backend batches. Could be done in parallel with Batch 2.

#### 3a. Todo 106 — Error Boundary Factory
- **Files**:
  - Create: `packages/frontend/src/monitoring/createFeatureErrorBoundary.tsx`
  - Modify: 6 feature ErrorBoundary files (ai, dashboard, nostr, content, subscriptions, analytics)
  - Keep unchanged: `packages/frontend/src/features/auth/ErrorBoundary.tsx` (custom implementation)
- **Important**: Files import from `../../monitoring/ErrorBoundary`, NOT `@/components/ErrorBoundary` as todo states
- **Change**: Create factory function that wraps `ErrorBoundary` with `level="feature"` and `featureName` prop. Replace 6 identical 16-line files with one-line factory calls.
- **Complexity**: Small

### Batch 4: Docker Security Hardening

**Purpose**: Infrastructure-only changes, no application code.

#### 4a. Todo 035+059 (Merged) — Docker Fixes
- **File**: `docker/security/docker-compose.secure.yml`
- **Changes**:
  1. Line 248: Change Redis health check from `['CMD', 'redis-cli', '-a', '${REDIS_PASSWORD}', 'ping']` to `['CMD-SHELL', 'REDISCLI_AUTH=$REDIS_PASSWORD redis-cli ping']`
  2. Line 325: Change ICC from `'true'` to `'false'` — BUT add explicit service links or use Docker network aliases for backend→redis and backend→postgres communication
- **Items from 035 NOT applicable**: Vault setup script deleted. Postgres ports already bound to 127.0.0.1. CSP report endpoint logging already addressed.
- **Items from 059 NOT applicable**: Console logging already fixed. `_next` already fixed. Emojis already removed.
- **Complexity**: Small

### Batch 5: Database Query Patterns

**Purpose**: Lowest priority, prepares for future real DB integration.

#### 5a. Todo 130 — N+1 Query Patterns
- **Files**:
  - `packages/backend/src/services/recommendation-service.ts` — `getCreatorRecommendations()`
  - `packages/backend/src/services/lightning-service.ts` — `getCreatorPayments()`
- **Change**: Add WHERE clause filtering at query level instead of loading all + filtering in-memory. Since these are placeholder implementations, add a TODO comment noting the optimization and restructure the data access pattern.
- **Complexity**: Small
- **Note**: Low urgency since these use placeholder data. Fix the pattern so it's correct when real DB is wired.

### Batch 6: OpenAPI Documentation

**Purpose**: Documentation-only, no behavior changes.

#### 6a. Todo 018 — OpenAPI Annotations
- **Files**:
  - `packages/backend/src/routes/v1/payment.routes.ts` (211 lines, 0 OpenAPI annotations)
  - `packages/backend/src/routes/v1/user.routes.ts` (223 lines, 0 OpenAPI annotations)
- **Reference**: `packages/backend/src/routes/v1/content.routes.ts` (has 11 @openapi blocks)
- **Change**: Add OpenAPI JSDoc annotations matching the pattern in content.routes.ts to all endpoint handlers in payment and user routes
- **Complexity**: Medium (repetitive but voluminous — needs careful endpoint-by-endpoint documentation)

## Batch Dependency Graph

```
Batch 0 (pre-work: mark 109, 059 resolved)
    |
    v
Batch 1 (quick wins: 083, 084, 085, 105, 132) ─────────┐
    |                                                     |
    v                                                     v
Batch 2 (arch: 104, 131, 133, 134)            Batch 3 (frontend: 106)
    |                                                     |
    v                                                     v
Batch 4 (docker: 035+059)                     [done when Batch 3 completes]
    |
    v
Batch 5 (queries: 130)
    |
    v
Batch 6 (docs: 018)
```

**Parallelism**: Batches 2 and 3 can run in parallel (backend vs frontend). Batch 4 is independent of Batch 3. Batch 6 is lowest priority and can be deferred if sprint time runs short.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| TTLCache LRU change breaks cache consumers | Low | Medium | Existing tests + new LRU tests. Interface unchanged. |
| Polling timer cleanup misses edge cases | Low | Low | Add maxPollingDuration failsafe |
| Sensitive field changes miss a real sensitive field | Low | Medium | Keep broad terms `password`, `token`, `secret`, `credential`. Only remove `key` and `auth`. |
| Error boundary factory breaks React rendering | Low | Low | Pure refactor, no behavior change. Visual testing confirms. |
| Docker ICC=false breaks service communication | Medium | Medium | Test backend→redis and backend→postgres connectivity after change. Docker uses network aliases. |

## Estimated Complexity Summary

| Batch | Items | Estimated Effort |
|-------|-------|-----------------|
| 0 | 2 (mark resolved) | Trivial |
| 1 | 5 items | Small (most are 1-file changes) |
| 2 | 4 items | Medium (TTLCache is the heaviest) |
| 3 | 1 item | Small |
| 4 | 1 merged item | Small |
| 5 | 1 item | Small |
| 6 | 1 item | Medium |
| **Total** | **14 implement + 6 defer** | **~3-4 hours implementation** |
