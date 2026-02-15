---
status: pending
priority: p2
issue_id: 007
tags: [code-review, security]
dependencies: []
---

# Missing NOSTR Signature Verification on Payment Routes

## Problem Statement

Payment routes (invoices/:id/pay, subscriptions, refunds) only require JWT auth, not NOSTR signature verification. For a NOSTR-based platform, financial operations should require proof of private key ownership.

## Findings

Security-sentinel found v1 payment routes lack requireNostrSignature middleware. Stolen JWT allows payments without key proof. OWASP A07:2021.

## Proposed Solutions

### Option A: Add requireNostrSignature Middleware to Financial Endpoints

**Pros:** Ensures all financial mutations require proof of private key ownership, prevents unauthorized payments even with stolen JWT
**Cons:** Slightly increases client implementation complexity
**Effort:** Small
**Risk:** Low

## Technical Details

**Affected Files:** packages/backend/src/routes/v1/payment.routes.ts (lines 30-52)

## Acceptance Criteria

- [ ] All POST/PUT/DELETE payment endpoints require NOSTR signature verification
- [ ] requireNostrSignature middleware applied to invoice payment route
- [ ] requireNostrSignature middleware applied to subscription routes
- [ ] requireNostrSignature middleware applied to refund routes
- [ ] Tests verify payment endpoints reject requests without valid NOSTR signatures

## Work Log

- 2026-02-11: Created from /workflows:review multi-agent code review
