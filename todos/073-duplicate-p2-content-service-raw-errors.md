---
status: pending
priority: p2
issue_id: 073
tags: [code-review, patterns, error-handling]
dependencies: []
---

# content-management-service.ts 28x Raw Error() Bypasses AppError

## Problem Statement

`packages/backend/src/services/content-management-service.ts` throws `new Error()` 28 times instead of using the `AppError` hierarchy. These raw errors bypass the structured error handler, resulting in generic 500 responses instead of proper status codes and error codes.

## Findings

- **Pattern Recognition P1-05**: 28 instances of `throw new Error()` bypassing the entire AppError system.
- **Architecture Strategist**: Inconsistent error handling across services.

## Proposed Solutions

### Option A: Replace with appropriate AppError subclasses (Recommended)

Replace each `throw new Error(msg)` with the appropriate error class: `NotFoundError`, `ValidationError`, `ServiceError`, etc.
**Pros:** Proper HTTP status codes, structured error responses
**Cons:** Need to categorize each error
**Effort:** Medium | **Risk:** Low

## Acceptance Criteria

- [ ] Zero `throw new Error()` in content-management-service.ts
- [ ] Each error uses the appropriate AppError subclass
- [ ] Error responses include proper status codes and error codes
