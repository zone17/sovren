---
status: pending
priority: p2
issue_id: 743
tags: [code-review, slice-8, validation, security, realtime, supabase, notifications, frontend]
dependencies: []
---

# #743 - Unvalidated userId in Realtime Subscription Filter

## Problem Statement

`useNotifications.ts` subscribes to a Supabase Realtime channel using `userId` from the auth context without validating that it is a valid UUID before constructing the channel filter. An invalid or missing `userId` creates a malformed channel subscription, which may silently fail (receiving no notifications) or produce a subscription error that is not surfaced to the user.

## Findings

Single agent finding during Slice 8 Creator Network review.

- `features/notifications/hooks/useNotifications.ts` uses `userId` from auth context in the Realtime channel subscription
- No validation that `userId` exists or is a valid UUID before subscribing
- If `userId` is `undefined`, `null`, or a non-UUID string, the channel filter `eq('user_id', userId)` will be malformed
- Malformed subscriptions may not error loudly — they silently receive no data
- In edge cases (e.g., auth context race condition on mount), the hook may subscribe with an invalid userId and never re-subscribe with the correct one

## Proposed Solutions

Validate that `userId` is a non-empty UUID string before subscribing:

```typescript
import { z } from 'zod';

const UUIDSchema = z.string().uuid();

// In useNotifications.ts:
useEffect(() => {
  // Guard: only subscribe if userId is a valid UUID
  const parsed = UUIDSchema.safeParse(userId);
  if (!parsed.success) {
    // userId not yet available or invalid — skip subscription
    return;
  }

  const channel = supabase
    .channel(`notifications:${parsed.data}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${parsed.data}`,
      },
      handleNewNotification
    )
    .subscribe(handleStatusChange);

  return () => {
    supabase.removeChannel(channel);
  };
}, [userId]); // re-subscribe if userId changes
```

## Technical Details

- **File**: `features/notifications/hooks/useNotifications.ts`
- **Risk**: Silent no-notification state if userId is invalid/missing at subscription time
- **Auth context timing**: On initial render, userId may be undefined if auth is still loading — the guard handles this gracefully
- **Re-subscription**: The `useEffect` dependency on `userId` ensures re-subscription once a valid userId is available

## Acceptance Criteria

- [ ] `userId` validated as non-empty UUID before Realtime subscription is created
- [ ] Hook skips subscription (and cleans up any existing subscription) when `userId` is invalid/undefined
- [ ] Hook re-subscribes automatically once a valid `userId` becomes available (useEffect dependency)
- [ ] Unit test added: verify no subscription created when userId is undefined
- [ ] Unit test added: verify no subscription created when userId is not a valid UUID
- [ ] Unit test added: verify subscription created with valid UUID userId
