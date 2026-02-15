# Sovren Platform - Service Level Objectives (SLOs)

## Overview

SLOs define the reliability targets for the Sovren platform. They are measured via real
Prometheus metrics (prom-client) and enforced through automated alerting.

All SLIs are derived from the `sovren_*` metric namespace exported at `/metrics`.

---

## API Endpoints

### Availability SLO

| Metric     | Target  | Measurement                                                                                   |
| ---------- | ------- | --------------------------------------------------------------------------------------------- |
| Error rate | < 1%    | `sum(rate(sovren_http_request_errors_total[5m])) / sum(rate(sovren_http_requests_total[5m]))` |
| Uptime     | > 99.5% | Percentage of 5-minute windows with error rate < 1%                                           |

**Error budget**: 0.5% = ~3.6 hours/month of allowed downtime or elevated errors.

**Alert**: `SLOHighErrorRate` fires when error rate exceeds 1% for 5 consecutive minutes.

### Latency SLO

| Percentile | Target  | Measurement                                                                                    |
| ---------- | ------- | ---------------------------------------------------------------------------------------------- |
| P99        | < 500ms | `histogram_quantile(0.99, sum(rate(sovren_http_request_duration_seconds_bucket[5m])) by (le))` |
| P95        | < 250ms | `histogram_quantile(0.95, sum(rate(sovren_http_request_duration_seconds_bucket[5m])) by (le))` |
| P50        | < 100ms | `histogram_quantile(0.50, sum(rate(sovren_http_request_duration_seconds_bucket[5m])) by (le))` |

**Alert**: `SLOHighLatencyP99` (critical) and `SLOHighLatencyP95` (warning).

---

## BullMQ Queues

### Job Completion SLO

| Metric              | Target          | Measurement                                                                                              |
| ------------------- | --------------- | -------------------------------------------------------------------------------------------------------- |
| Job completion rate | > 99%           | `1 - (sum(rate(sovren_queue_jobs_total{status="failed"}[5m])) / sum(rate(sovren_queue_jobs_total[5m])))` |
| P95 processing time | < 30s           | `histogram_quantile(0.95, sum(rate(sovren_queue_job_duration_seconds_bucket[5m])) by (le, queue))`       |
| Queue depth         | < 100 (warning) | `sovren_queue_depth` per queue                                                                           |

**Alert**: `SLOQueueJobFailures` fires when failure rate exceeds 1%.

---

## Infrastructure

### Node.js Process

| Metric         | Target  | Measurement                                                                |
| -------------- | ------- | -------------------------------------------------------------------------- |
| Heap usage     | < 90%   | `sovren_nodejs_heap_size_used_bytes / sovren_nodejs_heap_size_total_bytes` |
| Event loop lag | < 500ms | `sovren_nodejs_eventloop_lag_seconds`                                      |

### System Resources

| Metric       | Target | Measurement                                                                 |
| ------------ | ------ | --------------------------------------------------------------------------- |
| CPU usage    | < 85%  | `100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)`          |
| Memory usage | < 85%  | `(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100` |
| Disk usage   | < 85%  | `(1 - (node_filesystem_avail_bytes / node_filesystem_size_bytes)) * 100`    |

---

## Frontend Web Vitals

Measured via `web-vitals` library and reported to Sentry performance.

| Metric                          | Good    | Needs Improvement | Poor     |
| ------------------------------- | ------- | ----------------- | -------- |
| LCP (Largest Contentful Paint)  | < 2.5s  | < 4.0s            | >= 4.0s  |
| FID (First Input Delay)         | < 100ms | < 300ms           | >= 300ms |
| CLS (Cumulative Layout Shift)   | < 0.1   | < 0.25            | >= 0.25  |
| INP (Interaction to Next Paint) | < 200ms | < 500ms           | >= 500ms |
| TTFB (Time to First Byte)       | < 800ms | < 1.8s            | >= 1.8s  |

Poor Web Vitals are reported as Sentry warning events for investigation.

---

## Grafana Dashboards

PromQL queries for an overview dashboard:

**Request Rate**:

```promql
sum(rate(sovren_http_requests_total[5m]))
```

**Error Rate (%)**:

```promql
sum(rate(sovren_http_request_errors_total[5m])) / sum(rate(sovren_http_requests_total[5m])) * 100
```

**P99 Latency**:

```promql
histogram_quantile(0.99, sum(rate(sovren_http_request_duration_seconds_bucket[5m])) by (le))
```

**Active Connections**:

```promql
sovren_http_active_connections
```

**Heap Usage**:

```promql
sovren_nodejs_heap_size_used_bytes / sovren_nodejs_heap_size_total_bytes * 100
```

---

## Runbook References

Every alert has a corresponding runbook in `docs/observability/runbooks/`:

| Alert                  | Runbook                                                               |
| ---------------------- | --------------------------------------------------------------------- |
| SLOHighErrorRate       | [high-error-rate.md](runbooks/high-error-rate.md)                     |
| SLOHighLatencyP99      | [high-latency.md](runbooks/high-latency.md)                           |
| SLOQueueJobFailures    | [queue-job-failures.md](runbooks/queue-job-failures.md)               |
| HighPaymentFailureRate | [high-payment-failure-rate.md](runbooks/high-payment-failure-rate.md) |
| NodeJSHighHeapUsage    | [nodejs-high-heap.md](runbooks/nodejs-high-heap.md)                   |
| PrometheusTargetDown   | [prometheus-target-down.md](runbooks/prometheus-target-down.md)       |
