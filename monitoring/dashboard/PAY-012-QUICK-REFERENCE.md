# PAY-012 Quick Reference Guide

**Payment Analytics Dashboards - Quick Start & Commands**

---

## One-Line Deploy

```bash
cd /Users/fp/Desktop/Sovren/monitoring/dashboard/grafana && docker-compose -f docker-compose.grafana.yml up -d
```

---

## Access URLs

- **Grafana**: http://localhost:3001 (admin/admin)
- **Prometheus**: http://localhost:9090
- **AlertManager**: http://localhost:9093
- **Node Exporter**: http://localhost:9100

---

## Common Commands

### Start Stack
```bash
docker-compose -f docker-compose.grafana.yml up -d
```

### Stop Stack
```bash
docker-compose -f docker-compose.grafana.yml down
```

### View Logs
```bash
docker-compose -f docker-compose.grafana.yml logs -f grafana
docker-compose -f docker-compose.grafana.yml logs -f prometheus
```

### Restart Service
```bash
docker-compose -f docker-compose.grafana.yml restart grafana
```

### Check Status
```bash
docker-compose -f docker-compose.grafana.yml ps
```

---

## Quick Checks

### Verify Metrics
```bash
curl http://localhost:3000/metrics | head -20
```

### Check Prometheus Targets
```bash
curl http://localhost:9090/api/v1/targets | jq '.data.activeTargets[].health'
```

### List Alert Rules
```bash
curl http://localhost:9090/api/v1/rules | jq '.data.groups[].rules[].name'
```

---

## Dashboard Navigation

1. Login to Grafana: http://localhost:3001
2. Click "Dashboards" → "Browse"
3. Open "Payment Analytics" folder
4. Select dashboard:
   - **Business Metrics**: Revenue, success rates, top creators
   - **Technical Metrics**: Latency, errors, system health

---

## Alert Configuration

Edit `.env` file:
```bash
SLACK_WEBHOOK_URL_CRITICAL=https://hooks.slack.com/services/YOUR/WEBHOOK
ONCALL_EMAIL_ADDRESSES=oncall@sovren.app
PAGERDUTY_INTEGRATION_KEY=your-key
```

Restart Grafana:
```bash
docker-compose -f docker-compose.grafana.yml restart grafana
```

---

## Key Metrics

- `payment_total` - Total payments
- `payment_success_rate` - Success rate (0.0-1.0)
- `payment_volume_sats_total` - Total volume (sats)
- `active_payments_count` - Active payments
- `payment_duration_ms_bucket` - Latency histogram

---

## Alert Thresholds

| Alert | Threshold | Severity |
|-------|-----------|----------|
| LowPaymentSuccessRate | < 95% | Critical |
| HighPaymentLatencyP95 | > 2s | Critical |
| DegradedSuccessRate | < 98% | Warning |
| ElevatedLatencyP95 | > 1s | Warning |

---

## Troubleshooting

**No data in dashboard?**
1. Check Prometheus targets: http://localhost:9090/targets
2. Verify backend metrics: `curl http://localhost:3000/metrics`

**Alerts not firing?**
1. Check alert rules: http://localhost:9090/alerts
2. Verify thresholds match your data

**Can't access Grafana?**
1. Check container running: `docker ps | grep grafana`
2. View logs: `docker logs sovren-grafana`

---

## File Locations

- Dashboards: `/grafana/dashboards/*.json`
- Alerts: `/grafana/alerts/payment-alert-rules.yml`
- Prometheus config: `/grafana/config/prometheus.yml`
- Env vars: `/grafana/.env`

---

## Full Documentation

- Complete guide: `/grafana/README.md`
- Examples: `/grafana/DASHBOARD_EXAMPLES.md`
- Completion summary: `/PAY-012-IMPLEMENTATION-COMPLETE.md`

---

**Status**: ✅ READY FOR PRODUCTION
**Cost**: $0/month (100% FREE)
