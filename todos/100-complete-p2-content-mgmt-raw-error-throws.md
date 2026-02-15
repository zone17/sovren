---
status: pending
priority: p2
issue_id: '100'
tags: [code-review, error-handling, http-status]
dependencies: []
---

# Content Management Service Throws Raw Errors Instead of AppError Hierarchy

## Problem Statement

`content-management-service.ts` throws `new Error(...)` 28 times instead of using the AppError hierarchy (ValidationError, NotFoundError, ServiceError, ConflictError). All raw errors become 500 Internal Server Error via the global error handler, losing HTTP status semantics. Business errors like "Content not found" should return 404, and validation errors like "Content must have a title" should return 400.

## Findings

**Current Error Handling:**

- 28 `throw new Error(...)` calls in `content-management-service.ts`
- Global error handler treats unknown errors as 500 Internal Server Error
- No distinction between validation errors (400), not found (404), conflicts (409), and actual server errors (500)
- Clients receive 500 for all failures, making client-side error handling impossible

**Error Categories in content-management-service.ts:**

1. **Validation Errors (should be 400):**

   - "Content must have a title"
   - "Content must have a body"
   - "Invalid content type"
   - "Tags must be an array"
   - ~8 occurrences

2. **Not Found Errors (should be 404):**

   - "Content not found"
   - "Content with ID X does not exist"
   - ~6 occurrences

3. **Conflict Errors (should be 409):**

   - "Content with this slug already exists"
   - "Cannot publish draft content"
   - ~4 occurrences

4. **Business Logic Errors (should be 422):**

   - "Cannot delete published content"
   - "Content already archived"
   - ~5 occurrences

5. **Actual Server Errors (correctly 500):**
   - Database connection failures
   - External service timeouts
   - ~5 occurrences

**AppError Hierarchy (already exists in error-handler-middleware.ts):**

```typescript
class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {}
}

class ValidationError extends AppError {
  constructor(message: string) {
    super(400, message);
  }
}

class NotFoundError extends AppError {
  constructor(message: string) {
    super(404, message);
  }
}

class ConflictError extends AppError {
  constructor(message: string) {
    super(409, message);
  }
}

class ServiceError extends AppError {
  constructor(message: string) {
    super(500, message);
  }
}
```

**Impact:**

- Clients can't distinguish between "content not found" (retry won't help) and "database timeout" (retry might succeed)
- 4xx errors trigger client-side user messaging; 5xx errors trigger error reporting/alerting
- Error monitoring tools (Sentry) report all errors as 500s, masking actual error rates
- Poor API user experience (all failures look the same)

## Proposed Solutions

### Option 1: Replace Raw Errors with AppError Subclasses

**Pros:**

- Proper HTTP status codes for each error type
- Leverages existing AppError hierarchy
- Better client-side error handling
- Accurate error monitoring (Sentry, Datadog)
- Minimal code change (change error class, not logic)

**Cons:**

- Requires updating 28 throw statements
- Need to import AppError subclasses
- Must categorize each error correctly

**Effort:** Medium (3 hours)
**Risk:** Low

### Option 2: Wrap Errors at Service Boundary

**Pros:**

- Service layer keeps throwing raw errors
- Controller/middleware wraps errors based on type/message
- Centralized error mapping logic

**Cons:**

- Error mapping logic is fragile (string matching on error messages)
- Harder to maintain (mapping rules separate from business logic)
- Loses context at throw site
- Doesn't scale well

**Effort:** Medium (4 hours)
**Risk:** Medium

### Option 3: Use Result/Either Pattern

**Pros:**

- No exceptions thrown (explicit error returns)
- Forces callers to handle errors
- Type-safe error handling
- Functional programming approach

**Cons:**

- Large refactor (service signatures change)
- Breaking change for all callers
- Team must learn Result pattern
- Overkill for this issue

**Effort:** High (12 hours)
**Risk:** High

## Recommended Action

**Option 1: Replace Raw Errors with AppError Subclasses**

Direct replacement of `throw new Error(...)` with appropriate AppError subclasses. This provides immediate improvement in API semantics with minimal risk.

