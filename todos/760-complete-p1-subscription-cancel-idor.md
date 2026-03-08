---
status: pending
priority: p1
issue_id: 760
tags: [code-review, security, idor, authorization]
dependencies: []
---

# Subscription Cancellation IDOR — Missing Ownership Check

## Problem Statement

Any authenticated user can cancel any other user's subscription by providing the subscription ID. No ownership verification is performed. CVSS: 8.1.

## Findings

- **Security Agent**: P1-03 — `lightning.ts` lines 91-100
- The payout route (line 141) correctly passes `getAuthUser(req).nostr_pubkey`
- This route does not

## Proposed Solutions

Pass authenticated user's pubkey to `cancelSubscription()` and verify ownership inside the service.

## Acceptance Criteria

- [ ] `cancelSubscription` receives and validates the authenticated user's identity
- [ ] Attempting to cancel another user's subscription returns 403
- [ ] Test coverage for the authorization check
