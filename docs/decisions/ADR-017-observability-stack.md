# ADR-017: Observability Stack -- prom-client, Sentry SDKs, AsyncLocalStorage Correlation

**Date**: 2026-02-12
**Status**: Accepted
**Epic**: Infrastructure Sprint - US-E0-010 Observability Pipeline
**Related ADRs**: [ADR-013 (Redis Caching)](./ADR-013-redis-caching.md), [ADR-014 (Circuit Breaker)](./ADR-014-circuit-breaker-pattern.md)

## Context

Sovren's observability layer was built with **simulation code** during rapid prototyping. Specifically:

- **Sentry**: Both frontend and backend had hand-rolled mock objects (`captureException()` calls that `console.error`'d) instead of real SDK integrations. No errors were reaching an actual error-tracking service.
- **Prometheus metrics**: The backend used a hand-rolled in-memory counter/histogram implementation that could not be scraped by a real Prometheus instance and produced non-standard output.
- **Health checks**: The `/health/detailed` endpoint used `Math.random()` to simulate service availability, providing no real signal about database, Redis, or external service health.
- **Logging**: Logs were unstructured `console.log` calls with no correlation between requests, making it impossible to trace a single user request across log entries.
- **Web Vitals**: The frontend had no Core Web Vitals collection or reporting.

For production readiness, we needed to replace all simulations with real, industry-standard observability tooling that could be operated on free/open-source tiers.

## Decision

We adopted the following production observability stack:

### 1. Metrics: prom-client (Prometheus Node.js Client)

**File**: `packages/backend/src/middleware/deployment-monitoring.ts`

- **prom-client** is the official Prometheus client for Node.js
- Exposes metrics at `/metrics` in standard Prometheus exposition format
- Custom metrics registered:
  - `sovren_http_requests_total` (Counter) -- total HTTP requests by method/route/status
  - `sovren_http_request_duration_seconds` (Histogram) -- latency distribution with P50/P95/P99 buckets
  - `sovren_http_active_connections` (Gauge) -- concurrent connections
  - `sovren_http_request_errors_total` (Counter) -- 4xx/5xx error count
  - `sovren_db_query_duration_seconds` (Histogram) -- database query latency
  - `sovren_cache_operations_total` (Counter) -- cache hit/miss rates
  - `sovren_queue_jobs_total` / `sovren_queue_job_duration_seconds` / `sovren_queue_depth` -- BullMQ job metrics
- **Default Node.js metrics** collected via `collectDefaultMetrics()` with `sovren_` prefix (memory, CPU, event loop lag, GC)
- **Route normalization**: Dynamic path segments (UUIDs, numeric IDs, hex pubkeys) replaced with placeholders to prevent high-cardinality label explosion

### 2. Error Tracking: @sentry/node + @sentry/react

**Files**: `packages/backend/src/lib/sentry.ts`, `packages/frontend/src/monitoring/sentry.ts`

- **Backend**: `@sentry/node` with `httpIntegration()` and `expressIntegration()` for automatic request context capture
- **Frontend**: `@sentry/react` with `browserTracingIntegration()` and `replayIntegration()` for session replay on errors
- Both SDKs configured for **Sentry free tier budget awareness**:
  - `tracesSampleRate: 0.1` (10% of transactions sampled)
  - `replaysSessionSampleRate: 0` (no proactive session recording)
  - `replaysOnErrorSampleRate: 1.0` (record session on error for debugging)
- **Data sanitization**: `beforeSend` hooks strip `authorization`, `cookie`, `x-api-key` headers and redact fields containing `password`, `token`, `secret`, `private_key`, `nsec`
- **Breadcrumb sanitization**: URLs containing tokens/keys in query parameters are redacted
- **Graceful degradation**: If `SENTRY_DSN` is not configured, initialization is skipped with a log message (no runtime errors)

### 3. Structured Logging: Winston + AsyncLocalStorage Correlation IDs

**Files**: `packages/backend/src/lib/logger.ts`, `packages/backend/src/middleware/correlation-id.ts`

- **Winston** logger with JSON format for Loki/Promtail ingestion
- **Correlation ID middleware** uses Node.js `AsyncLocalStorage` to propagate a unique request ID through the entire async call chain without manual parameter threading
- Incoming `X-Correlation-ID` or `X-Request-ID` headers are reused (for upstream tracing); otherwise a UUID is generated
- Every log entry automatically includes: `correlationId`, `requestMethod`, `requestPath`, `timestamp`, `service`, `environment`
- **Sensitive data sanitization**: Winston format automatically redacts fields matching common secret patterns
- Development mode uses colorized human-readable format; production uses JSON

### 4. Real Health Checks

**File**: `packages/backend/src/routes/health.ts`

- `/health` -- lightweight liveness (memory usage, uptime)
- `/ready` -- readiness probe: actually pings Supabase (database) and Redis
- `/live` -- simple process-alive check
- `/health/detailed` -- comprehensive check including database, Redis, Lightning (LNbits), and NOSTR relay connectivity with measured response times and degraded/unhealthy status determination

### 5. Frontend Web Vitals

**File**: `packages/frontend/src/monitoring/web-vitals.ts`

- Collects all Core Web Vitals via the `web-vitals` library: LCP, FID, CLS, TTFB, INP
- Ratings calculated against Google's thresholds (good/needs-improvement/poor)
- All measurements recorded as Sentry breadcrumbs for debugging context
- Only **poor** vitals are reported as Sentry messages to stay within free tier event budget
- Dynamically imported to avoid blocking the critical rendering path

## Consequences

### Positive

- **Production-grade observability**: Real metrics, real error tracking, real health checks -- no more simulations
- **Free tier compatible**: All tools (Prometheus, Sentry free tier, Grafana OSS, Loki, Winston) are free or open source
- **Correlation tracing**: A single `correlationId` links all log entries, metrics, and Sentry events for a given request, enabling rapid incident investigation
- **Scraped by real Prometheus**: The `/metrics` endpoint outputs standard exposition format that any Prometheus instance can scrape
- **Budget-conscious**: Aggressive sampling rates (10% traces, 0% proactive replays, poor-vitals-only Web Vital events) keep within Sentry's free tier

### Negative

- **Multiple SDK dependencies**: `@sentry/node`, `@sentry/react`, `prom-client`, `winston`, and `web-vitals` add to the dependency footprint. Each requires security patching and version management.
- **AsyncLocalStorage overhead**: There is a small (~2-5%) performance overhead from wrapping every request in `AsyncLocalStorage.run()`. This is negligible for our workload but should be monitored.
- **Sampling trade-off**: 10% trace sampling means 90% of transactions are invisible to Sentry's performance tab. If a performance issue affects only certain routes under specific conditions, it may not be captured. Acceptable for MVP; can increase sampling as budget allows.

### Neutral

- This stack is standard across the Node.js ecosystem and well-documented. New developers will find familiar patterns.
- The health check endpoints follow Kubernetes probe conventions (`/ready`, `/live`, `/health`), preparing for future container orchestration.

## Alternatives Considered

### OpenTelemetry (OTel) Instead of prom-client

OpenTelemetry provides vendor-neutral telemetry but adds significant complexity (collector deployment, protocol configuration, SDK setup). prom-client is simpler, purpose-built for Prometheus, and directly serves the `/metrics` endpoint without an intermediary collector. OTel may be adopted in the future if we need multi-backend trace propagation.

### Datadog / New Relic Instead of Sentry + Prometheus

Both are excellent but require paid tiers for production use. Sentry's free tier (5K errors/month, 10K transactions/month) and self-hosted Prometheus/Grafana meet our needs at zero cost.

### Pino Instead of Winston

Pino offers ~5x faster JSON logging than Winston. We chose Winston because it was already partially integrated in the codebase and its format pipeline (custom formats for correlation ID injection and sanitization) is more ergonomic. If logging throughput becomes a bottleneck, Pino migration is straightforward.
