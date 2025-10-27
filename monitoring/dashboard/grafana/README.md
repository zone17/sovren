# Sovren Payment Analytics - Grafana Dashboards

**PAY-012: Payment Analytics Dashboards Implementation**

Production-grade Grafana dashboards for comprehensive payment system monitoring with business and technical metrics, automated alerting, and FREE open-source infrastructure.

---

## Overview

This implementation provides complete observability for the Sovren Lightning payment system using:

- **Grafana** - Visualization and dashboarding (FREE, open-source)
- **Prometheus** - Metrics collection and storage (FREE, open-source)
- **AlertManager** - Alert routing and management (FREE, open-source)
- **Node Exporter** - System metrics (FREE, open-source)

**Zero cost. Production-ready. Elite engineering.**

---

## Dashboards Included

### 1. Business Metrics Dashboard (`payment-business-dashboard.json`)

**Purpose**: Monitor business KPIs and revenue metrics

**Panels**:
- Total Payments Processed (stat)
- Payment Success Rate (stat with thresholds)
- Total Volume in Sats & BTC (stats)
- Payment Rate per Minute (time series)
- Payment Volume Rate per Minute (time series)
- Success vs Failure Rate Over Time (time series)
- Top 10 Creators by Payment Count (table)
- Payment Amount Distribution Heatmap
- Payment Status Distribution (pie chart)
- Active Payments Real-Time (gauge)

**Use Cases**:
- Daily revenue monitoring
- Business performance tracking
- Creator analytics
- Success rate trends
- Payment volume analysis

### 2. Technical Metrics Dashboard (`payment-technical-dashboard.json`)

**Purpose**: Monitor system health and performance

**Panels**:
- System Health Status (stat)
- P95 Latency (stat with thresholds)
- Total Errors (stat)
- Active Payments (stat)
- Payment Processing Latency P50/P95/P99 (time series)
- Error Rate per Second (time series)
- Latency Distribution Heatmap
- Success vs Failures 1-minute Buckets (bars)
- HTTP Request Rate (time series)
- HTTP Status Code Distribution (time series)
- HTTP Performance Metrics (table)

**Use Cases**:
- SRE on-call monitoring
- Performance optimization
- Incident response
- Capacity planning
- Error tracking

---

## Alert Rules

All alert rules are defined in `alerts/payment-alert-rules.yml` and follow the SRE best practice of **actionable, severity-based alerting**.

### Critical Alerts (Page On-Call)

| Alert | Threshold | Duration | Action Required |
|-------|-----------|----------|-----------------|
| **LowPaymentSuccessRate** | Success rate < 95% | 5 minutes | Immediate investigation - users affected |
| **ZeroPaymentVolume** | No payments for 15 min (business hours) | 15 minutes | Check if payment system is down |
| **HighPaymentLatencyP95** | P95 latency > 2 seconds | 5 minutes | Performance degradation - investigate bottleneck |

### Warning Alerts (Slack Only)

| Alert | Threshold | Duration | Action Required |
|-------|-----------|----------|-----------------|
| **DegradedPaymentSuccessRate** | Success rate < 98% | 10 minutes | Monitor closely, prepare for potential incident |
| **ElevatedPaymentLatencyP95** | P95 latency > 1 second | 10 minutes | Performance degrading, investigate proactively |
| **HighPaymentLatencyP99** | P99 latency > 5 seconds | 10 minutes | Some users experiencing delays |
| **HighActivePaymentCount** | Active payments > 50 | 15 minutes | Queue backup, check processing capacity |
| **PaymentErrorRateSpike** | Error rate > 0.1/sec | 5 minutes | Error spike detected, check logs |

### Info Alerts (Informational)

| Alert | Threshold | Duration | Action Required |
|-------|-----------|----------|-----------------|
| **LowPaymentVolume** | Payment rate < 0.1/sec | 1 hour | Normal variance or real issue? Investigate if unusual |
| **AnomalousAveragePaymentAmount** | Avg amount change > 50% | 30 minutes | May indicate fraud or promotional activity |

---

## Quick Start

### Prerequisites

- Docker and Docker Compose installed
- Payment analytics backend running (PAY-011)
- Environment variables configured (optional)

### 1. Start Monitoring Stack

```bash
cd /Users/fp/Desktop/Sovren/monitoring/dashboard/grafana

# Copy environment template
cp .env.example .env

# Edit .env with your credentials (optional)
vim .env

# Start all services
docker-compose -f docker-compose.grafana.yml up -d

# Check status
docker-compose -f docker-compose.grafana.yml ps
```

