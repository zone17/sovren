---
status: pending
priority: p2
issue_id: '692'
tags: [code-review, backend, performance, slice-8]
dependencies: ['681']
---

# getCircles() ignores creatorId + getFollowCounts() uses COUNT instead of denormalized columns

## Problem Statement

Two service method bugs:

1. `CreatorCircleService.getCircles(creatorId)` accepts `creatorId` but never filters by it — returns 100 circles from entire platform
2. `FollowService.getFollowCounts()` issues 2 COUNT queries instead of reading pre-computed `creators.follower_count`/`following_count`

**Agent consensus: 2/8 each** (Performance + Data Integrity)

## Fix

### getCircles

Add `.eq('created_by', creatorId)` to the query (line ~112).

### getFollowCounts

Replace two COUNT queries with single point-read on `creators` table:

```typescript
const { data } = await this.db
  .from('creators')
  .select('follower_count, following_count')
  .eq('user_id', userId)
  .single();
```

## Acceptance Criteria

- [ ] `getCircles()` returns only circles for the specified creator
- [ ] `getFollowCounts()` reads denormalized columns (O(1) vs O(n))
