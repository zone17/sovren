---
status: pending
priority: p3
issue_id: '131'
tags:
  - code-review
  - performance
  - payment
  - memory
dependencies: []
---

# 131: Unbounded Polling Timers Per Invoice in LightningPaymentService

## Problem Statement

`/packages/backend/src/services/lightning-payment-service.ts` (lines 649-685) creates a `setInterval` per pending invoice for status polling. These timers are never cleaned up if the invoice is never paid or expires. Over time, accumulates unbounded timers consuming CPU cycles for expired invoices.

## Findings

- Lines 649-685 implement per-invoice polling with `setInterval`
- No cleanup mechanism when invoice transitions to terminal state
- Expired/cancelled invoices leave orphaned timers running indefinitely
- Accumulation of timers over time will consume CPU resources unnecessarily

## Proposed Solutions

**Option A: Clear Interval on Terminal State**

- Clear interval when invoice transitions to terminal state (paid/expired/cancelled)
- Effort: Small
- Risk: Low
- Benefit: Simple fix, maintains current architecture

**Option B: Single Polling Loop**

- Use a single polling loop that checks all pending invoices
- Effort: Medium
- Risk: Low
- Benefit: More scalable, centralized timer management

## Acceptance Criteria

- [ ] Timers cleaned up on terminal state transitions
- [ ] No orphaned intervals for expired invoices
- [ ] No orphaned intervals for cancelled invoices
- [ ] No orphaned intervals for paid invoices
- [ ] Memory profiling confirms timer cleanup works correctly

## Work Log

| Date       | Action                                      | Learnings                                                                |
| ---------- | ------------------------------------------- | ------------------------------------------------------------------------ |
| 2026-02-14 | Identified in code review round 6 of PR #73 | Polling timers accumulate without cleanup; needs terminal state handling |
