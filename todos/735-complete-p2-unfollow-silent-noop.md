---
status: pending
priority: p2
issue_id: 735
tags: [code-review, slice-8, correctness, error-handling, follow-service, status-guards]
dependencies: []
---

# #735 - unfollow() Silent No-Op

## Problem Statement

`FollowService.unfollow()` executes a DELETE but does not check whether any row was actually deleted. If the follow relationship does not exist (e.g., caller passes an invalid ID, or the relationship was already removed), the method silently returns success. Callers receive no feedback that their unfollow had no effect, which can mask bugs in calling code and makes the API semantically incorrect.

## Findings

Single agent finding during Slice 8 Creator Network review. Violates critical-patterns.md #7 (status guards).

- `unfollow()` in `services/community/FollowService.ts` issues a DELETE against the `followers` table
- The DELETE result's row count is not checked
- If `count === 0` (no row matched), method returns normally — callers believe the unfollow succeeded
- critical-patterns.md #7 explicitly requires checking DELETE row count and throwing `NotFoundError` when 0

## Proposed Solutions

Check the row count returned by the DELETE operation:

```typescript
async unfollow(followerId: string, followingId: string): Promise<void> {
  const { error, count } = await this.db
    .from('followers')
    .delete({ count: 'exact' })
    .eq('follower_id', followerId)
    .eq('following_id', followingId);

  if (error) throw new DatabaseError('Failed to remove follow', { cause: error });

  if (count === 0) {
    throw new NotFoundError('Follow relationship not found');
  }
}
```

Note: Supabase requires `{ count: 'exact' }` option on DELETE to return the affected row count.

## Technical Details

- **File**: `services/community/FollowService.ts`
- **Method**: `unfollow()`
- **Pattern reference**: critical-patterns.md #7 (status guards — always check DELETE/UPDATE row count)
- **Supabase API**: Pass `{ count: 'exact' }` to `.delete()` to get the row count back
- **HTTP semantics**: Route handler should return 404 when `NotFoundError` is thrown

## Acceptance Criteria

- [ ] `unfollow()` passes `{ count: 'exact' }` to Supabase DELETE
- [ ] `NotFoundError` thrown when `count === 0`
- [ ] `DatabaseError` thrown on Supabase error
- [ ] Unit test added: verify `NotFoundError` thrown when relationship does not exist
- [ ] Unit test added: verify success path when relationship exists and is deleted
- [ ] Route handler for unfollow returns 404 to client on `NotFoundError`
