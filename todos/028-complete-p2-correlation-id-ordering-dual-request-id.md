---
status: pending
priority: p2
issue_id: '028'
tags: [code-review, architecture, observability]
dependencies: []
---

# Correlation ID Middleware Ordering + Dual Request ID Systems

## Problem Statement

Two issues with request identity:

1. **Correlation ID placed too late** (`app.ts`): Currently at position 5, AFTER helmet, CORS, rate limiting. Rejection responses (429, CORS errors) won't carry correlation IDs and won't be traced.

2. **Dual request ID systems**: `correlation-id.ts` uses UUID + `X-Correlation-ID` via AsyncLocalStorage. `error-handler-middleware.ts:324-326` generates its own ID via `req_${Date.now()}_${Math.random()}` and sets `X-Request-ID`. Two competing ID systems create confusion.

## Findings

- **architecture-strategist**: CRITICAL - correlation ID placement; MINOR - dual request IDs
- **pattern-recognition-specialist**: MEDIUM - duplicate request ID generation

## Proposed Solutions

1. Move `app.use(correlationIdMiddleware)` to immediately after `const app = express()`
2. Remove `requestIdMiddleware` from `error-handler-middleware.ts`
3. Have error handler use `getCorrelationId()` from correlation-id module

**Effort**: Small | **Risk**: Low

## Acceptance Criteria

- [ ] Correlation ID middleware is first middleware in the stack
- [ ] Rate limiter 429 responses carry correlation IDs
- [ ] Single request identity system
