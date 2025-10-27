# Runbook: High Payment Failure Rate

**Alert**: `HighPaymentFailureRate`
**Severity**: CRITICAL
**Team**: Payments
**SLA**: 15 minutes to acknowledge, 1 hour to resolve

## Symptoms

Payment failure rate exceeds 5% over a 5-minute window. Users are experiencing failed payment attempts, impacting revenue and user experience.

## Impact

- **User Experience**: Users cannot complete payments, leading to frustration
- **Revenue**: Lost transactions directly impact business revenue
- **Reputation**: High failure rates damage platform credibility
- **SLA Risk**: Payment success rate SLO (95%) is breached

## Immediate Actions (First 5 Minutes)

1. **Acknowledge Alert**: Confirm you are investigating
   ```bash
   # Silence alert in AlertManager (if investigating)
   amtool alert add --alertmanager.url=http://localhost:9093
   ```

2. **Check Grafana Dashboard**:
   - Navigate to Payment Dashboard: http://grafana:3000/d/payments/payment-dashboard
   - Look for spike in failed payments (red bars)
   - Check P95 latency for sudden increases

3. **Verify Health Status**:
   ```bash
   curl http://payment-api:3000/health
   ```

## Investigation Steps

### Step 1: Identify Failure Pattern

Check recent payment failures:
```bash
# Query Prometheus for failure breakdown
curl -G 'http://prometheus:9090/api/v1/query' \
  --data-urlencode 'query=rate(payment_total{status="failed"}[5m])'

# Check Loki logs for payment errors
curl -G 'http://loki:3100/loki/api/v1/query' \
  --data-urlencode 'query={job="payment-api",level="error"}'
```

### Step 2: Check Lightning Node Connectivity

```bash
# Verify Lightning node health
curl http://payment-api:3000/health | jq '.components.lightning_node'

# If using LND:
lncli getinfo
lncli walletbalance
lncli channelbalance

# Check channel status
lncli listchannels
```

**Common Issues**:
- Lightning node offline → Restart node, check logs
- Insufficient channel capacity → Open new channels or rebalance
- Stuck HTLCs → Force-close problematic channels (last resort)

### Step 3: Check Database Connectivity

```bash
# Verify database health
curl http://payment-api:3000/health | jq '.components.database'

# Check database connections
psql -h postgres -U user -d payments -c "SELECT count(*) FROM pg_stat_activity;"

# Look for long-running queries
psql -h postgres -U user -d payments -c "
  SELECT pid, now() - query_start as duration, query
  FROM pg_stat_activity
  WHERE state = 'active'
  ORDER BY duration DESC
  LIMIT 10;
"
```

**Common Issues**:
- Database connection pool exhausted → Increase pool size or kill idle connections
- Slow queries → Add indexes, optimize queries
- Database deadlocks → Review transaction isolation levels

### Step 4: Check Payment Processor

```bash
# Check circuit breaker state
curl http://payment-api:3000/health | jq '.components.circuit_breaker'

# Check queue depth
curl http://payment-api:3000/metrics | grep active_payments_count
```

**Common Issues**:
- Circuit breaker open → Wait for cooldown, or manually reset if cause is resolved
- High queue depth → Scale payment processors, investigate bottlenecks
- Rate limiting → Check third-party API limits (Lightning service providers)

### Step 5: Review Recent Deployments

```bash
# Check recent code deployments
git log --since="1 hour ago" --oneline

# Check recent config changes
kubectl get configmap payment-api -o yaml | grep -A 10 "data:"

# Review container restarts
docker ps -a --filter "name=payment-api" --format "table {{.Status}}"
```

## Common Root Causes

| Cause | Symptoms | Solution |
|-------|----------|----------|
| Lightning node offline | All payments fail, health check unhealthy | Restart Lightning node, check network |
| Insufficient channel liquidity | Intermittent failures, high value payments fail | Rebalance channels, open new channels |
| Database connection issues | Timeouts, slow queries | Scale database, optimize queries, restart |
| Third-party API downtime | External payment failures | Switch to backup provider, enable circuit breaker |
| Network connectivity | Timeouts, connection refused | Check network, firewall rules, DNS |
| Code regression | Failures after deployment | Rollback deployment, fix bug |
| Rate limiting | Consistent rejection from provider | Request rate increase, implement backoff |

