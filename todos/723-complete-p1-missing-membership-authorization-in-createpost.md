---
status: pending
priority: p1
issue_id: '723'
tags: [code-review, slice-8, backend, security, authorization, community]
dependencies: [721]
---

# Missing membership authorization in createPost

## Problem Statement

`createPost()` in `CreatorCircleService` only verifies that the caller is authenticated — it does not check whether the authenticated user is a member of the target circle. Any authenticated user on the platform can post to any circle, violating the creator-circle access model where only members should be able to create posts.

**Agent consensus: security finding**

## Findings

In `packages/backend/src/services/community/CreatorCircleService.ts`, the `createPost()` method:

1. Accepts `circleId` and `userId` (or pubkey — see #721) from the caller
2. Proceeds directly to insert a post record without verifying membership
3. There is no query to `circle_members` to confirm the user belongs to the circle

This means:

- A user who was never accepted into a circle can post to it
- A user who was removed from a circle can continue posting
- Paid/invite-only circles have no enforcement on post creation

## Proposed Solutions

Add a membership check before the insert:

```typescript
async createPost(circleId: string, userId: string, content: string): Promise<CirclePost> {
  // 1. Verify membership
  const { data: membership, error: memberError } = await this.db
    .from('circle_members')
    .select('id')
    .eq('circle_id', circleId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();

  if (memberError) throw new DatabaseError('Failed to verify circle membership', memberError);
  if (!membership) throw new AuthorizationError('User is not a member of this circle');

  // 2. Proceed with post creation
  const { data, error } = await this.db
    .from('circle_posts')
    .insert({ circle_id: circleId, author_id: userId, content })
    .select()
    .single();

  if (error) throw new DatabaseError('Failed to create post', error);
  return data;
}
```

Note: This fix depends on #721 being resolved first so that `userId` is a proper UUID when passed to the membership query.

## Technical Details

- Affected file: `packages/backend/src/services/community/CreatorCircleService.ts`
- Affected method: `createPost()`
- The `circle_members` table has columns `circle_id`, `user_id`, `status` (at minimum)
- `status = 'active'` check is required — pending/rejected members must not be able to post
- Use `AuthorizationError` (403), not `ValidationError` (400) — per common-solutions.md #24 error class selection matrix
- RLS alone cannot substitute for this check — service-layer enforcement is needed for defense-in-depth

## Acceptance Criteria

- [ ] `createPost()` queries `circle_members` before inserting a post
- [ ] Non-members receive an `AuthorizationError` (HTTP 403), not a 400 or silent success
- [ ] Removed members (status != 'active') cannot post
- [ ] Unit test: member can post successfully
- [ ] Unit test: non-member receives 403
- [ ] Unit test: pending member (not yet accepted) receives 403
- [ ] Fix does not regress after #721 UUID resolution is applied
