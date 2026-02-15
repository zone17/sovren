---
status: pending
priority: p2
issue_id: '095'
tags: [code-review, infrastructure, redis, shutdown]
dependencies: []
---

# Redis Connections Not Closed During Graceful Shutdown

## Problem Statement

`gracefulShutdown()` in `server.ts:277-306` contains only TODO comments for connection cleanup. `lib/redis.ts` exports `disconnectRedis()` but it's never called during shutdown. Redis connections linger after SIGTERM/SIGINT, blocking container shutdown in Kubernetes and causing connection leaks. Additionally, `lazyConnect: true` at `redis.ts:42` with no explicit `connect()` call means the first Redis command at runtime triggers connection, surfacing connection errors in user requests instead of at startup.

## Findings

**Shutdown Issues:**

- `gracefulShutdown()` at `server.ts:277-306` has TODO placeholders for cleanup
- `disconnectRedis()` exported from `lib/redis.ts` but never invoked
- Redis client connections remain open after HTTP server closes
- In Kubernetes, pod termination waits for connection close timeout (default 30s)
- Connection leaks accumulate in Redis server connection pool

**Startup Issues:**

- `lazyConnect: true` configured at `redis.ts:42`
- No explicit `redis.connect()` call during app initialization
- First Redis command (e.g., cache read) triggers connection attempt
- Connection failures surface as 500 errors in user requests, not at startup
- Health checks may pass even if Redis is unreachable (connection not established yet)

## Proposed Solutions

### Option 1: Add disconnectRedis() to gracefulShutdown

**Pros:**

- Minimal change: single function call in shutdown handler
- Fixes connection leak immediately
- Leverages existing disconnectRedis() implementation

**Cons:**

- Doesn't address lazy connection issue
- Health checks still misleading during startup

**Effort:** Low (30 minutes)
**Risk:** Low

### Option 2: Eager Connection + Graceful Shutdown

**Pros:**

- Remove `lazyConnect: true`, add explicit `connectRedis()` during bootstrap
- Connection errors fail-fast at startup (visible in logs, health checks)
- Add `disconnectRedis()` to graceful shutdown
- Full lifecycle management: connect → serve → disconnect

**Cons:**

- Requires `connectRedis()` export from `lib/redis.ts`
- Need to update bootstrap sequence in `server.ts` or `app.ts`
- Slightly slower startup (wait for Redis handshake)

**Effort:** Medium (2 hours)
**Risk:** Low

### Option 3: Comprehensive Connection Pool Management

**Pros:**

- Track all external connections (Redis, DB, Sentry, etc.)
- Unified shutdown sequence with timeouts
- Health check endpoint verifies all connections
- Graceful degradation if Redis unavailable

**Cons:**

- Larger refactor
- Requires connection registry pattern
- More complex error handling

**Effort:** High (6 hours)
**Risk:** Medium

## Recommended Action

**Option 2: Eager Connection + Graceful Shutdown**

This provides the best balance of reliability and simplicity. Fail-fast at startup is a best practice for 12-factor apps, and proper shutdown prevents connection leaks in production.

Implementation:

1. Remove `lazyConnect: true` from Redis client config in `lib/redis.ts:42`
2. Export `connectRedis()` function from `lib/redis.ts`
3. Call `await connectRedis()` during app bootstrap (after config load, before HTTP server start)
4. Add `await disconnectRedis()` to `gracefulShutdown()` in `server.ts`
5. Update health check endpoint to verify Redis connection is active
6. Add error handling for Redis connection failure at startup (log and exit)

**Shutdown Sequence:**

1. Receive SIGTERM/SIGINT
2. Stop accepting new requests
3. Wait for in-flight requests to complete (with timeout)
4. Close HTTP server
5. **Disconnect Redis** ← new step
6. Close database connections
7. Flush logs
8. Exit process

## Technical Details

**Affected Files:**

- `src/server.ts` (lines 277-306: gracefulShutdown function)
- `src/lib/redis.ts` (line 42: lazyConnect config, disconnectRedis export)
- `src/bootstrap.ts` or `src/app.ts` (add connectRedis call)
- Health check endpoint (verify Redis connection)

**Current gracefulShutdown (server.ts:277-306):**

```typescript
const gracefulShutdown = async (signal: string) => {
  logger.info(`${signal} received, starting graceful shutdown...`);

  server.close(() => {
    logger.info('HTTP server closed');
  });

  // TODO: Close database connections
  // TODO: Close Redis connections ← missing disconnectRedis()
  // TODO: Close other resources

  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};
```

**Proposed gracefulShutdown:**

```typescript
const gracefulShutdown = async (signal: string) => {
  logger.info(`${signal} received, starting graceful shutdown...`);

  server.close(async () => {
    logger.info('HTTP server closed');

    try {
      await disconnectRedis();
      logger.info('Redis disconnected');
    } catch (err) {
      logger.error('Error disconnecting Redis:', err);
    }

    // Close other connections (DB, etc.)

    logger.info('Graceful shutdown complete');
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};
```

**Current lib/redis.ts (line 42):**

```typescript
const redisClient = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  lazyConnect: true, // ← Remove this
  // ...
});
```

**Proposed Bootstrap Sequence:**

```typescript
// bootstrap.ts or app.ts
async function bootstrap() {
  loadConfig();
  await connectDatabase();
  await connectRedis(); // ← Add this
  initSentry();
  startHTTPServer();
}
```

**Health Check Endpoint Update:**

```typescript
app.get('/health', async (req, res) => {
  const checks = {
    http: 'ok',
    redis: 'unknown',
    database: 'unknown',
  };

  try {
    await redis.ping();
    checks.redis = 'ok';
  } catch (err) {
    checks.redis = 'error';
  }

  // DB check...

  const healthy = Object.values(checks).every((v) => v === 'ok');
  res.status(healthy ? 200 : 503).json(checks);
});
```

## Acceptance Criteria

- [ ] `lazyConnect: true` removed from Redis client configuration
- [ ] `connectRedis()` function exported from `lib/redis.ts`
- [ ] `await connectRedis()` called during app bootstrap before HTTP server starts
- [ ] Redis connection failure at startup logs error and exits process (fail-fast)
- [ ] `disconnectRedis()` called in `gracefulShutdown()` function
- [ ] Shutdown sequence waits for Redis disconnect before exiting
- [ ] Health check endpoint verifies Redis connection is active
- [ ] Integration test: SIGTERM triggers graceful shutdown with Redis disconnect
- [ ] Integration test: Redis unavailable at startup causes app to exit with error
- [ ] Kubernetes pod termination time reduced (no 30s connection timeout wait)
- [ ] Documentation updated in `docs/operations/shutdown-sequence.md` (if exists)

## Work Log

**2026-02-14**

- Identified in PR #73 full code review
- Observed TODO comments in gracefulShutdown function
- Confirmed disconnectRedis() export exists but is unused
- Identified lazyConnect as startup reliability issue

## Resources

- PR #73: https://github.com/user/sovren/pull/73
- Node.js graceful shutdown: https://expressjs.com/en/advanced/healthcheck-graceful-shutdown.html
- Kubernetes pod termination: https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#pod-termination
- ioredis lazy connection: https://github.com/redis/ioredis#connect-to-redis
- 12-factor app processes: https://12factor.net/processes
