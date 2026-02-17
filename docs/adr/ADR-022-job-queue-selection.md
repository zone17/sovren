# ADR-022: Job Queue Selection

## Status

Accepted

## Date

2026-02-16

## Context

EPIC-009 (NOSTR Relay Scanner) and EPIC-012 (Background Processing) require a robust background job queue for tasks such as notification delivery, content fingerprint scanning, relay event processing, and scheduled analytics aggregation. The job queue must:

1. **Support retries and dead letter queues** — Failed jobs must be retried with exponential backoff and eventually moved to a dead letter queue for manual inspection
2. **Provide job prioritization** — Urgent notifications and payment confirmations must preempt bulk analytics jobs
3. **Support scheduled/delayed jobs** — Recurring tasks (daily digest emails, weekly analytics rollups) and delayed retries
4. **Be observable** — Dashboard for monitoring queue depth, failure rates, and processing latency
5. **Be self-hosted** — Sovren's decentralized philosophy requires full infrastructure ownership; no vendor lock-in or cloud-hosted SaaS dependencies
6. **Integrate with existing infrastructure** — Minimize new dependencies and operational overhead

The current implementation in `NotificationService` (790 lines) uses an in-memory array as a queue (`private readonly queue: NotificationQueueItem[] = []`), processed by a `setInterval` every 5 seconds. This has critical limitations:

- **Data loss on restart** — All queued jobs are lost when the process restarts
- **No horizontal scaling** — The in-memory queue is process-local; multiple backend instances cannot share work
- **No dead letter queue** — Failed jobs retry in-place with no way to inspect or manually retry persistent failures
- **No prioritization** — Jobs are sorted by priority in the array but processed sequentially with no preemption
- **No observability** — No dashboard, no metrics export, no alerting on queue depth

We evaluated three options:

- **A) BullMQ**: Redis-based job queue for Node.js/TypeScript. Reuses existing ioredis infrastructure. Self-hosted. Built-in retries, DLQ, rate limiting, priorities, scheduling, and Bull Board dashboard. Most mature option in the Node.js ecosystem (18K+ GitHub stars, active maintenance).
- **B) Inngest**: Cloud-hosted event-driven workflow engine. Serverless-friendly with built-in observability. No Redis needed. However, it is a SaaS product with vendor lock-in, pricing at scale, and conflicts with Sovren's self-hosting requirement.
- **C) Trigger.dev**: Cloud-hosted background job platform with TypeScript-first DX. Self-hosting available in v3+ but is a younger project with a smaller community. Designed primarily for long-running tasks and serverless environments.

## Decision

**Option A: BullMQ — Redis-based job queue with Bull Board for monitoring.**

### Decision Drivers

1. **Redis infrastructure already exists** — `packages/backend/src/lib/redis.ts` provides a production-ready ioredis singleton with retry logic, connection lifecycle management, and health checks. BullMQ accepts an ioredis connection directly — zero new infrastructure required.

2. **ioredis already installed** — `ioredis ^5.3.2` is in `packages/backend/package.json` dependencies. BullMQ is built on top of ioredis and requires no additional database or message broker.

3. **Self-hosted aligns with decentralized philosophy** — Sovren is built on NOSTR and Bitcoin Lightning specifically to avoid centralized dependencies. A cloud-hosted job queue (Inngest, Trigger.dev) contradicts this core principle. BullMQ runs entirely on Sovren's own Redis instance.

4. **Zero additional infrastructure cost** — Redis is already provisioned for caching and rate limiting (`rate-limit-redis ^4.3.1` is in the dependency tree). BullMQ adds no new infrastructure, no new billing, no new vendor relationship.

5. **Bull Board for monitoring** — `@bull-board/express` provides a ready-made dashboard that integrates directly with Express (already the backend framework). Shows queue depth, job status, failure rates, and allows manual retry/removal.

6. **Most mature Node.js/TypeScript option** — BullMQ is the successor to Bull, with 8+ years of ecosystem maturity. Active TypeScript support with first-class type definitions. Used in production by large-scale Node.js applications.

7. **Direct replacement for in-memory queue** — BullMQ's API maps cleanly to the existing `NotificationQueueItem` pattern: `queue.add()` replaces `this.queue.push()`, workers replace `setInterval` processing, and job options replace manual retry/priority logic.

### Architecture

