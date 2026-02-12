# Runbook: SLOHighErrorRate

## Alert

**SLOHighErrorRate** fires when the API error rate (4xx + 5xx) exceeds 1% over a
5-minute window for 5 consecutive minutes.

## Symptoms

- Users report failed API calls
- Dashboard shows error rate spike
- Sentry error volume increases

## Impact

- Degraded user experience
- Failed payments or content operations
- SLO error budget consumption

## Investigation Steps

1. **Check which routes are failing**:

   ```promql
   topk(10, sum by (route, status_code) (rate(sovren_http_request_errors_total[5m])))
   ```

2. **Check if 5xx or 4xx**:

   - 5xx: Server-side issue (check logs, database, external services)
   - 4xx: Client-side issue (may be a bad deploy, changed API contract)

3. **Check logs in Grafana/Loki**:

   ```logql
   {service="sovren-api", level="error"} | json
   ```

4. **Correlate with recent deploys**:

   - Check recent GitHub Actions deployments
   - Check if error rate started after a deploy

5. **Check infrastructure**:
   - Database connectivity: `sovren_db_connections_active`
   - Redis connectivity: Check Redis exporter metrics
   - Memory pressure: `sovren_nodejs_heap_size_used_bytes`

## Common Causes

| Cause                 | Fix                                                   |
| --------------------- | ----------------------------------------------------- |
| Bad deploy            | Rollback via `gh workflow run automated-rollback.yml` |
| Database overload     | Scale database, check slow queries                    |
| External service down | Check Lightning/NOSTR service status                  |
| Memory exhaustion     | Restart pods, investigate memory leak                 |

## Escalation

- **5 minutes**: On-call engineer investigates
- **15 minutes**: If not resolved, escalate to backend team lead
- **30 minutes**: If not resolved, trigger rollback
