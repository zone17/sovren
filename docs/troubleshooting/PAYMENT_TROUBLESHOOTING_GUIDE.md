# Lightning Payment Troubleshooting Guide

**Version:** 1.0.0
**Last Updated:** 2025-10-25
**Audience:** Operations team, DevOps engineers, Support engineers
**Related Documentation:** [Payment System Architecture](../features/LIGHTNING_PAYMENT_ARCHITECTURE.md), [Payment Analytics](../deployment/PAYMENT_MONITORING.md)

---

## Table of Contents

1. [Quick Diagnosis](#quick-diagnosis)
2. [Invoice Creation Issues](#1-invoice-creation-issues)
3. [Payment Verification Issues](#2-payment-verification-issues)
4. [Webhook Issues](#3-webhook-issues)
5. [Retry Logic Issues](#4-retry-logic-issues)
6. [State Machine Issues](#5-state-machine-issues)
7. [Performance Issues](#6-performance-issues)
8. [Emergency Procedures](#7-emergency-procedures)
9. [Debugging Commands Reference](#debugging-commands-reference)

---

## Quick Diagnosis

Use this decision tree to quickly identify the issue category:

```
Payment Issue
├─ Invoice won't generate? → Section 1: Invoice Creation Issues
├─ Payment stuck pending? → Section 2: Payment Verification Issues
├─ Webhook not received? → Section 3: Webhook Issues
├─ Payment keeps retrying? → Section 4: Retry Logic Issues
├─ Invalid state transition? → Section 5: State Machine Issues
└─ System running slow? → Section 6: Performance Issues
```

**First Steps for Any Issue:**

1. Check payment analytics dashboard: `/api/analytics/realtime-metrics`
2. Review recent alerts: Check monitoring logs for active alerts
3. Verify system health: Ensure Lightning node is synced and connected
4. Check rate limits: Confirm no rate limit alerts are active

---

## 1. Invoice Creation Issues

### 1.1 Failed to Create Invoice

**Symptoms:**

- User receives "Failed to create Lightning invoice" error
- API returns 500 error on invoice creation
- No invoice record in database

**Root Cause:**
One of the following:

- Lightning node is disconnected or not responding
- Insufficient inbound liquidity on Lightning channels
- Invalid amount (too high or below dust limit)
- LND API timeout or network issues

**Diagnostic Steps:**

```bash
# 1. Check Lightning node status
curl http://localhost:8080/api/lightning/node-info

# Expected healthy response:
# {
#   "syncedToChain": true,
#   "numActiveChannels": > 0,
#   "totalCapacity": > 0
# }

# 2. Check recent invoice creation attempts
psql -d sovren -c "
SELECT id, amount, status, created_at, error_message
FROM lightning_invoices
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 20;
"

# 3. Check LND logs for errors
docker logs sovren-lnd --tail 100 | grep -i error

# 4. Test invoice creation manually
curl -X POST http://localhost:8080/api/lightning/create-invoice \
  -H "Content-Type: application/json" \
  -d '{"amount": 1000, "description": "Test invoice"}'
```

**Resolution:**

**Case 1: Lightning node disconnected**

```bash
# Restart Lightning node
docker restart sovren-lnd

# Wait 30 seconds for sync
sleep 30

# Verify sync status
curl http://localhost:8080/api/lightning/node-info
```

**Case 2: Insufficient inbound liquidity**

```bash
# Check channel balances
lncli channelbalance

# If needed, open new channels or rebalance existing ones
# Contact Lightning network operations team
```

**Case 3: Invalid amount**

```bash
# Check minimum/maximum invoice amounts
# Minimum: 1 sat
# Maximum: Based on channel capacity

# Update validation in frontend if needed
```

**Prevention:**

- Implement health checks for Lightning node (every 30 seconds)
- Alert on channel balance below 20% capacity
- Set up automated channel rebalancing
- Implement graceful degradation when node is temporarily unavailable

---

### 1.2 Invalid Invoice Amount

**Symptoms:**

- API rejects invoice creation with "Invalid amount" error
- Amount validation fails before reaching Lightning node

**Root Cause:**

- Amount below 1 satoshi (dust limit)
- Amount exceeds channel capacity
- Amount exceeds platform maximum (if configured)
- Invalid format (negative, decimal, or non-numeric)

**Diagnostic Steps:**

```bash
# 1. Check the rejected request in logs
tail -f /var/log/sovren/api.log | grep "Invalid amount"

# 2. Verify amount validation rules
curl http://localhost:8080/api/lightning/limits

# 3. Check recent validation failures
psql -d sovren -c "
SELECT amount, error_message, created_at, user_id
FROM payment_errors
WHERE error_type = 'INVALID_AMOUNT'
  AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
"
```

**Resolution:**

```typescript
// Update amount validation rules in backend
// packages/backend/src/routes/lightning.ts

const MIN_INVOICE_AMOUNT = 1; // satoshis
const MAX_INVOICE_AMOUNT = 1_000_000; // 0.01 BTC

if (amount < MIN_INVOICE_AMOUNT || amount > MAX_INVOICE_AMOUNT) {
  return res.status(400).json({
    success: false,
    error: `Amount must be between ${MIN_INVOICE_AMOUNT} and ${MAX_INVOICE_AMOUNT} sats`,
  });
}
```

**Prevention:**

- Implement client-side validation before API call
- Display clear min/max limits in UI
- Add validation to frontend forms
- Log all validation failures for analysis

---

### 1.3 Lightning Node Connection Error

**Symptoms:**

- All invoice creation attempts fail
- "Lightning service initialization failed" error on startup
- Node info endpoint returns 503

**Root Cause:**

- LND node is down or unreachable
- Network connectivity issues
- TLS certificate mismatch
- Macaroon authentication failure

**Diagnostic Steps:**

```bash
# 1. Check if LND container is running
docker ps | grep lnd

# 2. Check LND health
docker exec sovren-lnd lncli --network=mainnet getinfo

# 3. Check network connectivity
docker exec sovren-lnd ping -c 3 <lnd-host>

# 4. Verify TLS and macaroon files
docker exec sovren-lnd ls -la /root/.lnd/tls.cert
docker exec sovren-lnd ls -la /root/.lnd/data/chain/bitcoin/mainnet/admin.macaroon

# 5. Check LND sync status
docker exec sovren-lnd lncli --network=mainnet getinfo | jq '.synced_to_chain'
```

**Resolution:**

```bash
# 1. If LND is down, start it
docker start sovren-lnd

# 2. If not responding, restart
docker restart sovren-lnd

# 3. Wait for sync (can take 5-10 minutes)
while [ "$(docker exec sovren-lnd lncli --network=mainnet getinfo | jq -r '.synced_to_chain')" != "true" ]; do
  echo "Waiting for LND to sync..."
  sleep 10
done

# 4. If TLS issues, regenerate certificates
docker exec sovren-lnd lncli --network=mainnet stop
rm /root/.lnd/tls.cert /root/.lnd/tls.key
docker start sovren-lnd

# 5. Verify connection from app
curl http://localhost:8080/api/lightning/node-info
```

**Prevention:**

- Implement automatic LND health checks
- Set up monitoring alerts for node downtime
- Use connection pooling with retry logic
- Maintain backup LND node for failover

---

## 2. Payment Verification Issues

### 2.1 Payment Stuck in Pending State

**Symptoms:**

- Payment shows "pending" for > 5 minutes
- User paid but no confirmation
- Database shows `status = 'pending'` for extended period

**Root Cause:**

- Webhook not received from payment provider
- Verification polling stopped or failed
- Payment actually failed on Lightning Network
- Database lock preventing state update

**Diagnostic Steps:**

```bash
# 1. Check payment record in database
psql -d sovren -c "
SELECT
  id,
  payment_hash,
  status,
  amount_sats,
  created_at,
  updated_at,
  EXTRACT(EPOCH FROM (NOW() - created_at)) as age_seconds
FROM payments
WHERE status = 'pending'
  AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
"

# 2. Manually check invoice status with Lightning node
PAYMENT_HASH="<hash-from-above>"
docker exec sovren-lnd lncli --network=mainnet lookupinvoice $PAYMENT_HASH

# 3. Check webhook delivery logs
tail -f /var/log/sovren/webhooks.log | grep $PAYMENT_HASH

# 4. Check verification service logs
tail -f /var/log/sovren/payment-verification.log | grep $PAYMENT_HASH

# 5. Check for database locks
psql -d sovren -c "
SELECT pid, usename, state, query_start, query
FROM pg_stat_activity
WHERE query LIKE '%payments%'
  AND state != 'idle';
"
```

**Resolution:**

**Case 1: Payment actually settled (webhook missed)**

```bash
# 1. Get current invoice status from LND
SETTLED=$(docker exec sovren-lnd lncli --network=mainnet lookupinvoice $PAYMENT_HASH | jq -r '.settled')

# 2. If settled=true, manually update database
if [ "$SETTLED" = "true" ]; then
  psql -d sovren -c "
  UPDATE payments
  SET status = 'completed',
      settled_at = NOW(),
      updated_at = NOW()
  WHERE payment_hash = '$PAYMENT_HASH'
    AND status = 'pending';
  "

  echo "Payment manually marked as completed"
fi

# 3. Trigger any post-payment webhooks or notifications
curl -X POST http://localhost:8080/api/internal/trigger-payment-confirmation \
  -H "Content-Type: application/json" \
  -d "{\"payment_hash\": \"$PAYMENT_HASH\"}"
```

**Case 2: Payment failed but not updated**

```bash
# 1. Check actual payment status
STATUS=$(docker exec sovren-lnd lncli --network=mainnet lookupinvoice $PAYMENT_HASH | jq -r '.state')

# 2. If CANCELED or EXPIRED, mark as failed
if [ "$STATUS" = "CANCELED" ] || [ "$STATUS" = "EXPIRED" ]; then
  psql -d sovren -c "
  UPDATE payments
  SET status = 'failed',
      error_message = 'Invoice expired or canceled',
      updated_at = NOW()
  WHERE payment_hash = '$PAYMENT_HASH'
    AND status = 'pending';
  "
fi
```

**Case 3: Database lock preventing update**

```bash
# 1. Identify blocking queries
psql -d sovren -c "
SELECT
  blocking.pid AS blocking_pid,
  blocking.query AS blocking_query,
  blocked.pid AS blocked_pid,
  blocked.query AS blocked_query
FROM pg_stat_activity blocked
JOIN pg_stat_activity blocking
  ON blocking.pid = ANY(pg_blocking_pids(blocked.pid))
WHERE blocked.query LIKE '%payments%';
"

# 2. Terminate blocking query (CAUTION: only if safe)
# First verify query is safe to kill
psql -d sovren -c "SELECT pg_terminate_backend(<blocking_pid>);"

# 3. Retry payment update
```

**Prevention:**

- Implement payment verification timeout (5 minutes max)
- Auto-transition to "verification_failed" after timeout
- Set up webhook retry logic with exponential backoff
- Monitor pending payment age and alert on >2 minutes
- Use advisory locks instead of row locks for payment updates

---

### 2.2 False Positive Payment Confirmations

**Symptoms:**

- Payment marked as completed but no actual payment received
- User gets access without paying
- Lightning node shows invoice as unpaid

**Root Cause:**

- Webhook signature verification bypassed or compromised
- Race condition in verification logic
- Replay attack using old webhook
- Database integrity issue

**Diagnostic Steps:**

```bash
# 1. Verify payment in Lightning node
PAYMENT_HASH="<suspicious-payment-hash>"
docker exec sovren-lnd lncli --network=mainnet lookupinvoice $PAYMENT_HASH

# 2. Check webhook signature verification logs
grep "$PAYMENT_HASH" /var/log/sovren/webhooks.log | grep -i signature

# 3. Check for replay attacks
psql -d sovren -c "
SELECT
  webhook_id,
  payment_hash,
  received_at,
  signature_valid,
  timestamp_valid,
  is_replay
FROM webhook_logs
WHERE payment_hash = '$PAYMENT_HASH'
ORDER BY received_at;
"

# 4. Verify payment amount matches
psql -d sovren -c "
SELECT
  p.id,
  p.amount_sats as db_amount,
  p.status,
  i.amount as invoice_amount
FROM payments p
JOIN lightning_invoices i ON p.payment_hash = i.payment_hash
WHERE p.payment_hash = '$PAYMENT_HASH';
"
```

**Resolution:**

**CRITICAL: If false positive confirmed, immediately:**

```bash
# 1. Revoke access for affected user
psql -d sovren -c "
UPDATE payments
SET status = 'disputed',
    notes = 'False positive - payment not actually received',
    updated_at = NOW()
WHERE payment_hash = '$PAYMENT_HASH';
"

# 2. Revoke subscription or content access
psql -d sovren -c "
UPDATE subscriptions
SET status = 'suspended',
    suspended_reason = 'Payment verification failed',
    updated_at = NOW()
WHERE payment_hash = '$PAYMENT_HASH';
"

# 3. Alert security team
curl -X POST $SLACK_WEBHOOK_URL \
  -H 'Content-Type: application/json' \
  -d "{
    \"text\": \"🚨 SECURITY ALERT: False positive payment detected\",
    \"attachments\": [{
      \"color\": \"danger\",
      \"fields\": [
        {\"title\": \"Payment Hash\", \"value\": \"$PAYMENT_HASH\"},
        {\"title\": \"Action\", \"value\": \"Access revoked, payment marked disputed\"}
      ]
    }]
  }"

# 4. Review webhook signature verification
# Check packages/backend/src/routes/webhooks.ts for vulnerabilities
```

**Prevention:**

- **NEVER** skip webhook signature verification
- Implement replay attack prevention (nonce tracking)
- Always cross-verify with Lightning node before granting access
- Use strict timestamp validation (max 5 minutes)
- Log all verification steps with immutable audit trail
- Implement webhook secret rotation
- Rate limit webhooks per IP (100/minute)

---

### 2.3 Webhook Verification Delays

**Symptoms:**

- Payment confirmed but user sees "processing" for >30 seconds
- Webhook received but processing slow
- Database update lag

**Root Cause:**

- Database connection pool exhausted
- Slow Lightning node response
- Heavy load on verification service
- Network latency to Lightning node

**Diagnostic Steps:**

```bash
# 1. Check webhook processing times
psql -d sovren -c "
SELECT
  AVG(EXTRACT(EPOCH FROM (processed_at - received_at))) as avg_processing_seconds,
  MAX(EXTRACT(EPOCH FROM (processed_at - received_at))) as max_processing_seconds,
  COUNT(*) as webhook_count
FROM webhook_logs
WHERE received_at > NOW() - INTERVAL '1 hour';
"

# 2. Check database connection pool
psql -d sovren -c "
SELECT count(*), state
FROM pg_stat_activity
GROUP BY state;
"

# 3. Check LND response times
docker exec sovren-lnd lncli --network=mainnet --rpc.command.timeout=5s getinfo

# 4. Monitor current verification queue
curl http://localhost:8080/api/metrics/verification-queue
```

**Resolution:**

```bash
# 1. If database pool exhausted, increase pool size
# Edit .env or docker-compose.yml:
DB_POOL_SIZE=20  # Increase from default 10

# 2. Restart app to apply new pool size
docker-compose restart api

# 3. If LND slow, check sync status
docker exec sovren-lnd lncli --network=mainnet getinfo | jq '.synced_to_graph'

# 4. Add caching for frequently checked invoices
# Implement Redis caching with 30-second TTL

# 5. Optimize verification query
# Add index if missing:
psql -d sovren -c "
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_hash_status
ON payments(payment_hash, status);
"
```

**Prevention:**

- Set SLA targets: 95% of verifications < 2 seconds
- Implement async webhook processing with queue
- Cache invoice status for 30 seconds
- Use connection pooling with proper limits
- Monitor P95/P99 latency and alert on degradation
- Implement circuit breaker for Lightning node calls

---

## 3. Webhook Issues

### 3.1 Webhook Signature Verification Failures

**Symptoms:**

- Webhook rejected with "Invalid signature" error
- Legitimate webhooks not processing
- 403 responses in webhook logs

**Root Cause:**

- Webhook secret mismatch (wrong secret configured)
- Timestamp outside tolerance window (>5 minutes)
- Payload modification in transit
- Secret rotation not properly handled

**Diagnostic Steps:**

```bash
# 1. Check recent signature failures
tail -f /var/log/sovren/webhooks.log | grep "Invalid signature"

# 2. Verify webhook secret configuration
echo $WEBHOOK_SECRET | base64  # Should match provider's secret

# 3. Check webhook timestamp validation
psql -d sovren -c "
SELECT
  webhook_id,
  received_at,
  webhook_timestamp,
  EXTRACT(EPOCH FROM (received_at - webhook_timestamp)) as time_diff_seconds,
  signature_valid,
  timestamp_valid
FROM webhook_logs
WHERE signature_valid = false
  AND received_at > NOW() - INTERVAL '1 hour'
ORDER BY received_at DESC
LIMIT 20;
"

# 4. Test signature generation manually
PAYLOAD='{"payment_hash":"abc123","status":"completed"}'
TIMESTAMP=$(date +%s)
SIGNATURE=$(echo -n "${TIMESTAMP}.${PAYLOAD}" | openssl dgst -sha256 -hmac "$WEBHOOK_SECRET" -binary | base64)
echo "Expected signature: $SIGNATURE"
```

**Resolution:**

**Case 1: Wrong webhook secret**

```bash
# 1. Verify secret with payment provider
# Contact provider to confirm current webhook secret

# 2. Update secret in environment
# Edit .env file:
WEBHOOK_SECRET="<correct-secret-from-provider>"

# 3. Restart API server
docker-compose restart api

# 4. Test with new secret
curl -X POST http://localhost:8080/api/webhooks/payment \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: <valid-signature>" \
  -H "X-Webhook-Timestamp: $(date +%s)" \
  -d '{"payment_hash":"test123","status":"completed"}'
```

**Case 2: Timestamp tolerance issues**

```bash
# 1. Check server time sync
timedatectl status

# 2. If time drift detected, sync with NTP
sudo ntpdate -s time.nist.gov

# 3. Verify time difference
date -u +%s  # Server time
# Compare with webhook timestamp in logs

# 4. If necessary, increase tolerance temporarily (not recommended)
# Edit packages/backend/src/routes/webhooks.ts
# WEBHOOK_TIMESTAMP_TOLERANCE = 600; // 10 minutes (default: 5)
```

**Case 3: Secret rotation**

```bash
# 1. Configure secondary secret for rotation period
WEBHOOK_SECRET_ROTATION="<new-secret>"

# 2. Update environment and restart
docker-compose restart api

# 3. Verify both old and new secrets work

# 4. After migration period, remove old secret
# Edit .env and remove WEBHOOK_SECRET, rename ROTATION to SECRET
```

**Prevention:**

- Implement webhook secret rotation procedure
- Monitor signature failure rate (alert if >1%)
- Use NTP for accurate server time
- Log all signature validation attempts
- Test webhook signature before going live
- Document secret rotation process

---

### 3.2 Duplicate Webhook Deliveries

**Symptoms:**

- Same webhook received multiple times
- Payment processed multiple times
- User charged twice for same transaction

**Root Cause:**

- Payment provider retry logic
- No idempotency key checking
- Webhook processing not atomic
- Race condition in state machine

**Diagnostic Steps:**

```bash
# 1. Check for duplicate webhook IDs
psql -d sovren -c "
SELECT
  payment_hash,
  webhook_id,
  COUNT(*) as delivery_count,
  ARRAY_AGG(received_at ORDER BY received_at) as received_times
FROM webhook_logs
WHERE received_at > NOW() - INTERVAL '1 hour'
GROUP BY payment_hash, webhook_id
HAVING COUNT(*) > 1
ORDER BY delivery_count DESC;
"

# 2. Check for duplicate payment processing
psql -d sovren -c "
SELECT
  payment_hash,
  COUNT(*) as process_count,
  ARRAY_AGG(status ORDER BY updated_at) as status_history
FROM payment_state_transitions
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY payment_hash
HAVING COUNT(*) > 1;
"

# 3. Check idempotency key usage
grep "Duplicate webhook" /var/log/sovren/webhooks.log | tail -20
```

**Resolution:**

**Immediate fix for duplicate charge:**

```bash
# 1. Identify affected payment
PAYMENT_HASH="<duplicate-payment-hash>"

# 2. Check payment count
psql -d sovren -c "
SELECT id, payment_hash, amount_sats, status, created_at
FROM payments
WHERE payment_hash = '$PAYMENT_HASH'
ORDER BY created_at;
"

# 3. Refund duplicate payment (keep only first)
DUPLICATE_ID="<id-of-duplicate>"
psql -d sovren -c "
UPDATE payments
SET status = 'refunded',
    refund_reason = 'Duplicate webhook processing',
    refund_processed_at = NOW()
WHERE id = '$DUPLICATE_ID';
"

# 4. Initiate Lightning refund
curl -X POST http://localhost:8080/api/lightning/refund \
  -H "Content-Type: application/json" \
  -d "{\"payment_id\": \"$DUPLICATE_ID\"}"
```

**Implement idempotency:**

```typescript
// packages/backend/src/routes/webhooks.ts

// Store processed webhook IDs
const processedWebhooks = new Set<string>();

router.post('/payment', async (req, res) => {
  const webhookId = req.headers['x-webhook-id'] as string;

  // Check if already processed
  const alreadyProcessed = await redis.get(`webhook:${webhookId}`);
  if (alreadyProcessed) {
    console.log(`[WEBHOOK] Duplicate webhook ignored: ${webhookId}`);
    return res.status(200).json({ success: true, message: 'Already processed' });
  }

  // Mark as processing (24 hour TTL)
  await redis.setex(`webhook:${webhookId}`, 86400, 'processing');

  // Process webhook...

  // Mark as completed
  await redis.setex(`webhook:${webhookId}`, 86400, 'completed');
});
```

**Prevention:**

- Implement idempotency key tracking (Redis with 24-hour TTL)
- Use database transactions for atomic payment processing
- Log all webhook IDs and check before processing
- Use payment state machine to prevent invalid transitions
- Monitor for duplicate webhook patterns

---

### 3.3 Out-of-Order Webhook Delivery

**Symptoms:**

- "completed" webhook received before "processing" webhook
- State machine rejects valid transition
- Payment stuck in intermediate state

**Root Cause:**

- Network latency variations
- Multiple webhook processors
- Concurrent webhook delivery
- Retry logic interfering with normal flow

**Diagnostic Steps:**

```bash
# 1. Check webhook delivery order
psql -d sovren -c "
SELECT
  payment_hash,
  webhook_id,
  status as webhook_status,
  received_at,
  processed_at,
  LAG(status) OVER (PARTITION BY payment_hash ORDER BY received_at) as previous_status
FROM webhook_logs
WHERE payment_hash = '<payment-hash>'
ORDER BY received_at;
"

# 2. Check state machine transitions
psql -d sovren -c "
SELECT
  payment_hash,
  from_state,
  to_state,
  created_at,
  is_valid_transition
FROM payment_state_transitions
WHERE payment_hash = '<payment-hash>'
ORDER BY created_at;
"

# 3. Check for concurrent processing
psql -d sovren -c "
SELECT
  payment_hash,
  COUNT(*) as concurrent_updates,
  MAX(received_at) - MIN(received_at) as time_diff
FROM webhook_logs
WHERE payment_hash = '<payment-hash>'
  AND ABS(EXTRACT(EPOCH FROM (received_at - MAX(received_at) OVER (PARTITION BY payment_hash)))) < 1
GROUP BY payment_hash
HAVING COUNT(*) > 1;
"
```

**Resolution:**

```typescript
// packages/backend/src/services/payment/PaymentStateMachine.ts

// Implement version-based concurrency control
async transitionState(
  paymentHash: string,
  toState: PaymentState,
  expectedVersion?: number
): Promise<void> {
  // Get current state with version
  const current = await this.getCurrentState(paymentHash);

  // Verify version matches (optimistic locking)
  if (expectedVersion && current.version !== expectedVersion) {
    throw new Error('Payment state changed, retry operation');
  }

  // Allow idempotent transitions (arriving at same end state is OK)
  if (current.state === toState) {
    console.log(`[STATE] Already in state ${toState}, ignoring duplicate transition`);
    return;
  }

  // Validate transition is legal
  if (!this.isValidTransition(current.state, toState)) {
    // Check if we're behind (e.g., "pending" -> "completed" when already "processing")
    if (this.isProgressiveState(toState, current.state)) {
      console.log(`[STATE] Ignoring outdated transition to ${toState}, already at ${current.state}`);
      return;
    }
    throw new Error(`Invalid state transition: ${current.state} -> ${toState}`);
  }

  // Atomic update with version increment
  await this.db.query(`
    UPDATE payments
    SET status = $1, version = version + 1, updated_at = NOW()
    WHERE payment_hash = $2 AND version = $3
  `, [toState, paymentHash, current.version]);
}
```

**Prevention:**

- Implement optimistic locking with version numbers
- Allow idempotent state transitions
- Ignore webhooks for already-reached states
- Use message queue for ordered processing
- Add webhook sequence numbers if provider supports

---

## 4. Retry Logic Issues

### 4.1 Circuit Breaker Open

**Symptoms:**

- All payment operations failing immediately
- "Circuit breaker open" error messages
- Payments not even attempted

**Root Cause:**

- Too many consecutive failures (5+ in 60 seconds)
- Lightning node was down and circuit opened
- Failure threshold too sensitive
- Circuit not resetting after node recovery

**Diagnostic Steps:**

```bash
# 1. Check circuit breaker status
curl http://localhost:8080/api/metrics/circuit-breaker

# Expected response:
# {
#   "state": "open" | "closed" | "half-open",
#   "failure_count": 8,
#   "last_failure_at": "2025-10-25T14:32:10Z",
#   "opens_at": "2025-10-25T14:33:10Z"  # When circuit opened
# }

# 2. Check recent failure patterns
psql -d sovren -c "
SELECT
  DATE_TRUNC('minute', created_at) as minute,
  COUNT(*) as failure_count,
  ARRAY_AGG(DISTINCT error_message) as error_types
FROM payment_errors
WHERE created_at > NOW() - INTERVAL '1 hour'
  AND is_circuit_breaker_trigger = true
GROUP BY DATE_TRUNC('minute', created_at)
ORDER BY minute DESC;
"

# 3. Verify Lightning node status
docker exec sovren-lnd lncli --network=mainnet getinfo
```

**Resolution:**

**Case 1: Node recovered, manually close circuit**

```bash
# 1. Verify node is healthy
curl http://localhost:8080/api/lightning/node-info

# 2. If healthy, manually reset circuit breaker
curl -X POST http://localhost:8080/api/internal/circuit-breaker/reset \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 3. Verify circuit closed
curl http://localhost:8080/api/metrics/circuit-breaker
```

**Case 2: Adjust circuit breaker thresholds**

```bash
# Edit configuration (requires deployment)
# packages/backend/src/config/circuit-breaker.ts

export const CIRCUIT_BREAKER_CONFIG = {
  failure_threshold: 10,        // Failures before opening (increase from 5)
  reset_timeout_ms: 60000,      // 1 minute before attempting reset
  half_open_max_requests: 3,    // Test requests in half-open state
  rolling_window_ms: 120000,    // 2 minute window (increase from 60s)
};
```

**Case 3: Implement gradual recovery**

```typescript
// packages/backend/src/services/CircuitBreaker.ts

class CircuitBreaker {
  async executeWithBreaker<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      // Check if timeout elapsed
      if (Date.now() - this.openedAt > this.resetTimeout) {
        this.state = 'half-open';
        console.log('[CIRCUIT] Entering half-open state, testing requests');
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    if (this.state === 'half-open') {
      // Limit concurrent test requests
      if (this.halfOpenRequests >= this.maxHalfOpenRequests) {
        throw new Error('Circuit breaker is half-open, max test requests reached');
      }
      this.halfOpenRequests++;
    }

    try {
      const result = await fn();

      // Success in half-open state -> close circuit
      if (this.state === 'half-open') {
        this.successCount++;
        if (this.successCount >= 3) {
          this.state = 'closed';
          this.failureCount = 0;
          this.successCount = 0;
          console.log('[CIRCUIT] Circuit closed after successful recovery');
        }
      }

      return result;
    } catch (error) {
      this.recordFailure(error);
      throw error;
    }
  }
}
```

**Prevention:**

- Monitor circuit breaker state and alert when opened
- Implement health checks before opening circuit
- Use exponential backoff for retry attempts
- Set appropriate failure thresholds for environment
- Implement gradual recovery with half-open state
- Log all circuit state transitions

---

### 4.2 Max Retries Exceeded

**Symptoms:**

- Payment verification fails after 5+ retry attempts
- "Max retries exceeded" error in logs
- Legitimate payments not completing

**Root Cause:**

- Lightning payment actually failed (routing failure, insufficient liquidity)
- Temporary network issues persisting too long
- Webhook never arriving
- Retry interval too short for Lightning Network settlement

**Diagnostic Steps:**

```bash
# 1. Check retry attempts for payment
psql -d sovren -c "
SELECT
  payment_hash,
  retry_count,
  max_retries,
  last_retry_at,
  error_message,
  EXTRACT(EPOCH FROM (NOW() - created_at)) as age_seconds
FROM payment_retry_log
WHERE retry_count >= max_retries
  AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
"

# 2. Check actual payment status on Lightning node
PAYMENT_HASH="<hash-from-above>"
docker exec sovren-lnd lncli --network=mainnet lookupinvoice $PAYMENT_HASH

# 3. Check retry timing
psql -d sovren -c "
SELECT
  payment_hash,
  attempt_number,
  attempted_at,
  LAG(attempted_at) OVER (PARTITION BY payment_hash ORDER BY attempted_at) as previous_attempt,
  EXTRACT(EPOCH FROM (attempted_at - LAG(attempted_at) OVER (PARTITION BY payment_hash ORDER BY attempted_at))) as seconds_since_last
FROM payment_retry_attempts
WHERE payment_hash = '$PAYMENT_HASH'
ORDER BY attempted_at;
"
```

**Resolution:**

**Case 1: Payment actually succeeded (verify and update)**

```bash
# 1. Check Lightning node
STATUS=$(docker exec sovren-lnd lncli --network=mainnet lookupinvoice $PAYMENT_HASH | jq -r '.state')

# 2. If SETTLED, update database
if [ "$STATUS" = "SETTLED" ]; then
  psql -d sovren -c "
  UPDATE payments
  SET status = 'completed',
      settled_at = NOW(),
      retry_count = NULL
  WHERE payment_hash = '$PAYMENT_HASH';
  "
fi
```

**Case 2: Payment genuinely failed (mark as failed)**

```bash
# 1. Verify payment cannot succeed
docker exec sovren-lnd lncli --network=mainnet lookupinvoice $PAYMENT_HASH

# 2. If CANCELED or EXPIRED, mark as failed
psql -d sovren -c "
UPDATE payments
SET status = 'failed',
    error_message = 'Payment failed after maximum retries',
    failed_at = NOW()
WHERE payment_hash = '$PAYMENT_HASH';
"

# 3. Notify user
curl -X POST http://localhost:8080/api/notifications/payment-failed \
  -d "{\"payment_hash\": \"$PAYMENT_HASH\"}"
```

**Case 3: Adjust retry configuration**

```typescript
// packages/backend/src/config/retry.ts

export const RETRY_CONFIG = {
  max_retries: 10, // Increase from 5
  initial_delay_ms: 2000, // 2 seconds
  max_delay_ms: 60000, // Cap at 60 seconds
  backoff_multiplier: 2, // Exponential: 2s, 4s, 8s, 16s, 32s, 60s
  timeout_per_attempt_ms: 10000, // 10 second timeout per attempt

  // Only retry on transient errors
  retryable_errors: [
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ENOTFOUND',
    'NETWORK_ERROR',
    'LIGHTNING_NODE_UNAVAILABLE',
  ],
};
```

**Prevention:**

- Set retry limits appropriate for Lightning Network (10-15 retries)
- Use exponential backoff (2s, 4s, 8s, 16s, 32s, 60s)
- Only retry on transient errors
- Implement circuit breaker to stop retries when node is down
- Monitor retry success rate and adjust parameters
- Alert on high retry rates (>20% of payments)

---

### 4.3 Exponential Backoff Too Slow

**Symptoms:**

- Payment takes too long to verify (>2 minutes)
- Retry delays too long for user experience
- Users abandoning payment flow

**Root Cause:**

- Backoff multiplier too aggressive (3x or higher)
- Maximum delay too high (>60 seconds)
- Too many retry attempts with increasing delays
- Initial delay too conservative

**Diagnostic Steps:**

```bash
# 1. Analyze retry timing distribution
psql -d sovren -c "
WITH retry_timings AS (
  SELECT
    payment_hash,
    attempt_number,
    attempted_at,
    LAG(attempted_at) OVER (PARTITION BY payment_hash ORDER BY attempted_at) as previous_attempt
  FROM payment_retry_attempts
  WHERE created_at > NOW() - INTERVAL '1 hour'
)
SELECT
  attempt_number,
  AVG(EXTRACT(EPOCH FROM (attempted_at - previous_attempt))) as avg_delay_seconds,
  MAX(EXTRACT(EPOCH FROM (attempted_at - previous_attempt))) as max_delay_seconds,
  COUNT(*) as attempt_count
FROM retry_timings
WHERE previous_attempt IS NOT NULL
GROUP BY attempt_number
ORDER BY attempt_number;
"

# 2. Check user abandonment correlation
psql -d sovren -c "
SELECT
  COUNT(*) FILTER (WHERE status = 'abandoned') as abandoned_count,
  COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
  AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_completion_time
FROM payments
WHERE created_at > NOW() - INTERVAL '1 day'
  AND retry_count > 0;
"
```

**Resolution:**

```typescript
// packages/backend/src/services/payment/RetryService.ts

export class RetryService {
  private config = {
    initial_delay_ms: 1000, // Start at 1 second (reduce from 2s)
    max_delay_ms: 30000, // Cap at 30 seconds (reduce from 60s)
    backoff_multiplier: 1.5, // Gentler: 1s, 1.5s, 2.25s, 3.38s, 5.06s, 7.59s, 11.39s, 17.08s, 25.63s, 30s
    jitter_factor: 0.1, // Add ±10% random jitter
  };

  calculateDelay(attemptNumber: number): number {
    // Exponential backoff with jitter
    let delay =
      this.config.initial_delay_ms * Math.pow(this.config.backoff_multiplier, attemptNumber - 1);

    // Cap at maximum
    delay = Math.min(delay, this.config.max_delay_ms);

    // Add jitter to prevent thundering herd
    const jitter = delay * this.config.jitter_factor * (Math.random() - 0.5);
    delay = Math.max(0, delay + jitter);

    return Math.floor(delay);
  }

  async retryWithBackoff<T>(
    operation: () => Promise<T>,
    context: { payment_hash: string }
  ): Promise<T> {
    let attemptNumber = 1;

    while (attemptNumber <= this.config.max_retries) {
      try {
        return await operation();
      } catch (error) {
        // Only retry transient errors
        if (!this.isRetryableError(error) || attemptNumber >= this.config.max_retries) {
          throw error;
        }

        const delay = this.calculateDelay(attemptNumber);
        console.log(
          `[RETRY] Attempt ${attemptNumber} failed for ${context.payment_hash}, ` +
            `retrying in ${delay}ms...`
        );

        await this.sleep(delay);
        attemptNumber++;
      }
    }

    throw new Error('Max retries exceeded');
  }
}
```

**Optimize for user experience:**

```typescript
// Use faster verification for recent payments
const isRecent = Date.now() - payment.created_at < 60000; // Less than 1 minute old

const verificationConfig = isRecent
  ? {
      initial_delay_ms: 500, // Fast polling for recent payments
      max_delay_ms: 5000, // Cap at 5 seconds
      backoff_multiplier: 1.3, // Gentle: 500ms, 650ms, 845ms, 1099ms, 1429ms, 1858ms, 2415ms, 3140ms, 4082ms, 5000ms
    }
  : {
      initial_delay_ms: 2000, // Slower for older payments
      max_delay_ms: 30000, // Cap at 30 seconds
      backoff_multiplier: 1.8, // Moderate
    };
```

**Prevention:**

- Use adaptive backoff based on payment age
- Fast polling for first minute (500ms - 5s delays)
- Slower polling for older payments (2s - 30s delays)
- Monitor user abandonment rate
- Target: 95% of payments verified within 30 seconds
- A/B test different backoff parameters

---

## 5. State Machine Issues

### 5.1 Invalid State Transitions

**Symptoms:**

- "Invalid state transition" error in logs
- Payment stuck and cannot progress
- State machine rejects valid operations

**Root Cause:**

- Attempting illegal state transition (e.g., pending → refunded)
- State machine definition too restrictive
- Race condition causing concurrent state updates
- Webhook out-of-order delivery

**Diagnostic Steps:**

```bash
# 1. Check rejected transitions
psql -d sovren -c "
SELECT
  payment_hash,
  from_state,
  to_state,
  attempted_at,
  rejection_reason,
  attempted_by
FROM payment_state_transition_log
WHERE is_valid = false
  AND attempted_at > NOW() - INTERVAL '1 hour'
ORDER BY attempted_at DESC
LIMIT 20;
"

# 2. View valid transition rules
psql -d sovren -c "
SELECT from_state, ARRAY_AGG(to_state) as allowed_transitions
FROM payment_state_transitions_allowed
GROUP BY from_state;
"

# 3. Check current payment state
PAYMENT_HASH="<problematic-payment>"
psql -d sovren -c "
SELECT
  payment_hash,
  status as current_state,
  created_at,
  updated_at,
  EXTRACT(EPOCH FROM (NOW() - updated_at)) as seconds_since_update
FROM payments
WHERE payment_hash = '$PAYMENT_HASH';
"

# 4. View full state history
psql -d sovren -c "
SELECT
  from_state,
  to_state,
  transitioned_at,
  triggered_by
FROM payment_state_history
WHERE payment_hash = '$PAYMENT_HASH'
ORDER BY transitioned_at;
"
```

**Resolution:**

**Case 1: Payment in unrecoverable state**

```bash
# 1. Assess current state
CURRENT_STATE=$(psql -d sovren -t -c "SELECT status FROM payments WHERE payment_hash = '$PAYMENT_HASH';")

# 2. Check Lightning node actual status
LND_STATUS=$(docker exec sovren-lnd lncli --network=mainnet lookupinvoice $PAYMENT_HASH | jq -r '.state')

# 3. Force state to match reality (CAUTION: admin operation only)
case $LND_STATUS in
  SETTLED)
    TARGET_STATE="completed"
    ;;
  CANCELED|EXPIRED)
    TARGET_STATE="failed"
    ;;
  OPEN|ACCEPTED)
    TARGET_STATE="pending"
    ;;
esac

psql -d sovren -c "
UPDATE payments
SET status = '$TARGET_STATE',
    updated_at = NOW(),
    force_updated = true,
    force_update_reason = 'Admin correction to match Lightning node state'
WHERE payment_hash = '$PAYMENT_HASH';

INSERT INTO payment_state_history (payment_hash, from_state, to_state, triggered_by, notes)
VALUES ('$PAYMENT_HASH', '$CURRENT_STATE', '$TARGET_STATE', 'admin_force', 'Corrected to match LND state');
"
```

**Case 2: Update state machine transition rules**

```typescript
// packages/backend/src/services/payment/PaymentStateMachine.ts

export class PaymentStateMachine {
  private readonly validTransitions: Record<PaymentState, PaymentState[]> = {
    pending: ['processing', 'failed', 'expired'],
    processing: ['verifying', 'failed'],
    verifying: ['completed', 'verification_failed'],
    verification_failed: ['verifying', 'failed'], // Allow retry
    completed: ['refunded', 'disputed'], // Allow refund/dispute
    failed: ['pending'], // Allow retry
    expired: [], // Terminal state
    refunded: ['disputed'], // Allow dispute of refund
    disputed: [], // Terminal state
  };

  isValidTransition(from: PaymentState, to: PaymentState): boolean {
    // Allow idempotent transitions (same state)
    if (from === to) {
      return true;
    }

    const allowedTransitions = this.validTransitions[from] || [];
    return allowedTransitions.includes(to);
  }
}
```

**Case 3: Implement state reconciliation**

```typescript
// Add periodic state reconciliation job
async reconcilePaymentStates(): Promise<void> {
  // Find payments stuck in intermediate states
  const stuckPayments = await this.db.query(`
    SELECT payment_hash, status, created_at
    FROM payments
    WHERE status IN ('processing', 'verifying', 'verification_failed')
      AND updated_at < NOW() - INTERVAL '10 minutes'
  `);

  for (const payment of stuckPayments.rows) {
    try {
      // Check actual Lightning node status
      const invoice = await this.lnd.lookupInvoice(payment.payment_hash);

      let targetState: PaymentState;
      if (invoice.settled) {
        targetState = 'completed';
      } else if (invoice.state === 'CANCELED' || invoice.state === 'EXPIRED') {
        targetState = 'failed';
      } else {
        targetState = 'pending';
      }

      // Update if different
      if (payment.status !== targetState) {
        await this.forceTransition(payment.payment_hash, targetState, 'reconciliation');
        console.log(
          `[RECONCILIATION] Updated ${payment.payment_hash}: ${payment.status} -> ${targetState}`
        );
      }
    } catch (error) {
      console.error(`[RECONCILIATION] Failed to reconcile ${payment.payment_hash}:`, error);
    }
  }
}
```

**Prevention:**

- Run state reconciliation job every 5 minutes
- Allow idempotent transitions (same state)
- Implement permissive transition rules with audit logging
- Use optimistic locking to prevent race conditions
- Log all transition attempts (valid and invalid)
- Alert on high invalid transition rate (>1%)

---

### 5.2 Stuck in Intermediate States

**Symptoms:**

- Payment in "processing" or "verifying" for >5 minutes
- No state transitions occurring
- User sees indefinite loading state

**Root Cause:**

- State transition handler crashed or threw exception
- Webhook never arrived to trigger next state
- Database lock preventing state update
- Verification service not running

**Diagnostic Steps:**

```bash
# 1. Find stuck payments
psql -d sovren -c "
SELECT
  payment_hash,
  status,
  created_at,
  updated_at,
  EXTRACT(EPOCH FROM (NOW() - updated_at)) as stuck_seconds
FROM payments
WHERE status IN ('processing', 'verifying', 'verification_failed')
  AND updated_at < NOW() - INTERVAL '5 minutes'
ORDER BY updated_at ASC
LIMIT 50;
"

# 2. Check for active locks
psql -d sovren -c "
SELECT
  l.locktype,
  l.relation::regclass,
  l.mode,
  l.transactionid,
  l.pid,
  a.query_start,
  a.query
FROM pg_locks l
JOIN pg_stat_activity a ON l.pid = a.pid
WHERE l.relation = 'payments'::regclass
  OR l.locktype = 'transactionid';
"

# 3. Check verification service health
curl http://localhost:8080/api/health/verification-service

# 4. Check webhook processing backlog
curl http://localhost:8080/api/metrics/webhook-queue-depth
```

**Resolution:**

**Immediate recovery:**

```bash
# 1. Identify stuck payments
STUCK_PAYMENTS=$(psql -d sovren -t -c "
SELECT payment_hash
FROM payments
WHERE status IN ('processing', 'verifying')
  AND updated_at < NOW() - INTERVAL '10 minutes';
")

# 2. For each stuck payment, check Lightning status and update
for PAYMENT_HASH in $STUCK_PAYMENTS; do
  # Get LND status
  LND_STATE=$(docker exec sovren-lnd lncli --network=mainnet lookupinvoice $PAYMENT_HASH 2>/dev/null | jq -r '.state')

  case $LND_STATE in
    SETTLED)
      psql -d sovren -c "
      UPDATE payments
      SET status = 'completed', settled_at = NOW(), updated_at = NOW()
      WHERE payment_hash = '$PAYMENT_HASH';
      "
      echo "✅ Completed: $PAYMENT_HASH"
      ;;
    CANCELED|EXPIRED)
      psql -d sovren -c "
      UPDATE payments
      SET status = 'failed', failed_at = NOW(), updated_at = NOW()
      WHERE payment_hash = '$PAYMENT_HASH';
      "
      echo "❌ Failed: $PAYMENT_HASH"
      ;;
    OPEN)
      psql -d sovren -c "
      UPDATE payments
      SET status = 'pending', updated_at = NOW()
      WHERE payment_hash = '$PAYMENT_HASH';
      "
      echo "⏳ Reset to pending: $PAYMENT_HASH"
      ;;
  esac
done
```

**Implement automatic recovery:**

```typescript
// packages/backend/src/jobs/payment-recovery.ts

import cron from 'node-cron';

// Run every minute
cron.schedule('* * * * *', async () => {
  try {
    await recoverStuckPayments();
  } catch (error) {
    console.error('[RECOVERY] Payment recovery job failed:', error);
  }
});

async function recoverStuckPayments(): Promise<void> {
  const STUCK_THRESHOLD_MINUTES = 5;

  // Find stuck payments
  const stuckPayments = await db.query(`
    SELECT payment_hash, status, updated_at
    FROM payments
    WHERE status IN ('processing', 'verifying', 'verification_failed')
      AND updated_at < NOW() - INTERVAL '${STUCK_THRESHOLD_MINUTES} minutes'
  `);

  console.log(`[RECOVERY] Found ${stuckPayments.rowCount} stuck payments`);

  for (const payment of stuckPayments.rows) {
    try {
      // Check actual status
      const invoice = await lnd.lookupInvoice(payment.payment_hash);

      // Transition to correct state
      if (invoice.settled) {
        await paymentStateMachine.transitionState(payment.payment_hash, 'completed');
      } else if (['CANCELED', 'EXPIRED'].includes(invoice.state)) {
        await paymentStateMachine.transitionState(payment.payment_hash, 'failed');
      } else {
        // Still pending, reset to pending state
        await paymentStateMachine.transitionState(payment.payment_hash, 'pending');
      }

      console.log(`[RECOVERY] Recovered payment ${payment.payment_hash}`);
    } catch (error) {
      console.error(`[RECOVERY] Failed to recover ${payment.payment_hash}:`, error);

      // After 30 minutes, force to failed state
      const ageMinutes = (Date.now() - payment.updated_at) / 60000;
      if (ageMinutes > 30) {
        await paymentStateMachine.transitionState(payment.payment_hash, 'failed');
        console.log(`[RECOVERY] Forced ${payment.payment_hash} to failed after 30 minutes`);
      }
    }
  }
}
```

**Prevention:**

- Implement automatic recovery job (every minute)
- Timeout stuck states after 5 minutes
- Force to failed state after 30 minutes
- Monitor stuck payment count and alert if >10
- Implement health checks for verification service
- Use database advisory locks instead of row locks

---

### 5.3 Concurrent State Update Conflicts

**Symptoms:**

- "Concurrent update detected" errors
- Race condition errors in logs
- State transitions sometimes fail

**Root Cause:**

- Multiple webhooks arriving simultaneously
- Verification polling racing with webhook
- No optimistic locking or versioning
- Database isolation level too low

**Diagnostic Steps:**

```bash
# 1. Check for concurrent updates
psql -d sovren -c "
SELECT
  payment_hash,
  COUNT(*) as concurrent_updates,
  ARRAY_AGG(DISTINCT triggered_by) as update_sources,
  MAX(transitioned_at) - MIN(transitioned_at) as time_spread
FROM payment_state_history
WHERE transitioned_at > NOW() - INTERVAL '1 hour'
GROUP BY payment_hash
HAVING COUNT(*) > 1
  AND MAX(transitioned_at) - MIN(transitioned_at) < INTERVAL '1 second'
ORDER BY concurrent_updates DESC;
"

# 2. Check database isolation level
psql -d sovren -c "SHOW transaction_isolation;"

# 3. Monitor conflict rate
psql -d sovren -c "
SELECT
  COUNT(*) FILTER (WHERE error_message LIKE '%concurrent%') as concurrent_conflicts,
  COUNT(*) as total_updates,
  ROUND(100.0 * COUNT(*) FILTER (WHERE error_message LIKE '%concurrent%') / COUNT(*), 2) as conflict_rate
FROM payment_state_transition_log
WHERE attempted_at > NOW() - INTERVAL '1 hour';
"
```

**Resolution:**

**Implement optimistic locking:**

```sql
-- Add version column to payments table
ALTER TABLE payments ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- Create index for version-based queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_hash_version
ON payments(payment_hash, version);
```

```typescript
// packages/backend/src/services/payment/PaymentStateMachine.ts

export class PaymentStateMachine {
  async transitionStateWithLocking(
    paymentHash: string,
    toState: PaymentState,
    triggeredBy: string
  ): Promise<void> {
    const MAX_RETRIES = 3;
    let attempt = 0;

    while (attempt < MAX_RETRIES) {
      try {
        await this.db.query('BEGIN');

        // Get current state with version (FOR UPDATE locks the row)
        const result = await this.db.query(
          `
          SELECT status, version
          FROM payments
          WHERE payment_hash = $1
          FOR UPDATE NOWAIT
        `,
          [paymentHash]
        );

        if (result.rowCount === 0) {
          throw new Error('Payment not found');
        }

        const { status: currentState, version } = result.rows[0];

        // Validate transition
        if (!this.isValidTransition(currentState, toState)) {
          // Allow idempotent (same state is OK)
          if (currentState === toState) {
            await this.db.query('COMMIT');
            console.log(`[STATE] Payment already in state ${toState}, skipping`);
            return;
          }
          throw new Error(`Invalid transition: ${currentState} -> ${toState}`);
        }

        // Update with version check (optimistic locking)
        const updateResult = await this.db.query(
          `
          UPDATE payments
          SET status = $1,
              version = version + 1,
              updated_at = NOW()
          WHERE payment_hash = $2
            AND version = $3
          RETURNING id
        `,
          [toState, paymentHash, version]
        );

        if (updateResult.rowCount === 0) {
          throw new Error('Concurrent update detected, version mismatch');
        }

        // Record state transition
        await this.db.query(
          `
          INSERT INTO payment_state_history
          (payment_hash, from_state, to_state, triggered_by, transitioned_at)
          VALUES ($1, $2, $3, $4, NOW())
        `,
          [paymentHash, currentState, toState, triggeredBy]
        );

        await this.db.query('COMMIT');

        console.log(`[STATE] ${paymentHash}: ${currentState} -> ${toState} (v${version + 1})`);

        return;
      } catch (error: any) {
        await this.db.query('ROLLBACK');

        // Retry on lock conflict or version mismatch
        if (
          error.code === '55P03' || // lock_not_available
          error.message.includes('Concurrent update')
        ) {
          attempt++;
          if (attempt < MAX_RETRIES) {
            // Exponential backoff with jitter
            const delay = Math.min(100 * Math.pow(2, attempt) + Math.random() * 100, 1000);
            await this.sleep(delay);
            console.log(
              `[STATE] Concurrent update for ${paymentHash}, retrying (${attempt}/${MAX_RETRIES})...`
            );
            continue;
          }
        }

        throw error;
      }
    }

    throw new Error(`Failed to update payment state after ${MAX_RETRIES} attempts`);
  }
}
```

**Prevention:**

- Use optimistic locking with version numbers
- Implement row-level locking with NOWAIT
- Retry on lock conflicts with exponential backoff
- Use SERIALIZABLE isolation level for critical transactions
- Deduplicate webhooks before processing
- Monitor concurrent update rate and alert if >5%

---

## 6. Performance Issues

### 6.1 Slow Payment Verification

**Symptoms:**

- Payment verification takes >2 seconds (target: <500ms)
- High P95/P99 latency
- User complaints about slow confirmation

**Root Cause:**

- Slow Lightning node RPC calls
- No caching of invoice status
- Database query inefficiencies
- Network latency to Lightning node
- N+1 query problems

**Diagnostic Steps:**

```bash
# 1. Check verification latency metrics
curl http://localhost:8080/api/metrics/payment-verification | jq

# Expected output:
# {
#   "avg_latency_ms": 180,
#   "p95_latency_ms": 450,
#   "p99_latency_ms": 1200,
#   "slow_verifications": 45  # Count > 1s
# }

# 2. Profile slow verifications
psql -d sovren -c "
SELECT
  payment_hash,
  EXTRACT(EPOCH FROM (verified_at - verification_started_at)) * 1000 as latency_ms,
  verification_method
FROM payment_verifications
WHERE verified_at > NOW() - INTERVAL '1 hour'
  AND EXTRACT(EPOCH FROM (verified_at - verification_started_at)) > 1
ORDER BY latency_ms DESC
LIMIT 20;
"

# 3. Check Lightning node response time
time docker exec sovren-lnd lncli --network=mainnet getinfo

# 4. Check database query performance
psql -d sovren -c "
SELECT
  query,
  mean_exec_time,
  calls,
  total_exec_time
FROM pg_stat_statements
WHERE query LIKE '%payments%'
ORDER BY mean_exec_time DESC
LIMIT 10;
"
```

**Resolution:**

**1. Implement caching:**

```typescript
// packages/backend/src/services/payment/VerificationCache.ts

import Redis from 'ioredis';

export class VerificationCache {
  private redis: Redis;
  private readonly CACHE_TTL = 30; // seconds

  async getInvoiceStatus(paymentHash: string): Promise<InvoiceStatus | null> {
    const cached = await this.redis.get(`invoice:${paymentHash}`);
    if (cached) {
      console.log(`[CACHE] Hit for ${paymentHash}`);
      return JSON.parse(cached);
    }
    return null;
  }

  async setInvoiceStatus(paymentHash: string, status: InvoiceStatus): Promise<void> {
    await this.redis.setex(
      `invoice:${paymentHash}`,
      this.CACHE_TTL,
      JSON.stringify(status)
    );
  }

  async invalidate(paymentHash: string): Promise<void> {
    await this.redis.del(`invoice:${paymentHash}`);
  }
}

// Use in verification service
async verifyPayment(paymentHash: string): Promise<PaymentStatus> {
  // Check cache first
  const cached = await this.cache.getInvoiceStatus(paymentHash);
  if (cached) {
    return this.mapToPaymentStatus(cached);
  }

  // Cache miss - query Lightning node
  const invoice = await this.lnd.lookupInvoice(paymentHash);

  // Cache result (even if not settled, to reduce load)
  await this.cache.setInvoiceStatus(paymentHash, invoice);

  return this.mapToPaymentStatus(invoice);
}
```

**2. Optimize database queries:**

```sql
-- Add missing indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_status_created
ON payments(status, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_hash_include
ON payments(payment_hash)
INCLUDE (status, amount_sats, created_at);

-- Analyze query performance
EXPLAIN ANALYZE
SELECT status, amount_sats, created_at
FROM payments
WHERE payment_hash = '<hash>';
```

**3. Use connection pooling:**

```typescript
// packages/backend/src/config/lnd-pool.ts

import { Pool } from 'generic-pool';
import { LndClient } from './lnd-client';

const lndPool = Pool.create({
  create: () => new LndClient(config),
  destroy: (client) => client.disconnect(),
  max: 10, // Maximum connections
  min: 2, // Minimum connections
  idleTimeoutMillis: 30000,
});

export async function withLndClient<T>(operation: (client: LndClient) => Promise<T>): Promise<T> {
  const client = await lndPool.acquire();
  try {
    return await operation(client);
  } finally {
    await lndPool.release(client);
  }
}
```

**4. Implement parallel verification:**

```typescript
// Verify multiple payments in parallel
async verifyMultiplePayments(paymentHashes: string[]): Promise<Map<string, PaymentStatus>> {
  const results = await Promise.all(
    paymentHashes.map(hash =>
      this.verifyPayment(hash).catch(error => ({ hash, error }))
    )
  );

  return new Map(
    results.map((result, i) => [paymentHashes[i], result])
  );
}
```

**Prevention:**

- Set SLA: 95% of verifications < 500ms
- Cache invoice status for 30 seconds
- Use connection pooling for Lightning node
- Monitor P95/P99 latency continuously
- Add database indexes on hot query paths
- Implement circuit breaker for slow queries

---

### 6.2 Database Performance Bottlenecks

**Symptoms:**

- Database CPU at >80%
- Slow query performance (>100ms)
- Connection pool exhaustion
- Timeouts on payment queries

**Root Cause:**

- Missing database indexes
- Table bloat from high update volume
- Inefficient queries (N+1, full table scans)
- Connection pool too small
- Long-running transactions

**Diagnostic Steps:**

```bash
# 1. Check database CPU and connections
psql -d sovren -c "
SELECT
  (SELECT count(*) FROM pg_stat_activity) as total_connections,
  (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_connections,
  (SELECT current_setting('max_connections')::int) as max_connections;
"

# 2. Find slow queries
psql -d sovren -c "
SELECT
  substring(query, 1, 100) as query_preview,
  mean_exec_time,
  calls,
  total_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
"

# 3. Check for missing indexes
psql -d sovren -c "
SELECT
  schemaname,
  tablename,
  attname,
  n_distinct,
  correlation
FROM pg_stats
WHERE schemaname = 'public'
  AND tablename = 'payments'
  AND n_distinct > 100
  AND correlation < 0.1;
"

# 4. Check table bloat
psql -d sovren -c "
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
  n_tup_ins,
  n_tup_upd,
  n_tup_del,
  last_vacuum,
  last_autovacuum
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
"

# 5. Check for lock waits
psql -d sovren -c "
SELECT
  COUNT(*) as blocked_queries,
  mode,
  relation::regclass
FROM pg_locks
WHERE NOT granted
GROUP BY mode, relation;
"
```

**Resolution:**

**1. Add missing indexes:**

```sql
-- Essential indexes for payment queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_hash
ON payments(payment_hash);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_user_created
ON payments(user_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_creator_status
ON payments(creator_id, status, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_status_updated
ON payments(status, updated_at)
WHERE status IN ('pending', 'processing', 'verifying');

-- Composite index for common filter combination
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_composite
ON payments(status, created_at DESC, user_id)
INCLUDE (amount_sats, payment_hash);

-- Partial index for active payments only
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_active
ON payments(created_at DESC)
WHERE status NOT IN ('completed', 'failed', 'expired');
```

**2. Optimize connection pool:**

```javascript
// packages/backend/src/config/database.ts

export const dbConfig = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,

  // Connection pool settings
  max: 20, // Increase from default 10
  min: 5, // Maintain minimum connections
  idleTimeoutMillis: 30000, // Close idle connections after 30s
  connectionTimeoutMillis: 10000, // Fail fast on connection timeout

  // Statement timeout (prevent long-running queries)
  statement_timeout: 30000, // 30 second timeout

  // Query timeout
  query_timeout: 10000, // 10 second timeout for queries
};
```

**3. Vacuum and analyze:**

```bash
# Manual vacuum for immediate relief
psql -d sovren -c "VACUUM ANALYZE payments;"

# Check autovacuum settings
psql -d sovren -c "
SELECT name, setting, unit
FROM pg_settings
WHERE name LIKE '%autovacuum%';
"

# Tune autovacuum for high-update tables
psql -d sovren -c "
ALTER TABLE payments SET (
  autovacuum_vacuum_scale_factor = 0.05,  -- Vacuum at 5% updates
  autovacuum_analyze_scale_factor = 0.02  -- Analyze at 2% updates
);
"
```

**4. Query optimization:**

```typescript
// Before: N+1 query problem
for (const payment of payments) {
  const user = await db.query('SELECT * FROM users WHERE id = $1', [payment.user_id]);
  payment.user = user.rows[0];
}

// After: Single query with JOIN
const paymentsWithUsers = await db.query(`
  SELECT
    p.*,
    u.email,
    u.username,
    c.name as creator_name
  FROM payments p
  LEFT JOIN users u ON p.user_id = u.id
  LEFT JOIN creators c ON p.creator_id = c.id
  WHERE p.created_at > NOW() - INTERVAL '1 hour'
  ORDER BY p.created_at DESC
`);
```

**Prevention:**

- Monitor slow query log daily
- Set up automated index suggestions
- Run VACUUM ANALYZE weekly
- Monitor connection pool utilization
- Set statement timeout (30s) to prevent runaway queries
- Use EXPLAIN ANALYZE for all new queries
- Implement query result caching for read-heavy endpoints

---

### 6.3 Memory Leaks in Payment Processing

**Symptoms:**

- Node.js process memory grows continuously
- Server requires restart every few days
- Out of memory errors in production

**Root Cause:**

- Event listeners not removed
- Cached data not evicted
- Circular references preventing garbage collection
- Large result sets loaded into memory

**Diagnostic Steps:**

```bash
# 1. Check Node.js memory usage
curl http://localhost:8080/api/metrics/memory

# Expected output:
# {
#   "rss": "450 MB",
#   "heapTotal": "320 MB",
#   "heapUsed": "280 MB",
#   "external": "25 MB"
# }

# 2. Monitor memory over time
while true; do
  echo "$(date) - $(curl -s http://localhost:8080/api/metrics/memory | jq -r '.heapUsed')"
  sleep 60
done

# 3. Take heap snapshot (requires Node.js debugging)
kill -USR2 <node-pid>  # Triggers heap dump
# Analyze with Chrome DevTools or heapdump module

# 4. Check for event listener leaks
curl http://localhost:8080/api/metrics/event-listeners
```

**Resolution:**

**1. Fix event listener leaks:**

```typescript
// Before: Event listeners never removed
class PaymentVerifier {
  constructor() {
    this.emitter.on('payment-verified', this.handleVerified);
  }
}

// After: Properly remove listeners
class PaymentVerifier {
  constructor() {
    this.boundHandler = this.handleVerified.bind(this);
    this.emitter.on('payment-verified', this.boundHandler);
  }

  destroy() {
    this.emitter.off('payment-verified', this.boundHandler);
  }
}
```

**2. Implement cache eviction:**

```typescript
// packages/backend/src/services/payment/PaymentCache.ts

import LRU from 'lru-cache';

export class PaymentCache {
  private cache = new LRU<string, PaymentData>({
    max: 10000, // Maximum items
    maxAge: 1000 * 60 * 5, // 5 minute TTL
    updateAgeOnGet: false, // Don't reset TTL on access
    dispose: (key, value) => {
      // Cleanup when evicted
      console.log(`[CACHE] Evicted ${key}`);
    },
  });

  set(key: string, value: PaymentData): void {
    this.cache.set(key, value);
  }

  get(key: string): PaymentData | undefined {
    return this.cache.get(key);
  }

  // Periodic cleanup
  prune(): void {
    this.cache.prune();
  }
}

// Schedule periodic cleanup
setInterval(() => paymentCache.prune(), 60000); // Every minute
```

**3. Stream large result sets:**

```typescript
// Before: Load all payments into memory
const allPayments = await db.query('SELECT * FROM payments');
processPayments(allPayments.rows); // Could be millions of rows!

// After: Use cursor for streaming
const cursor = db.query(new Cursor('SELECT * FROM payments'));

cursor.on('row', (payment) => {
  processPayment(payment);
});

cursor.on('end', () => {
  console.log('All payments processed');
});
```

**4. Monitor memory usage:**

```typescript
// packages/backend/src/monitoring/memory-monitor.ts

setInterval(() => {
  const usage = process.memoryUsage();

  console.log({
    rss: `${Math.round(usage.rss / 1024 / 1024)} MB`,
    heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)} MB`,
    heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)} MB`,
    external: `${Math.round(usage.external / 1024 / 1024)} MB`,
  });

  // Alert if heap used > 80% of total
  const heapUsagePercent = (usage.heapUsed / usage.heapTotal) * 100;
  if (heapUsagePercent > 80) {
    console.error(`[MEMORY] High heap usage: ${heapUsagePercent.toFixed(1)}%`);
    // Trigger alert
  }

  // Force garbage collection if available (--expose-gc flag)
  if (global.gc && heapUsagePercent > 75) {
    console.log('[MEMORY] Forcing garbage collection...');
    global.gc();
  }
}, 60000); // Every minute
```

**Prevention:**

- Monitor heap usage continuously
- Set memory limits (--max-old-space-size=4096)
- Use streaming for large datasets
- Implement proper cleanup in destructors
- Use LRU cache with size limits
- Run with --expose-gc in production (with monitoring)
- Take regular heap snapshots in staging
- Load test to identify leaks before production

---

## 7. Emergency Procedures

### 7.1 Total Payment System Outage

**Situation:** All payments failing, Lightning node unreachable

**Immediate Actions:**

```bash
# 1. Verify the outage scope
curl http://localhost:8080/api/health
curl http://localhost:8080/api/lightning/node-info

# 2. Check Lightning node status
docker ps | grep lnd
docker logs sovren-lnd --tail 50

# 3. If LND down, restart immediately
docker restart sovren-lnd

# 4. Wait for sync (may take 5-10 minutes)
while [ "$(docker exec sovren-lnd lncli --network=mainnet getinfo 2>/dev/null | jq -r '.synced_to_chain')" != "true" ]; do
  echo "Waiting for LND sync... ($(date))"
  sleep 10
done

# 5. Verify recovery
curl http://localhost:8080/api/lightning/node-info
curl -X POST http://localhost:8080/api/lightning/create-invoice \
  -H "Content-Type: application/json" \
  -d '{"amount": 1000, "description": "Recovery test"}'

# 6. Notify stakeholders
curl -X POST $SLACK_WEBHOOK_URL \
  -d '{"text": "✅ Payment system recovered, LND restarted and synced"}'
```

**If restart doesn't work:**

```bash
# 1. Check for disk space
df -h

# 2. Check Docker resources
docker system df

# 3. Check system resources
top
free -h

# 4. Review LND logs for specific errors
docker logs sovren-lnd --tail 200 | grep -i error

# 5. If corruption suspected, rebuild from backup
docker stop sovren-lnd
docker run --rm -v sovren_lnd_data:/backup -v $(pwd):/restore alpine \
  tar xvf /restore/lnd-backup-latest.tar -C /backup
docker start sovren-lnd

# 6. Escalate to infrastructure team if unresolved in 15 minutes
```

---

### 7.2 Mass Payment Verification Failures

**Situation:** >50% of payment verifications failing

**Immediate Actions:**

```bash
# 1. Check failure rate
psql -d sovren -c "
SELECT
  COUNT(*) FILTER (WHERE status = 'failed') as failed,
  COUNT(*) FILTER (WHERE status = 'completed') as completed,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'failed') / COUNT(*), 2) as failure_rate
FROM payments
WHERE created_at > NOW() - INTERVAL '15 minutes';
"

# 2. Identify error patterns
psql -d sovren -c "
SELECT error_message, COUNT(*)
FROM payments
WHERE status = 'failed'
  AND created_at > NOW() - INTERVAL '15 minutes'
GROUP BY error_message
ORDER BY COUNT(*) DESC;
"

# 3. Check webhook delivery
tail -f /var/log/sovren/webhooks.log | grep -i error

# 4. Verify Lightning node health
docker exec sovren-lnd lncli --network=mainnet getinfo
docker exec sovren-lnd lncli --network=mainnet channelbalance

# 5. If webhook signature issues, verify secret
echo $WEBHOOK_SECRET | base64

# 6. If systematic failure, enable degraded mode
curl -X POST http://localhost:8080/api/internal/enable-degraded-mode \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 7. Manual verification of recent payments
for HASH in $(psql -d sovren -t -c "SELECT payment_hash FROM payments WHERE status = 'failed' AND created_at > NOW() - INTERVAL '15 minutes'"); do
  docker exec sovren-lnd lncli --network=mainnet lookupinvoice $HASH
done
```

---

### 7.3 Database Corruption or Lock Deadlock

**Situation:** Database unresponsive, payments stuck

**Immediate Actions:**

```bash
# 1. Check for blocking queries
psql -d sovren -c "
SELECT
  pid,
  usename,
  pg_blocking_pids(pid) as blocked_by,
  query,
  state,
  query_start
FROM pg_stat_activity
WHERE state != 'idle'
  AND query LIKE '%payments%';
"

# 2. Identify deadlocks
psql -d sovren -c "
SELECT * FROM pg_stat_activity WHERE wait_event_type = 'Lock';
"

# 3. Terminate blocking queries (CAUTION!)
psql -d sovren -c "
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle in transaction'
  AND query_start < NOW() - INTERVAL '5 minutes';
"

# 4. If corruption suspected, check integrity
psql -d sovren -c "
SELECT tablename, pg_relation_size(schemaname||'.'||tablename)
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'payments';
"

# 5. Reindex if needed
psql -d sovren -c "REINDEX TABLE CONCURRENTLY payments;"

# 6. Restart database if unresponsive (LAST RESORT)
docker restart sovren-postgres
```

---

## Debugging Commands Reference

### Payment Inspection

```bash
# Get full payment details
PAYMENT_HASH="<hash>"
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
  error_message
FROM payments
WHERE payment_hash = '$PAYMENT_HASH';
"

# Get payment state history
psql -d sovren -c "
SELECT
  from_state,
  to_state,
  transitioned_at,
  triggered_by
FROM payment_state_history
WHERE payment_hash = '$PAYMENT_HASH'
ORDER BY transitioned_at;
"

# Get webhook delivery log
psql -d sovren -c "
SELECT
  webhook_id,
  received_at,
  processed_at,
  signature_valid,
  timestamp_valid,
  is_replay
FROM webhook_logs
WHERE payment_hash = '$PAYMENT_HASH'
ORDER BY received_at;
"
```

### Lightning Node Commands

```bash
# Node info
docker exec sovren-lnd lncli --network=mainnet getinfo

# Check specific invoice
docker exec sovren-lnd lncli --network=mainnet lookupinvoice <payment_hash>

# List recent invoices
docker exec sovren-lnd lncli --network=mainnet listinvoices --max_invoices=20

# Channel balance
docker exec sovren-lnd lncli --network=mainnet channelbalance

# List channels
docker exec sovren-lnd lncli --network=mainnet listchannels

# Wallet balance
docker exec sovren-lnd lncli --network=mainnet walletbalance
```

### Performance Analysis

```bash
# Real-time payment metrics
curl http://localhost:8080/api/analytics/realtime-metrics | jq

# Payment success rate (last hour)
psql -d sovren -c "
SELECT
  COUNT(*) FILTER (WHERE status = 'completed') as completed,
  COUNT(*) FILTER (WHERE status = 'failed') as failed,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'completed') / COUNT(*), 2) as success_rate
FROM payments
WHERE created_at > NOW() - INTERVAL '1 hour';
"

# Average verification time
psql -d sovren -c "
SELECT
  AVG(EXTRACT(EPOCH FROM (verified_at - created_at))) as avg_seconds,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (verified_at - created_at))) as p95_seconds
FROM payments
WHERE verified_at IS NOT NULL
  AND created_at > NOW() - INTERVAL '1 hour';
"

# Active payments count
psql -d sovren -c "
SELECT status, COUNT(*)
FROM payments
WHERE status IN ('pending', 'processing', 'verifying')
GROUP BY status;
"
```

### Health Checks

```bash
# Overall system health
curl http://localhost:8080/api/health

# Component health
curl http://localhost:8080/api/health/lightning
curl http://localhost:8080/api/health/database
curl http://localhost:8080/api/health/redis

# Circuit breaker status
curl http://localhost:8080/api/metrics/circuit-breaker

# Database connection pool
psql -d sovren -c "
SELECT
  count(*) as total,
  count(*) FILTER (WHERE state = 'active') as active,
  count(*) FILTER (WHERE state = 'idle') as idle
FROM pg_stat_activity;
"
```

---

## Support Contacts

**Critical Issues (P0 - Production Down):**

- Slack: #sovren-payment-critical
- PagerDuty: Lightning Payment Escalation
- Phone: +1-XXX-XXX-XXXX (On-call engineer)

**High Priority (P1 - Degraded Performance):**

- Slack: #sovren-payment-support
- Email: payments-oncall@sovren.com

**Standard Support (P2 - Non-urgent):**

- Slack: #sovren-engineering
- Email: engineering@sovren.com
- JIRA: Create ticket in PAY project

---

**Document Version:** 1.0.0
**Last Updated:** 2025-10-25
**Maintained By:** Platform Engineering Team
**Review Schedule:** Monthly or after major incidents
