---
status: complete
priority: p2
issue_id: '535'
tags: [code-review, quality, typescript, pr-100]
dependencies: []
---

# P2: onPaymentComplete dead callback + stale dependency array

## Problem Statement

In `PremiumContentPaywall.tsx`, the `handlePayment` callback has two issues:

1. **Dead callback**: `onPaymentComplete` is a prop callback that is never invoked because the function always throws before reaching the success path. The throw-then-catch ensures `onPaymentComplete` is unreachable.

2. **Stale dependency array**: The `useCallback` deps list includes 5 items (`content.id, content.title, selectedAmount, currentUser?.nostr_pubkey, onPaymentComplete`) but only `currentUser?.nostr_pubkey` is actually used in the callback body (for the auth check). The other 4 are stale deps that trigger unnecessary re-renders.

**Agent consensus**: 4/8 (TypeScript Reviewer, Pattern Recognition, Simplicity Reviewer, Architecture Strategist)

## Findings

### TypeScript Reviewer (Kieran)

- P1-3: `onPaymentComplete` in dependency array references a callback that always throws — confuses React's memoization
- P2: Stale deps array with 4 unused dependencies

### Pattern Recognition

- `onPaymentComplete` unreachable in PremiumContentPaywall — dead code path

### Simplicity Reviewer

- 5 unused deps in dependency array is a code smell — suggests the callback was designed for a different implementation

### Architecture Strategist

- PremiumContentPaywall throws unconditionally — UI should reflect "not implemented" state visually

## Proposed Solutions

### Option A: Clean up deps array + remove dead callback (Recommended)

1. Remove `onPaymentComplete` from deps array (it's never called)
2. Remove `content.id`, `content.title`, `selectedAmount` from deps (unused)
3. Keep only `currentUser?.nostr_pubkey` which is actually used

**Pros**: Correct React hooks usage, no unnecessary re-renders
**Cons**: None
**Effort**: Small (5 min)
**Risk**: None

### Option B: Simplify to direct setError (combines with #532)

Replace the entire handlePayment with a direct `setPaymentError('Payment not yet implemented')`, removing the useCallback entirely.

**Pros**: Maximum simplification, removes the callback and all its deps
**Cons**: Loses the auth check guard (which is actually useful when payments go live)
**Effort**: Small (10 min)
**Risk**: Low

## Recommended Action

Option A — minimal and correct.

## Technical Details

**Affected files:**

- `packages/frontend/src/features/content/components/PremiumContentPaywall.tsx` (~line 68)

## Acceptance Criteria

- [ ] `useCallback` dependency array contains only variables used in the callback body
- [ ] No unreachable code paths in handlePayment
- [ ] All existing tests pass

## Work Log

| Date       | Action                                | Learnings                                |
| ---------- | ------------------------------------- | ---------------------------------------- |
| 2026-02-26 | Created from PR #100 review (8-agent) | 4/8 consensus — second strongest finding |

## Resources

- PR #100: https://github.com/zone17/sovren/pull/100
- Related: #532 (throw-then-catch simplification)
