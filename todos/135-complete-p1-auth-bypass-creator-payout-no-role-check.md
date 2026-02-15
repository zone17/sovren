---
status: pending
priority: p1
issue_id: '135'
tags:
  - code-review
  - round-7
  - security
  - auth
  - payment
  - payout
dependencies: []
---

# 135: Auth Bypass on Creator Payout Endpoints — No Role Check

## Problem Statement

The Lightning payout endpoints (`/lightning/creator/payout`, `/lightning/creator/payouts`) lack role-based authorization checks. Any authenticated user — regardless of whether they are a creator — can request payouts. This is a direct financial exploit vector.

**Why it matters**: An attacker with a regular user account can drain creator funds by calling the payout endpoint directly.

## Findings

**Security Sentinel (Round 7)**: Flagged as P1 — auth bypass on creator payouts.

**Location**: `packages/backend/src/routes/lightning.ts` — payout routes use `authenticate` middleware but not `authorize('creator')` or equivalent role check.

**Attack vector**:
1. Create regular user account
2. Call `POST /api/lightning/creator/payout` with valid auth token
3. Payout processes without verifying the caller is a creator

## Proposed Solutions

### Option A: Add Role Middleware (Recommended)
**Effort**: Small | **Risk**: Low

Add `authorize('creator')` middleware to payout routes:
```typescript
router.post('/creator/payout', authenticate, authorize('creator'), payoutHandler);
router.get('/creator/payouts', authenticate, authorize('creator'), payoutListHandler);
```

**Pros**: Simple, consistent with other protected routes
**Cons**: None significant

### Option B: Service-Level Check
**Effort**: Small | **Risk**: Low

Verify creator role inside `PayoutManagementService.requestPayout()`.

**Pros**: Defense in depth
**Cons**: Should be BOTH route and service level

## Recommended Action

Option A + Option B together (defense in depth). Route middleware prevents unauthorized access; service validates business rules.

## Technical Details

**Affected Files**:
- `packages/backend/src/routes/lightning.ts`
- `packages/backend/src/services/payout-management-service.ts`

## Acceptance Criteria

- [ ] Payout endpoints (`/lightning/creator/payout`, `/lightning/creator/payouts`) require `creator` role via middleware
- [ ] Non-creator authenticated user receives HTTP 403 with `{ error: "Forbidden" }` body
- [ ] Service layer (`PayoutManagementService.requestPayout`) independently validates caller has `creator` role
- [ ] Service-level role check throws even if middleware is bypassed (defense in depth)
- [ ] Test: regular user calling POST `/lightning/creator/payout` gets 403
- [ ] Test: regular user calling GET `/lightning/creator/payouts` gets 403

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-15 | Created from Round 7 security review | Auth bypass on financial endpoints is P1 critical |
