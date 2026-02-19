---
status: complete
priority: p2
issue_id: '275'
tags: [code-review, security, authorization]
dependencies: []
---

# No-op requireBuyer/requireSeller Middleware

## Problem Statement

requireBuyer and requireSeller middleware in marketplace routes only check if the user is authenticated, not whether they are actually the buyer/seller of the specific order. Any authenticated user can act on any order.

## Findings

- `packages/backend/src/routes/v2/marketplace.routes.ts` — middleware checks auth but not resource ownership
- `packages/backend/src/middleware/` — requireBuyer/requireSeller implementations

## Proposed Solutions

### Option 1: Add ownership verification

**Approach:** Middleware loads the order, checks req.user.id matches order.buyer_id or order.seller_id respectively. Returns 403 if not.
**Effort:** 1h **Risk:** Low

## Acceptance Criteria

- [ ] requireBuyer verifies user is the order's buyer
- [ ] requireSeller verifies user is the order's seller
- [ ] 403 returned for non-owners
- [ ] RLS provides defense-in-depth

## Work Log

### 2026-02-18 - Code Review Discovery

**By:** Claude Code (13-agent parallel review)
