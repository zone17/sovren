---
status: pending
priority: p2
issue_id: '031'
tags: [code-review, architecture, performance, health-checks]
dependencies: []
---

# Duplicate Health Check Endpoints + WebSocket in Readiness Probes

## Problem Statement

1. **Duplicate routes**: `/ready` and `/health/ready` are identical (lines 89-116 vs 174-202). `/live` and `/health/live` are also identical (lines 119-126 vs 205-213). Pure copy-paste duplication.

2. **WebSocket in readiness probe**: `checkNostr()` opens a new WebSocket to a NOSTR relay on every health check with a 5-second timeout. If the relay is slow, Kubernetes could mark the pod unhealthy even though the core app works.

3. **`WebSocket` global** (line 346): Not available in Node.js < 21. Will throw `ReferenceError` on Node.js 18/20 LTS.

4. **Health check `SELECT *`** from `health_check` table (line 221): Should use `SELECT 1` for a simple connectivity check.

## Findings

- **performance-oracle**: OPT-2 (WebSocket churn), OPT-3 (duplicate endpoints), OPT-6 (SELECT \*)
- **architecture-strategist**: MODERATE - duplicate routes, WebSocket in health check
- **pattern-recognition-specialist**: Duplicate health endpoints
- **kieran-typescript-reviewer**: MEDIUM-19 - WebSocket not available in Node < 21

## Proposed Solutions

1. Define handlers once, mount at both paths
2. Move NOSTR/Lightning checks to `/health/detailed` only
3. Cache relay health status with 60s TTL
4. Import `WebSocket` from `ws` package
5. Replace `SELECT *` with `SELECT 1`

**Effort**: Small | **Risk**: Low

## Acceptance Criteria

- [ ] No duplicate route handler implementations
- [ ] `/ready` only checks DB + Redis (critical dependencies)
- [ ] NOSTR relay check uses cached status or is in `/health/detailed` only
- [ ] WebSocket imported from `ws` package
