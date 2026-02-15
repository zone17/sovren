# Runbook: SLOHighLatencyP99 / SLOHighLatencyP95

## Alert

- **SLOHighLatencyP99** (critical): P99 latency exceeds 500ms for 5 minutes
- **SLOHighLatencyP95** (warning): P95 latency exceeds 250ms for 5 minutes

## Symptoms

- Users report slow page loads or API responses
- Dashboard shows latency spike

## Investigation Steps

1. **Identify slow routes**:

   ```promql
   topk(10,
     histogram_quantile(0.99,
       sum by (route, le) (rate(sovren_http_request_duration_seconds_bucket[5m]))
     )
   )
   ```

2. **Check database query latency**:

   ```promql
   histogram_quantile(0.95, sum by (operation, le) (rate(sovren_db_query_duration_seconds_bucket[5m])))
   ```

3. **Check event loop lag**:

   ```promql
   sovren_nodejs_eventloop_lag_seconds
   ```

4. **Check memory pressure**:

   ```promql
   sovren_nodejs_heap_size_used_bytes / sovren_nodejs_heap_size_total_bytes
   ```

5. **Check CPU and system load**:
   ```promql
   100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)
   ```

## Common Causes

| Cause                         | Fix                            |
| ----------------------------- | ------------------------------ |
| Slow database queries         | Add indexes, optimize queries  |
| High memory causing GC pauses | Restart, investigate leak      |
| CPU saturation                | Scale horizontally             |
| External service latency      | Add timeouts, circuit breakers |
| Event loop blocking           | Find and fix sync operations   |

## Escalation

- **5 minutes**: On-call investigates
- **15 minutes**: Escalate to backend team lead
