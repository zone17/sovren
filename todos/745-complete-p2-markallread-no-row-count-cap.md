---
status: pending
priority: p2
issue_id: 745
tags: [code-review, slice-8, performance, database, notifications, pagination]
dependencies: []
---

# #745 - markAllRead No Row Count Cap

## Problem Statement

`NotificationPersistenceService.markAllRead()` issues a single UPDATE against all unread notifications for a user with no LIMIT. For users who have accumulated 10,000+ unread notifications, this single query will cause a statement timeout, lock a large number of rows, and potentially impact other concurrent operations on the notifications table.

## Findings

Single agent finding during Slice 8 Creator Network review.

- `services/community/NotificationPersistenceService.ts` — `markAllRead()` method
- Executes: `UPDATE notifications SET read = true WHERE user_id = $1 AND read = false`
- No LIMIT or batch processing — all unread notifications updated in one transaction
- PostgreSQL acquires row-level locks for every matched row; at 10K+ rows this creates significant lock contention
- Statement timeout will fire before completion for very large counts
- Even moderate counts (1K+) can cause noticeable latency spikes

## Proposed Solutions

Add batched processing with a configurable batch size:

```typescript
async markAllRead(userId: string): Promise<void> {
  const BATCH_SIZE = 500;

  let updatedCount: number;

  do {
    // Use a CTE to update only the next BATCH_SIZE unread rows
    const { count, error } = await this.db
      .from('notifications')
      .update({ read: true }, { count: 'exact' })
      .eq('user_id', userId)
      .eq('read', false)
      .limit(BATCH_SIZE);

    if (error) throw new DatabaseError('Failed to mark notifications as read', { cause: error });

    updatedCount = count ?? 0;
  } while (updatedCount === BATCH_SIZE);
}
```

Note: Supabase's `.limit()` on UPDATE may not be supported in all versions. An alternative is a raw SQL approach using a CTE with `RETURNING` to identify and update in batches, or a `WHERE id IN (SELECT id FROM notifications WHERE ... LIMIT 500)` pattern.

## Technical Details

- **File**: `services/community/NotificationPersistenceService.ts`
- **Method**: `markAllRead()`
- **Batch size**: 500 (consistent with PAGE_SIZE used elsewhere — critical-patterns.md #3)
- **Lock impact**: Each batch holds locks for only BATCH_SIZE rows instead of all rows
- **Caveat**: Batched `markAllRead` is not atomic — notifications created between batches may not be marked read. This is acceptable for a "mark all read" UX operation but should be noted.

## Acceptance Criteria

- [ ] `markAllRead()` processes unread notifications in batches of at most 500
- [ ] Method continues until all unread notifications are marked (loop terminates when batch count < BATCH_SIZE)
- [ ] `DatabaseError` thrown on any Supabase error (not `ValidationError`)
- [ ] Unit test added: verify method correctly handles user with 0 unread notifications
- [ ] Unit test added: verify method correctly handles user with fewer than batch-size unread notifications
- [ ] Unit test added: verify method iterates multiple batches when unread count exceeds batch size (mock returns full batch, then partial batch)