```
┌──────────────────────┐       ┌──────────────────────┐
│   Producer Services   │       │   Bull Board (UI)    │
│                      │       │   /admin/queues       │
│  NotificationService │       └──────────┬───────────┘
│  RelayScannerService │                  │ reads
│  AnalyticsService    │                  ▼
│  ContentShieldService│       ┌──────────────────────┐
│                      │──────▶│     Redis (ioredis)   │
└──────────────────────┘ add   │   Existing singleton  │
                               │   from src/lib/redis  │
                               └──────────┬───────────┘
                                          │ consume
                               ┌──────────▼───────────┐
                               │   BullMQ Workers      │
                               │                      │
                               │  notification.worker  │
                               │  relay-scan.worker    │
                               │  analytics.worker     │
                               │  fingerprint.worker   │
                               └──────────────────────┘
```

### Queue Configuration

| Queue | Concurrency | Max Retries | Backoff | Priority Levels |
|-------|-------------|-------------|---------|-----------------|
| `notifications` | 5 | 3 | Exponential (1s, 4s, 16s) | urgent, high, normal, low |
| `relay-scan` | 3 | 5 | Exponential (2s, 8s, 32s) | high, normal |
| `analytics` | 2 | 3 | Fixed (30s) | normal, low |
| `content-fingerprint` | 3 | 3 | Exponential (5s, 20s, 80s) | normal |

### Connection Reuse

BullMQ requires dedicated ioredis connections (it uses blocking commands like `BRPOPLPUSH`). The implementation will create BullMQ-specific connections using the same configuration from `getConfig()` in `src/lib/redis.ts`, while the shared singleton remains available for caching and rate limiting.

```typescript
import { Queue, Worker } from 'bullmq';

// Reuse the same Redis config, but BullMQ manages its own connections
const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0', 10),
};

const notificationQueue = new Queue('notifications', { connection });
const notificationWorker = new Worker('notifications', processor, {
  connection,
  concurrency: 5,
});
```

### Migration Path from In-Memory Queue

1. Install `bullmq` and `@bull-board/express`
2. Create queue definitions in `src/lib/queues/`
3. Create workers in `src/workers/`
4. Refactor `NotificationService.addToQueue()` to call `notificationQueue.add()` instead of `this.queue.push()`
5. Remove `startQueueProcessor()` / `processQueue()` / `setInterval` from `NotificationService`
6. Mount Bull Board at `/admin/queues` (protected by auth middleware)
7. Add graceful shutdown: `worker.close()` in the server shutdown handler alongside `disconnectRedis()`

## Consequences

**Positive:**
- Eliminates data loss on restart — jobs persist in Redis
- Enables horizontal scaling — multiple backend instances can share queue work via Redis
- Built-in retries with configurable backoff strategies (exponential, fixed, custom)
- Dead letter queue for persistent failures — inspectable and manually retryable via Bull Board
- Job prioritization with named priority levels
- Scheduled and recurring jobs (cron syntax supported)
- Bull Board dashboard for real-time queue monitoring without building custom UI
- No new infrastructure — reuses existing Redis
- No vendor lock-in — fully self-hosted, open-source (MIT license)
- Active TypeScript support with first-class type definitions
- ~200 line reduction in NotificationService by removing manual queue logic

**Negative:**
- Redis becomes a harder dependency — queue data loss if Redis goes down without persistence (RDB/AOF)
- BullMQ requires dedicated ioredis connections (cannot share the singleton for blocking commands)
- Learning curve for BullMQ-specific patterns (sandboxed processors, flow producers, rate limiters)
- Bull Board adds an admin surface that must be secured

**Mitigation:**
- Enable Redis persistence (RDB snapshots + AOF) in production Docker configuration — already planned in infrastructure setup
- Connection count is manageable: ~2 connections per queue (1 producer, 1 worker) = ~8 total for 4 queues
- Bull Board route protected by existing admin auth middleware (`requireAdmin`)
- BullMQ documentation is comprehensive; team can reference existing patterns in the Node.js ecosystem

## Alternatives Rejected

### Inngest (Option B)
- **Rejected because**: Cloud-hosted SaaS conflicts with Sovren's self-sovereign, decentralized architecture. Introduces vendor lock-in, requires internet connectivity for job processing, and adds ongoing SaaS costs. The event-driven model is powerful but over-engineered for Sovren's current job queue needs.

### Trigger.dev (Option C)
- **Rejected because**: Younger project with smaller community and fewer production references. Self-hosting (v3+) is available but less battle-tested than BullMQ. Primarily designed for serverless and long-running task patterns that don't align with Sovren's Express-based backend. Adds complexity without clear benefit over BullMQ given existing Redis infrastructure.

## References

- [BullMQ Documentation](https://docs.bullmq.io/)
- [Bull Board](https://github.com/felixmosh/bull-board)
- Existing Redis singleton: `packages/backend/src/lib/redis.ts`
- Current in-memory queue: `packages/backend/src/services/NotificationService.ts` (lines 65-66, 686-789)
- ioredis dependency: `packages/backend/package.json` (line 70)
