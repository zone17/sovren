---
status: pending
priority: p2
issue_id: '144'
tags:
  - code-review
  - round-7
  - data-integrity
  - subscription
  - transaction
dependencies: []
---

# 144: Compensating Transaction Rollback Gaps in Subscription Creation

## Problem Statement

The compensating transaction pattern in `subscription-management-service.ts` (Fix #116) tracks 4 steps with boolean flags, but the rollback logic has gaps: if the rollback step itself fails (e.g., database connection drops during rollback), the orphaned records remain with no retry mechanism, alert, or reconciliation process.

Additionally, the `var createdInvoice = initial_invoice` pattern uses `var` hoisting instead of proper `let` scoping (also flagged in security review M-4).

**Why it matters**: Partial subscription creation leaves orphaned payment records that may be charged but not associated with any active subscription.

## Findings

**Data Integrity Guardian (Round 7)**: Flagged as CRITICAL — compensating transaction has rollback holes.

**Security Sentinel (Prior Round)**: Flagged `var` usage as M-4.

**Location**: `packages/backend/src/services/subscription-management-service.ts:380-434` — `createSubscription()` method.

## Proposed Solutions

### Option A: Rollback Retry + Alert (Recommended)
**Effort**: Medium | **Risk**: Low

Add retry (max 3 attempts) for each rollback step. If rollback still fails, emit an alert/metric and log the orphaned record IDs for manual reconciliation.

**Pros**: Handles transient failures, provides visibility into orphaned records
**Cons**: Adds complexity to rollback logic

### Option B: Async Reconciliation Job
**Effort**: Large | **Risk**: Low

Background job that periodically scans for orphaned records (payment records without matching subscription, subscription without matching invoice) and cleans them up.

**Pros**: Handles edge cases comprehensively
**Cons**: Delayed cleanup, requires background job infrastructure

## Recommended Action

Option A for immediate fix. Option B as future enhancement when moving to Supabase.

## Technical Details

**Affected Files**:
- `packages/backend/src/services/subscription-management-service.ts`

## Acceptance Criteria

- [ ] Rollback steps retry up to 3 times on transient failure
- [ ] Failed rollback after 3 retries emits structured alert/log with orphaned record IDs
- [ ] Orphaned record IDs logged at `error` level for manual reconciliation
- [ ] All `var` declarations in `createSubscription()` replaced with `let` or `const`
- [ ] Test: simulate rollback failure at step 2, verify retry + alert
- [ ] Test: verify all 4 rollback steps have retry logic

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-15 | Created from Round 7 data integrity review | Compensating transactions need rollback retry + alerting |
