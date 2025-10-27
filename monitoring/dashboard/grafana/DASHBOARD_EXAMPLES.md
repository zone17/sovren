# Grafana Dashboard Examples - Visual Guide

This document provides visual examples and query explanations for the Sovren Payment Analytics dashboards.

---

## Business Dashboard Panel Examples

### Panel 1: Total Payments Processed

**Query**:
```promql
payment_total
```

**Visualization**: Stat panel
**Expected Output**: `15,234` (cumulative counter)

**What it shows**: Total number of payments processed since system start. This is a monotonically increasing counter that never decreases.

---

### Panel 2: Payment Success Rate

**Query**:
```promql
payment_success_rate
```

**Visualization**: Stat panel with color thresholds
**Expected Output**: `0.98` (displayed as 98%)

**Color Thresholds**:
- 🔴 Red (< 0.95): `0.92` = Critical issue
- 🟡 Yellow (0.95-0.98): `0.96` = Warning
- 🟢 Green (> 0.98): `0.99` = Healthy

**What it shows**: Current payment success rate as a decimal (0.0 to 1.0). This is a gauge that reflects the health of the payment system.

---

### Panel 3: Total Volume (sats)

**Query**:
```promql
payment_volume_sats_total
```

**Visualization**: Stat panel
**Expected Output**: `5,000,000` sats

**What it shows**: Cumulative payment volume in satoshis since system start.

---

### Panel 4: Total Volume (BTC)

**Query**:
```promql
payment_volume_sats_total / 100000000
```

**Visualization**: Stat panel with 8 decimal precision
**Expected Output**: `0.05000000` BTC

**What it shows**: Same as Panel 3 but converted to BTC (1 BTC = 100,000,000 sats).

---

### Panel 5: Payment Rate (per minute)

**Query**:
```promql
rate(payment_total[5m]) * 60
```

**Visualization**: Time series graph
**Expected Output**: Line graph showing 0-50 payments/minute

**What it shows**:
- `rate()` calculates per-second rate over 5-minute window
- `* 60` converts to per-minute rate
- Shows payment throughput trend

**Example Timeline**:
```
12:00 → 10 payments/min
12:15 → 25 payments/min (traffic spike)
12:30 → 15 payments/min (back to normal)
```

---

### Panel 6: Payment Volume Rate (sats per minute)

**Query**:
```promql
rate(payment_volume_sats_total[5m]) * 60
```

**Visualization**: Time series graph
**Expected Output**: Line showing 0-100,000 sats/minute

**What it shows**: How much volume (in sats) is being processed per minute.

---

### Panel 7: Success vs Failure Rate Over Time

**Query A (Success)**:
```promql
payment_success_rate
```

**Query B (Failure)**:
```promql
1 - payment_success_rate
```

**Visualization**: Stacked time series area chart
**Expected Output**: Two stacked areas showing success (green) and failure (red) rates

**What it shows**: Visual representation of success vs failure rates over time. Healthy system shows mostly green with minimal red.

---

### Panel 8: Top 10 Creators by Payment Count

**Query**:
```promql
topk(10, sum by (creator_id) (payment_success_total))
```

**Visualization**: Table
**Expected Output**:
```
| Creator ID        | Successful Payments |
|-------------------|---------------------|
| creator_alice     | 1,234               |
| creator_bob       | 987                 |
| creator_charlie   | 756                 |
| ...               | ...                 |
```

**What it shows**: Top 10 creators ranked by total successful payment count.

---

### Panel 9: Payment Amount Distribution Heatmap

**Query**:
```promql
sum(increase(payment_amount_sats_bucket[1h])) by (le)
```

**Visualization**: Heatmap
**Expected Output**: Color-coded heatmap showing payment amount frequency

**Bucket Interpretation**:
- `le="100"`: Payments ≤ 100 sats
- `le="1000"`: Payments ≤ 1,000 sats
- `le="10000"`: Payments ≤ 10,000 sats
- etc.

