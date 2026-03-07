# Payment Debugging Commands Reference

**Version:** 1.0.0
**Last Updated:** 2025-10-25
**Audience:** Operations team, DevOps engineers, Support engineers

---

## Quick Command Index

| Category           | Command                  | Purpose                     |
| ------------------ | ------------------------ | --------------------------- |
| **Payment Status** | `payment-status <hash>`  | Get full payment details    |
| **Lightning Node** | `lnd-info`               | Check node health           |
| **Database**       | `db-health`              | Check database performance  |
| **Webhooks**       | `webhook-logs <hash>`    | View webhook delivery       |
| **Performance**    | `payment-metrics`        | Real-time metrics           |
| **Recovery**       | `recover-stuck-payments` | Auto-recover stuck payments |

---

## Table of Contents

1. [Payment Investigation Commands](#1-payment-investigation-commands)
2. [Lightning Node Commands](#2-lightning-node-commands)
3. [Database Queries](#3-database-queries)
4. [Webhook Debugging](#4-webhook-debugging)
5. [Performance Analysis](#5-performance-analysis)
6. [Recovery Operations](#6-recovery-operations)
7. [Monitoring & Alerts](#7-monitoring--alerts)
8. [Bulk Operations](#8-bulk-operations)

---

## 1. Payment Investigation Commands

### Get Full Payment Details

```bash
# Basic payment lookup
PAYMENT_HASH="<payment-hash>"

psql -d sovren -c "
SELECT
  id,
  payment_hash,
  user_id,
  creator_id,
  amount_sats,
  status,
  created_at,
  updated_at,
  settled_at,
  failed_at,
  error_message,
  retry_count,
  version
FROM payments
WHERE payment_hash = '$PAYMENT_HASH';
"
```

**Output Example:**

```
 id  | payment_hash | user_id | creator_id | amount_sats | status  | created_at | updated_at | settled_at | failed_at | error_message | retry_count | version
-----+--------------+---------+------------+-------------+---------+------------+------------+------------+-----------+---------------+-------------+---------
 123 | abc123...    | user1   | creator1   | 1000        | pending | 2025-10...  | 2025-10... | NULL       | NULL      | NULL          | 0           | 1
```

---

### View Payment State History

```bash
PAYMENT_HASH="<payment-hash>"

psql -d sovren -c "
SELECT
  from_state,
  to_state,
  transitioned_at,
  triggered_by,
  notes
FROM payment_state_history
WHERE payment_hash = '$PAYMENT_HASH'
ORDER BY transitioned_at;
"
```

**Output Example:**

```
 from_state | to_state   | transitioned_at     | triggered_by | notes
------------+------------+---------------------+--------------+-------
 NULL       | pending    | 2025-10-25 10:00:00 | user_action  | Invoice created
 pending    | processing | 2025-10-25 10:01:00 | webhook      | Payment detected
 processing | completed  | 2025-10-25 10:01:05 | webhook      | Payment confirmed
```

---

### Check Payment Retry History

```bash
PAYMENT_HASH="<payment-hash>"

psql -d sovren -c "
SELECT
  attempt_number,
  attempted_at,
  error_message,
  will_retry,
  next_retry_at,
  LAG(attempted_at) OVER (ORDER BY attempted_at) as previous_attempt,
  EXTRACT(EPOCH FROM (attempted_at - LAG(attempted_at) OVER (ORDER BY attempted_at))) as seconds_since_last
FROM payment_retry_attempts
WHERE payment_hash = '$PAYMENT_HASH'
ORDER BY attempted_at;
"
```

---

### Find Recent Payments by Status

```bash
# All pending payments (last hour)
psql -d sovren -c "
SELECT
  payment_hash,
  user_id,
  amount_sats,
  created_at,
  EXTRACT(EPOCH FROM (NOW() - created_at)) as age_seconds
FROM payments
WHERE status = 'pending'
  AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
"

# Failed payments with errors
psql -d sovren -c "
SELECT
  payment_hash,
  amount_sats,
  error_message,
  failed_at
FROM payments
WHERE status = 'failed'
  AND failed_at > NOW() - INTERVAL '1 hour'
ORDER BY failed_at DESC
LIMIT 20;
"
```

---

### Find User's Payment History

```bash
USER_ID="<user-id>"

psql -d sovren -c "
SELECT
  payment_hash,
  amount_sats,
  status,
  created_at,
  settled_at,
  creator_id
FROM payments
WHERE user_id = '$USER_ID'
ORDER BY created_at DESC
LIMIT 50;
"
```

---

### Find Creator's Received Payments

```bash
CREATOR_ID="<creator-id>"

psql -d sovren -c "
SELECT
  COUNT(*) as total_payments,
  COUNT(*) FILTER (WHERE status = 'completed') as successful,
  COUNT(*) FILTER (WHERE status = 'failed') as failed,
  SUM(amount_sats) FILTER (WHERE status = 'completed') as total_received_sats,
  AVG(amount_sats) FILTER (WHERE status = 'completed') as avg_payment_sats
FROM payments
WHERE creator_id = '$CREATOR_ID'
  AND created_at > NOW() - INTERVAL '30 days';
"
```

---

## 2. Lightning Node Commands

### Check Node Health

```bash
# Basic node info
docker exec sovren-lnd lncli --network=mainnet getinfo

# Parse specific fields
docker exec sovren-lnd lncli --network=mainnet getinfo | jq '{
  synced: .synced_to_chain,
  synced_to_graph: .synced_to_graph,
  block_height: .block_height,
  num_active_channels: .num_active_channels,
  num_peers: .num_peers
}'
```

**Expected Output (Healthy):**

```json
{
  "synced": true,
  "synced_to_graph": true,
  "block_height": 812345,
  "num_active_channels": 24,
  "num_peers": 18
}
```

---

### Check Specific Invoice

```bash
PAYMENT_HASH="<payment-hash>"

docker exec sovren-lnd lncli --network=mainnet lookupinvoice $PAYMENT_HASH

# Or parse specific fields
docker exec sovren-lnd lncli --network=mainnet lookupinvoice $PAYMENT_HASH | jq '{
  payment_hash: .r_hash,
  settled: .settled,
  state: .state,
  value: .value,
  amt_paid: .amt_paid_sat,
  settle_date: .settle_date
}'
```

**States:**

- `OPEN` - Invoice created, awaiting payment
- `SETTLED` - Payment received and confirmed
- `CANCELED` - Invoice manually canceled
- `ACCEPTED` - Payment in flight
- `EXPIRED` - Invoice expired before payment

---

### List Recent Invoices

```bash
# Last 20 invoices
docker exec sovren-lnd lncli --network=mainnet listinvoices --max_invoices=20

# Only settled invoices
docker exec sovren-lnd lncli --network=mainnet listinvoices --max_invoices=50 | \
  jq '.invoices[] | select(.settled == true) | {payment_hash: .r_hash, value: .value}'

# Only pending invoices
docker exec sovren-lnd lncli --network=mainnet listinvoices --max_invoices=50 | \
  jq '.invoices[] | select(.state == "OPEN") | {payment_hash: .r_hash, value: .value, creation_date: .creation_date}'
```

---

### Check Channel Liquidity

```bash
# Channel balance
docker exec sovren-lnd lncli --network=mainnet channelbalance

# List all channels with balances
docker exec sovren-lnd lncli --network=mainnet listchannels | jq '.channels[] | {
  channel_point: .channel_point,
  capacity: .capacity,
  local_balance: .local_balance,
  remote_balance: .remote_balance,
  active: .active
}'

# Total capacity vs balance
docker exec sovren-lnd lncli --network=mainnet listchannels | jq '{
  total_capacity: ([.channels[].capacity] | add),
  total_local: ([.channels[].local_balance] | add),
  total_remote: ([.channels[].remote_balance] | add)
}'
```

---

### Check Wallet Balance

```bash
# On-chain wallet balance
docker exec sovren-lnd lncli --network=mainnet walletbalance

# Lightning channel balance
docker exec sovren-lnd lncli --network=mainnet channelbalance
```

---

### Create Test Invoice

```bash
# Create 1000 sat test invoice
docker exec sovren-lnd lncli --network=mainnet addinvoice \
  --amt 1000 \
  --memo "Test invoice - troubleshooting"

# Decode invoice to verify
INVOICE="<payment-request-from-above>"
docker exec sovren-lnd lncli --network=mainnet decodepayreq $INVOICE
```

---

## 3. Database Queries

### Check Database Health

```bash
# Connection count
psql -d sovren -c "
SELECT
  count(*) as total_connections,
  count(*) FILTER (WHERE state = 'active') as active,
  count(*) FILTER (WHERE state = 'idle') as idle,
  count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction
FROM pg_stat_activity;
"

# Database size
psql -d sovren -c "
SELECT
  pg_size_pretty(pg_database_size('sovren')) as database_size;
"

# Table sizes
psql -d sovren -c "
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) as index_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 10;
"
```

---

### Find Slow Queries

```bash
# Enable pg_stat_statements if not enabled
psql -d sovren -c "CREATE EXTENSION IF NOT EXISTS pg_stat_statements;"

# Top 10 slowest queries
psql -d sovren -c "
SELECT
  substring(query, 1, 100) as query_preview,
  calls,
  mean_exec_time,
  max_exec_time,
  total_exec_time
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat_statements%'
ORDER BY mean_exec_time DESC
LIMIT 10;
"

# Queries taking >1 second
psql -d sovren -c "
SELECT
  substring(query, 1, 100) as query_preview,
  calls,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 1000
  AND query NOT LIKE '%pg_stat_statements%'
ORDER BY mean_exec_time DESC;
"
```

---

### Check for Locks and Blocking

```bash
# Current locks
psql -d sovren -c "
SELECT
  l.locktype,
  l.relation::regclass as table,
  l.mode,
  l.granted,
  a.pid,
  a.usename,
  a.query_start,
  substring(a.query, 1, 50) as query
FROM pg_locks l
JOIN pg_stat_activity a ON l.pid = a.pid
WHERE l.relation IS NOT NULL
ORDER BY a.query_start;
"

# Blocking queries
psql -d sovren -c "
SELECT
  blocking.pid AS blocking_pid,
  blocking.usename AS blocking_user,
  substring(blocking.query, 1, 50) AS blocking_query,
  blocked.pid AS blocked_pid,
  blocked.usename AS blocked_user,
  substring(blocked.query, 1, 50) AS blocked_query
FROM pg_stat_activity blocked
JOIN pg_stat_activity blocking
  ON blocking.pid = ANY(pg_blocking_pids(blocked.pid))
WHERE blocked.pid != blocking.pid;
"
```

---

### Terminate Long-Running Queries

```bash
# Find long-running queries (>5 minutes)
psql -d sovren -c "
SELECT
  pid,
  usename,
  state,
  query_start,
  NOW() - query_start AS duration,
  substring(query, 1, 100) as query
FROM pg_stat_activity
WHERE state != 'idle'
  AND query_start < NOW() - INTERVAL '5 minutes'
ORDER BY query_start;
"

# Terminate specific query (CAUTION!)
# First verify it's safe to kill
psql -d sovren -c "SELECT pg_terminate_backend(<pid>);"

# Terminate all idle in transaction (>5 min)
psql -d sovren -c "
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle in transaction'
  AND query_start < NOW() - INTERVAL '5 minutes';
"
```

---

### Check Index Usage

```bash
# Unused indexes
psql -d sovren -c "
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans,
  idx_tup_read,
  idx_tup_fetch,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC;
"

# Most used indexes
psql -d sovren -c "
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC
LIMIT 20;
"
```

---

## 4. Webhook Debugging

### View Webhook Logs for Payment

```bash
PAYMENT_HASH="<payment-hash>"

psql -d sovren -c "
SELECT
  webhook_id,
  received_at,
  processed_at,
  signature_valid,
  timestamp_valid,
  is_replay,
  http_status,
  error_message,
  EXTRACT(EPOCH FROM (processed_at - received_at)) as processing_time_seconds
FROM webhook_logs
WHERE payment_hash = '$PAYMENT_HASH'
ORDER BY received_at;
"
```

---

### Find Recent Webhook Failures

```bash
# Signature failures (last hour)
psql -d sovren -c "
SELECT
  webhook_id,
  payment_hash,
  received_at,
  error_message,
  source_ip
FROM webhook_logs
WHERE signature_valid = false
  AND received_at > NOW() - INTERVAL '1 hour'
ORDER BY received_at DESC
LIMIT 20;
"

# All webhook errors
psql -d sovren -c "
SELECT
  error_message,
  COUNT(*) as occurrence_count,
  MAX(received_at) as last_occurrence
FROM webhook_logs
WHERE error_message IS NOT NULL
  AND received_at > NOW() - INTERVAL '1 hour'
GROUP BY error_message
ORDER BY occurrence_count DESC;
"
```

---

### Test Webhook Signature Manually

```bash
# Generate test signature
WEBHOOK_SECRET="<your-webhook-secret>"
TIMESTAMP=$(date +%s)
PAYLOAD='{"payment_hash":"test123","status":"completed","amount":1000}'

# Generate HMAC signature
SIGNATURE=$(echo -n "${TIMESTAMP}.${PAYLOAD}" | \
  openssl dgst -sha256 -hmac "$WEBHOOK_SECRET" -binary | \
  base64)

echo "Timestamp: $TIMESTAMP"
echo "Signature: $SIGNATURE"

# Test webhook endpoint
curl -X POST http://localhost:8080/api/webhooks/payment \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: $SIGNATURE" \
  -H "X-Webhook-Timestamp: $TIMESTAMP" \
  -H "X-Webhook-ID: test-$(date +%s)" \
  -d "$PAYLOAD" \
  -v
```

---

### Check Webhook Processing Rate

```bash
# Webhooks per minute (last hour)
psql -d sovren -c "
SELECT
  DATE_TRUNC('minute', received_at) as minute,
  COUNT(*) as webhook_count,
  COUNT(*) FILTER (WHERE signature_valid = true) as valid_count,
  COUNT(*) FILTER (WHERE signature_valid = false) as invalid_count
FROM webhook_logs
WHERE received_at > NOW() - INTERVAL '1 hour'
GROUP BY DATE_TRUNC('minute', received_at)
ORDER BY minute DESC;
"
```

---

### Find Duplicate Webhooks

```bash
# Duplicate webhook IDs
psql -d sovren -c "
SELECT
  webhook_id,
  COUNT(*) as delivery_count,
  ARRAY_AGG(received_at ORDER BY received_at) as received_times
FROM webhook_logs
WHERE received_at > NOW() - INTERVAL '1 hour'
GROUP BY webhook_id
HAVING COUNT(*) > 1
ORDER BY delivery_count DESC;
"
```

---

## 5. Performance Analysis

### Real-Time Payment Metrics

```bash
# API endpoint for real-time metrics
curl http://localhost:8080/api/analytics/realtime-metrics | jq

# Expected output:
# {
#   "timestamp": "2025-10-25T14:30:00Z",
#   "payments_per_minute": 12,
#   "volume_per_minute_sats": 15000,
#   "active_payments": 3,
#   "recent_success_rate": 0.985,
#   "recent_average_duration_ms": 180,
#   "is_degraded": false
# }
```

---

### Payment Success Rate Analysis

```bash
# Hourly success rate (last 24 hours)
psql -d sovren -c "
SELECT
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as total_payments,
  COUNT(*) FILTER (WHERE status = 'completed') as successful,
  COUNT(*) FILTER (WHERE status = 'failed') as failed,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'completed') / COUNT(*), 2) as success_rate
FROM payments
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', created_at)
ORDER BY hour DESC;
"
```

---

### Verification Latency Analysis

```bash
# P50, P95, P99 verification times
psql -d sovren -c "
SELECT
  COUNT(*) as total_verifications,
  ROUND(AVG(EXTRACT(EPOCH FROM (verified_at - created_at)) * 1000)::numeric, 2) as avg_ms,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (verified_at - created_at)) * 1000)::numeric, 2) as p50_ms,
  ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (verified_at - created_at)) * 1000)::numeric, 2) as p95_ms,
  ROUND(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (verified_at - created_at)) * 1000)::numeric, 2) as p99_ms
FROM payments
WHERE verified_at IS NOT NULL
  AND created_at > NOW() - INTERVAL '1 hour';
"

# Slow verifications (>1 second)
psql -d sovren -c "
SELECT
  payment_hash,
  ROUND(EXTRACT(EPOCH FROM (verified_at - created_at)) * 1000) as latency_ms,
  verification_method,
  created_at
FROM payments
WHERE verified_at IS NOT NULL
  AND EXTRACT(EPOCH FROM (verified_at - created_at)) > 1
  AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY latency_ms DESC
LIMIT 20;
"
```

---

### Memory Usage Monitoring

```bash
# Node.js process memory
curl http://localhost:8080/api/metrics/memory | jq

# Docker container stats
docker stats sovren-api --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}"

# Detailed memory breakdown
docker exec sovren-api node -e "console.log(JSON.stringify(process.memoryUsage(), null, 2))"
```

---

### Database Performance Metrics

```bash
# Cache hit ratio (should be >95%)
psql -d sovren -c "
SELECT
  sum(heap_blks_read) as heap_read,
  sum(heap_blks_hit) as heap_hit,
  sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) * 100 as cache_hit_ratio
FROM pg_statio_user_tables;
"

# Transaction throughput
psql -d sovren -c "
SELECT
  xact_commit as commits,
  xact_rollback as rollbacks,
  xact_commit + xact_rollback as total_transactions,
  tup_inserted,
  tup_updated,
  tup_deleted
FROM pg_stat_database
WHERE datname = 'sovren';
"
```

---

## 6. Recovery Operations

### Recover Stuck Payments

```bash
#!/bin/bash
# Script: recover-stuck-payments.sh
# Purpose: Automatically recover payments stuck in intermediate states

echo "Finding stuck payments..."

STUCK_PAYMENTS=$(psql -d sovren -t -c "
SELECT payment_hash
FROM payments
WHERE status IN ('processing', 'verifying', 'verification_failed')
  AND updated_at < NOW() - INTERVAL '10 minutes';
")

if [ -z "$STUCK_PAYMENTS" ]; then
  echo "No stuck payments found."
  exit 0
fi

echo "Found $(echo "$STUCK_PAYMENTS" | wc -l) stuck payments"

for PAYMENT_HASH in $STUCK_PAYMENTS; do
  echo "Processing: $PAYMENT_HASH"

  # Get LND status
  LND_STATE=$(docker exec sovren-lnd lncli --network=mainnet lookupinvoice "$PAYMENT_HASH" 2>/dev/null | jq -r '.state')

  case $LND_STATE in
    SETTLED)
      echo "  → Marking as completed"
      psql -d sovren -c "
      UPDATE payments
      SET status = 'completed', settled_at = NOW(), updated_at = NOW()
      WHERE payment_hash = '$PAYMENT_HASH';
      "
      ;;
    CANCELED|EXPIRED)
      echo "  → Marking as failed"
      psql -d sovren -c "
      UPDATE payments
      SET status = 'failed', failed_at = NOW(), updated_at = NOW()
      WHERE payment_hash = '$PAYMENT_HASH';
      "
      ;;
    OPEN)
      echo "  → Resetting to pending"
      psql -d sovren -c "
      UPDATE payments
      SET status = 'pending', updated_at = NOW()
      WHERE payment_hash = '$PAYMENT_HASH';
      "
      ;;
    *)
      echo "  → Unknown state: $LND_STATE, skipping"
      ;;
  esac
done

echo "Recovery complete"
```

---

### Manual Payment Confirmation

```bash
#!/bin/bash
# Manually confirm a payment that was verified externally

PAYMENT_HASH="$1"

if [ -z "$PAYMENT_HASH" ]; then
  echo "Usage: $0 <payment-hash>"
  exit 1
fi

# Verify with LND first
LND_SETTLED=$(docker exec sovren-lnd lncli --network=mainnet lookupinvoice "$PAYMENT_HASH" 2>/dev/null | jq -r '.settled')

if [ "$LND_SETTLED" != "true" ]; then
  echo "ERROR: Payment not settled according to LND"
  exit 1
fi

# Update database
psql -d sovren -c "
BEGIN;

UPDATE payments
SET status = 'completed',
    settled_at = NOW(),
    updated_at = NOW(),
    notes = COALESCE(notes, '') || ' [Manually confirmed]'
WHERE payment_hash = '$PAYMENT_HASH'
  AND status != 'completed';

INSERT INTO payment_state_history (payment_hash, from_state, to_state, triggered_by, notes)
SELECT '$PAYMENT_HASH', status, 'completed', 'manual_recovery', 'Manually confirmed via script'
FROM payments
WHERE payment_hash = '$PAYMENT_HASH';

COMMIT;
"

echo "Payment $PAYMENT_HASH marked as completed"

# Trigger post-payment webhooks
curl -X POST http://localhost:8080/api/internal/trigger-payment-confirmation \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d "{\"payment_hash\": \"$PAYMENT_HASH\"}"

echo "Post-payment webhooks triggered"
```

---

### Reset Circuit Breaker

```bash
# Check circuit breaker status
curl http://localhost:8080/api/metrics/circuit-breaker

# Reset circuit breaker (requires admin token)
curl -X POST http://localhost:8080/api/internal/circuit-breaker/reset \
  -H "Authorization: Bearer $ADMIN_TOKEN"

echo "Circuit breaker reset successfully"
```

---

### Clear Webhook Cache (Replay Protection)

```bash
# Clear Redis webhook ID cache for specific webhook
WEBHOOK_ID="<webhook-id>"

redis-cli DEL "webhook:$WEBHOOK_ID"

echo "Webhook $WEBHOOK_ID can now be reprocessed"

# Clear all expired webhook caches (older than 24 hours)
redis-cli --scan --pattern "webhook:*" | while read key; do
  TTL=$(redis-cli TTL "$key")
  if [ "$TTL" -lt 0 ]; then
    redis-cli DEL "$key"
    echo "Cleared expired: $key"
  fi
done
```

---

## 7. Monitoring & Alerts

### Check Active Alerts

```bash
# API endpoint for active alerts
curl http://localhost:8080/api/analytics/active-alerts | jq

# Example output:
# [
#   {
#     "severity": "warning",
#     "type": "latency",
#     "message": "Average payment duration (1.2s) exceeds threshold (1s)",
#     "triggered_at": "2025-10-25T14:25:00Z"
#   }
# ]
```

---

### Payment System Health Check

```bash
#!/bin/bash
# Comprehensive health check script

echo "=== Payment System Health Check ==="
echo ""

# 1. Lightning Node
echo "[1/6] Lightning Node Status"
LND_SYNCED=$(docker exec sovren-lnd lncli --network=mainnet getinfo 2>/dev/null | jq -r '.synced_to_chain')
if [ "$LND_SYNCED" = "true" ]; then
  echo "  ✓ LND is synced"
else
  echo "  ✗ LND is NOT synced"
fi

# 2. Database
echo "[2/6] Database Connection"
DB_CONNECTIONS=$(psql -d sovren -t -c "SELECT count(*) FROM pg_stat_activity;")
echo "  ✓ Active connections: $DB_CONNECTIONS"

# 3. Recent Payment Success Rate
echo "[3/6] Payment Success Rate (last hour)"
SUCCESS_RATE=$(psql -d sovren -t -c "
SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'completed') / COUNT(*), 2)
FROM payments
WHERE created_at > NOW() - INTERVAL '1 hour';
")
echo "  ✓ Success rate: ${SUCCESS_RATE}%"

# 4. Stuck Payments
echo "[4/6] Stuck Payments"
STUCK_COUNT=$(psql -d sovren -t -c "
SELECT COUNT(*)
FROM payments
WHERE status IN ('processing', 'verifying')
  AND updated_at < NOW() - INTERVAL '5 minutes';
")
if [ "$STUCK_COUNT" -eq 0 ]; then
  echo "  ✓ No stuck payments"
else
  echo "  ⚠ $STUCK_COUNT stuck payments found"
fi

# 5. Circuit Breaker
echo "[5/6] Circuit Breaker Status"
CB_STATE=$(curl -s http://localhost:8080/api/metrics/circuit-breaker | jq -r '.state')
echo "  ✓ Circuit breaker: $CB_STATE"

# 6. Active Alerts
echo "[6/6] Active Alerts"
ALERT_COUNT=$(curl -s http://localhost:8080/api/analytics/active-alerts | jq '. | length')
if [ "$ALERT_COUNT" -eq 0 ]; then
  echo "  ✓ No active alerts"
else
  echo "  ⚠ $ALERT_COUNT active alerts"
  curl -s http://localhost:8080/api/analytics/active-alerts | jq -r '.[] | "    - \(.severity | ascii_upcase): \(.message)"'
fi

echo ""
echo "=== Health Check Complete ==="
```

---

### Set Up Monitoring Dashboard

```bash
# Export Prometheus metrics
curl http://localhost:8080/api/metrics/prometheus

# Grafana dashboard data
curl http://localhost:8080/api/analytics/dashboard-data | jq

# Example response:
# {
#   "success_rate": 0.985,
#   "payments_last_hour": 156,
#   "avg_verification_ms": 180,
#   "active_payments": 3,
#   "circuit_breaker_state": "closed",
#   "lnd_synced": true
# }
```

---

## 8. Bulk Operations

### Export Payment Data

```bash
# Export to CSV (last 30 days)
psql -d sovren -c "\COPY (
  SELECT
    payment_hash,
    user_id,
    creator_id,
    amount_sats,
    status,
    created_at,
    settled_at
  FROM payments
  WHERE created_at > NOW() - INTERVAL '30 days'
  ORDER BY created_at DESC
) TO '/tmp/payments-export.csv' WITH CSV HEADER;"

echo "Exported to /tmp/payments-export.csv"

# Export to JSON
psql -d sovren -t -c "
SELECT json_agg(row_to_json(t))
FROM (
  SELECT
    payment_hash,
    user_id,
    creator_id,
    amount_sats,
    status,
    created_at,
    settled_at
  FROM payments
  WHERE created_at > NOW() - INTERVAL '30 days'
  ORDER BY created_at DESC
) t;
" > /tmp/payments-export.json

echo "Exported to /tmp/payments-export.json"
```

---

### Bulk Payment Reconciliation

```bash
#!/bin/bash
# Reconcile database payment states with Lightning node

echo "Starting bulk reconciliation..."

ALL_PAYMENTS=$(psql -d sovren -t -c "
SELECT payment_hash
FROM payments
WHERE status IN ('pending', 'processing', 'verifying')
  AND created_at > NOW() - INTERVAL '24 hours';
")

TOTAL=$(echo "$ALL_PAYMENTS" | wc -l)
CURRENT=0

for PAYMENT_HASH in $ALL_PAYMENTS; do
  CURRENT=$((CURRENT + 1))
  echo "[$CURRENT/$TOTAL] Reconciling $PAYMENT_HASH..."

  # Get LND state
  LND_INFO=$(docker exec sovren-lnd lncli --network=mainnet lookupinvoice "$PAYMENT_HASH" 2>/dev/null)
  LND_STATE=$(echo "$LND_INFO" | jq -r '.state')
  LND_SETTLED=$(echo "$LND_INFO" | jq -r '.settled')

  # Get DB state
  DB_STATE=$(psql -d sovren -t -c "SELECT status FROM payments WHERE payment_hash = '$PAYMENT_HASH';")

  # Reconcile if different
  if [ "$LND_SETTLED" = "true" ] && [ "$DB_STATE" != "completed" ]; then
    echo "  → Mismatch! LND=settled, DB=$DB_STATE. Updating..."
    psql -d sovren -c "
    UPDATE payments
    SET status = 'completed', settled_at = NOW(), updated_at = NOW()
    WHERE payment_hash = '$PAYMENT_HASH';
    "
  elif [ "$LND_STATE" = "CANCELED" ] || [ "$LND_STATE" = "EXPIRED" ]; then
    if [ "$DB_STATE" != "failed" ]; then
      echo "  → Mismatch! LND=$LND_STATE, DB=$DB_STATE. Updating..."
      psql -d sovren -c "
      UPDATE payments
      SET status = 'failed', failed_at = NOW(), updated_at = NOW()
      WHERE payment_hash = '$PAYMENT_HASH';
      "
    fi
  else
    echo "  ✓ In sync: $DB_STATE"
  fi

  # Rate limit to avoid overwhelming LND
  sleep 0.1
done

echo "Reconciliation complete. Processed $TOTAL payments."
```

---

### Generate Daily Payment Report

```bash
#!/bin/bash
# Generate daily payment summary report

DATE=${1:-$(date -d "yesterday" +%Y-%m-%d)}

echo "=== Payment Report for $DATE ==="
echo ""

psql -d sovren << EOF
-- Summary Statistics
SELECT
  'Total Payments' as metric,
  COUNT(*)::text as value
FROM payments
WHERE DATE(created_at) = '$DATE'

UNION ALL

SELECT
  'Successful Payments',
  COUNT(*)::text
FROM payments
WHERE DATE(created_at) = '$DATE'
  AND status = 'completed'

UNION ALL

SELECT
  'Failed Payments',
  COUNT(*)::text
FROM payments
WHERE DATE(created_at) = '$DATE'
  AND status = 'failed'

UNION ALL

SELECT
  'Success Rate',
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'completed') / COUNT(*), 2)::text || '%'
FROM payments
WHERE DATE(created_at) = '$DATE'

UNION ALL

SELECT
  'Total Volume (sats)',
  SUM(amount_sats)::text
FROM payments
WHERE DATE(created_at) = '$DATE'
  AND status = 'completed'

UNION ALL

SELECT
  'Average Payment (sats)',
  ROUND(AVG(amount_sats))::text
FROM payments
WHERE DATE(created_at) = '$DATE'
  AND status = 'completed'

UNION ALL

SELECT
  'Median Payment (sats)',
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY amount_sats)::integer::text
FROM payments
WHERE DATE(created_at) = '$DATE'
  AND status = 'completed';
EOF
```

---

## Quick Reference Card

**Print this section for rapid incident response:**

```bash
# EMERGENCY - Payment System Down
docker restart sovren-lnd && sleep 30 && docker exec sovren-lnd lncli getinfo

# EMERGENCY - Stuck Payments
./recover-stuck-payments.sh

# Check if payment settled
docker exec sovren-lnd lncli lookupinvoice <payment-hash> | jq '.settled'

# Manual payment confirmation
psql -d sovren -c "UPDATE payments SET status='completed' WHERE payment_hash='<hash>';"

# Reset circuit breaker
curl -X POST http://localhost:8080/api/internal/circuit-breaker/reset

# View recent errors
psql -d sovren -c "SELECT * FROM payments WHERE status='failed' AND created_at > NOW() - INTERVAL '1 hour';"

# Check system health
curl http://localhost:8080/api/health | jq

# View active alerts
curl http://localhost:8080/api/analytics/active-alerts | jq
```

---

**Version:** 1.0.0
**Maintained By:** Platform Engineering Team
**Support:** #sovren-payment-support
