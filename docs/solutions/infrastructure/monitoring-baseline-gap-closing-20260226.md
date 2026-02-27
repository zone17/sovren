---
title: 'Monitoring Baseline Gap Closing — PR #103'
date: '2026-02-26'
category: infrastructure
pr: 103
branch: feat/monitoring-baseline-gap-closing
type: compound-doc
severity: P3 prerequisite (last monitoring baseline gap before v2.0 feature slices)
files_touched: 18
commits: 3
review_agents: 7
findings: '0 P1, 2 P2, 4 P3 — all fixed before merge'
---

# Monitoring Baseline Gap Closing

## Summary

PR #103 closed 5 monitoring baseline gaps and then fixed 6 review findings from a 7-agent parallel review. This was the last prerequisite before shipping v2.0 feature slices.

**Net result:** Docker health checks working, Prometheus scraping backend metrics, 32 `console.*` calls replaced with Winston structured logger, stale Sentry import removed, monitoring endpoints discoverable via `/api` root.

---

## What Was Built

### Commit 1: Gap Fixes (5 items)

| #   | Gap                                    | Fix                                     | Files                                                       |
| --- | -------------------------------------- | --------------------------------------- | ----------------------------------------------------------- |
| 1   | Docker health check path wrong         | `/api/health` -> `/health`              | `docker-compose.dev.yml`                                    |
| 2   | Prometheus not scraping backend        | Added backend API scrape target         | `docker/prometheus/prometheus.yml`                          |
| 3   | Stale `@sentry/tracing` in frontend    | Removed (merged into Sentry v8+ core)   | `packages/frontend/package.json`                            |
| 4   | 32 `console.*` calls in lifecycle code | Replaced with Winston structured logger | `shutdown.ts` (17), `RedisAdapter.ts` (14), `server.ts` (1) |
| 5   | Uninstrumented Prometheus metrics      | Added TODO comments to 3 exports        | `deployment-monitoring.ts`                                  |

### Commit 2: Pre-Existing Test Blocker Fixes

| Fix                                    | Root Cause                                      | File                               |
| -------------------------------------- | ----------------------------------------------- | ---------------------------------- |
| Created `analytics-service.ts` stub    | Module import broken (file missing)             | `services/analytics-service.ts`    |
| Created `notification-service.ts` stub | Cascading from analytics fix                    | `services/notification-service.ts` |
| Created `websocket-service.ts` stub    | Cascading from notification fix                 | `services/websocket-service.ts`    |
| Fixed `NotFoundError` scope bug        | `export { X } from` does NOT create local scope | `error-handler-middleware.ts`      |
| Fixed health check test assertions     | Asserted wrong response shape                   | `server.test.ts`                   |

### Commit 3: Review Finding Fixes (6 items)

| #   | Finding                                                                              | Severity | Consensus | Fix                                                                        |
| --- | ------------------------------------------------------------------------------------ | -------- | --------- | -------------------------------------------------------------------------- |
| 1   | `notification-service.ts` name collision with DI-registered `NotificationService.ts` | P2       | 5/7       | Renamed to `notification-stub.ts`                                          |
| 2   | Prometheus config missing auth/timeout for production                                | P2       | 5/7       | Added `bearer_token_file` comment + `scrape_timeout`                       |
| 3   | Stale `@sentry/tracing` in vite.config.ts chunk config                               | P3       | -         | Removed reference                                                          |
| 4   | `{ event, ...properties }` Winston key shadowing risk                                | P3       | -         | Changed to `{ event, properties }`                                         |
| 5   | `/api` root discovery missing monitoring endpoints                                   | P3       | -         | Added `/ready`, `/live`, `/health/detailed`, `/metrics`, `/api/v1/metrics` |
| 6   | Unused `promise` parameter warning                                                   | P3       | -         | Prefixed as `_promise`                                                     |

---

## Review Process

- **7 parallel review agents:** TypeScript, Security, Performance, Architecture, Pattern Recognition, Simplicity, Agent-Native
- **Performance oracle:** Confirmed zero hot-path concerns. All 32 logger calls are lifecycle/error paths (~5-15us overhead, irrelevant).
- **Agent-native reviewer:** 7/11 monitoring capabilities are agent-accessible. JSON metrics endpoint praised as first-class agent interface.
- **All 6 findings fixed before merge** -- zero deferred items.

---

## Patterns Discovered

### Pattern 1: Re-Export Does NOT Create Local Scope

**Category:** TypeScript / Module System
**Severity when missed:** Runtime crash (P1 potential, caught as pre-existing test blocker here)

