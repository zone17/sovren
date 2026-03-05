---
status: pending
priority: p1
issue_id: '622'
tags: [code-review, frontend, react-query, correctness]
dependencies: []
---

# Optimistic delete snapshot captures wrong query key

## Problem Statement

`useDeleteComment` in `packages/frontend/src/features/comments/hooks/useComments.ts` line 87 snapshots only `commentKeys.list(contentId, {})` (empty filters/default key), but `setQueriesData` on line 90 modifies ALL cached pages via `commentKeys.byContent(contentId)`. On rollback (line 106-108), only the single default-key snapshot is restored, leaving other page caches in modified state.

## Findings

- Performance Oracle, Security Sentinel, and Pattern-Recognition agents all flagged this independently (3/8 consensus)
- If user is on page 2 and deletes a comment, rollback restores page 1 data but leaves page 2 modified
- The `onSettled` invalidation (line 112-113) eventually corrects, but there is a visible inconsistency window

## Proposed Solutions

### Option A: Snapshot all matching queries (Recommended)

Use `queryClient.getQueriesData({ queryKey: commentKeys.byContent(contentId) })` to capture all page caches, restore all on rollback.

- Pros: Full correctness, preserves optimistic UX
- Cons: Slightly more memory for snapshots
- Effort: Small

### Option B: Drop optimistic update, use invalidation only

Remove optimistic update entirely; rely on `onSettled` invalidation.

- Pros: Simpler code, no rollback bugs
- Cons: Slower perceived UX (comment stays visible until refetch completes)
- Effort: Small

## Acceptance Criteria

- [ ] Rollback restores ALL cached pages, not just the default key
- [ ] Test covers multi-page rollback scenario
