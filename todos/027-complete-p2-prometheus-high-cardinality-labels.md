---
status: pending
priority: p2
issue_id: '027'
tags: [code-review, performance, observability]
dependencies: []
---

# High-Cardinality Prometheus Route Labels for Unmatched Requests

## Problem Statement

`deployment-monitoring.ts:136` falls through to raw `req.path` for 404s (unmatched routes):

```typescript
const route = normalizeRoute(req.route?.path || req.path);
```

Bot scanning 1,000 unique paths creates 1,000 _ 5 methods _ 3 status codes = 15,000 time series. With 11 histogram buckets, that's 165,000 metric data points in memory.

## Findings

- **performance-oracle**: OPT-5 - potential Prometheus memory explosion under bot traffic

## Proposed Solutions

Add a fallback for unmatched routes:

```typescript
const route = req.route?.path ? normalizeRoute(req.route.path) : '/unmatched';
```

**Effort**: Small (5 lines) | **Risk**: None

## Acceptance Criteria

- [ ] Unmatched routes collapse to `/unmatched` label
- [ ] Bot scanning cannot cause cardinality explosion
