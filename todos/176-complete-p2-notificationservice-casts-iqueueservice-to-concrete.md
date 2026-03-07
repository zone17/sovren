# 176 - P2 - NotificationService Casts IQueueService to Concrete QueueService

## Priority: P2 (Important)

## Source

PR #83 — Review Agent: architecture-strategist

## Description

In `NotificationService.ts:736`, the code casts the interface to the concrete implementation:

```typescript
const qs = this.queueService as QueueService;
```

This is done to call `createQueue()` and `registerProcessor()`, which are on the concrete `QueueService` class but `registerProcessor` is NOT on the `IQueueService` interface.

This breaks the Dependency Inversion Principle — the service depends on a concrete class, not the interface. If a different `IQueueService` implementation were provided, this cast would fail at runtime.

The `import type { QueueService }` at line 30 of NotificationService.ts imports the concrete class just for this cast.

## Files

- `packages/backend/src/services/NotificationService.ts:30` (concrete import)
- `packages/backend/src/services/NotificationService.ts:736` (cast)
- `packages/backend/src/interfaces/queue/IQueueService.ts` (missing `registerProcessor`)

## Fix

Either:

1. **Add `registerProcessor` to `IQueueService`** so the interface is complete
2. **Move queue/worker initialization to a separate bootstrap function** that receives the concrete `QueueService` and `NotificationService`, wiring them together outside the service itself
3. **Use a factory pattern** where the DI container registers the processor during binding

Option 2 is cleanest — keeps `NotificationService` dependent only on the interface.

## Impact

Architecture — breaks interface abstraction, creates hidden dependency on concrete class.
