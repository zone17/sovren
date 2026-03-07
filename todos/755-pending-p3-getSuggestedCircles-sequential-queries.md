---
status: pending
priority: p3
issue_id: 755
tags: [code-review, slice-8, performance, database, optimization]
dependencies: []
---

# P3: getSuggestedCircles 3 sequential queries

## Problem Statement

The `getSuggestedCircles` function executes three independent database queries sequentially instead of in parallel. This unnecessarily increases response latency when the queries could be awaited together with `Promise.all()`. Each query takes ~50-100ms, resulting in 150-300ms total time instead of ~100ms with parallelization.

## Findings

- File: `services/community/CreatorCircleService.ts`
- Function: `getSuggestedCircles()`
- Current pattern:
  ```typescript
  const circles1 = await query1();
  const circles2 = await query2();
  const circles3 = await query3();
  ```
- Issue: No dependency between queries; all can run in parallel
- Impact: ~2-3x latency increase unnecessarily

## Proposed Solutions

Parallelize independent queries:

```typescript
export async function getSuggestedCircles(userId: string): Promise<Circle[]> {
  const [followerCircles, topCircles, recommendedCircles] = await Promise.all([
    getCirclesFollowedByUserFollowers(userId),
    getTopCirclesByMemberCount(),
    getRecommendedCirclesByInterests(userId),
  ]);

  // Merge and deduplicate results
  const circleMap = new Map<string, Circle>();
  [...followerCircles, ...topCircles, ...recommendedCircles].forEach((circle) =>
    circleMap.set(circle.id, circle)
  );

  return Array.from(circleMap.values());
}
```

## Technical Details

- `Promise.all()` awaits all promises concurrently
- No changes to query logic or result processing needed
- Deduplication recommended if circles appear in multiple result sets
- Error handling: `Promise.all()` fails if any query fails (use `Promise.allSettled()` if partial results acceptable)

## Acceptance Criteria

- [ ] `Promise.all()` used to parallelize 3 queries
- [ ] Response time confirmed to drop by ~50-60% (150-300ms → 100ms)
- [ ] Results identical to sequential version (same circles, same order)
- [ ] Tests pass with concurrent queries
- [ ] Error handling verified (what happens if one query fails?)
- [ ] Query performance confirmed via local load test or profiling
