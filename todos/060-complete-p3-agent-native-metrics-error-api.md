---
status: pending
priority: p3
issue_id: '060'
tags: [code-review, agent-native, api]
dependencies: []
---

# Agent-Native Metrics and Error APIs

## Problem Statement

The current monitoring and error handling system is not optimized for programmatic (agent/bot) consumption:

1. **Metrics Endpoint Format**: `/metrics` endpoint exclusively serves Prometheus exposition format with no JSON alternative for agents. `getDeploymentHealth()` returns JSON but is not wired to any route.

2. **No Aggregate Error-State API**: No endpoint exists for agents to query:
   - Error rates across services
   - Degraded service status
   - Rate-limit quota/consumption
   - Structured error summaries

3. **Generic Production Errors**: Production errors return generic "Internal server error" with no actionable information for agents to diagnose or retry intelligently.

4. **Rate-Limit Key Includes User-Agent Hash**: Different agent versions get separate rate-limit buckets, preventing centralized quota management for agent traffic.

This creates friction for agent-based monitoring, deployment automation, and programmatic health checks.

## Findings

**Locations**:

- `middleware/deployment-monitoring.ts:207-216` (metrics endpoint, getDeploymentHealth)
- `middleware/error-handler-middleware.ts:244` (generic error responses)

**Impact**:

- Agents must parse Prometheus text format (error-prone)
- No structured error aggregation for automated alerting
- Agent deployments cannot query health before routing traffic
- Rate-limit enforcement inconsistent across agent versions
- Generic errors prevent intelligent retry logic

**Current Workarounds**:

- Agents scrape Prometheus metrics and parse text
- Manual health checks before deployments
- No automated error-rate monitoring

## Proposed Solutions

### 1. Add JSON Metrics Endpoint

**Create**: `GET /api/metrics/json` route

```typescript
// Wire up existing getDeploymentHealth
app.get('/api/metrics/json', authenticateAgent, async (req, res) => {
  const health = await getDeploymentHealth();
  res.json(health);
});
```

**Response Format**:

```json
{
  "status": "healthy",
  "timestamp": "2026-02-12T10:30:00Z",
  "services": {
    "backend": { "status": "healthy", "latency_ms": 45 },
    "redis": { "status": "healthy", "latency_ms": 2 },
    "postgres": { "status": "healthy", "latency_ms": 8 }
  },
  "metrics": {
    "requests_per_minute": 1247,
    "error_rate_percent": 0.12,
    "avg_response_time_ms": 123
  }
}
```

### 2. Create Error Aggregation Endpoint

**Create**: `GET /api/errors/summary` route

```typescript
app.get('/api/errors/summary', authenticateAgent, async (req, res) => {
  const { timeRange = '1h' } = req.query;

  const summary = {
    timeRange,
    totalErrors: 42,
    errorRate: 0.34,
    topErrors: [
      {
        type: 'DatabaseConnectionError',
        count: 15,
        lastOccurred: '2026-02-12T10:25:00Z',
        retryable: true,
      },
      {
        type: 'ValidationError',
        count: 12,
        lastOccurred: '2026-02-12T10:28:00Z',
        retryable: false,
      },
    ],
    degradedServices: ['postgres'],
  };

  res.json(summary);
});
```

### 3. Add Agent-Friendly Error Responses

**Change**: `middleware/error-handler-middleware.ts:244`

```typescript
// Detect agent via Accept header or custom header
const isAgent =
  req.get('Accept')?.includes('application/json') && req.get('X-Client-Type') === 'agent';

if (isAgent) {
  return res.status(500).json({
    error: 'InternalServerError',
    message: 'Service temporarily unavailable',
    retryable: true,
    retryAfterSeconds: 60,
    correlationId: getCorrelationId(req),
    supportUrl: 'https://status.sovren.com',
  });
} else {
  return res.status(500).json({
    error: 'Internal server error',
    correlationId: getCorrelationId(req),
  });
}
```

### 4. Normalize Rate-Limit Key for Agents

**Change**: Rate-limit key generation

```typescript
// Before
const rateLimitKey = `${ip}:${hashUserAgent(userAgent)}`;

// After
const clientType = req.get('X-Client-Type');
const rateLimitKey =
  clientType === 'agent'
    ? `agent:${ip}` // All agent versions share quota
    : `${ip}:${hashUserAgent(userAgent)}`;
```

### 5. Add Rate-Limit Quota Endpoint

**Create**: `GET /api/rate-limit/quota` route

```typescript
app.get('/api/rate-limit/quota', authenticateAgent, async (req, res) => {
  const key = getRateLimitKey(req);
  const quota = await redis.get(`quota:${key}`);

  res.json({
    limit: 1000,
    remaining: quota?.remaining || 1000,
    resetAt: quota?.resetAt || Date.now() + 3600000,
    retryAfterSeconds: quota?.remaining === 0 ? 3600 : 0,
  });
});
```

## Technical Details

**Files Affected**:

- `middleware/deployment-monitoring.ts`
- `middleware/error-handler-middleware.ts`
- `middleware/rate-limit.ts` (or equivalent)
- New: `routes/agent-api.ts` (optional, for organization)

**New Routes**:

- `GET /api/metrics/json` - JSON health/metrics
- `GET /api/errors/summary` - Error aggregation
- `GET /api/rate-limit/quota` - Quota consumption

**Authentication**:

- Require API key or JWT for agent endpoints
- Add `X-Client-Type: agent` header validation
- Consider separate rate-limit tier for authenticated agents

**Complexity**: Medium (new routes + error response logic)

## Acceptance Criteria

- [ ] `/api/metrics/json` endpoint returns structured health data
- [ ] `/api/errors/summary` endpoint returns error aggregates
- [ ] Agent errors include `retryable` flag and correlation ID
- [ ] Rate-limit key for agents normalized (no User-Agent hash)
- [ ] `/api/rate-limit/quota` endpoint shows consumption
- [ ] Agent endpoints require authentication
- [ ] OpenAPI/Swagger docs updated for new endpoints
- [ ] Integration tests for all new endpoints
- [ ] Agent SDK/documentation updated with examples

## Work Log

_No work logged yet_

## Resources

- PR #73: Post-Remediation Review
- Prometheus exposition format: https://prometheus.io/docs/instrumenting/exposition_formats/
- Agent-native API design patterns: https://cloud.google.com/apis/design/errors
- Rate-limiting best practices: https://www.rfc-editor.org/rfc/rfc6585#section-4
