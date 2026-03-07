---
status: pending
priority: p2
issue_id: 731
tags: [code-review, slice-8, performance, database, pagination, circles]
dependencies: []
---

# #731 - Unbounded SELECT in Circle Post Fan-Out

## Problem Statement

When creating a circle post notification, `createPost()` in `CreatorCircleService.ts` fetches ALL circle members in a single unbounded SELECT with no LIMIT. For large circles this will cause memory exhaustion and query timeouts, and could bring down the service entirely.

## Findings

Single agent finding during Slice 8 Creator Network review.

- `createPost()` in `services/community/CreatorCircleService.ts` executes a SELECT against `circle_members` to retrieve all members for notification fan-out
- No LIMIT clause on this query
- A circle with 10,000+ members would attempt to load all rows into memory at once
- The pattern for paginated fan-out already exists in the codebase (critical-patterns.md #3: PAGE_SIZE=500 paginated accumulation)

## Proposed Solutions

Replace the unbounded SELECT with a paginated loop using the established PAGE_SIZE=500 pattern:

```typescript
// In createPost() — replace single unbounded fetch with paginated loop
const PAGE_SIZE = 500;
let offset = 0;
let membersBatch: { user_id: string }[];

do {
  const { data, error } = await this.db
    .from('circle_members')
    .select('user_id')
    .eq('circle_id', circleId)
    .range(offset, offset + PAGE_SIZE - 1);

  if (error) throw new DatabaseError('Failed to fetch circle members', error);

  membersBatch = data ?? [];

  // fan-out notifications for this batch
  await this.notifyMembers(membersBatch, postId);

  offset += PAGE_SIZE;
} while (membersBatch.length === PAGE_SIZE);
```

## Technical Details

- **File**: `services/community/CreatorCircleService.ts`
- **Method**: `createPost()`
- **Pattern reference**: critical-patterns.md #3 (paginated accumulation, PAGE_SIZE=500)
- **Failure mode**: Memory spike proportional to circle size; Supabase/PostgreSQL statement timeout at high row counts
- **Fan-out volume**: Even with pagination, large circles should use a queue for notification delivery rather than synchronous fan-out — consider filing a P3 for queue-based fan-out if circle size is expected to scale significantly

## Acceptance Criteria

- [ ] `createPost()` no longer issues an unbounded SELECT against `circle_members`
- [ ] Paginated loop with PAGE_SIZE=500 (or configurable constant) used instead
- [ ] Each page's members are processed (notifications sent) before fetching the next page
- [ ] Unit test added: verify fan-out occurs for a circle exceeding PAGE_SIZE members (mock returns 2 pages)
- [ ] No behavior change for circles smaller than PAGE_SIZE
