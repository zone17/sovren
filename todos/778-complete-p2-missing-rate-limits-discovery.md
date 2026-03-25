---
status: pending
priority: p2
issue_id: 778
tags: [code-review, security, rate-limiting, dos]
dependencies: []
---

# Missing Rate Limits on Discovery Endpoints

## Problem Statement

5 public discovery endpoints have no per-endpoint rate limiters despite involving DB queries and Redis lookups. Only the global limiter (1000 req/15min) applies.

## Findings

- **Security Agent**: P2-07
- Endpoints: /trending, /categories, /category/:category, /similar/:contentId, /explore

## Proposed Solutions

Apply `readOnlyRateLimiter` or `expensiveOperationRateLimiter` to each endpoint.

## Acceptance Criteria

- [ ] All 5 discovery endpoints have rate limiters
- [ ] Rate limit headers in responses
