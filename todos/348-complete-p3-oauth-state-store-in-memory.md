---
status: pending
priority: p3
issue_id: 348
tags: [code-review, scalability]
---

# In-memory OAuth state store doesn't scale horizontally

## Problem Statement

OAuth state parameters are stored in an in-memory `Map()`, which breaks when running multiple server instances behind a load balancer. A user starting OAuth on instance A will fail the callback on instance B because the state won't be found.

## Findings

- File: `packages/backend/src/routes/v2/platforms.routes.ts`
- OAuth state stored in `new Map()` at module level
- Works fine for single-instance deployment but fails with horizontal scaling
- No TTL on entries — abandoned OAuth flows leak memory indefinitely

## Proposed Solutions

1. Move OAuth state storage to Redis with a short TTL (e.g., 10 minutes)
2. As an interim measure, add a TTL-based cleanup to the in-memory Map to prevent memory leaks
3. Long-term: use the existing cache/session infrastructure if available

## Acceptance Criteria

- [ ] OAuth state is stored in a shared store (Redis) accessible by all instances
- [ ] State entries expire after a reasonable TTL (e.g., 10 minutes)
- [ ] OAuth flow works correctly when callback hits a different instance than the initial request
