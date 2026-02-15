---
status: pending
priority: p2
issue_id: '050'
tags: [code-review, performance, rate-limiting, scalability]
dependencies: []
---

# Rate Limiters In-Memory Only

## Problem Statement

All rate limiter presets use in-memory MemoryStore, causing independent rate-limit counters per instance in multi-instance deployments. A `createRedisRateLimiter` function with Redis-backed store exists but is never imported or called, making it dead code. Additionally, the Redis client configuration has `enableOfflineQueue: true` which causes unbounded memory growth when Redis is unavailable.

## Findings

**Location**:

- `middleware/rate-limit-middleware.ts:52-108` (presets using MemoryStore)
- `middleware/rate-limit-middleware.ts:145-180` (dead Redis code)

**Issue 1: In-Memory Only in Production**:

- All rate limiter presets instantiate with default MemoryStore
- Multi-instance deployment = each instance has independent counters
- Attacker can bypass limits by distributing requests across instances
- 3 instances with 100 req/min limit = effective 300 req/min limit

**Issue 2: Dead Redis Code**:

- `createRedisRateLimiter` function exists (36 lines)
- Never imported by any module
- Never called
- Redis store dependency installed but unused
- Wasted implementation effort

**Issue 3: Unbounded Queue Growth**:

```typescript
const redis = new Redis({
  enableOfflineQueue: true, // DANGEROUS
});
```

- When Redis down, commands queue in memory indefinitely
- No queue size limit
- Memory exhaustion in production outages
- Should fail fast or have bounded queue

## Proposed Solutions

1. **Enable Redis Store** (Recommended):

   - Replace MemoryStore with Redis store in all presets
   - Use existing `createRedisRateLimiter` implementation
   - Add Redis health check before server start
   - Configure `enableOfflineQueue: false` for fail-fast behavior
   - Add Redis connection pooling
   - Document Redis requirement in deployment guides

2. **Hybrid Approach**:

   - Use Redis in production (check NODE_ENV)
   - Fall back to MemoryStore in development/test
   - Add warning log when using MemoryStore
   - Still requires Redis setup

3. **Bounded Queue with Circuit Breaker**:
   - Keep `enableOfflineQueue: true`
   - Set `maxRetriesPerRequest: 3`
   - Add circuit breaker pattern
   - More complex, less reliable

## Technical Details

**Current Architecture**:

```typescript
// All presets use MemoryStore (default)
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  // No store specified = MemoryStore
});
```

**Target Architecture**:

```typescript
import RedisStore from 'rate-limit-redis';
import { redisClient } from './redis';

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  store: new RedisStore({
    client: redisClient,
    prefix: 'rl:api:',
  }),
});
```

**Redis Configuration Changes**:

```typescript
const redis = new Redis({
  enableOfflineQueue: false, // Fail fast
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => {
    if (times > 3) return null; // Stop retrying
    return Math.min(times * 50, 2000);
  },
});
```

## Acceptance Criteria

- [ ] All rate limiter presets use Redis store in production
- [ ] `createRedisRateLimiter` function used or removed
- [ ] Redis client configured with `enableOfflineQueue: false`
- [ ] Bounded retry strategy implemented
- [ ] Health check verifies Redis connectivity on startup
- [ ] Graceful degradation when Redis unavailable (fail closed or open - document decision)
- [ ] Rate limits enforced across all instances
- [ ] Load testing confirms distributed rate limiting works
- [ ] Memory usage stable during Redis outages
- [ ] Documentation updated with Redis deployment requirements
- [ ] Environment variable configuration for Redis connection
- [ ] Docker Compose updated with Redis service
- [ ] CI/CD pipeline includes Redis for integration tests

## Work Log

Created: 2026-02-12

## Resources

- PR #73 post-remediation review
- rate-limit-redis package documentation
- Redis client documentation
- ioredis configuration options
