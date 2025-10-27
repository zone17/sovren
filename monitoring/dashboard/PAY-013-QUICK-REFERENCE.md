# PAY-013 Quick Reference Guide

**Payment System Monitoring - Essential Commands**

---

## Quick Start

```bash
# Start monitoring stack
docker-compose -f docker-compose.monitoring.yml up -d

# Check status
docker-compose -f docker-compose.monitoring.yml ps

# View logs
docker-compose -f docker-compose.monitoring.yml logs -f prometheus
```

**Access Points**:
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3001 (admin/admin)
- AlertManager: http://localhost:9093

---

## Health Checks

### Check System Health
```bash
curl http://payment-api:3000/health | jq .
```

### Check Specific Component
```bash
curl http://payment-api:3000/health | jq '.components.lightning_node'
curl http://payment-api:3000/health | jq '.components.database'
```

### Get Health Metrics
```bash
curl http://payment-api:3000/health/metrics
```

---

## Prometheus Queries

### Payment Metrics

```promql
# Current success rate
payment_success_rate

# Payment rate (last 5 minutes)
rate(payment_total[5m])

# Failure rate
rate(payment_total{status="failed"}[5m])

# P95 payment duration
histogram_quantile(0.95, rate(payment_duration_seconds_bucket[5m]))

# Active payments
active_payments_count
```

### System Metrics

```promql
# CPU usage
100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)

# Memory usage
(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100

# Disk usage
(1 - (node_filesystem_avail_bytes / node_filesystem_size_bytes)) * 100
```

### Health Checks

```promql
# All component health
health_check_status

# Unhealthy components
health_check_status < 0.5

# Check latency
health_check_latency_seconds
```

---

## Alert Commands

### List Active Alerts
```bash
curl http://localhost:9093/api/v2/alerts | jq .
```

### Silence Alert
```bash
amtool silence add \
  alertname=HighPaymentFailureRate \
  --duration=1h \
  --comment="Investigating issue"
```

### View Alert History
```bash
curl http://localhost:9093/api/v2/alerts/groups | jq .
```

---

## Loki Log Queries

### Recent Payment Errors
```logql
{job="payment-api",level="error"} |= "payment"
```

### Failed Payments
```logql
{job="payment-api"} | json | status="failed"
```

### Lightning Node Logs
```logql
{job="lightning-node"} | json | level="error"
```

### Database Slow Queries
```logql
{job="postgres"} |= "slow query"
```

---

## Common Troubleshooting

### Payment Failures

```bash
# Check failure rate
curl -G 'http://prometheus:9090/api/v1/query' \
  --data-urlencode 'query=payment_success_rate'

# Get error logs
curl -G 'http://loki:3100/loki/api/v1/query' \
  --data-urlencode 'query={job="payment-api",level="error"}'

# Check Lightning node
lncli getinfo
lncli listchannels
```

### Database Issues

```sql
-- Active connections
SELECT count(*) FROM pg_stat_activity;

-- Slow queries
SELECT pid, now() - query_start as duration, query
FROM pg_stat_activity
WHERE state = 'active'
ORDER BY duration DESC
LIMIT 5;

-- Kill slow query
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE pid = 12345;
```

### Lightning Node Down

```bash
# Check container
docker ps | grep lightning

# View logs
docker logs sovren-lightning-node --tail 100

# Restart node
docker restart sovren-lightning-node

# Verify recovery
lncli getinfo
```

---

## Alert Severity Guide

| Severity | Response Time | Escalation |
|----------|---------------|------------|
| Critical | 5-15 min | PagerDuty + Slack + Email |
| Warning | 30 min - 2 hours | Slack + Email |
| Info | Next business day | Email only |

---

## Runbook Index

| Alert | Runbook | SLA |
|-------|---------|-----|
| HighPaymentFailureRate | [Link](/docs/runbooks/high-payment-failure-rate.md) | 15 min |
| LightningNodeDown | [Link](/docs/runbooks/lightning-node-down.md) | 5 min |
| DatabaseSlowQueries | [Link](/docs/runbooks/database-slow-queries.md) | 30 min |

---

## Emergency Contacts

- **Payment Team**: #payments-critical (Slack)
- **Infrastructure Team**: #infrastructure-alerts (Slack)
- **On-Call Engineer**: PagerDuty escalation
- **Database Admin**: database@sovren.com

---

## File Locations

```
/Users/fp/Desktop/Sovren/monitoring/dashboard/
├── backend/
│   ├── services/
│   │   ├── HealthCheckService.ts
│   │   └── PrometheusExporter.ts
│   └── __tests__/
│       ├── health-check.test.ts
│       └── prometheus-exporter.test.ts
├── config/
│   ├── prometheus.yml
│   ├── alert-rules.yml
│   ├── alertmanager.yml
│   ├── loki-config.yml
│   └── promtail-config.yml
├── docs/runbooks/
│   ├── high-payment-failure-rate.md
│   ├── lightning-node-down.md
│   └── database-slow-queries.md
└── docker-compose.monitoring.yml
```

---

## Testing

```bash
# Run health check tests
npm test backend/__tests__/health-check.test.ts

# Run Prometheus exporter tests
npm test backend/__tests__/prometheus-exporter.test.ts

# Run all monitoring tests
npm test backend/__tests__/health-check.test.ts backend/__tests__/prometheus-exporter.test.ts
```

---

## Maintenance Commands

### Restart Monitoring Stack
```bash
docker-compose -f docker-compose.monitoring.yml restart
```

### View Service Logs
```bash
docker-compose -f docker-compose.monitoring.yml logs -f <service>
# Services: prometheus, alertmanager, grafana, loki, promtail
```

### Clear Prometheus Data
```bash
docker-compose -f docker-compose.monitoring.yml down -v
docker-compose -f docker-compose.monitoring.yml up -d
```

### Reload Prometheus Config
```bash
curl -X POST http://localhost:9090/-/reload
```

### Reload AlertManager Config
```bash
curl -X POST http://localhost:9093/-/reload
```

---

## Metrics Endpoints

| Service | Metrics URL | Port |
|---------|-------------|------|
| Payment API | http://payment-api:3000/metrics | 3000 |
| Prometheus | http://prometheus:9090/metrics | 9090 |
| Node Exporter | http://node-exporter:9100/metrics | 9100 |
| PostgreSQL | http://postgres-exporter:9187/metrics | 9187 |
| Redis | http://redis-exporter:9121/metrics | 9121 |

---

**Last Updated**: 2024-10-25
**Story**: PAY-013
**Status**: Production Ready
