---
status: pending
priority: p2
issue_id: '687'
tags: [code-review, frontend, slice-8]
dependencies: ['683']
---

# useUnreadNotificationCount fetches 1 item — always returns 0 or 1

## Problem Statement

The hook fetches `list({ page: 1, limit: 1 })` and filters for `!n.read`. With at most 1 notification returned, the count is always 0 or 1 regardless of actual unread count. Backend exposes dedicated `GET /unread-count` endpoint that is never called.

**Agent consensus: 6/8** (Performance, Security, Agent-native, TypeScript, Simplicity, Architecture)

## Fix

Replace client-side filtering with dedicated endpoint call:

```typescript
export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: [...notificationKeys.all, 'unread-count'],
    queryFn: () => notificationsApi.getUnreadCount(),
    staleTime: 30 * 1000,
  });
}
```

Depends on #683 adding `getUnreadCount()` to `notificationsApi`.

## Acceptance Criteria

- [ ] Badge shows correct unread count (not capped at 1)
- [ ] Calls dedicated `/unread-count` endpoint
