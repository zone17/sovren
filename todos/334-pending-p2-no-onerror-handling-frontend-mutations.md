---
status: pending
priority: p2
issue_id: 334
tags: [code-review, frontend, error-handling]
---

# No `onError` handling on ANY mutation across all frontend hooks

## Problem Statement

All `useMutation` hooks across the frontend feature hooks lack `onError` callbacks. When mutations fail (especially financial ones like invoice creation, contract signing, escrow funding), the user receives no feedback. The mutation silently fails, leaving the user unaware that their action did not complete.

## Findings

- `packages/frontend/src/features/multi-platform/hooks/useInbox.ts` — all `useMutation` hooks lack `onError`
- `packages/frontend/src/features/creator-network/hooks/useCreatorNetwork.ts` — all `useMutation` hooks lack `onError`
- `packages/frontend/src/features/business/hooks/useBusiness.ts` — all `useMutation` hooks lack `onError`
- Financial mutations (invoices, contracts, escrow, payments) fail silently

## Proposed Solutions

1. Add `onError` callbacks to all `useMutation` hooks
2. Display user-facing toast/notification on error with a descriptive message
3. Prioritize financial mutations which have the highest impact on user trust
4. Consider a shared `onMutationError` helper to standardize error handling

## Technical Details

- **Affected Files**: packages/frontend/src/features/multi-platform/hooks/useInbox.ts, packages/frontend/src/features/creator-network/hooks/useCreatorNetwork.ts, packages/frontend/src/features/business/hooks/useBusiness.ts

## Acceptance Criteria

- [ ] All `useMutation` hooks have `onError` callbacks
- [ ] Error toast/notification displayed to user on mutation failure
- [ ] Financial mutations (invoices, contracts, escrow) have specific error messages
- [ ] Error messages are user-friendly (no raw error objects)
- [ ] Toast/notification system integrated (or existing one used)