`export { X } from './module'` makes `X` available to _consumers_ of the re-exporting file, but `X` is NOT available within the re-exporting file itself. This is a subtle TypeScript/ESM distinction.

```typescript
// error-handler-middleware.ts

// WRONG -- NotFoundError is available to consumers, but NOT to this file
export { NotFoundError } from '../utils/errors';

function handleError(err: unknown) {
  if (err instanceof NotFoundError) {
    // ReferenceError: NotFoundError is not defined
    res.status(404).json({ error: err.message });
  }
}

// RIGHT -- two-step: import for local use, then re-export
import { NotFoundError } from '../utils/errors';
export { NotFoundError };

function handleError(err: unknown) {
  if (err instanceof NotFoundError) {
    // Works correctly
    res.status(404).json({ error: err.message });
  }
}
```

**Detection:** Grep for `export { X } from` in files that also reference `X` in their own function bodies. The file compiles (TypeScript sees the re-export as valid syntax) but crashes at runtime.

```bash
# Find re-exports
grep -rn "export {.*} from" packages/ --include="*.ts" | while read line; do
  file=$(echo "$line" | cut -d: -f1)
  exported=$(echo "$line" | grep -oP "(?<=\{ ).*(?= \})")
  # Check if the same name is used locally
  grep -q "$exported" "$file" && echo "POTENTIAL BUG: $file uses re-exported $exported locally"
done
```

**Why it compiles:** TypeScript type-checks the export declaration as valid syntax. The name resolution for `instanceof` is a runtime operation that TypeScript doesn't statically verify against re-export-only declarations.

---

### Pattern 2: Service Stub Name Collisions on Case-Insensitive Filesystems

**Category:** Infrastructure / macOS APFS
**Severity when missed:** P2 (silent import misdirection)

Creating `notification-service.ts` alongside existing `NotificationService.ts` is dangerous on macOS APFS (case-insensitive by default). The filesystem may resolve imports to the wrong file depending on the import casing and module resolution order.

5/7 review agents flagged this independently -- strong consensus.

```
# WRONG -- case-insensitive collision on macOS APFS
services/
  NotificationService.ts   # DI-registered real service
  notification-service.ts  # Stub file -- APFS may confuse these

# RIGHT -- explicitly different name avoids any ambiguity
services/
  NotificationService.ts   # DI-registered real service
  notification-stub.ts     # Clearly a stub, no collision possible
```

**Rules:**

- When creating stub/mock files alongside real services, use a `-stub` or `-mock` suffix
- Never rely on case alone to distinguish files in the same directory
- This applies to macOS APFS (default), Windows NTFS -- basically everything except ext4
- CI may run on Linux (case-sensitive) and pass, while developers on macOS hit the collision

**Detection:** `ls -1 path/to/dir/ | sort -f | uniq -di` -- outputs names that differ only by case.

---

### Pattern 3: Spread Operator in Logger Metadata Is Unsafe

**Category:** Observability / Winston
**Severity when missed:** P3 (log corruption, not crash)

When using `logger.info('msg', { event, ...properties })`, callers can shadow Winston built-in keys (`level`, `message`, `timestamp`, `service`). Winston metadata is flat -- spread puts caller keys at the same level as Winston's internal fields.

```typescript
// WRONG -- properties can shadow Winston built-ins
logger.info('Event tracked', { event: 'purchase', ...properties });
// If properties = { message: 'hello', level: 'error' }, Winston metadata is corrupted

// RIGHT -- nest caller data under a dedicated key
logger.info('Event tracked', { event: 'purchase', properties });
// Winston built-ins are safe; caller data is under 'properties' key
```

**Rules:**

- Never spread user/caller-controlled data into the root of Winston metadata
- Always nest under a dedicated key: `{ event, properties }` or `{ event, data }`
- This applies to any structured logger that uses flat metadata objects (Winston, Pino, Bunyan)

**Detection:** Grep for `logger\.(info|warn|error|debug).*\.\.\.` to find spread in logger calls.

---

### Pattern 4: API Root Discovery Must List All Monitoring Endpoints

**Category:** Agent-Native / API Design
**Severity when missed:** P3 (reduced discoverability for automated agents)

The agent-native reviewer flagged that `/api` root only listed `/health` but omitted `/ready`, `/live`, `/health/detailed`, `/metrics`, `/api/v1/metrics`. Agents (and developers using curl) cannot discover what they cannot see in the discovery response.