### 2. Access Dashboards

- **Grafana**: http://localhost:3001
  - Username: `admin` (default)
  - Password: `admin` (default, change on first login)

- **Prometheus**: http://localhost:9090
- **AlertManager**: http://localhost:9093

### 3. Import Dashboards

Dashboards are **automatically imported** via provisioning. Navigate to:

1. Grafana → Dashboards → Browse
2. Find "Payment Analytics" folder
3. Open "Sovren Payment Analytics - Business Metrics"
4. Open "Sovren Payment Analytics - Technical Metrics"

### 4. Configure Alert Notifications

Edit `.env` to add your notification channels:

```bash
# Slack webhooks
SLACK_WEBHOOK_URL_CRITICAL=https://hooks.slack.com/services/YOUR/CRITICAL/WEBHOOK
SLACK_WEBHOOK_URL_WARNING=https://hooks.slack.com/services/YOUR/WARNING/WEBHOOK

# Email
ONCALL_EMAIL_ADDRESSES=oncall@sovren.app,sre-team@sovren.app

# PagerDuty
PAGERDUTY_INTEGRATION_KEY=your-pagerduty-integration-key
```

Restart Grafana to apply:
```bash
docker-compose -f docker-compose.grafana.yml restart grafana
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Sovren Payment System                   │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Payment Analytics Backend (PAY-011)               │    │
│  │  - Express API                                     │    │
│  │  - Prometheus Middleware                           │    │
│  │  - Exposes /metrics endpoint                       │    │
│  └────────────┬───────────────────────────────────────┘    │
└───────────────┼──────────────────────────────────────────────┘
                │
                │ HTTP GET /metrics (scrape every 30s)
                ▼
       ┌────────────────────┐
       │   Prometheus       │
       │  - Scrapes metrics │
       │  - Stores TSDB     │
       │  - Evaluates rules │
       └────────┬───────────┘
                │
                ├─────────────────┬──────────────────┐
                │                 │                  │
                ▼                 ▼                  ▼
       ┌────────────────┐  ┌─────────────┐  ┌──────────────┐
       │   Grafana      │  │ AlertManager│  │ Node Exporter│
       │  - Dashboards  │  │ - Routing   │  │ - System     │
       │  - Alerting    │  │ - Dedupe    │  │   Metrics    │
       │  - Queries     │  │ - Notif.    │  │ - CPU/Memory │
       └────────────────┘  └─────┬───────┘  └──────────────┘
                                 │
                                 │ Notifications
                                 ▼
              ┌──────────────────────────────────────┐
              │  Slack / Email / PagerDuty / Webhooks│
              └──────────────────────────────────────┘
```

---

## Metrics Reference

All metrics exposed from PAY-011 backend at `http://localhost:3000/metrics`:

### Counters
- `payment_total` - Total payments processed
- `payment_success_total` - Successful payments
- `payment_failure_total` - Failed payments
- `payment_volume_sats_total` - Total volume in satoshis

### Gauges
- `payment_success_rate` - Current success rate (0.0-1.0)
- `active_payments_count` - Currently processing payments

### Histograms
- `payment_amount_sats_bucket` - Payment amount distribution
  - Buckets: 100, 500, 1k, 5k, 10k, 50k, 100k, 500k, 1M sats
- `payment_duration_ms_bucket` - Payment duration distribution
  - Buckets: 100ms, 500ms, 1s, 5s, 10s, 30s, 60s

### HTTP Metrics
- `http_requests_total` - Total HTTP requests
- `http_requests_by_status{code}` - Requests by status code
- `http_request_duration_ms{quantile}` - HTTP latency percentiles

---

## Dashboard Panels Explained

### Business Dashboard Panels

#### Total Payments Processed
- **Query**: `payment_total`
- **Type**: Stat panel
- **Purpose**: Show cumulative payment count since system start

#### Payment Success Rate
- **Query**: `payment_success_rate`
- **Type**: Stat panel with thresholds
- **Thresholds**:
  - 🔴 Red: < 95% (critical)
  - 🟡 Yellow: 95-98% (warning)
  - 🟢 Green: > 98% (healthy)

#### Payment Rate per Minute
- **Query**: `rate(payment_total[5m]) * 60`
- **Type**: Time series
- **Purpose**: Show payment throughput trend

#### Top 10 Creators by Payment Count
- **Query**: `topk(10, sum by (creator_id) (payment_success_total))`
- **Type**: Table
- **Purpose**: Identify highest-earning creators

