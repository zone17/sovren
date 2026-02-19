---
status: pending
priority: p2
issue_id: 320
tags: [code-review, architecture, reliability]
---

# `BusinessInvoiceService` constructor side effect — queue creation at DI resolution

## Problem Statement

The `BusinessInvoiceService` constructor calls `queueService.createQueue()` during DI container resolution. If Redis is unavailable at startup, the entire finance module fails to load — even routes that don't use recurring invoices. This creates a hard dependency on Redis availability for all Business Manager functionality.

## Findings

- `packages/backend/src/services/finance/BusinessInvoiceService.ts` lines 33-47: constructor calls `queueService.createQueue()`
- Queue creation happens synchronously during DI resolution
- If Redis is down at startup, the service fails to instantiate
- All finance routes become unavailable, not just recurring invoice features
- This violates the principle of graceful degradation

## Proposed Solutions

1. Move queue creation to a lazy `ensureQueue()` method called only when needed:

```typescript
class BusinessInvoiceService {
  private queue: Queue | null = null;
  private queueInitPromise: Promise<Queue> | null = null;

  constructor(
    private readonly supabase: SupabaseClient,
    private readonly queueService: QueueService
  ) {
    // No queue creation here
  }

  private async ensureQueue(): Promise<Queue> {
    if (this.queue) return this.queue;
    if (!this.queueInitPromise) {
      this.queueInitPromise = this.queueService
        .createQueue('recurring-invoices')
        .then((q) => {
          this.queue = q;
          return q;
        })
        .catch((err) => {
          this.queueInitPromise = null;
          throw err;
        });
    }
    return this.queueInitPromise;
  }

  async createInvoice(data: CreateInvoiceInput) {
    const invoice = await this.insertInvoice(data);

    if (data.recurringInterval) {
      const queue = await this.ensureQueue();
      await queue.add(
        'recurring-invoice',
        { invoiceId: invoice.id },
        {
          repeat: { pattern: data.recurringInterval },
        }
      );
    }

    return invoice;
  }
}
```

## Technical Details

- **Affected Files**: `packages/backend/src/services/finance/BusinessInvoiceService.ts`
- **Components**: BusinessInvoiceService, DI container, QueueService

## Acceptance Criteria

- [ ] BusinessInvoiceService can be resolved even if Redis is temporarily unavailable
- [ ] Queue is created lazily on first use (when a recurring invoice is created)
- [ ] Non-recurring invoice operations work without Redis