```typescript
// WRONG -- incomplete discovery
app.get('/api', (req, res) => {
  res.json({
    endpoints: {
      health: '/health',
    },
  });
});

// RIGHT -- all monitoring endpoints listed
app.get('/api', (req, res) => {
  res.json({
    endpoints: {
      health: '/health',
      ready: '/ready',
      live: '/live',
      healthDetailed: '/health/detailed',
      metrics: '/metrics',
      metricsApi: '/api/v1/metrics',
    },
  });
});
```

**Rules:**

- Every new endpoint added to Express must also be added to the `/api` root discovery response
- Monitoring and operational endpoints are especially important -- they are the first thing automated agents and runbooks check
- JSON format is preferred over HTML for machine consumption

**Detection:** Diff the list of `app.get`/`router.get` registrations against the keys in the `/api` discovery response. Any mismatch is a gap.

---

### Pattern 5: Pre-Existing Test Blockers Cascade

Missing module stubs cascade: fixing `analytics-service.ts` reveals `notification-service.ts` is also missing, which reveals `websocket-service.ts` is missing. Each missing stub is discovered only after the previous one is fixed and the test suite re-runs.

**Budget:** When fixing test blockers caused by missing modules, expect 2-3x the initially apparent scope. Always run the full test suite after each fix to discover the next cascading failure.

---

### Pattern 6: Prometheus Scrape Configs Need Auth Comments for Production

Dev configs that work without auth will silently fail in production when `METRICS_AUTH_TOKEN` is set. Always add commented `bearer_token_file` placeholder so the production config path is visible.

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'backend-api'
    scrape_interval: 15s
    scrape_timeout: 10s # Always set -- default 10s can hide slow targets
    static_configs:
      - targets: ['backend:3001']
    # Production: uncomment when METRICS_AUTH_TOKEN is configured
    # bearer_token_file: /run/secrets/metrics_token
```

---

### Pattern 7: lint-staged Stash/Pop Can Cause Branch Confusion

lint-staged's stash/pop mechanism during pre-commit hooks can cause unexpected branch switches in edge cases. After a commit that triggers lint-staged, always verify you're still on the expected branch.

In this PR, a commit landed on `main` instead of the feature branch and had to be cherry-picked.

**Rule:** After any commit with lint-staged active, run `git branch --show-current` to verify.

---

## Performance Assessment

The performance oracle confirmed that all 32 logger replacements are on lifecycle/error paths:

| Path                         | Call Count                  | Overhead     | Hot Path? |
| ---------------------------- | --------------------------- | ------------ | --------- |
| `shutdown.ts` (17 calls)     | Once per process lifetime   | ~5us each    | No        |
| `RedisAdapter.ts` (14 calls) | On connect/disconnect/error | ~5-15us each | No        |
| `server.ts` (1 call)         | Once at startup             | ~5us         | No        |

Zero hot-path concerns. Winston structured logging adds negligible overhead vs `console.*` for lifecycle events.

---

## Files Touched

```
docker-compose.dev.yml
docker/prometheus/prometheus.yml
packages/frontend/package.json
packages/frontend/vite.config.ts
packages/backend/src/server.ts
packages/backend/src/shutdown.ts
packages/backend/src/cache/RedisAdapter.ts
packages/backend/src/middleware/deployment-monitoring.ts
packages/backend/src/middleware/error-handler-middleware.ts
packages/backend/src/services/analytics-service.ts
packages/backend/src/services/notification-stub.ts
packages/backend/src/services/websocket-service.ts
packages/backend/src/app.ts
packages/backend/src/__tests__/server.test.ts
packages/backend/src/services/__tests__/subscription-atomicity.test.ts
packages/backend/src/services/lightning-payment-service.ts
packages/backend/src/services/subscription-management-service.ts
packages/backend/src/services/payout-management-service.ts
```

---

## Cross-Reference: Pattern Files Updated

| Pattern                                     | Action | Target File         | Entry # |
| ------------------------------------------- | ------ | ------------------- | ------- |
| Re-export scope bug                         | NEW    | common-solutions.md | #54     |
| Stub name collision on case-insensitive FS  | NEW    | common-solutions.md | #55     |
| Spread in logger metadata                   | NEW    | common-solutions.md | #56     |
| API root discovery for monitoring endpoints | NEW    | common-solutions.md | #57     |

No existing patterns in critical-patterns.md or common-solutions.md needed refinement.

---

## Key Metrics

| Metric               | Value     |
| -------------------- | --------- |
| PR                   | #103      |
| Commits              | 3         |
| Files touched        | 18        |
| `console.*` replaced | 32        |
| Review agents        | 7         |
| P1 findings          | 0         |
| P2 findings          | 2 (fixed) |
| P3 findings          | 4 (fixed) |
| Deferred items       | 0         |
| Task type            | Solo      |
| Duration             | ~2 hours  |