### Technical Dashboard Panels

#### System Health Status
- **Query**: `payment_success_rate < 0.95`
- **Type**: Stat panel with value mapping
- **Values**: 0 = HEALTHY (green), 1 = DEGRADED (red)

#### P95 Latency
- **Query**: `histogram_quantile(0.95, sum(rate(payment_duration_ms_bucket[5m])) by (le))`
- **Type**: Stat panel with thresholds
- **Thresholds**:
  - 🟢 Green: < 1000ms
  - 🟡 Yellow: 1000-2000ms
  - 🔴 Red: > 2000ms

#### Latency Distribution Heatmap
- **Query**: `sum(increase(payment_duration_ms_bucket[5m])) by (le)`
- **Type**: Heatmap
- **Purpose**: Visualize latency distribution over time

---

## Alert Runbooks

Each alert includes a `runbook_url` annotation pointing to detailed troubleshooting steps.

### LowPaymentSuccessRate Runbook

**Symptoms**: Success rate drops below 95%

**Impact**: Users experiencing payment failures

**Investigation Steps**:
1. Check error logs: `docker logs sovren-payment-backend --tail 100`
2. Query recent failed payments: `curl http://localhost:3000/api/analytics/payments/summary?status=failed&start_date=$(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%SZ)`
3. Check Lightning node connectivity
4. Verify invoice expiration settings
5. Check database connection pool

**Common Causes**:
- Lightning node offline
- Network connectivity issues
- Invoice expiration too short
- Database connection exhaustion
- External Lightning service degraded

**Resolution**:
- Restart Lightning node if unresponsive
- Increase invoice expiration time
- Scale database connection pool
- Failover to backup Lightning provider

### HighPaymentLatencyP95 Runbook

**Symptoms**: P95 latency exceeds 2 seconds

**Impact**: Slow user experience, potential timeouts

**Investigation Steps**:
1. Check database query performance
2. Verify Lightning node response time
3. Check system resources (CPU, memory, disk I/O)
4. Review recent code deployments
5. Check for slow external API calls

**Common Causes**:
- Slow database queries (missing indexes)
- Lightning node slow response
- High CPU/memory usage
- Network latency to external services
- Recent code regression

**Resolution**:
- Add missing database indexes
- Optimize slow queries
- Scale up resources
- Implement caching
- Rollback problematic deployment

---

## Customization

### Adding Custom Panels

1. Open Grafana dashboard in edit mode
2. Click "Add Panel"
3. Select visualization type
4. Write PromQL query
5. Configure thresholds, legends, axes
6. Save dashboard
7. Export JSON: Dashboard Settings → JSON Model → Copy to clipboard
8. Update dashboard file in `dashboards/` directory

### Modifying Alert Thresholds

Edit `alerts/payment-alert-rules.yml`:

```yaml
- alert: LowPaymentSuccessRate
  expr: payment_success_rate < 0.90  # Changed from 0.95
  for: 10m                            # Changed from 5m
```

Reload Prometheus config:
```bash
docker exec sovren-prometheus kill -HUP 1
```

### Adding New Alerts

1. Add rule to `alerts/payment-alert-rules.yml`
2. Reload Prometheus: `docker exec sovren-prometheus kill -HUP 1`
3. Verify rule loaded: http://localhost:9090/alerts
4. Test alert by simulating condition

---

## Monitoring Best Practices

### Alert Fatigue Prevention

✅ **DO**:
- Set realistic thresholds based on actual data
- Use `for` durations to avoid flapping
- Group related alerts
- Add clear runbooks
- Implement alert inhibition rules

❌ **DON'T**:
- Alert on every minor anomaly
- Use zero-duration alerts (instant firing)
- Create duplicate alerts
- Alert without actionable steps
- Ignore alert history

### Dashboard Design

✅ **DO**:
- Put most critical metrics at the top
- Use color coding consistently (red = bad, green = good)
- Include legends with stats (mean, max, current)
- Set appropriate time ranges (1h default)
- Add annotations for deployments

❌ **DON'T**:
- Clutter with too many panels (max 12 per dashboard)
- Use default panel titles ("Panel Title")
- Mix business and technical metrics
- Forget to set thresholds
- Use auto-refresh < 5s (wastes resources)

---

## Troubleshooting

### Grafana Dashboard Not Loading

**Problem**: Dashboard shows "No data" or "N/A"