**Example Heatmap**:
```
Time →    10:00   11:00   12:00   13:00
100 sats   🟦🟦   🟦🟦   🟦🟦   🟦🟦  (Many small payments)
1k sats    🟩🟩   🟩🟩   🟩🟩   🟩🟩  (Moderate medium payments)
10k sats   🟨      🟨      🟨🟨   🟨    (Few large payments)
100k sats  ⬜      ⬜      🟧      ⬜    (Rare very large payments)
```

**What it shows**: Distribution of payment amounts over time. Helps identify patterns (e.g., many small tips vs few large donations).

---

### Panel 10: Payment Status Distribution

**Query A (Successful)**:
```promql
payment_success_total
```

**Query B (Failed)**:
```promql
payment_failure_total
```

**Visualization**: Donut/Pie chart
**Expected Output**: Pie chart with two slices

**Example**:
- 🟢 Successful: 98% (14,938 payments)
- 🔴 Failed: 2% (296 payments)

**What it shows**: Overall ratio of successful to failed payments.

---

### Panel 11: Active Payments (Real-Time)

**Query**:
```promql
active_payments_count
```

**Visualization**: Gauge
**Expected Output**: Needle pointing to current value (0-100 scale)

**Thresholds**:
- 🟢 Green (0-10): Normal
- 🟡 Yellow (10-50): Elevated
- 🔴 Red (50+): High (potential queue backup)

**What it shows**: Number of payments currently in "pending" or "processing" state.

---

## Technical Dashboard Panel Examples

### Panel 1: System Health Status

**Query**:
```promql
payment_success_rate < 0.95
```

**Visualization**: Stat with value mapping
**Expected Output**: "HEALTHY" (green) or "DEGRADED" (red)

**Value Mapping**:
- `0` → "HEALTHY" (green background)
- `1` → "DEGRADED" (red background)

**What it shows**: Binary health indicator based on success rate threshold.

---

### Panel 2: P95 Latency

**Query**:
```promql
histogram_quantile(0.95, sum(rate(payment_duration_ms_bucket[5m])) by (le))
```

**Visualization**: Stat with color thresholds
**Expected Output**: `850 ms`

**Color Thresholds**:
- 🟢 Green (< 1000ms): Fast
- 🟡 Yellow (1000-2000ms): Acceptable
- 🔴 Red (> 2000ms): Slow (SLO violation)

**What it shows**: 95th percentile payment processing time. 95% of payments complete faster than this value.

**Percentile Explanation**:
- If P95 = 850ms, then 95% of payments took ≤ 850ms
- Only 5% of payments took longer than 850ms

---

### Panel 3: Total Errors

**Query**:
```promql
payment_failure_total
```

**Visualization**: Stat
**Expected Output**: `296` (cumulative)

**What it shows**: Total number of failed payments since system start.

---

### Panel 4: Active Payments

**Query**:
```promql
active_payments_count
```

**Visualization**: Stat
**Expected Output**: `12`

**What it shows**: Current number of payments being processed.

---

### Panel 5: Payment Processing Latency (P50/P95/P99)

**Query A (P50 - Median)**:
```promql
histogram_quantile(0.50, sum(rate(payment_duration_ms_bucket[5m])) by (le))
```

**Query B (P95)**:
```promql
histogram_quantile(0.95, sum(rate(payment_duration_ms_bucket[5m])) by (le))
```

**Query C (P99)**:
```promql
histogram_quantile(0.99, sum(rate(payment_duration_ms_bucket[5m])) by (le))
```

**Visualization**: Multi-line time series
**Expected Output**: Three lines showing latency percentiles over time

**Example Timeline**:
```
Time  | P50  | P95   | P99
------|------|-------|-------
12:00 | 200ms| 800ms | 1500ms
12:15 | 250ms| 1200ms| 2800ms  ⚠️ Latency spike
12:30 | 180ms| 750ms | 1400ms
```

**Threshold Line**: Red horizontal line at 2000ms (SLO threshold)

**What it shows**: Latency distribution over time. Helps identify performance degradation.

---

### Panel 6: Error Rate (errors per second)

