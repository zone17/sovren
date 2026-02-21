---
status: complete
priority: p1
issue_id: 316
tags: [code-review, frontend, race-condition, financial]
---

# OrderTracker financial action double-fire

## Problem Statement

The `startOrder`, `completeOrder`, and `disputeOrder` mutations in OrderTracker can all fire in the same frame with no synchronous guard. These are financial operations involving escrow release and dispute initiation — double-firing can cause fund misallocation or duplicate disputes.

## Findings

- `packages/frontend/src/features/creator-network/components/OrderTracker.tsx` lines 30-34: three separate mutations with no mutual exclusion
- No synchronous guard prevents clicking multiple actions simultaneously
- All three actions are financial operations (escrow release, dispute)
- React state updates are asynchronous, so `isPending` checks alone may not prevent same-frame fires

## Proposed Solutions

1. Use `useRef` for synchronous in-flight flag:

```typescript
const inFlightRef = useRef(false);

const guardedMutate = (mutationFn: () => void) => {
  if (inFlightRef.current) return;
  inFlightRef.current = true;
  mutationFn();
};

const startOrderMutation = useMutation({
  mutationFn: startOrder,
  onSettled: () => { inFlightRef.current = false; },
});

// In render:
<button
  disabled={inFlightRef.current}
  onClick={() => guardedMutate(() => startOrderMutation.mutate(orderId))}
>
```

2. Alternative: Disable all action buttons when any mutation `isPending`:

```typescript
const anyPending =
  startMutation.isPending || completeMutation.isPending || disputeMutation.isPending;
// Apply disabled={anyPending} to all action buttons
```

## Technical Details

- **Affected Files**: `packages/frontend/src/features/creator-network/components/OrderTracker.tsx`
- **Components**: OrderTracker, marketplace order actions

## Acceptance Criteria

- [ ] Financial order actions cannot double-fire
- [ ] All action buttons are disabled while any financial mutation is in-flight
