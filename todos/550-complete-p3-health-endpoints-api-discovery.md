---
status: pending
priority: p3
issue_id: '550'
tags: [code-review, agent-native, pr-103]
dependencies: []
---

# Add health/readiness/metrics endpoints to API root discovery response

## Problem Statement

The `/api` root endpoint lists `health: '/health'` but omits `/ready`, `/live`, `/health/detailed`, `/api/v1/metrics`, and `/api/v1/metrics/health`. An agent discovering available endpoints via `GET /api` would not know these monitoring endpoints exist.

## Findings

- `packages/backend/src/app.ts:226-245` — API root response lists only `/health`
- 7 monitoring endpoints exist but only 1 is discoverable
- Agent-native reviewer: "simplest agent-native improvement"

## Proposed Solutions

### Option 1: Expand endpoints object (Recommended)

```typescript
endpoints: {
  health: '/health',
  ready: '/ready',
  live: '/live',
  healthDetailed: '/health/detailed',
  metrics: '/metrics',
  metricsJson: '/api/v1/metrics',
  metricsHealth: '/api/v1/metrics/health',
}
```

**Effort:** Small (5 min) | **Risk:** None

## Acceptance Criteria

- [ ] `GET /api` response includes all monitoring endpoints
