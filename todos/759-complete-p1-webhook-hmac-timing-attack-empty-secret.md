---
status: pending
priority: p1
issue_id: 759
tags: [code-review, security, cryptography, webhooks]
dependencies: []
---

# Webhook HMAC Timing Attack + Empty Secret Fallback

## Problem Statement

Two critical webhook security issues: (1) HMAC signature comparison uses `===` instead of `crypto.timingSafeEqual()` (CVSS: 7.4), enabling progressive signature guessing. (2) `WEBHOOK_SECRET` defaults to empty string, allowing signature forgery with `HMAC-SHA256('', payload)` (CVSS: 9.1).

## Findings

- **Security Agent**: P1-02 — `webhooks.ts` lines 107, 118 use `===`
- **Security Agent**: P1-05 — `webhooks.ts` line 46: `process.env.WEBHOOK_SECRET || ''`
- CSRF module at `csrf.ts` line 75 correctly uses `crypto.timingSafeEqual()`

## Proposed Solutions

1. Replace `===` with `crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))`
2. Throw at startup if `WEBHOOK_SECRET` is not set in production
3. Guard in `verifyWebhookSignature` rejecting if secret is empty

## Acceptance Criteria

- [ ] Both signature comparisons use `crypto.timingSafeEqual()`
- [ ] Empty/missing WEBHOOK_SECRET throws at startup in production
- [ ] Existing webhook tests pass
