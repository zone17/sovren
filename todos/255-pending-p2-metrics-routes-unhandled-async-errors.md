# Todo 255: Metrics routes swallow async errors (P2)

## Priority: P2 — Error Handling
## Found in: review-agent-native (commit d928918)
## File: packages/backend/src/routes/v1/metrics.routes.ts

## Problem

Both `GET /api/v1/metrics` and `GET /api/v1/metrics/health` use `async` handlers that `await` promises but have **no try/catch and no NextFunction parameter**. If `getJsonMetrics()` throws (e.g., prom-client registry error), Express will not route the error to the global error handler — it will produce an unhandled promise rejection.

Every other route file in the codebase uses the pattern:
```ts
async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    // ...
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
```

The metrics routes skip both `try/catch` and `next`.

## Impact

- Agent calling `/api/v1/metrics` gets a connection drop or generic 500 instead of a structured error JSON
- Breaks the "agent-friendly" promise of this endpoint
- Unhandled promise rejection could crash the process in strict environments

## Fix

Add `NextFunction` parameter and wrap in try/catch, or use the existing `asyncHandler` wrapper from `error-handler-middleware.ts`.

## Files to Change
- `packages/backend/src/routes/v1/metrics.routes.ts` (lines 38-42, 64-87)
