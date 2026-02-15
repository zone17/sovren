---
status: pending
priority: p2
issue_id: '044'
tags: [code-review, architecture, error-handling]
dependencies: []
---

# Dual Error Class Hierarchy

## Problem Statement

Two competing error hierarchies exist in the codebase, causing inconsistent error handling and incorrect HTTP status codes in production. The `error-handler-middleware.ts` defines `AppError` (with statusCode/code), while `utils/errors.ts` defines `ServiceError` (with cause/context/timestamp). Both hierarchies include overlapping classes like `ValidationError`, `NotFoundError`, `ConflictError`, and `ServiceError` but with different APIs. The global error handler only recognizes `AppError` instances, resulting in service-layer `NotFoundError` (from utils/errors) producing 500 status codes instead of 404 in production.

## Findings

**Location**:

- `error-handler-middleware.ts:18-84`
- `utils/errors.ts:15-85`

**Details**:

- AppError hierarchy (middleware): Includes statusCode and code properties
- ServiceError hierarchy (utils): Includes cause, context, and timestamp properties
- Global error handler middleware only handles AppError-based errors correctly
- Service layer errors from utils/errors.ts bypass proper HTTP status code mapping
- Duplicate error class names create confusion and maintenance burden
- No clear documentation on which hierarchy to use in which context

## Proposed Solutions

1. **Unify under AppError** (Recommended):

   - Make all utils/errors.ts classes extend AppError base class
   - Add cause, context, timestamp properties to AppError
   - Update all service imports to use consolidated hierarchy
   - Remove duplicate class definitions

2. **Unify under ServiceError**:

   - Update AppError to extend ServiceError
   - Add statusCode mapping to ServiceError
   - Update middleware to handle ServiceError base class

3. **Adapter Pattern**:
   - Keep both hierarchies
   - Create adapter in error handler to map ServiceError → AppError
   - Document usage boundaries clearly

## Technical Details

**Affected Files**:

- `error-handler-middleware.ts`
- `utils/errors.ts`
- All service files importing from either error module

**API Differences**:

```typescript
// AppError (middleware)
class AppError extends Error {
  statusCode: number;
  code: string;
}

// ServiceError (utils)
class ServiceError extends Error {
  cause?: Error;
  context?: Record<string, unknown>;
  timestamp: Date;
}
```

## Acceptance Criteria

- [ ] Single error class hierarchy exists
- [ ] All error classes include both HTTP status mapping AND debug context
- [ ] Global error handler correctly maps all error types to HTTP status codes
- [ ] Service layer NotFoundError returns 404 in production
- [ ] All service files updated to use consolidated hierarchy
- [ ] Unit tests verify HTTP status code mapping for all error types
- [ ] Documentation updated with error handling guidelines

## Work Log

Created: 2026-02-12

## Resources

- PR #73 post-remediation review
- Error handling best practices documentation