**Solutions**:
1. Verify Prometheus is running: `docker ps | grep prometheus`
2. Check Prometheus targets: http://localhost:9090/targets
3. Verify payment backend is exposing metrics: `curl http://localhost:3000/metrics`
4. Check Grafana datasource: Grafana → Configuration → Data Sources → Prometheus
5. Test query in Prometheus UI: http://localhost:9090/graph

### Alerts Not Firing

**Problem**: Alert should fire but isn't

**Solutions**:
1. Check alert state in Prometheus: http://localhost:9090/alerts
2. Verify rule file is loaded: http://localhost:9090/config
3. Check evaluation interval and `for` duration
4. Simulate alert condition manually
5. Review AlertManager config: http://localhost:9093/#/status

### No Metrics from Backend

**Problem**: Prometheus can't scrape backend

**Solutions**:
1. Verify backend is running: `curl http://localhost:3000/health`
2. Check metrics endpoint: `curl http://localhost:3000/metrics`
3. Verify Prometheus scrape config targets
4. Check firewall rules
5. Review Prometheus logs: `docker logs sovren-prometheus`

---

## Performance Optimization

### Prometheus Retention

Default: 30 days. Adjust in `docker-compose.grafana.yml`:

```yaml
command:
  - '--storage.tsdb.retention.time=90d'  # Increase to 90 days
```

### Query Optimization

**Slow queries**:
- Use recording rules for complex calculations
- Increase scrape intervals for less critical metrics
- Use appropriate time ranges (avoid querying months of data)

**Example recording rule** (add to `alerts/payment-alert-rules.yml`):

```yaml
groups:
  - name: recording_rules
    interval: 60s
    rules:
      - record: payment:success_rate:5m
        expr: payment_success_total / payment_total
```

### Grafana Performance

- Enable query caching
- Set max concurrent queries
- Use dashboard time range variables
- Limit panel query intervals

---

## Production Checklist

Before deploying to production:

- [ ] Change default Grafana admin password
- [ ] Configure Slack webhooks for critical alerts
- [ ] Set up PagerDuty integration
- [ ] Add email notification addresses
- [ ] Set appropriate alert thresholds based on SLOs
- [ ] Test all alert routes (critical, warning, info)
- [ ] Configure HTTPS for Grafana (reverse proxy)
- [ ] Set up backup for Prometheus data
- [ ] Document alert escalation procedures
- [ ] Train team on dashboard usage
- [ ] Create runbook wiki with detailed procedures
- [ ] Set up retention policy (30-90 days recommended)
- [ ] Configure authentication (LDAP/OAuth)
- [ ] Enable audit logging
- [ ] Set up monitoring for the monitoring stack (meta-monitoring)

---

## Files Structure

```
grafana/
├── docker-compose.grafana.yml          # Docker Compose orchestration
├── README.md                           # This file
├── .env.example                        # Environment template
├── dashboards/
│   ├── payment-business-dashboard.json # Business metrics dashboard
│   └── payment-technical-dashboard.json # Technical metrics dashboard
├── provisioning/
│   ├── datasources/
│   │   └── prometheus.yml              # Auto-configure Prometheus datasource
│   ├── dashboards/
│   │   └── sovren-dashboards.yml       # Auto-import dashboards
│   └── alerting/
│       ├── contact-points.yml          # Notification channels
│       └── notification-policies.yml   # Alert routing policies
├── alerts/
│   └── payment-alert-rules.yml         # Prometheus alert rules
└── config/
    ├── prometheus.yml                  # Prometheus scrape config
    └── alertmanager.yml                # AlertManager routing config
```

---

## Support & Resources

### Official Documentation
- **Grafana**: https://grafana.com/docs/grafana/latest/
- **Prometheus**: https://prometheus.io/docs/
- **AlertManager**: https://prometheus.io/docs/alerting/latest/alertmanager/

### Prometheus Query Examples
- PromQL Basics: https://prometheus.io/docs/prometheus/latest/querying/basics/
- Query Functions: https://prometheus.io/docs/prometheus/latest/querying/functions/

### Grafana Dashboard Examples
- Grafana Dashboards: https://grafana.com/grafana/dashboards/
- Best Practices: https://grafana.com/docs/grafana/latest/best-practices/

---

## License

This monitoring infrastructure is part of the Sovren project and follows the same license.

---

**Implemented by**: Monitoring & Observability Architect
**Story**: PAY-012 - Payment Analytics Dashboards
**Date**: October 25, 2025
**Status**: ✅ COMPLETE