Implementation:

1. **Import AppError subclasses:**

   ```typescript
   import {
     ValidationError,
     NotFoundError,
     ConflictError,
     ServiceError,
   } from '@/middleware/error-handler-middleware';
   ```

2. **Replace errors by category:**

   - Validation failures → `throw new ValidationError(...)`
   - Resource not found → `throw new NotFoundError(...)`
   - Duplicate resource → `throw new ConflictError(...)`
   - Business rule violation → `throw new ValidationError(...)` or custom 422 error
   - Database/external errors → `throw new ServiceError(...)`

3. **Add context to error messages:**

   - Include resource IDs, user IDs, relevant parameters
   - Example: `throw new NotFoundError(\`Content with ID ${id} not found\`)`

4. **Test error responses:**
   - Verify 400 for validation failures
   - Verify 404 for not found
   - Verify 409 for conflicts
   - Verify 500 for actual server errors

## Technical Details

**Affected File:**

- `src/services/content-management-service.ts` (28 throw statements)

**Example Migrations:**

**Before:**

```typescript
// Validation error (currently returns 500)
if (!content.title) {
  throw new Error('Content must have a title');
}

// Not found error (currently returns 500)
if (!existingContent) {
  throw new Error('Content not found');
}

// Conflict error (currently returns 500)
if (await this.contentExists(slug)) {
  throw new Error('Content with this slug already exists');
}
```

**After:**

```typescript
import {
  ValidationError,
  NotFoundError,
  ConflictError,
} from '@/middleware/error-handler-middleware';

// Validation error (returns 400)
if (!content.title) {
  throw new ValidationError('Content must have a title');
}

// Not found error (returns 404)
if (!existingContent) {
  throw new NotFoundError(`Content with ID ${id} not found`);
}

// Conflict error (returns 409)
if (await this.contentExists(slug)) {
  throw new ConflictError(`Content with slug "${slug}" already exists`);
}
```

**Error Categories and Counts:**
| Error Type | Count | Status Code | AppError Class |
|------------|-------|-------------|----------------|
| Validation | 8 | 400 | ValidationError |
| Not Found | 6 | 404 | NotFoundError |
| Conflict | 4 | 409 | ConflictError |
| Business Logic | 5 | 422 | ValidationError or custom |
| Server Error | 5 | 500 | ServiceError |

**Custom 422 Error (if needed):**

```typescript
// If business logic errors need distinction from validation
class UnprocessableEntityError extends AppError {
  constructor(message: string) {
    super(422, message);
  }
}
```

**Finding All Raw Errors:**

```bash
# Find all throw new Error in content-management-service.ts
grep -n "throw new Error" src/services/content-management-service.ts

# Context around each throw
grep -B 3 -A 1 "throw new Error" src/services/content-management-service.ts
```

## Acceptance Criteria

- [ ] All 28 `throw new Error(...)` statements replaced with appropriate AppError subclasses
- [ ] Validation errors return HTTP 400
- [ ] Not found errors return HTTP 404
- [ ] Conflict errors return HTTP 409
- [ ] Business logic errors return HTTP 422 or 400 (documented)
- [ ] Actual server errors return HTTP 500
- [ ] Error messages include relevant context (IDs, parameters)
- [ ] Unit tests verify correct error types thrown
- [ ] Integration tests verify correct HTTP status codes
- [ ] API documentation updated with error response codes
- [ ] Sentry error rates recalibrated (fewer false 500s)
- [ ] Client-side error handling tested (400 vs 500 handling)

## Work Log

**2026-02-14**

- Identified in PR #73 full code review
- Counted 28 raw `throw new Error(...)` calls in content-management-service.ts
- Categorized errors by HTTP status semantics
- Confirmed AppError hierarchy exists and is ready to use

## Resources

- PR #73: https://github.com/user/sovren/pull/73
- HTTP status codes: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status
- AppError hierarchy: `src/middleware/error-handler-middleware.ts`
- RESTful API error handling: https://www.rfc-editor.org/rfc/rfc7231#section-6
- Related: Issue #093 (AppError circular dependency)
