---
status: pending
priority: p2
issue_id: 333
tags: [code-review, frontend, race-condition]
---

# EscrowStatus countdown timer race condition

## Problem Statement

The EscrowStatus component sets up a `setInterval` for a countdown timer but does not clean it up on component unmount. This causes the timer callback to fire after the component has been unmounted, potentially calling `setState` on an unmounted component and causing memory leaks or React warnings.

## Findings

- `packages/frontend/src/features/creator-network/components/EscrowStatus.tsx:46-52` — `setInterval` created in `useEffect` without a cleanup return function
- Timer continues to fire after component unmounts

## Proposed Solutions

1. Return a cleanup function from the `useEffect` that calls `clearInterval(intervalId)`
2. Store the interval ID in a ref or local variable for proper cleanup

## Technical Details

- **Affected Files**: packages/frontend/src/features/creator-network/components/EscrowStatus.tsx

## Acceptance Criteria

- [ ] `useEffect` returns cleanup function that calls `clearInterval()`
- [ ] Timer stops firing when component unmounts
- [ ] No React warnings about setState on unmounted component
- [ ] Countdown timer still functions correctly while component is mounted
