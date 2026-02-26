# ADR-019: BullMQ Job Queue Standard

**Date**: 2026-02-26
**Status**: Accepted
**Epic**: v2.0 Production Roadmap
**Related ADRs**: [ADR-003 (Caching)](./ADR-003-multi-layer-caching.md), [ADR-013 (Redis)](./ADR-013-redis-caching.md), [ADR-014 (Circuit Breaker)](./ADR-014-circuit-breaker-pattern.md), [ADR-015 (Idempotency)](./ADR-015-idempotency-keys.md)

## Context

BullMQ is already in production with a mature implementation:

- `QueueService` wraps BullMQ `Queue` and `Worker` with a Map registry
- `IJobProcessor<T>` defines a framework-agnostic processor contract
- 3 queues exist: `cross-publish`, `relay-scan`, `inbox-polling`
- 5+ services depend on `QueueService` via DI (`TYPES.QueueService`)
- Bull Board admin UI at `/admin/queues` behind admin auth
- Health check integration via `queueService.isHealthy()`

v2.0 adds 4 new queue workloads across both squads. Without a formal standard, each team will invent its own conventions for naming, retry policies, failure handling, and concurrency — leading to inconsistent behavior and harder debugging.

This ADR codifies the existing patterns and extends them with prescriptive guidance for all new queue work.

## Decision

All background job processing in Sovren uses **BullMQ** via the `QueueService` abstraction. The following conventions are mandatory for all new queues.

### 1. Queue Naming

Format: **`{domain}-{action}`**, lowercase kebab-case.

```typescript
// Defined at module scope in the owning service
const QUEUE_NAME = 'payment-verification';
```

| Queue                   | Domain       | Action       | Owner             |
| ----------------------- | ------------ | ------------ | ----------------- |
| `payment-verification`  | payment      | verification | Squad B, Sprint 1 |
| `comment-moderation`    | comment      | moderation   | Squad B, Sprint 2 |
| `notification-delivery` | notification | delivery     | Squad B, Sprint 3 |
| `burnout-scoring`       | burnout      | scoring      | Squad A, Sprint 3 |

**Grandfathering:** Existing queue names (`cross-publish`, `relay-scan`, `inbox-polling`) predate this ADR and are not renamed. Renaming would orphan in-flight jobs in Redis. The convention applies to all new queues only.

### 2. Queue Creation and Retry Policy

Retry configuration belongs on the queue's `defaultJobOptions`, not on individual `addJob()` calls. This provides a single enforcement point.

```typescript
// packages/backend/src/services/payment/PaymentVerificationService.ts
const QUEUE_NAME = 'payment-verification';

constructor(private queueService: IQueueService) {
  this.queueService.createQueue(QUEUE_NAME, {
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
    },
  });
}
```

**Standard defaults:**

- `attempts: 3` — sufficient for transient failures (network blips, Redis reconnects)
- `backoff: { type: 'exponential', delay: 5000 }` — 5s, 10s, 20s
- `removeOnComplete: { count: 1000 }` — retain last 1000 completed jobs
- `removeOnFail: { count: 5000 }` — retain last 5000 failed jobs

**Override at `addJob()` call site** is permitted only with a code comment explaining why:

```typescript
// Override: payment verification needs immediate retry (no backoff)
// because LND node restarts are sub-second
await this.queueService.addJob(QUEUE_NAME, 'verify-invoice', data, {
  attempts: 5,
  backoff: { type: 'fixed', delay: 1000 },
});
```

**Payment audit exception:** For `payment-verification`, set `removeOnFail: false` to retain all failures indefinitely for audit:

```typescript
this.queueService.createQueue(QUEUE_NAME, {
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: false, // Retain ALL failures for payment audit
  },
});
```

### 3. Failed Job Handling

BullMQ's native **failed set** is the dead letter mechanism. Failed jobs remain in the queue's failed set (visible in Bull Board) after exhausting all retry attempts. No separate DLQ queue is created.

**When side effects accompany failure**, the processor MUST implement `onFailed()` to write terminal status to the database:

```typescript
// packages/backend/src/services/distribution/CrossPublishProcessor.ts (existing pattern)
async onFailed(job: JobContext<CrossPublishJobData>, error: Error): Promise<void> {
  await this.db
    .from('cross_posts')
    .update({
      status: 'failed',
      error_message: error.message,
      updated_at: new Date().toISOString(),
    })
    .eq('id', job.data.crossPostId);
}
```