## Resolution Steps

### If Lightning Node Issue:
```bash
# Restart Lightning node (Docker)
docker restart sovren-lightning-node

# Monitor logs
docker logs -f sovren-lightning-node

# Verify recovery
lncli getinfo
```

### If Database Issue:
```bash
# Kill long-running queries
psql -h postgres -U user -d payments -c "
  SELECT pg_terminate_backend(pid)
  FROM pg_stat_activity
  WHERE state = 'active' AND now() - query_start > interval '5 minutes';
"

# Restart database connection pool
docker restart payment-api
```

### If Circuit Breaker Issue:
```bash
# Reset circuit breaker (if cause is resolved)
curl -X POST http://payment-api:3000/admin/circuit-breaker/reset

# Monitor recovery
watch -n 1 'curl -s http://payment-api:3000/health | jq .components.circuit_breaker'
```

## Verification

1. **Check Failure Rate**: Should drop below 5% within 5 minutes
   ```bash
   curl -G 'http://prometheus:9090/api/v1/query' \
     --data-urlencode 'query=payment_success_rate' | jq .
   ```

2. **Test Payment Flow**: Execute test payment
   ```bash
   curl -X POST http://payment-api:3000/api/payments/process \
     -H "Content-Type: application/json" \
     -H "Idempotency-Key: test-$(date +%s)" \
     -d '{"amount_sats": 100, "creator_id": "test"}'
   ```

3. **Monitor Dashboard**: Watch Grafana for 10 minutes to ensure stability

## Escalation

If issue persists after 30 minutes:

1. **Escalate to Senior Engineer**: Page on-call senior engineer
2. **Notify Stakeholders**: Inform product team of payment outage
3. **Enable Maintenance Mode** (if necessary): Display user-facing error message
4. **Emergency Rollback**: If recent deployment caused issue, rollback immediately

## Post-Incident

1. **Create Incident Report**: Document timeline, root cause, resolution
2. **Review Logs**: Extract relevant logs for analysis
3. **Update Runbook**: Add new learnings
4. **Improve Monitoring**: Add alerts for early detection of root cause
5. **Schedule Post-Mortem**: Blameless review within 48 hours

## Related Alerts

- `LightningNodeDown` - Often precedes payment failures
- `DatabaseConnectionFailed` - Can cause payment failures
- `CircuitBreakerOpen` - Indicates repeated failures
- `SlowPaymentProcessing` - May indicate underlying issues

## Useful Commands

```bash
# Get payment failure breakdown by error code
curl -G 'http://loki:3100/loki/api/v1/query' \
  --data-urlencode 'query={job="payment-api",level="error",status="failed"} | json | line_format "{{.error_code}}"' \
  | jq -r '.data.result[].values[][1]' | sort | uniq -c | sort -rn

# Get Lightning node channel status
lncli listchannels | jq '.channels[] | {alias: .alias, capacity: .capacity, local_balance: .local_balance, remote_balance: .remote_balance}'

# Check recent payment processing times
curl -G 'http://prometheus:9090/api/v1/query' \
  --data-urlencode 'query=histogram_quantile(0.95, rate(payment_duration_seconds_bucket[5m]))'
```

## Prevention

- Monitor channel liquidity proactively
- Set up automated channel rebalancing
- Implement retry logic with exponential backoff
- Use circuit breakers for third-party dependencies
- Regular load testing to identify bottlenecks
- Implement canary deployments for code changes

## References

- [Payment Analytics Dashboard](http://grafana:3000/d/payments)
- [Lightning Network Documentation](https://docs.lightning.engineering/)
- [Payment API Architecture](/docs/ARCHITECTURE.md)
- [Incident Response Plan](/docs/incident-response.md)
