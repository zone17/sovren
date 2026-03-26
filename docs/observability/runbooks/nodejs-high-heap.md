# Runbook: NodeJS High Heap Usage

## Alert

- **NodeJSHighHeapUsage** (warning): Node.js heap used exceeds 80% of heap total for 5 minutes
- **NodeJSCriticalHeapUsage** (critical): Node.js heap used exceeds 95% of heap total for 5 minutes

## Symptoms

- Prometheus alert fires on `sovren_nodejs_heap_used_bytes / sovren_nodejs_heap_total_bytes > 0.80`
- API response times increasing (GC pauses)
- Container memory usage climbing steadily without plateau
- OOMKilled events in container logs
- `process.memoryUsage()` shows `heapUsed` near `heapTotal`

## Investigation Steps

### 1. Check current heap snapshot via process.memoryUsage()

Connect to the running process or add a temporary `/debug/memory` endpoint:

```javascript
const mem = process.memoryUsage();
console.log({
  heapUsed: (mem.heapUsed / 1024 / 1024).toFixed(2) + ' MB',
  heapTotal: (mem.heapTotal / 1024 / 1024).toFixed(2) + ' MB',
  rss: (mem.rss / 1024 / 1024).toFixed(2) + ' MB',
  external: (mem.external / 1024 / 1024).toFixed(2) + ' MB',
  arrayBuffers: (mem.arrayBuffers / 1024 / 1024).toFixed(2) + ' MB',
});
```

### 2. Check Prometheus metrics for trend

```promql
# Heap usage percentage over time
rate(sovren_nodejs_heap_used_bytes[5m]) /
rate(sovren_nodejs_heap_total_bytes[5m])

# GC pause duration (indicates memory pressure)
rate(sovren_nodejs_gc_duration_seconds_sum[5m])
```

### 3. Identify whether heap is growing monotonically

```promql
# Heap used over last 30 minutes — flat = GC working, rising = leak
sovren_nodejs_heap_used_bytes[30m]
```

### 4. Check for unbounded in-memory caches

Search the codebase for `Map`, `Set`, or custom cache objects that grow without eviction:

```bash
grep -r "new Map\|new Set\|TTLCache\|LRUCache" packages/backend/src/
```

Verify TTL-based caches have a `maxSize` or `ttl` configured.

### 5. Check for event listener accumulation

```javascript
// Check for listener leaks
process.eventNames().forEach(event => {
  const count = process.listenerCount(event);
  if (count > 10) console.warn(`High listener count on '${event}': ${count}`);
});
```

## Common Causes

| Cause | Symptom | Fix |
|-------|---------|-----|
| Memory leak in request handler | Heap grows per request, never GC'd | Profile with `--heap-prof`, find retained closures |
| Unbounded cache (Map/Set) | Heap grows monotonically, no GC relief | Add `maxSize` or switch to `TTLCache` with eviction |
| Large JSONB objects in memory | Spike on specific routes | Stream response, avoid full parse in memory |
| Circular references in objects | Old generation heap growing | Use `WeakRef` or `WeakMap` for back-references |
| Redis/DB connection pool leaking | RSS growing, heap stable | Check pool `max` setting, add connection timeout |
| Event emitter listener leak | Heap grows on reconnects | Always call `removeListener` / use `once()` |

## Remediation

### Immediate (< 5 min)

1. **Rolling restart** — clears in-memory state without downtime:
   ```bash
   kubectl rollout restart deployment/sovren-backend
   # or for Docker:
   docker restart sovren-backend
   ```

2. **Increase heap limit** (buys time only — not a fix):
   ```bash
   NODE_OPTIONS="--max-old-space-size=2048" node dist/index.js
   ```

### Short-term (same day)

3. **Heap snapshot** — capture before restart to diagnose:
   ```bash
   kill -USR2 <pid>  # if heapdump is installed
   # or use clinic.js
   npx clinic heapprofiler -- node dist/index.js
   ```

4. **Identify leaking module** — bisect by disabling background jobs or middleware

### Long-term

5. Add `maxSize` eviction to all in-memory caches
6. Add a `/health/memory` endpoint that returns `503` when `heapUsed/heapTotal > 0.95`
7. Set a container memory limit and enable automatic restart on OOMKill

## Escalation

- If heap does not stabilize after rolling restart → P1, page on-call engineer
- If OOMKill repeats > 3 times in 1 hour → increase container memory limit as emergency measure and open investigation ticket
