---
status: pending
priority: p2
issue_id: 489
tags: [code-review, backend, redis, architecture]
dependencies: []
---

# Redis lazy init bypasses health verification

## Problem Statement

`getRedisClient()` was changed from throwing when called before `connectRedis()` to silently creating a new client. The lazy path skips the `ping()` health check that `connectRedis()` performs. If Redis is down at startup, services silently get an unverified client.

**Agent consensus:** 5 of 10 agents flagged this (security, performance, architecture, data integrity, TypeScript).

## Findings

- **File:** `packages/backend/src/lib/redis.ts`, lines 98-103
- The module header comment (lines 1-9) still describes the old throw-on-missing behavior
- `connectRedis()` verifies via `ping()` (line 80), lazy path does not
- 9 call sites in production services use `getRedisClient()`
- No connection storm risk (synchronous singleton), but silent failure masking

## Proposed Solutions

### Option A: Add warning log to lazy path (Recommended — minimal change)

```typescript
if (!sharedClient) {
  logger.warn('[Redis] Lazy-creating client — connectRedis() was not called first');
  sharedClient = createClient();
}
```

- **Effort:** Small (5 min)
- **Risk:** None

### Option B: Revert to throw + fix initialization order

Fix bootstrap.ts to ensure `connectRedis()` runs before DI container creates services.

- **Effort:** Medium (1-2 hours)
- **Risk:** May surface other ordering issues

## Acceptance Criteria

- [ ] Lazy Redis creation is logged as a warning
- [ ] Module header comment updated to reflect new behavior

## Work Log

| Date       | Action                         | Learnings                                                    |
| ---------- | ------------------------------ | ------------------------------------------------------------ |
| 2026-02-24 | Created from /workflows:review | 5/10 agents flagged — no connection storm but silent failure |
