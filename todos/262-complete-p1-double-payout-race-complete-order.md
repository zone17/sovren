---
status: complete
priority: p1
issue_id: '262'
tags: [code-review, security, financial]
dependencies: []
---

# Double Payout Race in completeOrder

## Problem Statement

Two concurrent completeOrder requests can both read 'in_progress' and trigger two Lightning payouts. The DB trigger prevents the second status update but the payment is already sent. Funds are irrecoverably lost.

## Findings

- `packages/backend/src/services/community/MarketplaceService.ts` — read-then-payout-then-update pattern

## Proposed Solutions

### Option 1: Atomic guard via release_status

**Approach:** Set release_status='processing' atomically before payout. Only proceed if update succeeds. Use Supabase RPC with SELECT FOR UPDATE.
**Effort:** 3-4h **Risk:** Critical (financial loss)

## Acceptance Criteria

- [ ] Concurrent complete requests don't produce double payouts
- [ ] release_status used as atomic guard
- [ ] Test covers concurrent execution scenario

## Work Log

### 2026-02-18 - Code Review Discovery

**By:** Claude Code (13-agent parallel review)
