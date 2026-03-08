---
status: pending
priority: p2
issue_id: 738
tags: [code-review, slice-8, performance, react, memoization, notifications, frontend]
dependencies: []
---

# #738 - useMemo Dependency on Re-Created Array Reference

## Problem Statement

`ServerNotificationCenter.tsx` uses `useMemo` to compute a `groupByDate` value, with the `notifications` array as a dependency. Because React Query returns a new array reference on every render (even when the underlying data is identical), the `useMemo` recomputes on every single render. The memoization provides zero benefit and only adds overhead.

## Findings

Single agent finding during Slice 8 Creator Network review.

- `features/notifications/components/ServerNotificationCenter.tsx` contains a `useMemo` for `groupByDate`
- Dependency array includes the `notifications` array directly: `useMemo(() => groupByDate(notifications), [notifications])`
- React Query's `data` object gets a new array reference on every render cycle, even when no new data has been fetched
- Result: `groupByDate()` runs on every render, defeating the purpose of `useMemo`
- `groupByDate` is presumably a non-trivial computation (sorting/grouping), making this a real performance cost at scale

## Proposed Solutions

**Option A (recommended): Use notifications length + last updated timestamp as dependency**

```typescript
// Stable dependency that only changes when data actually changes
const notificationsKey = `${notifications.length}-${notifications[0]?.id ?? ''}`;
const groupedNotifications = useMemo(
  () => groupByDate(notifications),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [notificationsKey]
);
```

**Option B: Use React Query's data identity**

React Query's `select` option can ensure stable references when data hasn't changed:

```typescript
const { data: notifications = [] } = useNotifications({
  select: (data) => data, // React Query memoizes select results when data is same
});
```

**Option C: Use useCallback + stable selector in React Query**

If React Query v5 is in use, `structuralSharing: true` (the default) already ensures reference stability when data is unchanged — verify this is not disabled.

## Technical Details

- **File**: `features/notifications/components/ServerNotificationCenter.tsx`
- **Hook**: `useMemo` for `groupByDate`
- **Root cause**: React Query returns new array reference per render even with `structuralSharing`
- **Performance impact**: Proportional to notification count and complexity of `groupByDate`

## Acceptance Criteria

- [ ] `useMemo` for `groupByDate` no longer recomputes on every render when notification data is unchanged
- [ ] Chosen approach (stable key, select memoization, or structuralSharing verification) documented in a comment
- [ ] Manual verification: React DevTools Profiler confirms `groupByDate` is not recomputing on unrelated re-renders
- [ ] Existing rendering behavior and UI output unchanged