**Compensating transaction pattern** for multi-step enqueue (from critical-patterns.md #4c):

```typescript
const enqueuedIds: string[] = [];
try {
  for (const row of inserted || []) {
    await this.queueService.addJob(QUEUE_NAME, `process-${row.id}`, jobData);
    enqueuedIds.push(row.id);
  }
} catch (err) {
  const failedIds = (inserted || []).map((r) => r.id).filter((id) => !enqueuedIds.includes(id));

  logger.error('[Service] Enqueue failed mid-loop; compensating', {
    enqueuedCount: enqueuedIds.length,
    totalCount: (inserted || []).length,
    err,
  });

  if (failedIds.length > 0) {
    const { error: compensateError } = await db
      .from('table')
      .update({ status: 'failed', error_message: 'Queue enqueue failed' })
      .in('id', failedIds);

    if (compensateError) {
      logger.error('[Service] Compensating update failed — rows may be stuck', {
        failedIds,
        compensateError,
      });
    }
  }

  throw err; // Always rethrow
}
```

### 4. Processor Implementation

All processors implement `IJobProcessor<T>`:

```typescript
// packages/backend/src/services/payment/PaymentVerificationProcessor.ts
import type { IJobProcessor, JobContext } from '../../interfaces/queue/IJobProcessor';

interface PaymentVerificationJobData {
  invoiceId: string;
  creatorId: string;
  amountSats: number;
}

export class PaymentVerificationProcessor implements IJobProcessor<PaymentVerificationJobData> {
  readonly name = 'payment-verifier';
  readonly queueName = 'payment-verification';
  readonly concurrency = 1; // Prevent double-settlement

  constructor(
    private db: SupabaseClient,
    private logger: ILogger
  ) {}

  async process(job: JobContext<PaymentVerificationJobData>): Promise<void> {
    const { invoiceId, creatorId } = job.data;

    // TOCTOU-safe: conditional update prevents duplicate processing
    const { data: updated } = await this.db
      .from('invoices')
      .update({ status: 'verifying', attempt_count: job.attemptsMade + 1 })
      .eq('id', invoiceId)
      .eq('status', 'pending')
      .select('id');

    if (!updated?.length) return; // Already processed or cancelled

    // ... verify against LND ...
  }

  async onFailed(job: JobContext<PaymentVerificationJobData>, error: Error): Promise<void> {
    await this.db
      .from('invoices')
      .update({ status: 'verification_failed', error_message: error.message })
      .eq('id', job.data.invoiceId);
  }
}
```

### 5. Concurrency

| Queue                   | Concurrency | Rationale                                                   |
| ----------------------- | ----------- | ----------------------------------------------------------- |
| `payment-verification`  | 1           | Prevents double-settlement; aligns with ADR-015 idempotency |
| `comment-moderation`    | 10          | I/O bound (DOMPurify), no ordering requirement              |
| `notification-delivery` | 5           | Fan-out, matches existing cross-publish pattern             |
| `burnout-scoring`       | 3           | CPU-bound scoring algorithm, matches relay-scan pattern     |

Default (from `IJobProcessor`): `concurrency = 1` when omitted.

### 6. Job Data Rules

- **Plain JSON only.** Serialized via `JSON.stringify` into Redis. No class instances, functions, Date objects, or circular references.
- **No secrets.** Job data holds only identifiers (IDs, timestamps). Credentials, tokens, and PII are resolved from the database at execution time. (Security requirement M-7.)
- **Deterministic job IDs** for idempotent enqueue and targeted removal:

```typescript
await this.queueService.addJob(
  QUEUE_NAME,
  'verify-invoice',
  { invoiceId, creatorId, amountSats },
  { jobId: `payment-verify-${invoiceId}` } // Deterministic
);
```

- **Type safety** via `IJobProcessor<T>` generics at compile time. No runtime Zod validation on job data in v2.0.

### 7. Registration and Lifecycle

Register processors in domain-specific DI bindings or at service constructor time. `registerProcessor()` auto-creates the queue if missing:

```typescript
// packages/backend/src/container/bindings/payment.bindings.ts
registry.registerSingletonFactory(TYPES.PaymentVerificationProcessor, (container) => {
  const db = container.resolve(TYPES.SupabaseClient);
  const logger = container.resolve(TYPES.Logger);
  return new PaymentVerificationProcessor(db, logger);
});

// In bootstrap sequence:
const processor = container.resolve(TYPES.PaymentVerificationProcessor);
queueService.registerProcessor(processor);
```

**Graceful shutdown:** `queueService.closeAll()` closes workers first (stops picking up new jobs), then closes queues. BullMQ's `Worker.close()` waits for the current job to finish — no custom timeout in v2.0.

### 8. Monitoring

- **Bull Board** at `/admin/queues` — all registered queues auto-appear. Protected by `authenticate` + `authorize(['admin'])`.
- **Health check** via `queueService.isHealthy()` — included in the `/health` endpoint.
- **No real-time alerting** on queue failures in v2.0. Bull Board is pull-only. Processors that write terminal status to the database can trigger existing monitoring via DB-level checks. Real-time alerting (Slack/PagerDuty) deferred to v2.1.

## Consequences

### Positive

1. **Consistent patterns** across both squads — every new queue follows the same naming, retry, and processor conventions
2. **Operational visibility** via Bull Board for all queues without additional setup
3. **Failed job retention** enables debugging without log archaeology
4. **Framework-agnostic interface** (`IJobProcessor`) — swapping BullMQ for another queue system requires only a new `IQueueService` implementation, not changes to processors

### Negative

1. **No real-time alerting** on queue failures — operators must check Bull Board proactively. **Mitigation:** Processors write terminal status to DB; existing DB monitoring provides a secondary signal. Real-time alerting is v2.1 scope.
2. **Failed set is unbounded for payment queues** (`removeOnFail: false`) — Redis memory grows if payment failures accumulate. **Mitigation:** Payment failures should be rare on testnet. Add cleanup job in v2.1 for mainnet.
3. **No runtime job data validation** — a producer that passes the wrong shape will fail at process time, not enqueue time. **Mitigation:** Compile-time generics catch most issues. Runtime validation can be added per-processor if needed.

## Alternatives Considered

### 1. Separate DLQ Queue per Workload

**Pros:** Explicit dead letter routing, can attach different alerting per queue.

**Cons:** Doubles the number of queues. Requires custom `onFailed` that enqueues to a second queue. BullMQ has no native DLQ — fully custom code.

**Why Rejected:** BullMQ's failed set + Bull Board provides sufficient visibility for v2.0. Separate DLQs add complexity with no proportional benefit until real-time alerting is added.

### 2. Retry Config on IJobProcessor Interface

**Pros:** Each processor self-describes its retry behavior.

**Cons:** Creates N override points. Harder to enforce a standard. Current `IJobProcessor` interface has no `retryOptions` field — adding it is a breaking change.

**Why Rejected:** Queue-level `defaultJobOptions` provides a single enforcement point. Call-site overrides with comments handle exceptional cases.

### 3. Zod Validation on Job Data at Runtime

**Pros:** Catches producer bugs at enqueue time.

**Cons:** Adds runtime overhead to every `addJob()` call. Requires maintaining Zod schemas alongside TypeScript types.

**Why Rejected:** Compile-time generics are sufficient for internal producer/consumer pairs. If external producers are added in v2.1, runtime validation can be added to specific queues.

## Implementation Notes

**Test mock** — use `packages/backend/src/test-utils/queue-mock.ts`:

```typescript
import { createQueueServiceMock } from '../test-utils/queue-mock';

const mockQueue = createQueueServiceMock();
// mockQueue.addJob.mockResolvedValue('mock-job-id');
```

**Redis connection** — BullMQ requires `maxRetriesPerRequest: null` on its Redis connections. `QueueService.createBullMQConnection()` handles this by creating dedicated connections from the shared Redis config. Do NOT pass the shared `getRedisClient()` directly to BullMQ.

## Related Documentation

- `packages/backend/src/services/queue/QueueService.ts` — Implementation
- `packages/backend/src/interfaces/queue/IQueueService.ts` — Service interface
- `packages/backend/src/interfaces/queue/IJobProcessor.ts` — Processor interface
- `packages/backend/src/services/distribution/CrossPublishProcessor.ts` — Canonical processor
- `packages/backend/src/services/distribution/CrossPostService.ts` — Canonical queue consumer
- `packages/backend/src/test-utils/queue-mock.ts` — Test mock
- `packages/backend/src/routes/admin/bull-board.ts` — Bull Board admin UI
- `docs/solutions/patterns/critical-patterns.md` — Pattern #4c (queue compensation)

## Revision History

- **2026-02-26**: Initial version for v2.0 Sprint 0