**Query**:
```promql
rate(payment_failure_total[5m])
```

**Visualization**: Time series
**Expected Output**: Line graph showing 0-0.5 errors/sec

**What it shows**: Rate of payment failures per second. Spikes indicate issues.

---

### Panel 7: Latency Distribution Heatmap

**Query**:
```promql
sum(increase(payment_duration_ms_bucket[5m])) by (le)
```

**Visualization**: Heatmap
**Expected Output**: Color-coded heatmap showing latency frequency

**Bucket Interpretation**:
- `le="100"`: Payments ≤ 100ms (very fast)
- `le="500"`: Payments ≤ 500ms (fast)
- `le="1000"`: Payments ≤ 1s (acceptable)
- `le="5000"`: Payments ≤ 5s (slow)
- `le="30000"`: Payments ≤ 30s (very slow)

**Example Heatmap**:
```
Time →     10:00   11:00   12:00   13:00
100ms      🟦🟦   🟦🟦   🟩🟩   🟦🟦  (Most payments fast)
500ms      🟩🟩   🟩🟩   🟨🟨   🟩🟩  (Some medium latency)
1000ms     🟨      🟨      🟧🟧   🟨    (Few slow)
5000ms     ⬜      ⬜      🟥      ⬜    (Very rare timeouts)
```

**What it shows**: Latency distribution over time. Helps identify slow periods.

---

### Panel 8: Success vs Failures (1-minute buckets)

**Query A (Successful)**:
```promql
increase(payment_success_total[1m])
```

**Query B (Failed)**:
```promql
increase(payment_failure_total[1m])
```

**Visualization**: Stacked bar chart
**Expected Output**: Bars showing success (green) and failures (red) per minute

**Example**:
```
12:00 ████████████████ 45 successful, 2 failed
12:01 ███████████████  40 successful, 1 failed
12:02 ██████████████████ 52 successful, 3 failed
12:03 ████████████     30 successful, 8 failed ⚠️
```

**What it shows**: Minute-by-minute success vs failure count. Helps pinpoint exact time of issues.

---

### Panel 9: HTTP Request Rate

**Query**:
```promql
rate(http_requests_total[5m])
```

**Visualization**: Time series
**Expected Output**: Line showing 0-10 requests/sec

**What it shows**: Overall HTTP traffic to payment API.

---

### Panel 10: HTTP Status Code Distribution

**Query**:
```promql
sum by (code) (rate(http_requests_by_status[5m]))
```

**Visualization**: Stacked time series
**Expected Output**: Multiple lines showing different status codes

**Color by Status**:
- 🟢 Green: 2xx (success)
- 🟡 Yellow: 4xx (client errors)
- 🔴 Red: 5xx (server errors)

**Example Timeline**:
```
Time  | 200 | 400 | 500
------|-----|-----|-----
12:00 | 8/s | 0.1/s| 0/s
12:15 | 7/s | 0.2/s| 0.5/s  ⚠️ Server errors
12:30 | 9/s | 0.1/s| 0/s
```

**What it shows**: HTTP error rates over time.

---

### Panel 11: HTTP Performance Metrics

**Query**:
```promql
http_request_duration_ms
```

**Visualization**: Table
**Expected Output**:
```
| Percentile | Duration (ms) |
|------------|---------------|
| P50        | 45            |
| P95        | 120           |
| P99        | 250           |
```

**What it shows**: HTTP endpoint performance summary.

---

## Example Alert Scenarios

### Scenario 1: Success Rate Drop

**Alert**: LowPaymentSuccessRate
**Trigger**: Success rate drops to 92%
**Timeline**:
```
12:00 - Success rate: 98% ✅
12:10 - Success rate: 95% ⚠️ (warning)
12:15 - Success rate: 92% 🚨 (CRITICAL - alert fires after 5 min)
12:20 - Slack notification sent to #payments-critical
12:25 - PagerDuty page sent to on-call engineer
12:30 - Engineer investigates, finds Lightning node issue
12:45 - Lightning node restarted
12:50 - Success rate recovers to 98% ✅
12:55 - Alert auto-resolves
```

