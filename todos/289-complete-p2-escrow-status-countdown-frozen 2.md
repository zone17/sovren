---
status: complete
priority: p2
issue_id: '289'
tags: [code-review, frontend, race-condition]
dependencies: []
---

# EscrowStatus Countdown Frozen

## Problem Statement

EscrowStatusBadge component calculates time remaining once on render but doesn't set up an interval to update the countdown. The displayed countdown freezes at the initial value and never ticks down.

## Findings

- `packages/frontend/src/features/creator-network/components/EscrowStatusBadge.tsx` — no setInterval for countdown
- Related: OrderStatusTracker may have similar issue

## Proposed Solutions

### Option 1: Add countdown interval

**Approach:** Use useEffect with setInterval(1000ms) to recalculate remaining time. Clean up on unmount. Show "Expired" when time reaches 0.
**Effort:** 30min **Risk:** Low

## Acceptance Criteria

- [ ] Countdown updates every second
- [ ] Interval cleaned up on unmount
- [ ] Shows "Expired" when time reaches 0

## Work Log

### 2026-02-18 - Code Review Discovery

**By:** Claude Code (13-agent parallel review)
