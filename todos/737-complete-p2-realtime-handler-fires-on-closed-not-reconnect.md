---
status: pending
priority: p2
issue_id: 737
tags: [code-review, slice-8, realtime, supabase, notifications, frontend]
dependencies: []
---

# #737 - Realtime Handler Fires on CLOSED Not Reconnect

## Problem Statement

`useNotifications.ts` subscribes to Supabase Realtime and triggers a notification re-fetch when the channel status becomes `'CLOSED'`. This is semantically inverted — `CLOSED` means the connection has been lost, not re-established. Notifications received during the disconnection window are never fetched, and the re-fetch fires at the wrong moment (on disconnect rather than on reconnect).

## Findings

Single agent finding during Slice 8 Creator Network review.

- `features/notifications/hooks/useNotifications.ts` subscribes to Supabase Realtime channel
- Status callback checks `if (status === 'CLOSED')` and triggers a `refetch()`
- Supabase Realtime statuses: `SUBSCRIBED` (connected), `TIMED_OUT`, `CLOSED` (disconnected), `CHANNEL_ERROR`
- Re-fetching on `CLOSED` fetches while the connection is down — may fail or return stale data
- The correct trigger is `SUBSCRIBED` (just reconnected) to catch missed events, or `TIMED_OUT` + `SUBSCRIBED` to handle timeout reconnects
- Missed notifications during a disconnect window are permanently lost until a manual page refresh

## Proposed Solutions

Change the status check to fire on reconnect (`SUBSCRIBED`) rather than disconnect (`CLOSED`):

```typescript
// In useNotifications.ts
const channel = supabase
  .channel(`notifications:${userId}`)
  .on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'notifications' },
    handleNewNotification
  )
  .subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      // Just (re)connected — re-fetch to catch any notifications missed during disconnect
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    }
    // Optionally track connection state for UI indicators:
    // if (status === 'CLOSED' || status === 'TIMED_OUT') setIsDisconnected(true);
    // if (status === 'SUBSCRIBED') setIsDisconnected(false);
  });
```

Note: `SUBSCRIBED` fires on initial connect AND reconnect, so this re-fetch will also run on first mount — which is acceptable since React Query deduplicates rapid fetches.

## Technical Details

- **File**: `features/notifications/hooks/useNotifications.ts`
- **Supabase Realtime status values**: `SUBSCRIBED`, `TIMED_OUT`, `CLOSED`, `CHANNEL_ERROR`
- **Behavior change**: Re-fetch moves from disconnect event to reconnect event
- **Side effect**: Initial mount will trigger one extra re-fetch — acceptable, React Query dedupes
- **Optional enhancement**: Track `CLOSED`/`TIMED_OUT` in local state to show "disconnected" UI indicator

## Acceptance Criteria

- [ ] Status check changed from `'CLOSED'` to `'SUBSCRIBED'`
- [ ] Re-fetch (or `invalidateQueries`) triggers on `SUBSCRIBED` status
- [ ] No re-fetch triggered on `CLOSED` or `TIMED_OUT`
- [ ] Unit test added: verify refetch called when status transitions to `SUBSCRIBED`
- [ ] Unit test added: verify refetch NOT called when status is `CLOSED`
- [ ] Manual verification: disconnect and reconnect results in notification list refreshing
