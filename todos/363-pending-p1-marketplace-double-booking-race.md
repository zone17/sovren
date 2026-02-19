---
status: pending
priority: p1
issue_id: 363
tags:
  - code-review
  - data-integrity
  - race-condition
  - financial
dependencies: []
---

# Marketplace Double-Booking Race Condition on Single-Quantity Listings

## Problem Statement

Two buyers can simultaneously place orders for a single-quantity marketplace listing. Both pass the availability check and create orders, resulting in double-booking and potential financial loss. This directly impacts revenue integrity and can lead to fulfillment disputes.

## Findings

**Source agents:** concurrency-review, financial-review, data-integrity-review

**Evidence:**

- File: `packages/backend/src/services/community/MarketplaceService.ts`
- Issue: Order creation flow checks listing availability (quantity > 0 or status = 'active'), then creates the order in a separate operation. Two concurrent requests both see the listing as available and both create orders, resulting in overselling.

## Proposed Solutions

### Option A: Unique partial index + optimistic locking

- **Approach:** Add a unique partial index on orders table: `CREATE UNIQUE INDEX idx_single_order_active ON orders(listing_id) WHERE status = 'active' AND quantity = 1`. Combined with updating listing status to 'sold' atomically via RPC, the second concurrent order will fail with a unique constraint violation.
- **Effort:** Medium
- **Risk:** Low

### Option B: Supabase RPC with SELECT FOR UPDATE

- **Approach:** Create an RPC function that locks the listing row, verifies availability, creates the order, and updates the listing status in a single transaction. The row lock prevents concurrent reads of stale availability.
- **Effort:** Medium
- **Risk:** Low

## Recommended Action

_To be filled during triage_

## Technical Details

**Affected files:**

- `packages/backend/src/services/community/MarketplaceService.ts`

## Acceptance Criteria

- [ ] Concurrent order placements for a single-quantity listing result in exactly one success
- [ ] Failed concurrent order returns appropriate error (409 Conflict)
- [ ] Listing status is updated to 'sold' atomically with order creation
- [ ] Multi-quantity listings still allow multiple orders up to available quantity
- [ ] Load test with 10 concurrent orders on a quantity=1 listing results in exactly 1 success and 9 rejections

## Work Log

| Date       | Action  | Notes                      |
| ---------- | ------- | -------------------------- |
| 2026-02-19 | Created | PR #86 code review finding |

## Resources

- PR: https://github.com/zone17/sovren/pull/86
