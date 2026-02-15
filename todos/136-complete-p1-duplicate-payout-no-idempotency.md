---
status: pending
priority: p1
issue_id: '136'
tags:
  - code-review
  - round-7
  - security
  - data-integrity
  - payment
  - payout
dependencies: []
---

# 136: Duplicate Payout Risk — No Idempotency Check in PayoutManagementService

## Problem Statement

`PayoutManagementService` processes payout requests without idempotency checks. The same payout request can be submitted and processed multiple times, resulting in duplicate fund transfers. Combined with the auth bypass (todo 135), this creates a critical financial risk.

**Why it matters**: A single request replayed (network retry, malicious replay, or double-click) can transfer funds multiple times.

## Findings

**Data Integrity Guardian (Round 7)**: Flagged as CRITICAL — duplicate payout risk without idempotency key.

**Security Sentinel (Round 7)**: Corroborated — no deduplication mechanism for payout requests.

**Location**: `packages/backend/src/services/payout-management-service.ts` — `requestPayout()` method creates a new payout record every time without checking for existing pending/completed payouts with matching parameters.

## Proposed Solutions

### Option A: Idempotency Key Header (Recommended)
**Effort**: Medium | **Risk**: Low

Require clients to send `Idempotency-Key` header. Store key → result mapping. Return cached result on duplicate key.

```typescript
async requestPayout(params: PayoutParams, idempotencyKey: string): Promise<Payout> {
  const existing = await this.persistence.getPayoutByIdempotencyKey(idempotencyKey);
  if (existing) return existing; // Return cached result
  // ... process payout
}
```

**Pros**: Industry standard (Stripe, LNbits use this pattern)
**Cons**: Requires client changes to send header

### Option B: Deduplication Window
**Effort**: Small | **Risk**: Medium

Reject payouts with same (creator_id, amount) within a 5-minute window.

**Pros**: No client changes needed
**Cons**: May block legitimate back-to-back payouts of same amount

## Recommended Action

Option A — idempotency key is the standard approach for payment APIs.

## Technical Details

**Affected Files**:
- `packages/backend/src/services/payout-management-service.ts`
- `packages/backend/src/routes/lightning.ts`
- `packages/backend/src/services/payment-persistence.ts` (add idempotency key storage)

## Acceptance Criteria

- [ ] Payout requests require `Idempotency-Key` header
- [ ] Request without `Idempotency-Key` returns HTTP 400 with descriptive error
- [ ] Duplicate key returns cached result (HTTP 200, not re-processed)
- [ ] Idempotency keys expire after 24 hours (configurable TTL)
- [ ] Key-result mapping persisted to `payment-persistence` (survives restart)
- [ ] Test: same key sent twice returns same result without double-processing
- [ ] Test: different key with same params processes normally

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-15 | Created from Round 7 review | Payment APIs must always have idempotency protection |
