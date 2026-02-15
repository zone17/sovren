---
status: complete
priority: p1
issue_id: "091"
tags: [code-review, data-integrity, redis, broken-import]
dependencies: []
---

# 091: Broken Redis Import Path

## Problem Statement

`LightningPaymentService` and 6 other service files import `RedisClient` from `'../config/redis'`, but this module does not exist. The actual Redis singleton is located at `packages/backend/src/lib/redis.ts` and exports `getRedisClient()`. This breaks ALL Redis operations in these services including invoice caching, payment verification, and cache invalidation.

## Findings

**Location**: `packages/backend/src/services/lightning-payment-service.ts:4`

```typescript
import { RedisClient } from '../config/redis'; // Module does not exist
```

**Actual Redis module**: `packages/backend/src/lib/redis.ts`
```typescript
export function getRedisClient(): Redis { ... }
```

**Broken operations in LightningPaymentService**:
- **Line 228**: Invoice caching - `await RedisClient.setex(...)`
- **Line 429**: Payment verification caching - `await RedisClient.get(...)`
- **Line 487**: Payment status caching - `await RedisClient.setex(...)`
- **Lines 739-740**: Cache invalidation - `await RedisClient.del(...)`

**All Redis operations in this service throw runtime errors** when called, likely caught by try/catch blocks and silently failing.

**Other affected files with same broken import**:
1. `packages/backend/src/services/lightning-payment-service.ts`
2. `packages/backend/src/services/nostr-relay-service.ts`
3. `packages/backend/src/services/content-moderation-service.ts`
4. `packages/backend/src/services/analytics-service.ts`
5. `packages/backend/src/services/cache-service.ts`
6. `packages/backend/src/services/rate-limiter-service.ts`
7. `packages/backend/src/services/session-service.ts`

## Proposed Solutions

### Option A: Fix imports to use getRedisClient from lib/redis
- **Pros**: Uses existing singleton, no new files needed, correct architecture
- **Cons**: Requires updating 7+ files, need to refactor usage from `RedisClient.method()` to `getRedisClient().method()`
- **Effort**: Small
- **Risk**: Low

### Option B: Create config/redis.ts re-export module
- **Pros**: Minimal code changes, preserves existing usage patterns
- **Cons**: Adds unnecessary layer of indirection, non-standard location for singleton
- **Effort**: Small
- **Risk**: Low

### Option C: Move lib/redis.ts to config/redis.ts
- **Pros**: Makes import paths match expectations
- **Cons**: Requires updating all correct imports, lib/ is more appropriate for utilities
- **Effort**: Medium
- **Risk**: Medium

## Recommended Action

Implement Option A (fix imports to use lib/redis):

1. **Update all 7 service files**:
   ```typescript
   // Before
   import { RedisClient } from '../config/redis';
   await RedisClient.setex(...);

   // After
   import { getRedisClient } from '../lib/redis';
   const redis = getRedisClient();
   await redis.setex(...);
   ```

2. **Search for all occurrences**:
   - Run: `grep -r "from '../config/redis'" packages/backend/src/`
   - Update each file systematically

3. **Test Redis operations**:
   - Invoice caching in LightningPaymentService
   - Payment verification caching
   - Rate limiting
   - Session management
   - Analytics caching

4. **Add integration test**:
   - Verify Redis connection on startup
   - Test cache operations in each service

## Technical Details

- **Affected files**:
  - `packages/backend/src/services/lightning-payment-service.ts`
  - `packages/backend/src/services/nostr-relay-service.ts`
  - `packages/backend/src/services/content-moderation-service.ts`
  - `packages/backend/src/services/analytics-service.ts`
  - `packages/backend/src/services/cache-service.ts`
  - `packages/backend/src/services/rate-limiter-service.ts`
  - `packages/backend/src/services/session-service.ts`
- **Components**: Redis caching, session management, rate limiting, invoice caching, analytics
- **Root cause**: Import path references non-existent module, likely from refactoring or incorrect scaffold

## Acceptance Criteria

- [ ] All imports reference correct module: `../lib/redis`
- [ ] All Redis operations use `getRedisClient()` function
- [ ] Invoice caching works in LightningPaymentService
- [ ] Payment verification caching works
- [ ] Rate limiting functions correctly
- [ ] Session management persists to Redis
- [ ] No runtime import errors in any service
- [ ] Integration test verifies Redis connectivity

## Work Log

| Date | Action | Result |
|------|--------|--------|
| 2026-02-14 | Identified in PR #73 full code review | Review finding |

## Resources

- PR: https://github.com/zone17/sovren/pull/73
