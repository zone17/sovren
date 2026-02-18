# Todo 256: /metrics/health always returns "healthy" — no actual health checks (P2)

## Priority: P2 — Correctness / Agent Reliability
## Found in: review-agent-native (commit d928918)
## File: packages/backend/src/routes/v1/metrics.routes.ts

## Problem

The `GET /api/v1/metrics/health` endpoint hardcodes `status: 'healthy' as const` and only reports memory + process info. It performs **zero dependency health checks**:

- No database connectivity check (Supabase)
- No Redis/BullMQ connectivity check
- No external service checks

An agent relying on this endpoint for orchestration decisions (e.g., "should I route traffic here?") will always get `healthy` even when the service is functionally broken.

The existing health endpoints (`/health`, `/ready`, `/live`) at the root level already exist for infrastructure. This new `/api/v1/metrics/health` is positioned as the agent-friendly version but provides less information.

## Impact

- Agents cannot make reliable routing or retry decisions
- False positive health status masks real outages
- Undermines the purpose of an agent-native health endpoint

## Fix

At minimum, add a `checks` object with database reachability:
```ts
const checks = {
  database: await pingDatabase(), // returns { status: 'up'|'down', latencyMs }
  queue: await pingRedis(),       // returns { status: 'up'|'down', latencyMs }
};
const overallStatus = Object.values(checks).every(c => c.status === 'up') ? 'healthy' : 'degraded';
```

Alternatively, proxy the existing `/detailed` health endpoint data through the v1 JSON envelope.

## Files to Change
- `packages/backend/src/routes/v1/metrics.routes.ts` (lines 69-84)
