---
status: pending
priority: p1
issue_id: '037'
tags: [code-review, performance, prometheus, observability]
dependencies: []
---

# Route Metrics Always Unmatched

## Problem Statement

The `req.route` property is always `undefined` when the deployment-monitoring middleware runs (before Express resolves routes), causing ALL requests to be labeled `/unmatched` in Prometheus metrics. The `normalizeRoute()` function never processes real route paths, making route-level performance analysis impossible.

## Findings

**Location**: `/Users/fp/Desktop/Sovren/packages/backend/src/middleware/deployment-monitoring.ts:141`

**Found by**: Performance Oracle, TypeScript Reviewer, Architecture Strategist

**Issue**: The middleware captures route information at request start, but Express hasn't resolved `req.route` at that point in the middleware chain. As a result:

- Every request gets labeled with `route: "/unmatched"` in Prometheus
- Route normalization logic is effectively dead code
- Impossible to track performance by endpoint
- Time-series metrics are polluted with meaningless aggregate data

**Current code pattern**:

```typescript
// Middleware runs early - req.route is undefined here
const route = normalizeRoute(req.route?.path || '/unmatched');
histogram.observe({ method: req.method, route, status }, duration);
```

## Proposed Solutions

### Option 1: Move Route Capture to Response Finish Handler (Recommended)

Start the timer without labels, then pass all labels (including resolved route) when calling `end()` in the `res.on('finish')` callback.

**Pros**:

- Express has resolved routes by finish time
- Accurate route labeling
- Maintains timing accuracy (timer started at request arrival)

**Cons**:

- Slightly more complex code structure
- Timer and labels captured at different lifecycle points

### Option 2: Use Route-Specific Middleware

Register metrics middleware after route definitions, once per route.

**Pros**:

- Routes definitely resolved
- Simpler logic

**Cons**:

- Requires middleware registration on every route
- Won't capture 404s or middleware-only paths
- High maintenance burden

### Option 3: Use res.locals Pattern

Store timer in `res.locals` and capture route in finish handler.

**Pros**:

- Clean separation of concerns
- Route available at finish time

**Cons**:

- Similar complexity to Option 1
- Less explicit about label timing

## Technical Details

**Root cause**: Express middleware execution order

1. Deployment monitoring middleware runs
2. `req.route` is still `undefined`
3. Route matching happens later in the stack
4. By the time route is resolved, metrics are already recorded

**Impact**:

- All route-level Prometheus queries return meaningless data
- Cannot identify slow endpoints
- Cannot track error rates by route
- Alerts based on route patterns will never fire

**Related metrics**:

- `http_request_duration_seconds` histogram
- All route-labeled time-series data since deployment

## Acceptance Criteria

- [ ] `req.route.path` correctly captured for all matched routes
- [ ] 404 requests labeled with `/unmatched` or `/:404`
- [ ] Middleware-only endpoints have appropriate labels
- [ ] Existing histogram timing accuracy maintained
- [ ] Prometheus queries by route return meaningful data
- [ ] No breaking changes to metric label schema
- [ ] Tests verify route labeling for matched and unmatched routes

## Work Log

_No work logged yet_

## Resources

- Express middleware lifecycle: https://expressjs.com/en/guide/using-middleware.html
- Prometheus histogram best practices: https://prometheus.io/docs/practices/histograms/
- Related file: `/Users/fp/Desktop/Sovren/packages/backend/src/middleware/deployment-monitoring.ts`
