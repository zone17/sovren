---
status: pending
priority: p3
issue_id: '696'
tags: [code-review, frontend, cleanup, slice-8]
dependencies: []
---

# Query key centralization + YAGNI cleanup

## Items

1. Move `circleKeys` from `useCircles.ts` to `query-keys.ts`
2. Replace inline string arrays in `useMentorship.ts` with key factory
3. Remove unused `useRespondToCollaboration` hook (YAGNI)
4. Remove unused `useCircle(circleId)` hook (YAGNI)
5. Verify `COMMUNITY_COMMENT_CREATED` handler is not dead code
6. Remove empty `CHANNEL_ERROR`/`TIMED_OUT` branch in realtime handler
7. Remove unnecessary `queryClientRef` in `useNotificationRealtime` (queryClient is stable)
8. Remove redundant `onSuccess` counts invalidation (conflicts with optimistic update)
