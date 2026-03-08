---
status: pending
priority: p2
issue_id: 734
tags: [code-review, slice-8, code-quality, duplication, follow-service]
dependencies: []
---

# #734 - Duplicate getFollowers/getFollowing Methods

## Problem Statement

`FollowService.ts` contains two ~36-line methods (`getFollowers` and `getFollowing`) that are near-identical, differing only in which column they filter on. Any bug fix or enhancement applied to one must be manually duplicated in the other — a classic maintenance hazard that has already caused the divergence tracked in #706.

## Findings

Single agent finding during Slice 8 Creator Network review.

- `FollowService.getFollowers(userId)` and `FollowService.getFollowing(userId)` are structurally identical
- Both implement: pagination, error handling, Supabase query, result mapping
- Sole difference: `getFollowers` filters on `following_id = userId`; `getFollowing` filters on `follower_id = userId`
- Approximately 72 lines of near-duplicate code
- Related: #706 (getFollowCounts ignores trigger columns) is a bug that likely exists in both methods

## Proposed Solutions

Extract a shared private method `getFollowList()`:

```typescript
private async getFollowList(
  userId: string,
  direction: 'followers' | 'following',
  options: { limit?: number; offset?: number } = {}
): Promise<FollowUser[]> {
  const column = direction === 'followers' ? 'following_id' : 'follower_id';
  const joinColumn = direction === 'followers' ? 'follower_id' : 'following_id';

  const { data, error } = await this.db
    .from('followers')
    .select(`${joinColumn}, users!inner(id, username, display_name, avatar_url)`)
    .eq(column, userId)
    .range(options.offset ?? 0, (options.offset ?? 0) + (options.limit ?? 20) - 1);

  if (error) throw new DatabaseError('Failed to fetch follow list', { cause: error });
  return (data ?? []).map(row => mapToFollowUser(row));
}

public async getFollowers(userId: string, options?: PaginationOptions): Promise<FollowUser[]> {
  return this.getFollowList(userId, 'followers', options);
}

public async getFollowing(userId: string, options?: PaginationOptions): Promise<FollowUser[]> {
  return this.getFollowList(userId, 'following', options);
}
```

## Technical Details

- **File**: `services/community/FollowService.ts`
- **Methods to refactor**: `getFollowers()`, `getFollowing()`
- **Lines affected**: ~72 LOC reduced to ~30 LOC + shared private method
- **Public API**: Both public method signatures must remain unchanged (non-breaking)
- **Related**: Fix #706 (getFollowCounts trigger column bug) in the shared method to ensure both directions benefit from the fix

## Acceptance Criteria

- [ ] Single private `getFollowList(userId, direction)` method extracted
- [ ] `getFollowers()` and `getFollowing()` delegate to it with no logic duplication
- [ ] Public method signatures unchanged (no breaking change for callers)
- [ ] All existing `FollowService` unit tests still pass
- [ ] Test coverage for `getFollowList` direction logic added
