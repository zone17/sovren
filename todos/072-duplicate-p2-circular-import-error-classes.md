---
status: pending
priority: p2
issue_id: 072
tags: [code-review, architecture, typescript]
dependencies: []
---

# Circular Import Between error-handler-middleware and utils/errors

## Problem Statement

`error-handler-middleware.ts` re-exports from `utils/errors.ts` (line 80), and `utils/errors.ts` imports `AppError` from `error-handler-middleware.ts` (line 9). This creates a circular dependency that works due to Node.js module caching but is fragile and can break with bundlers or import order changes.

## Findings

- **Architecture Strategist P1-001**: Circular import creates fragile load-order dependency.
- **TypeScript Quality P2-009**: Circular dependency between error modules.
- **Pattern Recognition P1-04**: ValidationError defined 3 times across codebase.
- **Data Integrity Finding 1**: Circular module dependency risk.
- Previous P1 Fix #3 addressed the dual hierarchy but didn't eliminate the circular import.

## Proposed Solutions

### Option A: Move AppError to utils/errors.ts (Recommended)

Move `AppError` class from middleware to `utils/errors.ts`. Middleware imports from utils only. No re-exports needed.
**Pros:** Eliminates circular dependency cleanly
**Cons:** Changes import paths for AppError consumers
**Effort:** Medium | **Risk:** Low

## Acceptance Criteria

- [ ] No circular imports between error files
- [ ] Single direction: middleware imports from utils/errors
- [ ] All error classes defined in one location
- [ ] TypeScript compiles without issues
