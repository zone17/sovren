# 179 - P2 - QueueService Module-Level Singleton Bypasses DI Container

## Priority: P2 (Important)

## Source

PR #83 — Review Agent: security-sentinel

## Description

`QueueService.ts` maintains a module-level singleton:

```typescript
let singletonInstance: QueueService | null = null;

export function getQueueServiceInstance(): QueueService | null {
  return singletonInstance;
}
```

The constructor sets `singletonInstance = this` (line 29). This singleton is accessed in:

- `packages/backend/src/routes/health.ts:399` — health check
- `packages/backend/src/server.ts:73` — Bull Board mounting
- `packages/backend/src/server.ts:288` — graceful shutdown

This creates a parallel access path outside the DI container. Problems:

1. If the DI container disposes/recreates the QueueService, the singleton still points to the old instance
2. Health checks and shutdown bypass container lifecycle management
3. The singleton is never cleared on `closeAll()`, so a disposed QueueService is still accessible
4. Unit testing becomes harder — module-level state persists between test runs

## Files

- `packages/backend/src/services/queue/QueueService.ts:14-19,29` (singleton)
- `packages/backend/src/routes/health.ts:399` (consumer)
- `packages/backend/src/server.ts:73,288` (consumers)

## Fix

1. Resolve `QueueService` from the DI container where needed (pass it through Express `app.locals` or middleware)
2. For health checks, inject `IQueueService` into the health route via DI rather than module-level import
3. If the singleton pattern is kept, clear it in `closeAll()`: `singletonInstance = null`

## Impact

Architecture — DI bypass creates lifecycle management issues and testability problems.