**Dashboard View**:
- Business Dashboard shows success rate panel red
- Technical Dashboard shows error rate spike
- Both dashboards show latency increase

---

### Scenario 2: Latency Spike

**Alert**: HighPaymentLatencyP95
**Trigger**: P95 latency exceeds 2 seconds
**Timeline**:
```
14:00 - P95 latency: 800ms ✅
14:10 - P95 latency: 1200ms ⚠️ (warning)
14:15 - P95 latency: 2500ms 🚨 (CRITICAL - alert fires after 5 min)
14:20 - Slack notification sent
14:25 - Engineer checks database slow query log
14:30 - Missing index identified
14:45 - Index added, queries optimized
14:50 - P95 latency drops to 700ms ✅
14:55 - Alert auto-resolves
```

**Dashboard View**:
- Technical Dashboard shows P95 latency panel red
- Latency heatmap shows concentration in 2000-5000ms bucket
- HTTP request duration also elevated

---

## Query Cheat Sheet

### Rate Calculations
```promql
# Per-second rate over 5 minutes
rate(payment_total[5m])

# Per-minute rate
rate(payment_total[5m]) * 60

# Per-hour rate
rate(payment_total[5m]) * 3600
```

### Percentile Calculations
```promql
# P50 (median)
histogram_quantile(0.50, sum(rate(payment_duration_ms_bucket[5m])) by (le))

# P95
histogram_quantile(0.95, sum(rate(payment_duration_ms_bucket[5m])) by (le))

# P99
histogram_quantile(0.99, sum(rate(payment_duration_ms_bucket[5m])) by (le))
```

### Aggregations
```promql
# Sum across all instances
sum(payment_total)

# Average across all instances
avg(payment_success_rate)

# Min/Max
min(payment_success_rate)
max(payment_duration_ms_bucket)

# Count unique labels
count(payment_total)
```

### Filtering
```promql
# By label
payment_total{creator_id="alice"}

# By status
payment_total{status="completed"}

# Regex match
payment_total{creator_id=~"creator_.*"}

# Not equal
payment_total{status!="failed"}
```

### Time Ranges
```promql
# Last 5 minutes
rate(payment_total[5m])

# Last 1 hour
rate(payment_total[1h])

# Last 24 hours
rate(payment_total[24h])
```

### Math Operations
```promql
# Percentage
(payment_success_total / payment_total) * 100

# Difference
payment_total - payment_failure_total

# Ratio
payment_success_total / payment_failure_total
```

---

## Dashboard Best Practices

### Time Range Selection

**Dashboard Default**: 1 hour (good for real-time monitoring)

**Recommended Time Ranges**:
- 🕐 **5 minutes**: Incident investigation
- 🕐 **1 hour**: Real-time operations
- 🕐 **6 hours**: Trend analysis
- 🕐 **24 hours**: Daily review
- 🕐 **7 days**: Weekly performance review
- 🕐 **30 days**: Monthly business review

### Refresh Intervals

**Dashboard Default**: 10 seconds

**Recommended Intervals**:
- ⚡ **5s**: Incident response (temporary)
- ⚡ **10s**: Real-time monitoring
- ⚡ **30s**: Normal operations
- ⚡ **1m**: Background monitoring
- ⚡ **Off**: Historical analysis

---

## Conclusion

These dashboards provide comprehensive visibility into the Sovren payment system, enabling proactive monitoring, rapid incident response, and data-driven business decisions.

**Key Takeaways**:
- Business Dashboard = Revenue and KPIs
- Technical Dashboard = Performance and health
- Alerts = Actionable notifications with runbooks
- All metrics from PAY-011 backend
- FREE open-source stack (Grafana + Prometheus)

**Next Steps**:
1. Deploy stack with `docker-compose up`
2. Access Grafana at http://localhost:3001
3. Configure alert channels (Slack, email)
4. Set appropriate thresholds for your SLOs
5. Train team on dashboard usage
6. Document alert escalation procedures
