---
id: 450
severity: P2
status: pending
title: "CrossPostService: non-atomic insert + queue enqueue leaves orphaned rows on partial failure"
file: packages/backend/src/services/distribution/CrossPostService.ts
found_in: PR #92
reviewer: review-data-integrity
---

# CrossPostService publish() has non-atomic insert + enqueue

## Problem

The `publish()` method inserts rows into `cross_posts` and then enqueues BullMQ jobs sequentially. If the insert succeeds but a job enqueue fails midway (e.g., Redis goes down), cross-post rows remain in `queued` status permanently with no corresponding BullMQ job to process them.

```typescript
// Step 1: DB insert succeeds
const { data: inserted, error } = await this.db
  .from('cross_posts')
  .insert(crossPostRows)
  .select('id, platform, status, scheduled_at');

// Step 2: Enqueue jobs one at a time — if job 3 of 5 fails,
// rows 3-5 are stuck in 'queued' status forever
for (const row of inserted || []) {
  await this.queueService.addJob(...);
}
```

## Location

```
packages/backend/src/services/distribution/CrossPostService.ts  lines 95-125
```

## Fix

Add a compensating transaction around the enqueue loop per critical-patterns.md Pattern 4b:

```typescript
const enqueuedIds: string[] = [];
try {
  for (const row of inserted || []) {
    await this.queueService.addJob(...);
    enqueuedIds.push(row.id);
  }
} catch (err) {
  const failedIds = (inserted || [])
    .map(r => r.id)
    .filter(id => !enqueuedIds.includes(id));
  if (failedIds.length > 0) {
    await this.db
      .from('cross_posts')
      .update({ status: 'failed', error_message: 'Queue enqueue failed' })
      .in('id', failedIds);
  }
  throw err;
}
```

Alternatively, add a periodic reconciliation query that finds `queued` rows older than N minutes with no matching BullMQ job.

## Severity Justification

P2: Data integrity. Partial queue failure leaves orphaned rows that users see as "queued" but will never publish. No existing reconciliation mechanism to detect or retry these.
