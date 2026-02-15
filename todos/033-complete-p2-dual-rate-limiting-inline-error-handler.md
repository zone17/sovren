---
status: pending
priority: p2
issue_id: '033'
tags: [code-review, architecture, duplication]
dependencies: []
---

# Dual Rate Limiting + Inline Error Handler Duplication

## Problem Statement

Two architectural duplications:

1. **Dual rate limiting**: `app.ts` configures its own `express-rate-limit` (in-memory, not shared across instances) while `rate-limit-middleware.ts` provides a complete Redis-backed system. In production with multiple replicas, the in-memory global limiter provides false security.

2. **Inline error handler**: `app.ts:214-271` has an inline global error handler that duplicates `error-handler-middleware.ts`. The dedicated middleware has richer `AppError` hierarchy, `requestId` metadata, and structured responses. The inline handler is less structured.

3. **Three rate limiting files**: `rate-limit-middleware.ts`, `advanced-rate-limiting.ts`, `rateLimit.ts` all exist with different interfaces.

## Findings

- **architecture-strategist**: MODERATE - dual rate limiting, dual error handling
- **pattern-recognition-specialist**: HIGH - 3 rate limiting implementations, duplicate error handling

## Proposed Solutions

1. Remove inline `rateLimit()` from `app.ts`, use Redis-backed limiter from `rate-limit-middleware.ts`
2. Replace inline error handler with `errorHandler` from `error-handler-middleware.ts`
3. Delete `advanced-rate-limiting.ts` and `rateLimit.ts`

**Effort**: Medium | **Risk**: Low

## Acceptance Criteria

- [ ] Single rate limiting module used throughout
- [ ] Single error handler registered in `app.ts`
- [ ] No in-memory rate limiting in production
