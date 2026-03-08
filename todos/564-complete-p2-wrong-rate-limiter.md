---
status: pending
priority: p2
issue_id: '564'
tags: [code-review, pr-108, security, performance]
---

# Switch discovery route from readOnlyRateLimiter to expensiveOperationRateLimiter

## Problem Statement

The route uses `readOnlyRateLimiter` (100 req/min) but performs a 3-table JOIN with `ILIKE` text search and `count: 'exact'` (full table scan for total). This is an expensive operation on a **public, unauthenticated endpoint**. The codebase has `expensiveOperationRateLimiter` (20 req/min) designed for "search, analytics" operations.

**Consensus: 2/9 agents (Security Sentinel, Performance Oracle)**

## Findings

- `discovery.routes.ts`, line 19: `router.use(readOnlyRateLimiter)`
- `rate-limit-middleware.ts`: `expensiveOperationRateLimiter` = 20/min for search operations
- `rateLimiters.content.search` already uses `expensiveOperationRateLimiter`
- At 100 req/min, an attacker can run 100 expensive 3-table JOINs per minute per IP

## Proposed Solutions

Switch to `expensiveOperationRateLimiter` or create a discovery-specific limiter (30/min).

## Acceptance Criteria

- [ ] Discovery route uses appropriate rate limiter (20-30 req/min, not 100)
- [ ] Rate limiter import updated
