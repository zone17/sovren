---
id: 454
severity: P3
status: pending
title: "CrossPostService: cancel() doesn't remove BullMQ job from queue"
file: packages/backend/src/services/distribution/CrossPostService.ts
found_in: PR #92
reviewer: review-data-integrity
---

# CrossPostService cancel doesn't remove BullMQ job

## Problem

The `cancel()` method updates the database status to `cancelled` but does not remove the corresponding BullMQ job. The processor does check status (`.neq('status', 'cancelled')`), so the job becomes a no-op. But for scheduled jobs with long delays, the job sits in the queue for hours before being skipped, wasting a worker slot.

## Location

```
packages/backend/src/services/distribution/CrossPostService.ts  lines 165-181
```

## Fix

After updating status, attempt to remove the BullMQ job:

```typescript
await this.queueService.removeJob(QUEUE_NAME, `publish-${crossPost.platform}`);
```

## Severity Justification

P3: Resource efficiency. No data integrity issue since the processor handles cancelled status correctly.
