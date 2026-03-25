---
status: pending
priority: p2
issue_id: 746
tags: [code-review, slice-8, error-handling, logging, follow-service, silent-fallback]
dependencies: []
---

# #746 - Error-Swallowing Fallback in Follower Count Queries

## Problem Statement

`FollowService.getFollowCounts()` falls back to a `COUNT(*)` query when the primary query (using trigger-maintained counter columns) fails, but does not log the failure before falling back. The silent fallback masks data integrity issues — if the trigger columns are broken or stale, the system quietly degrades to full-table scans with no observable signal. This directly violates common-solutions.md #29 (silent fallback must log).

## Findings

Single agent finding during Slice 8 Creator Network review. Reinforces common-solutions.md #29.

- `services/community/FollowService.ts` — `getFollowCounts()` method
- Primary path: reads from denormalized trigger-maintained counter columns (fast, O(1))
- Fallback path: issues `COUNT(*)` aggregate query (slow, full scan for large tables)
- On primary path error: fallback executes but the triggering error is swallowed without logging
- Effect: trigger column failures are invisible in logs and metrics; the system appears healthy while silently degrading to N× slower queries
- Also related: #706 (getFollowCounts ignores trigger columns) which may cause the primary path to always fail

## Proposed Solutions

Add a warning log with full error context before executing the fallback:

```typescript
async getFollowCounts(userId: string): Promise<FollowCounts> {
  // Primary path: fast trigger-maintained counters
  const { data: counters, error: counterError } = await this.db
    .from('user_follow_counts')
    .select('follower_count, following_count')
    .eq('user_id', userId)
    .single();

  if (!counterError && counters) {
    return { followers: counters.follower_count, following: counters.following_count };
  }

  // Fallback path: full COUNT(*) — log before falling back
  this.logger.warn('getFollowCounts: falling back to COUNT(*) query', {
    userId,
    error: counterError?.message,
    code: counterError?.code,
  });

  const { count: followerCount, error: followerError } = await this.db
    .from('followers')
    .select('*', { count: 'exact', head: true })
    .eq('following_id', userId);

  if (followerError) throw new DatabaseError('Failed to count followers', { cause: followerError });

  // ... rest of fallback
}
```

## Technical Details

- **File**: `services/community/FollowService.ts`
- **Method**: `getFollowCounts()`
- **Pattern reference**: common-solutions.md #29 (silent fallback must log)
- **Log level**: `warn` (not `error`) — the fallback is a valid degraded path, not a crash
- **Log content**: error message, error code, userId (for correlation)
- **Related**: #706 (trigger column bug may be causing this fallback to always fire — fix #706 first, then verify #746 fallback is truly rare)

## Acceptance Criteria

- [ ] `logger.warn()` called with error details before executing the fallback COUNT query
- [ ] Log includes: `userId`, `error.message`, `error.code` (or equivalent identifying info)
- [ ] No change to fallback logic or return values — only adds logging
- [ ] Unit test added: verify warning is logged when primary path fails and fallback is used
- [ ] Unit test added: verify warning is NOT logged when primary path succeeds
- [ ] Log output observable in local dev console (not suppressed by log level config)
