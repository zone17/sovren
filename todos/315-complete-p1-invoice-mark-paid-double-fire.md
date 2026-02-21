---
status: complete
priority: p1
issue_id: 315
tags: [code-review, frontend, race-condition]
---

# Invoice "Mark Paid" double-fire — shared mutation across rows

## Problem Statement

A single `useMutation` instance is shared across all invoice rows in the InvoiceDashboard. Clicking "Mark Paid" on two invoices rapidly fires both mutations concurrently with no guard, potentially causing double-payment or inconsistent state.

## Findings

- `packages/frontend/src/features/business/components/InvoiceDashboard.tsx` lines 128-135: single `useMutation` shared across all rows
- No `disabled` guard using `isPending` per-row
- Rapid clicks on different invoice rows will fire concurrent mutations
- No optimistic locking or idempotency on the backend to compensate

## Proposed Solutions

1. Track `pendingId` state and disable buttons accordingly:

```typescript
const [pendingId, setPendingId] = useState<string | null>(null);

const markPaidMutation = useMutation({
  mutationFn: async (invoiceId: string) => {
    setPendingId(invoiceId);
    return markInvoicePaid(invoiceId);
  },
  onSettled: () => setPendingId(null),
});

// In render:
<button
  disabled={pendingId !== null}
  onClick={() => markPaidMutation.mutate(invoice.id)}
>
  Mark Paid
</button>
```

2. Alternative: Use per-row mutation instances by extracting each row into its own component with its own `useMutation`.

## Technical Details

- **Affected Files**: `packages/frontend/src/features/business/components/InvoiceDashboard.tsx`
- **Components**: InvoiceDashboard, invoice row actions

## Acceptance Criteria

- [ ] Cannot double-fire invoice status mutations
- [ ] All "Mark Paid" buttons are disabled while any mutation is in-flight
