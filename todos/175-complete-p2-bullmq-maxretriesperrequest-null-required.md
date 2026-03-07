# 175 - P2 - BullMQ Workers Require maxRetriesPerRequest: null on Redis Connection

## Priority: P2 (Important)

## Source

PR #83 — Review Agent: security-sentinel, performance-oracle

## Description

The shared Redis client in `lib/redis.ts` is created with `maxRetriesPerRequest: 3`. BullMQ workers use blocking Redis commands (e.g., `BRPOPLPUSH`, `BLMOVE`) that can exceed this limit, causing `MaxRetriesPerRequestError` under normal operation.

`QueueService.ts` uses `redis.duplicate()` to create connections for queues and workers. The `duplicate()` method clones the existing connection **including** the `maxRetriesPerRequest: 3` setting. BullMQ's documentation explicitly requires `maxRetriesPerRequest: null` for worker connections.

This will manifest as intermittent worker connection errors, especially under load or when Redis has brief latency spikes.

## Files

- `packages/backend/src/services/queue/QueueService.ts:38-39` (queue connection)
- `packages/backend/src/services/queue/QueueService.ts:98-99` (worker connection)
- `packages/backend/src/lib/redis.ts:39` (shared client maxRetriesPerRequest)

## Fix

Instead of `redis.duplicate()`, create BullMQ-specific ioredis connections with `maxRetriesPerRequest: null`:

```typescript
import Redis from 'ioredis';

function createBullMQConnection(): Redis {
  const baseClient = getRedisClient();
  const opts = baseClient.options;
  return new Redis({
    host: opts.host,
    port: opts.port,
    password: opts.password,
    db: opts.db,
    maxRetriesPerRequest: null, // Required for BullMQ blocking commands
  });
}
```

Or pass the connection config object rather than duplicating the client.

## Impact

Reliability — workers will fail with `MaxRetriesPerRequestError` under load.
