---
status: pending
priority: p2
issue_id: '197'
tags: [code-review, pr-85, data-integrity]
---

# Multi-Platform Publish Has No Transaction

## Problem Statement

CrossPostService.publish() inserts cross_posts rows and queues BullMQ jobs sequentially per platform without a transaction. If the second platform fails, the first already has a dangling job. Duplicate posts on retry.

## Findings

- **File**: `packages/backend/src/services/distribution/CrossPostService.ts:51-122`
- The `publish()` method iterates over target platforms sequentially
- For each platform: inserts a `cross_posts` row, then enqueues a BullMQ job
- No database transaction wraps the multi-platform operation
- If platform 2 of 3 fails (DB error, queue error), platform 1 already has a committed row and queued job
- Retrying the entire publish creates duplicate posts for platform 1
- No idempotency key to prevent duplicate job processing

## Proposed Solutions

1. Batch insert all `cross_posts` rows in a single query within a transaction, then enqueue all BullMQ jobs after the transaction commits. If job enqueue fails, the cross_posts rows serve as the source of truth for retry.
2. Add a unique idempotency key constraint (e.g., `content_id + platform + publish_batch_id`) to `cross_posts` table so duplicate inserts on retry are rejected gracefully

## Acceptance Criteria

- [ ] All cross_posts rows for a publish batch are inserted atomically (all or none)
- [ ] Retrying a failed publish does not create duplicate posts on platforms that already succeeded
- [ ] Failed platforms can be retried independently without affecting successful ones
- [ ] BullMQ job enqueue failures do not leave orphaned cross_posts rows without corresponding jobs
