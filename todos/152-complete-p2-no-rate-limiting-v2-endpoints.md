---
status: pending
priority: p2
issue_id: "152"
tags: [code-review, pr-82, phase-7, security, rate-limiting, performance]
dependencies: []
---

# No Rate Limiting on V2 Endpoints

## Problem Statement
All 24 v2 endpoints (14 wellness + 10 shield) have no rate limiting. An attacker or misbehaving client can overwhelm the server with requests, causing denial of service.

## Findings
- `packages/backend/src/routes/v2/wellness.routes.ts` — no rate limit middleware
- `packages/backend/src/routes/v2/shield.routes.ts` — no rate limit middleware
- V1 routes have some rate limiting via existing middleware
- Especially dangerous: fingerprint comparison (O(n) scan) and benchmark queries (full table scan) are expensive operations
- Flagged by: security-sentinel, performance-oracle

## Proposed Solutions
### Option 1: Apply Existing Rate Limiter (Recommended)
**Approach:** Apply the existing `rateLimit` middleware to v2 routes. Use tiered limits: standard (100/min) for reads, stricter (20/min) for mutations, very strict (5/min) for expensive operations like fingerprint compare.
**Pros:** Uses existing infrastructure, proven pattern
**Cons:** May need tuning for wellness check-in frequency
**Effort:** 1-2 hours
**Risk:** Low

## Technical Details
- `packages/backend/src/routes/v2/wellness.routes.ts`
- `packages/backend/src/routes/v2/shield.routes.ts`
- `packages/backend/src/middleware/rateLimit.ts` (existing)

## Acceptance Criteria
- [ ] All v2 endpoints have rate limiting
- [ ] Expensive operations have stricter limits
- [ ] Rate limit headers returned in responses
- [ ] 429 response when limit exceeded

## Resources
- **PR:** #82
- **Agents:** security-sentinel, performance-oracle

## Work Log
### 2026-02-14 - Discovery
**By:** Claude Code Review
Tags: security, rate-limiting, performance
