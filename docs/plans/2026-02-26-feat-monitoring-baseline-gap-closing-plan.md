---
title: "feat: Monitoring baseline gap closing"
type: feat
date: 2026-02-26
priority: P3
points: 1
owner: Either squad's QA
---

# feat: Monitoring Baseline Gap Closing

## Overview

The monitoring baseline (health endpoints, structured logging, Sentry error tracking, Prometheus metrics) **already exists** — implemented in the Infrastructure Sprint and documented in ADR-017. This 1-point story closes the remaining gaps so the baseline is production-ready before vertical slices ship.

## What Already Exists

| Component | Status | Files |
|---|---|---|
| Health endpoints (`/health`, `/ready`, `/live`, `/health/detailed`) | Implemented | `packages/backend/src/routes/health.ts` |
| Winston structured logging + correlation IDs | Implemented | `packages/backend/src/lib/logger.ts`, `packages/backend/src/middleware/correlation-id.ts` |
| Sentry backend (`@sentry/node@10.38.0`) | Implemented | `packages/backend/src/lib/sentry.ts` |
| Sentry frontend (`@sentry/react@10.38.0`) | Implemented | `packages/frontend/src/monitoring/sentry.ts` |
| Prometheus metrics (`prom-client@15.1.3`) | Implemented | `packages/backend/src/middleware/deployment-monitoring.ts` |
| Docker health checks | Configured | All Dockerfiles + compose files |
| Web Vitals collection | Implemented | `packages/frontend/src/monitoring/web-vitals.ts` |
| Sensitive field sanitization | Implemented | `packages/backend/src/lib/sensitive-fields.ts` |
| ADR-017 (Observability Stack) | Written | `docs/decisions/ADR-017-observability-stack.md` |

## Gaps to Close

### Gap 1: docker-compose.dev.yml wrong health check path

**File:** `docker-compose.dev.yml:55`

The dev health check uses `/api/health` but the health router is mounted at `/` (not `/api/`). The endpoint is `/health`.

```yaml
# Before (WRONG)
test: ['CMD', 'curl', '-f', 'http://localhost:3001/api/health']

# After (CORRECT)
test: ['CMD', 'curl', '-f', 'http://localhost:3001/health']
```

### Gap 2: Prometheus scrape config missing backend target

**File:** `docker/prometheus/prometheus.yml`

The Prometheus config scrapes MCP gateway services but **not the backend API**. The `/metrics` endpoint exists and works but Prometheus never scrapes it.

```yaml
# Add to prometheus.yml scrape_configs:
- job_name: 'sovren-api'
  scrape_interval: 15s
  static_configs:
    - targets: ['backend:3001']
  metrics_path: '/metrics'
```

Note: The `/metrics` endpoint requires `METRICS_AUTH_TOKEN` in production. For the dev Prometheus scrape, either:
- Set `METRICS_AUTH_TOKEN` in the backend's docker-compose env and pass as `bearer_token` in prometheus.yml
- Or skip auth in non-production (already the default behavior — if no token configured, metrics are open)

### Gap 3: Stale `@sentry/tracing` dependency

**File:** `packages/frontend/package.json`

`@sentry/tracing@^7.120.3` is installed alongside `@sentry/react@^10.38.0`. Tracing was merged into the core SDK in Sentry v8+. The v7 package is dead weight.

```bash
cd packages/frontend && npm uninstall @sentry/tracing
```

Verify no imports reference it:
```bash
grep -r "@sentry/tracing" packages/frontend/src/
```

### Gap 4: console.log sprawl in critical backend files

32 `console.log/error/warn` calls in 3 key files bypass structured logging:

| File | Count | Impact |
|---|---|---|
| `packages/backend/src/shutdown.ts` | 17 | Shutdown events invisible to log aggregation |
| `packages/backend/src/cache/RedisAdapter.ts` | 14 | Cache failures invisible to log aggregation |
| `packages/backend/src/server.ts` | 1 | Startup event invisible |

Replace with the existing Winston logger:
```typescript
import { logger } from '../lib/logger';

// Before
console.log('🚀 Server started on port 3001');

// After
logger.info('Server started', { port: 3001 });
```

**Scope limit:** Only fix these 3 files (32 calls). The remaining ~412 console calls across 52 other files are a separate cleanup story.

### Gap 5: Unused Prometheus metric exports

**File:** `packages/backend/src/middleware/deployment-monitoring.ts`

`dbQueryDuration`, `dbConnectionsActive`, and `cacheOperations` metrics are defined and exported but never instrumented (no `.observe()` or `.inc()` calls anywhere in the codebase).

**Action:** Add a `// TODO: Wire into Supabase/Redis when instrumentation layer exists` comment to each. Do NOT delete them — they're ready-to-use when the instrumentation layer is built. This is a documentation fix, not a code fix.

## Acceptance Criteria

- [x] `docker-compose.dev.yml` backend health check uses `/health` (not `/api/health`)
- [x] `docker/prometheus/prometheus.yml` includes `sovren-api` scrape target
- [x] `@sentry/tracing` removed from `packages/frontend/package.json`
- [x] No imports reference `@sentry/tracing`
- [x] `shutdown.ts`, `RedisAdapter.ts`, `server.ts` use Winston logger instead of console.*
- [x] Unused metric exports have TODO comments
- [x] All existing tests pass (3043 pass, 241 pre-existing failures unchanged)
- [x] `docker compose -f docker-compose.dev.yml config` validates (warning: missing .env.development is pre-existing)

## Out of Scope

- Replacing remaining ~412 console.log calls across 52 other files (separate P3 story)
- Grafana dashboard provisioning (separate story)
- Alertmanager / PagerDuty / Slack alerting (v2.1)
- OpenTelemetry migration (v2.1)
- Wiring db/cache metrics into actual instrumentation points (separate story)

## References

- ADR-017: `docs/decisions/ADR-017-observability-stack.md`
- Infrastructure Sprint compound doc: `docs/solutions/infrastructure-issues/infrastructure-sprint-software-factory-first.md`
- Production Roadmap brainstorm: `docs/brainstorms/2026-02-25-production-roadmap-brainstorm.md` (Decision #10)
- Critical pattern #10b: Silent fallback must log (`docs/solutions/patterns/critical-patterns.md`)
