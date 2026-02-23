---
status: pending
priority: p2
issue_id: '470'
tags: [code-review, data-integrity]
dependencies: []
---

# Add status guard to compensating update in CrossPostService.publish()

## Problem Statement

The compensating update that marks un-enqueued rows as `failed` doesn't filter by current status. If a row's status was changed between insert and the compensating update (e.g., by a concurrent processor picking up the BullMQ job), the update could overwrite a valid status with `failed`.

## Findings

- `CrossPostService.ts` line 153: `.update({ status: 'failed', ... }).in('id', failedIds)` has no `.in('status', ...)` guard
- The `cancel()` method at line 200 already uses `.in('status', ['queued', 'scheduled'])` as a status guard
- Pattern is documented in critical-patterns.md #7 (status guards prevent stale-state overwrites)
- 2 of 8 review agents flagged this (architecture-strategist, data-integrity-guardian)

## Fix

Add `.in('status', ['queued', 'scheduled'])` to the compensating update chain:

```typescript
const { error: compensateError } = await this.db
  .from('cross_posts')
  .update({
    status: 'failed',
    error_message: 'Queue enqueue failed',
    updated_at: new Date().toISOString(),
  })
  .in('id', failedIds)
  .in('status', ['queued', 'scheduled']);
```

**Effort:** 5 minutes
**Risk:** Low — additive filter, no behavior change in normal flow

## Acceptance Criteria

- [ ] Compensating update includes `.in('status', ['queued', 'scheduled'])` guard
- [ ] Test updated to verify status guard is applied
- [ ] Tests pass

## Resources

- **PR:** #96
- **Pattern:** critical-patterns.md #7 (status guards)
