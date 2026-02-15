---
status: pending
priority: p1
issue_id: '039'
tags: [code-review, architecture, redis, data-integrity]
dependencies: []
---

# Redis Client Sprawl

## Problem Statement

Five independent Redis client instances are created across the codebase with different authentication configurations, retry strategies, and environment variable sources. If Redis requires authentication, some clients will fail silently.

## Findings

**Locations**:

- `/Users/fp/Desktop/Sovren/packages/backend/src/routes/health.ts:15`
- `/Users/fp/Desktop/Sovren/packages/backend/src/middleware/rate-limit-middleware.ts:150`
- `/Users/fp/Desktop/Sovren/packages/backend/src/bootstrap.ts:260`
- `/Users/fp/Desktop/Sovren/packages/backend/src/cache/RedisAdapter.ts:174`
- `/Users/fp/Desktop/Sovren/packages/backend/src/services/CacheService.ts:48`

**Found by**: Data Integrity Guardian, Pattern Recognition Specialist

**Configuration inconsistencies**:

| File                     | Env Vars                                     | Auth            | Retry   | Error Handling |
| ------------------------ | -------------------------------------------- | --------------- | ------- | -------------- |
| health.ts                | `REDIS_URL`                                  | Implicit in URL | Default | None           |
| rate-limit-middleware.ts | `REDIS_HOST`, `REDIS_PORT`                   | None            | Custom  | Basic          |
| bootstrap.ts             | `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` | Explicit        | None    | Logs only      |
| RedisAdapter.ts          | `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` | Explicit        | Custom  | Throws         |
| CacheService.ts          | `REDIS_HOST`, `REDIS_PORT`                   | None            | Default | Silent fail    |

**Problems**:

1. `health.ts` uses `REDIS_URL` with no guarantee of password inclusion
2. Rate limiter and CacheService have no auth configuration - will fail against secured Redis
3. Inconsistent retry strategies mean different failure modes
4. No connection pooling or reuse - each instance maintains separate TCP connections
5. Error handling ranges from throwing to silent failure

**Example failure scenario**:

```
Production Redis requires auth
→ health.ts connects (password in URL) ✓
→ Rate limiter connects (no auth) ✗
→ All requests fail rate limit check
→ Either block all traffic or allow unlimited traffic
```

## Proposed Solutions

### Option 1: Unified Redis Factory (Recommended)

Create a single `lib/redis.ts` factory that:

- Reads unified configuration (with precedence: URL > HOST+PORT+PASSWORD)
- Creates a single shared client or connection pool
- Adds consistent error handlers
- Exports typed client interface

**Pros**:

- Single source of truth for configuration
- Connection pooling and reuse
- Consistent error handling and retry logic
- Easy to add monitoring and metrics
- Type safety across all consumers

**Cons**:

- Requires refactoring all 5 call sites
- Need to handle initialization order

**Implementation**:

```typescript
// lib/redis.ts
export const getRedisClient = (() => {
  let client: RedisClient;
  return async () => {
    if (!client) {
      client = await createClient(getUnifiedConfig());
      client.on('error', handleRedisError);
    }
    return client;
  };
})();
```

### Option 2: Dependency Injection Container

Use a DI container (e.g., tsyringe) to manage Redis client lifecycle.

**Pros**:

- Testability (easy to mock)
- Explicit dependency graph
- Handles initialization order

**Cons**:

- Adds framework dependency
- Steeper learning curve
- Overkill for single client

### Option 3: Environment Variable Normalization

Standardize all code to use the same env vars, but still create separate clients.

**Pros**:

- Minimal code changes
- No architectural changes

**Cons**:

- Still wastes connections
- No pooling
- Inconsistent error handling remains

## Technical Details

**Root cause**: Organic growth without centralized client management. Each feature added its own Redis client with whatever pattern the author knew.

**Current connection count**: 5 TCP connections per process (potentially 5x connection pool size).

**Environment variable chaos**:

- `REDIS_URL`: Used by health check
- `REDIS_HOST`: Used by 4 files
- `REDIS_PORT`: Used by 4 files
- `REDIS_PASSWORD`: Used by 2 files

**Auth failure mode**:
When Redis requires password:

- Clients with password: Connect successfully
- Clients without password: `NOAUTH Authentication required` error
- Some features work, others fail
- No clear system-wide failure indication

**Memory impact**: Each client maintains:

- TCP socket
- Send/receive buffers
- Command queue
- Reconnection timers

## Acceptance Criteria

- [ ] Single Redis client factory in `lib/redis.ts`
- [ ] All 5 call sites refactored to use factory
- [ ] Unified configuration with env var precedence documented
- [ ] Authentication works correctly when Redis requires password
- [ ] Authentication is optional when Redis allows unauthenticated access
- [ ] Connection pooling implemented (if using ioredis)
- [ ] Consistent error handling across all consumers
- [ ] Graceful degradation when Redis unavailable
- [ ] Monitoring/metrics hooks in factory (optional but recommended)
- [ ] Tests verify auth scenarios (with/without password)
- [ ] Tests verify connection reuse (spy on client creation)

## Work Log

_No work logged yet_

## Resources

- ioredis best practices: https://github.com/redis/ioredis#connect-to-redis
- Redis connection pooling: https://redis.io/docs/reference/clients/#connection-pooling
- Node.js singleton pattern: https://www.patterns.dev/posts/singleton-pattern
- Related files:
  - `/Users/fp/Desktop/Sovren/packages/backend/src/routes/health.ts`
  - `/Users/fp/Desktop/Sovren/packages/backend/src/middleware/rate-limit-middleware.ts`
  - `/Users/fp/Desktop/Sovren/packages/backend/src/bootstrap.ts`
  - `/Users/fp/Desktop/Sovren/packages/backend/src/cache/RedisAdapter.ts`
  - `/Users/fp/Desktop/Sovren/packages/backend/src/services/CacheService.ts`
