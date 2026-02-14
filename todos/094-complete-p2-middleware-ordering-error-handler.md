---
status: pending
priority: p2
issue_id: '094'
tags: [code-review, architecture, middleware]
dependencies: []
---

# Error Handler Middleware Placed After 404 Catch-All

## Problem Statement

Error handler middleware is registered AFTER the wildcard 404 catch-all route in `app.ts`. The 404 handler at line ~204 uses `app.use('*', ...)` which catches all unmatched routes, preventing errors from earlier middleware from reaching the error handler. Additionally, `notFoundHandler` exported from `error-handler-middleware.ts` is never used—an inline version is registered instead, creating code duplication and maintenance burden.

## Findings

- 404 catch-all registered at `app.ts:~204` using `app.use('*', ...)`
- Error handler middleware registered after the 404 handler
- Wildcard route `'*'` intercepts all requests not matched by earlier routes
- Errors thrown in route handlers or middleware before the 404 never reach error handler
- `error-handler-middleware.ts` exports `notFoundHandler` but it's unused
- Inline 404 handler duplicates logic that should be in error-handler-middleware.ts
- Missing correlation IDs, Sentry integration, structured logging for 404 responses

**Current Middleware Order:**

1. Body parsers, CORS, helmet
2. Request logging, correlation ID
3. Route handlers
4. 404 catch-all (`app.use('*', ...)`) ← catches everything
5. Error handler ← never reached for errors from routes/middleware above

## Proposed Solutions

### Option 1: Move Error Handler Before 404 Catch-All

**Pros:**

- Simple reordering of middleware registration
- Error handler catches all errors from routes/middleware
- 404 handler runs only for truly unmatched routes
- No code changes, just registration order

**Cons:**

- Error handler must be registered with 4 parameters to be recognized as error middleware
- Requires verification that error handler signature is correct

**Effort:** Low (30 minutes)
**Risk:** Low

### Option 2: Use notFoundHandler Export + Fix Middleware Order

**Pros:**

- Eliminates code duplication (inline 404 vs exported notFoundHandler)
- Single source of truth for 404 handling
- Error handler properly catches errors from all routes
- Consistent error formatting, correlation IDs for 404s

**Cons:**

- Requires updating both app.ts registration and error-handler-middleware.ts
- Need to verify notFoundHandler signature matches Express expectations

**Effort:** Low (1 hour)
**Risk:** Low

### Option 3: Redesign as Layered Error Handling Strategy

**Pros:**

- 404s treated as special case of NotFoundError (thrown, not inline handler)
- All errors flow through single error handler
- Consistent error response format
- Easier to add error monitoring, retry logic, etc.

**Cons:**

- More invasive change: replace inline 404 with `throw new NotFoundError()`
- Requires error handler to distinguish 404 from other errors
- May impact error metrics if 404s are currently tracked separately

**Effort:** Medium (3 hours)
**Risk:** Medium

## Recommended Action

**Option 2: Use notFoundHandler Export + Fix Middleware Order**

This balances minimal change with proper architecture. It eliminates duplication, ensures errors are caught correctly, and provides consistent 404 handling with correlation IDs and structured logging.

Implementation:

1. Verify `notFoundHandler` in `error-handler-middleware.ts` has correct signature
2. Update `app.ts` to use `notFoundHandler` instead of inline handler
3. Move 404 handler registration to AFTER error handler
4. Confirm error handler is registered with 4-parameter signature: `(err, req, res, next)`
5. Test error scenarios to verify error handler receives errors from routes/middleware

**Correct Middleware Order:**

1. Body parsers, CORS, helmet
2. Request logging, correlation ID
3. Route handlers
4. Error handler (`app.use((err, req, res, next) => ...)`) ← catches errors
5. 404 catch-all (`app.use(notFoundHandler)`) ← only runs if no route matched

## Technical Details

**Affected Files:**

- `src/app.ts` (lines ~204, error handler registration)
- `src/middleware/error-handler-middleware.ts` (notFoundHandler export)

**Current app.ts Structure (~lines 200-220):**

```typescript
// Routes
app.use('/api/v1', routes);

// 404 catch-all (inline) ← registered too early
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// Error handler ← never reached for route errors
app.use(errorHandler);
```

**Corrected app.ts Structure:**

```typescript
// Routes
app.use('/api/v1', routes);

// Error handler (4 params = error middleware)
app.use(errorHandler);

// 404 catch-all (use exported notFoundHandler)
app.use(notFoundHandler);
```

**notFoundHandler Signature:**

```typescript
// error-handler-middleware.ts
export const notFoundHandler = (req: Request, res: Response, next: NextFunction): void => {
  const error = new NotFoundError(`Route ${req.method} ${req.path} not found`);
  next(error); // Pass to error handler
};
```

**Error Handler Signature (must have 4 params):**

```typescript
export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction): void => {
  // Handle error
};
```

## Acceptance Criteria

- [ ] Error handler middleware registered before 404 catch-all in `app.ts`
- [ ] `notFoundHandler` from `error-handler-middleware.ts` used instead of inline handler
- [ ] Error handler signature confirmed to have 4 parameters
- [ ] 404 handler creates `NotFoundError` and calls `next(error)`
- [ ] Integration test: Error thrown in route handler reaches error handler
- [ ] Integration test: Unmatched route triggers 404 with correlation ID
- [ ] 404 responses include correlation ID in headers
- [ ] 404 responses logged with structured logger (not console.log)
- [ ] Sentry integration captures 404s at appropriate severity level
- [ ] No duplication between inline 404 logic and exported notFoundHandler

## Work Log

**2026-02-14**

- Identified in PR #73 full code review
- Observed that errors from routes return 500 instead of being caught by error handler
- Discovered notFoundHandler export is unused

## Resources

- PR #73: https://github.com/user/sovren/pull/73
- Express error handling guide: https://expressjs.com/en/guide/error-handling.html
- Express middleware order: https://expressjs.com/en/guide/using-middleware.html
- Related: `error-handler-middleware.ts` architecture
