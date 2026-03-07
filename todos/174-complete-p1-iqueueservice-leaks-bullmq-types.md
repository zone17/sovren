# 174 - P1 - IQueueService Interface Leaks BullMQ Types

## Priority: P1 (Critical — Architecture)

## Source

PR #83 — Review Agent: architecture-strategist

## Description

The `IQueueService` interface in `packages/backend/src/interfaces/queue/IQueueService.ts` imports and exposes `Queue`, `QueueOptions`, and `JobsOptions` directly from the `bullmq` package:

```typescript
import type { Queue, QueueOptions, JobsOptions } from 'bullmq';
```

This violates the interface abstraction principle. Any service consuming `IQueueService` transitively depends on BullMQ types. If the queue implementation changes (e.g., to a different backend), all consumers must be updated. The project's CLAUDE.md explicitly states "Interfaces are law" (Commandment 7).

Additionally, `getQueue()` returns `Queue | undefined` — a concrete BullMQ type — making it impossible to swap implementations without changing the interface.

## Files

- `packages/backend/src/interfaces/queue/IQueueService.ts:7,12,20,28`

## Fix

Define framework-agnostic types for queue options and return types:

```typescript
export interface QueueJobOptions {
  jobId?: string;
  priority?: number;
  attempts?: number;
  backoff?: { type: string; delay: number };
  delay?: number;
  removeOnComplete?: boolean | { count: number };
  removeOnFail?: boolean | { count: number };
}

export interface QueueCreateOptions {
  defaultJobOptions?: QueueJobOptions;
}

export interface IQueueService {
  createQueue(name: string, options?: QueueCreateOptions): void;
  addJob<T>(
    queueName: string,
    jobName: string,
    data: T,
    options?: QueueJobOptions
  ): Promise<string>;
  getQueueNames(): string[];
  isHealthy(): Promise<boolean>;
  closeAll(): Promise<void>;
}
```

Remove `getQueue()` from the interface (it returns a concrete BullMQ `Queue`). If consumers need queue stats, add specific methods like `getWaitingCount(queueName)`.

## Impact

Architecture — leaky abstraction defeats the purpose of the interface layer. Blocks clean swapability of queue implementation.
