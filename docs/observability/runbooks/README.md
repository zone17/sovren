# Runbooks

Operational runbooks for the Sovren platform. Each runbook covers investigation steps, common causes, and recovery procedures for a specific alert.

---

## You've Been Paged. Start Here.

1. **Check the alert name** in PagerDuty or Prometheus Alertmanager — find the matching row in the Quick Reference table below.
2. **Open the runbook** linked in that row.
3. **Follow the investigation steps top to bottom.** Do not skip to mitigation until you've confirmed the cause.
4. **Check Grafana** for correlated spikes across latency, error rate, queue depth, and memory.
5. **Check Sentry** for new error groups that appeared at the same time.
6. If you cannot resolve within the stated response time, **escalate** using the contacts in the runbook.

Incident channel: `#incidents` in Slack.
PagerDuty escalation path: On-Call Engineer → Squad Lead → Engineering Manager.

---

## Quick Reference

| Alert Name | Severity | Response Time | Runbook | Impact |
|------------|----------|---------------|---------|--------|
| `lightning_node_unreachable` | P1 — Critical | Immediate | [lightning-node-unreachable.md](./lightning-node-unreachable.md) | Payments blocked — direct revenue impact |
| `SLOHighErrorRate` | P1 — Critical | 5 min investigate, 30 min rollback | [high-error-rate.md](./high-error-rate.md) | API errors above 1% — SLO error budget burning |
| `SLOHighLatencyP99` | P1 — Critical | 5 min | [high-latency.md](./high-latency.md) | P99 latency > 500ms — users experiencing slow responses |
| `SLOHighLatencyP95` | P2 — Warning | 15 min | [high-latency.md](./high-latency.md) | P95 latency > 250ms — early degradation warning |
| `PrometheusTargetDown` | P1 — Critical | 2 min | [prometheus-target-down.md](./prometheus-target-down.md) | Observability blind spot — metrics gaps in all dashboards |
| `NodeJSCriticalHeapUsage` | P1 — Critical | 5 min | [nodejs-high-heap.md](./nodejs-high-heap.md) | Heap at 95% — OOMKill and service restart imminent |
| `NodeJSHighHeapUsage` | P2 — Warning | 15 min | [nodejs-high-heap.md](./nodejs-high-heap.md) | Heap at 80% — memory growth trend to investigate |
| `bullmq_dead_letter_queue_growing` | P2 — Warning | 30 min | [queue-job-failures.md](./queue-job-failures.md) | Background jobs failing — notifications/webhooks delayed |

---

## All Runbooks

| Runbook | Alerts Covered | Squad | File |
|---------|---------------|-------|------|
| Lightning Node Unreachable | `lightning_node_unreachable` | Payments | [lightning-node-unreachable.md](./lightning-node-unreachable.md) |
| High Error Rate | `SLOHighErrorRate` | Backend | [high-error-rate.md](./high-error-rate.md) |
| High Latency | `SLOHighLatencyP99`, `SLOHighLatencyP95` | Backend | [high-latency.md](./high-latency.md) |
| Prometheus Target Down | `PrometheusTargetDown` | Infrastructure | [prometheus-target-down.md](./prometheus-target-down.md) |
| Node.js High Heap | `NodeJSHighHeapUsage`, `NodeJSCriticalHeapUsage` | Backend | [nodejs-high-heap.md](./nodejs-high-heap.md) |
| Queue Job Failures | `bullmq_dead_letter_queue_growing` | Backend | [queue-job-failures.md](./queue-job-failures.md) |

---

## Key Links

### Dashboards & Observability

| Tool | URL | Purpose |
|------|-----|---------|
| Grafana | `http://<grafana-host>:3000` | Metrics dashboards, Loki logs |
| Prometheus | `http://<prometheus-host>:9090/targets` | Scrape target health, ad-hoc PromQL |
| Prometheus Alerts | `http://<prometheus-host>:9090/alerts` | Active alert rules |
| Sentry | `https://sentry.io` | Error tracking — frontend and backend |
| Bull Board | `https://api.sovren.dev/admin/queues` | BullMQ queue dashboard (admin auth required) |

### Health Endpoints

| Environment | URL |
|-------------|-----|
| Production (live) | `https://api.sovren.dev/health` |
| Production (ready) | `https://api.sovren.dev/ready` |
| Production (live probe) | `https://api.sovren.dev/live` |
| Production (detailed) | `https://api.sovren.dev/detailed` |
| Staging (live) | `https://api-staging.sovren.dev/health` |
| Staging (ready) | `https://api-staging.sovren.dev/ready` |

### Metrics Endpoint

| Service | Endpoint |
|---------|----------|
| sovren-api | `https://api.sovren.dev/metrics` |

All Prometheus metrics use the `sovren_*` namespace.

---

## SLO Summary

| SLO | Target | Alert |
|-----|--------|-------|
| API error rate | < 1% | `SLOHighErrorRate` |
| API uptime | > 99.5% | Derived from error rate |
| P99 latency | < 500ms | `SLOHighLatencyP99` |
| P95 latency | < 250ms | `SLOHighLatencyP95` |
| Queue job completion | > 99% | `SLOQueueJobFailures` |
| P95 queue processing | < 30s | `SLOQueueJobFailures` |

Error budget: 0.5% = ~3.6 hours/month of allowed elevated errors. See [../slos.md](../slos.md) for full SLO definitions.

---

## Adding a New Runbook

1. Create a new file in this directory: `<alert-name>.md`
2. Include at minimum: alert name, severity, symptoms, investigation steps, common causes, mitigation, escalation
3. Add a row to both tables in this README
4. Link the alert rule in Prometheus/Alertmanager to the runbook URL
