# Todo 257: Metrics endpoint double-wraps data field (P2)

## Priority: P2 — Agent DX / API Consistency
## Found in: review-agent-native (commit d928918)
## File: packages/backend/src/routes/v1/metrics.routes.ts

## Problem

The `GET /api/v1/metrics` handler calls:
```ts
res.json(createApiResponse(req, { metrics }, startTime));
```

`createApiResponse` wraps the second argument in `{ success: true, data: <arg>, metadata: {...} }`. This produces:
```json
{
  "success": true,
  "data": {
    "metrics": { ... }
  },
  "metadata": { ... }
}
```

The `data.metrics` nesting is redundant. An agent must access `response.data.metrics.sovren_http_requests_total` when `response.data.sovren_http_requests_total` would be cleaner and consistent with how other endpoints return data directly.

The `/metrics/health` endpoint does this correctly — passing the `health` object directly so the response is `data.status`, `data.uptime`, etc.

## Impact

- Minor but inconsistent: `/metrics/health` puts fields directly under `data`, while `/metrics` adds an extra `metrics` wrapper
- Agents need different parsing logic for two endpoints on the same router

## Fix

Change to `createApiResponse(req, metrics, startTime)` to match the health endpoint pattern.

## Files to Change
- `packages/backend/src/routes/v1/metrics.routes.ts` (line 41)
