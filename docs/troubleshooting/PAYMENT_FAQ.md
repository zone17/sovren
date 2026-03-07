# Payment System FAQ

**Version:** 1.0.0
**Last Updated:** 2025-10-25
**Audience:** Support team, Operations, Developers

---

## Table of Contents

1. [General Payment Questions](#1-general-payment-questions)
2. [Invoice & Payment Creation](#2-invoice--payment-creation)
3. [Payment Verification & Status](#3-payment-verification--status)
4. [Webhooks & Integration](#4-webhooks--integration)
5. [Errors & Failures](#5-errors--failures)
6. [Performance & Scaling](#6-performance--scaling)
7. [Security & Compliance](#7-security--compliance)
8. [Recovery & Debugging](#8-recovery--debugging)

---

## 1. General Payment Questions

### Q: How long should a Lightning payment take to confirm?

**A:** Lightning payments are designed to be near-instant:

- **Expected time:** 1-5 seconds for most payments
- **Target:** 95% of payments confirmed within 2 seconds
- **Maximum:** Should never exceed 30 seconds

**If longer:**

- 2-5 minutes: Investigate (check Lightning node, webhook delivery)
- > 5 minutes: Critical issue - check troubleshooting guide

**Factors affecting speed:**

- Lightning network routing (finding path to destination)
- Channel liquidity (available funds in channels)
- Network congestion
- Webhook delivery time from payment provider

---

### Q: What payment states are normal vs concerning?

**A:**

**Normal States (expected flow):**

1. `pending` → Invoice created, awaiting payment (0-60 seconds)
2. `processing` → Payment detected on Lightning Network (0-5 seconds)
3. `verifying` → Confirming payment with Lightning node (0-3 seconds)
4. `completed` → Payment confirmed, user receives access

**Concerning States:**

- `pending` for > 5 minutes → User may not have paid or routing issue
- `processing` for > 2 minutes → Webhook delay or verification issue
- `verifying` for > 1 minute → Lightning node response slow
- `verification_failed` → Temporary failure, system will retry
- `failed` → Payment could not complete (routing failure, expired)

**Action Required:**

- `disputed` → Manual investigation needed
- `refunded` → Refund processed, check reason

---

### Q: What's the difference between payment_hash and invoice?

**A:**

**Payment Hash:**

- 32-byte unique identifier for a payment
- Format: Hex string (64 characters)
- Example: `9dabd85596c3222f3d8a42e8895378d4473c0c79e7598dd3a2f5318b8a8e9b29`
- Used internally for tracking and verification
- Cryptographic proof of payment when matched with preimage

**Invoice (BOLT11):**

- User-facing payment request string
- Format: Starts with `lnbc` (mainnet) or `lntb` (testnet)
- Example: `lnbc1500n1pj4d0fz...` (much longer)
- Encodes: amount, payment hash, description, expiry, node info
- What users copy/paste or scan as QR code

**Relationship:** The invoice contains the payment hash, along with other payment details.

---

### Q: How do I know if a payment was successful?

**A:** A payment is confirmed successful when **ALL** of these are true:

1. **Database status:** `status = 'completed'` in `payments` table
2. **Lightning node:** `settled = true` when querying invoice
3. **Settled timestamp:** `settled_at` is not NULL
4. **Preimage exists:** Payment has a valid preimage (proof of payment)

**Verification command:**

```bash
# Check database
psql -d sovren -c "SELECT status, settled_at FROM payments WHERE payment_hash = '<hash>';"

# Cross-verify with Lightning node
docker exec sovren-lnd lncli lookupinvoice <payment-hash> | jq '.settled'
```

**Warning:** Never rely on database status alone. Always cross-verify with Lightning node to prevent false positives.

---

### Q: Can payments fail after showing as "completed"?

**A:** No, properly completed payments cannot fail:

**Once completed:**

- Payment is cryptographically proven with preimage
- Bitcoin has been received in Lightning channel
- Transaction is irreversible on Lightning Network
- Status should never revert from `completed`

**If you see this:**

- Database corruption or manual error
- False positive (wasn't actually completed)
- Immediate investigation required
- Check [Section 2.2: False Positive Confirmations](PAYMENT_TROUBLESHOOTING_GUIDE.md#22-false-positive-payment-confirmations)

**Proper flow after completion:**

- `completed` can transition to `refunded` (manual refund by creator)
- `completed` can transition to `disputed` (user disputes charge)
- No other transitions are valid

---

## 2. Invoice & Payment Creation

### Q: Why is invoice creation failing with "Lightning node unavailable"?

**A:** This indicates the LND node is not responding. Common causes:

**Immediate checks:**

1. Is LND running?

   ```bash
   docker ps | grep lnd
   ```

2. Is LND synced to chain?

   ```bash
   docker exec sovren-lnd lncli getinfo | jq '.synced_to_chain'
   ```

3. Can we connect to LND?
   ```bash
   docker exec sovren-lnd lncli getinfo
   ```

**Solutions:**

- **LND down:** `docker restart sovren-lnd`
- **LND syncing:** Wait 5-10 minutes for sync to complete
- **Connection issues:** Check TLS certificates and macaroon files
- **Network issues:** Verify Docker network connectivity

**See:** [Section 1.3: Lightning Node Connection Error](PAYMENT_TROUBLESHOOTING_GUIDE.md#13-lightning-node-connection-error)

---

### Q: What are valid invoice amounts?

**A:**

**Minimum:** 1 satoshi (dust limit)

**Maximum:** Depends on several factors:

- Channel capacity (typically 50,000 to 50,000,000 sats)
- Available inbound liquidity
- Platform limits (configurable, default 1,000,000 sats)

**Common amounts:**

- Small tip: 100-1,000 sats ($0.03-$0.30 at $30k BTC)
- Article access: 1,000-10,000 sats ($0.30-$3)
- Subscription: 10,000-100,000 sats ($3-$30)

**Validation:**

```typescript
const MIN_INVOICE_AMOUNT = 1;
const MAX_INVOICE_AMOUNT = 1_000_000; // 0.01 BTC

if (amount < MIN_INVOICE_AMOUNT || amount > MAX_INVOICE_AMOUNT) {
  throw new Error(`Amount must be between ${MIN_INVOICE_AMOUNT} and ${MAX_INVOICE_AMOUNT} sats`);
}
```

---

### Q: How long do invoices remain valid?

**A:**

**Default expiry:** 1 hour (3600 seconds)

**Configurable range:**

- Minimum: 5 minutes (300 seconds)
- Maximum: 24 hours (86400 seconds)
- Recommended: 15-60 minutes

**After expiry:**

- Invoice automatically marked as `EXPIRED` by Lightning node
- Payment attempts will fail
- User must request new invoice
- Database record updated to `status = 'expired'`

**Best practices:**

- Short expiry (15 min) for instant purchases
- Longer expiry (1-24 hours) for invoices sent via email
- Auto-generate new invoice if user returns after expiry

---

### Q: Can the same invoice be paid twice?

**A:** No, Lightning invoices are single-use by design:

**Security feature:**

- Each invoice has unique payment hash
- Once settled, invoice cannot be paid again
- Prevents double-charging and replay attacks

**If user tries to pay settled invoice:**

- Lightning wallet will reject payment
- Error: "Invoice already settled"
- User must request new invoice

**For recurring payments:**

- Generate new invoice for each payment cycle
- Use subscriptions with automated invoice generation
- Never reuse payment hashes

---

## 3. Payment Verification & Status

### Q: Payment shows "pending" for 10 minutes - what should I do?

**A:** Follow this diagnostic process:

**Step 1: Check Lightning node status**

```bash
docker exec sovren-lnd lncli lookupinvoice <payment-hash>
```

**Possible outcomes:**

1. **`state: SETTLED`** → Webhook missed, manual DB update needed

   ```bash
   psql -d sovren -c "UPDATE payments SET status='completed' WHERE payment_hash='<hash>';"
   ```

2. **`state: OPEN`** → User hasn't paid yet (or routing issue)
   - Contact user to confirm payment attempt
   - Check channel liquidity
   - User may need to retry payment

3. **`state: CANCELED` or `EXPIRED`** → Payment failed

   ```bash
   psql -d sovren -c "UPDATE payments SET status='failed' WHERE payment_hash='<hash>';"
   ```

4. **`Error: invoice not found`** → Lightning node issue
   - Check LND logs: `docker logs sovren-lnd --tail 100`
   - May need to restart LND

**See:** [Section 2.1: Payment Stuck in Pending](PAYMENT_TROUBLESHOOTING_GUIDE.md#21-payment-stuck-in-pending-state)

---

### Q: How can I tell if a webhook was missed vs never sent?

**A:** Check the webhook logs:

**Query webhook delivery logs:**

```bash
psql -d sovren -c "
SELECT webhook_id, received_at, signature_valid, error_message
FROM webhook_logs
WHERE payment_hash = '<payment-hash>'
ORDER BY received_at;
"
```

**Scenarios:**

**No rows returned:** Webhook never received

- Check payment provider dashboard (did they send it?)
- Check firewall rules (is traffic blocked?)
- Check application logs (is webhook endpoint responding?)

**Rows with `signature_valid = false`:** Webhook rejected

- Check webhook secret configuration
- Verify timestamp is within tolerance (< 5 minutes)
- See [Section 3.1: Signature Verification Failures](PAYMENT_TROUBLESHOOTING_GUIDE.md#31-webhook-signature-verification-failures)

**Rows with `error_message`:** Webhook received but processing failed

- Check error message for specific failure reason
- Common: database lock, invalid state transition
- May need manual intervention

**Provider-side check:**

- Log into payment provider dashboard
- Check webhook delivery logs
- Look for 4xx/5xx errors (our endpoint rejected it)
- Look for timeouts (our endpoint didn't respond)

---

### Q: What's the difference between "verification" and "confirmation"?

**A:**

**Verification:**

- Technical process of checking payment status with Lightning node
- Happens after webhook received or during polling
- Confirms payment hash, amount, and settled status match
- Automated, happens in < 1 second typically
- Results in state transition to `completed` or `failed`

**Confirmation:**

- User-facing notification that payment succeeded
- Sent after verification completes successfully
- May include email, push notification, UI update
- Triggers access grant (unlock content, activate subscription)
- User experiences this as "payment successful"

**Timeline:**

1. User pays invoice (0:00)
2. Webhook received (0:02)
3. Verification with LND (0:03)
4. Database updated to `completed` (0:04)
5. User confirmation sent (0:05)
6. Access granted (0:05)

---

### Q: How often does the system check payment status?

**A:** Multiple mechanisms ensure timely status updates:

**Webhook-based (primary method):**

- Payment provider sends webhook immediately when invoice settles
- Near real-time (< 2 seconds typically)
- Most reliable when webhooks working properly

**Polling-based (backup method):**

- Active invoices checked periodically with Lightning node
- Schedule:
  - First minute: Every 10 seconds (fast polling)
  - Minutes 2-5: Every 30 seconds
  - Minutes 5-15: Every 60 seconds
  - After 15 minutes: Every 5 minutes until expiry

**On-demand:**

- User can manually refresh status
- API endpoint: `GET /api/payments/<payment-hash>/status`
- Forces immediate check with Lightning node

**State reconciliation (cleanup):**

- Background job runs every 5 minutes
- Finds stuck payments and reconciles with Lightning node
- Ensures no payments are missed by webhooks or polling

---

## 4. Webhooks & Integration

### Q: What webhook endpoints need to be exposed?

**A:** Required webhook endpoints:

**Payment webhooks:**

- **URL:** `https://your-domain.com/api/webhooks/payment`
- **Method:** POST
- **Purpose:** Receive payment status updates
- **Authentication:** HMAC-SHA256 signature verification

**Subscription webhooks:**

- **URL:** `https://your-domain.com/api/webhooks/subscription`
- **Method:** POST
- **Purpose:** Subscription events (created, renewed, canceled)
- **Authentication:** HMAC-SHA256 signature verification

**Network requirements:**

- HTTPS only (TLS 1.2+)
- Publicly accessible (not behind firewall for provider IPs)
- Responds within 10 seconds (provider timeout)
- Returns 200 OK for successful processing

**Configuration with provider:**

1. Register webhook URLs in provider dashboard
2. Copy webhook secret provided by provider
3. Add secret to `.env` as `WEBHOOK_SECRET`
4. Test webhook delivery before going live

---

### Q: How do I test webhook signature verification locally?

**A:** Use this manual testing procedure:

**Step 1: Generate test webhook**

```bash
WEBHOOK_SECRET="your-webhook-secret"
TIMESTAMP=$(date +%s)
PAYLOAD='{"payment_hash":"test123","status":"completed","amount":1000}'

# Generate HMAC signature
SIGNATURE=$(echo -n "${TIMESTAMP}.${PAYLOAD}" | \
  openssl dgst -sha256 -hmac "$WEBHOOK_SECRET" -binary | \
  base64)

echo "Timestamp: $TIMESTAMP"
echo "Signature: $SIGNATURE"
```

**Step 2: Send test request**

```bash
curl -X POST http://localhost:8080/api/webhooks/payment \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: $SIGNATURE" \
  -H "X-Webhook-Timestamp: $TIMESTAMP" \
  -H "X-Webhook-ID: test-$(date +%s)" \
  -d "$PAYLOAD" \
  -v
```

**Expected response:**

```json
{
  "success": true,
  "message": "Webhook processed successfully"
}
```

**Common issues:**

- **403 Invalid signature:** Secret mismatch, regenerate signature
- **403 Timestamp expired:** Timestamp > 5 minutes old, use current timestamp
- **429 Rate limited:** Too many requests, wait 1 minute
- **500 Internal error:** Check application logs

---

### Q: Why are webhooks being rejected with "Invalid signature"?

**A:** Common causes and solutions:

**1. Wrong webhook secret**

- **Check:** Does `WEBHOOK_SECRET` in `.env` match provider's secret?
- **Solution:** Copy correct secret from provider dashboard
- **Test:** Generate signature manually and compare

**2. Timestamp out of tolerance**

- **Check:** Is server time synchronized?
- **Command:** `timedatectl status`
- **Solution:** Sync with NTP: `sudo ntpdate -s time.nist.gov`
- **Tolerance:** Webhooks must arrive within 5 minutes of timestamp

**3. Secret rotation in progress**

- **Check:** Did provider recently rotate secret?
- **Solution:** Add old secret to `WEBHOOK_SECRET_ROTATION` during transition
- **Duration:** Keep both secrets for 7 days, then remove old one

**4. Payload modification in transit**

- **Check:** Is there a proxy/WAF modifying request body?
- **Solution:** Disable body modification for webhook endpoint
- **Verify:** Raw body must exactly match what was signed

**Debug steps:**

```bash
# Enable webhook debug logging
export WEBHOOK_DEBUG=true

# Check recent signature failures
psql -d sovren -c "
SELECT webhook_id, received_at, error_message
FROM webhook_logs
WHERE signature_valid = false
ORDER BY received_at DESC
LIMIT 10;
"
```

**See:** [Section 3.1: Webhook Signature Verification Failures](PAYMENT_TROUBLESHOOTING_GUIDE.md#31-webhook-signature-verification-failures)

---

### Q: What happens if webhook delivery fails?

**A:** Multiple fallback mechanisms ensure payment is still processed:

**Webhook retry by provider:**

- Most providers retry failed webhooks automatically
- Typical schedule: immediate, 1m, 5m, 15m, 1h, 6h, 24h
- Each retry has unique `X-Webhook-ID` header
- Idempotency prevents duplicate processing

**Backup polling verification:**

- System polls Lightning node for invoice status
- Continues even without webhook
- Slower (30-60 second polling) but ensures payment detected

**Manual reconciliation:**

- Background job runs every 5 minutes
- Checks all pending payments against Lightning node
- Automatically updates any missed payments

**User notification:**

- If payment takes > 2 minutes, user sees "Verifying payment..."
- Can manually refresh status via "Check Payment" button
- Forces immediate verification check

**Outcome:** Payment will eventually be confirmed, webhook is optimization not requirement

---

## 5. Errors & Failures

### Q: What does "Circuit breaker open" mean?

**A:** Circuit breaker pattern prevents cascading failures:

**What it means:**

- Too many consecutive failures detected (default: 5 in 60 seconds)
- System temporarily stops attempting operations
- Prevents overwhelming failing service (Lightning node)
- Self-protection mechanism

**Common causes:**

- Lightning node down or unreachable
- Network connectivity issues
- Database connection problems
- Webhook signature verification failing repeatedly

**When circuit breaker opens:**

- All payment operations fail immediately (fail-fast)
- Error: "Service temporarily unavailable - circuit breaker open"
- System enters recovery mode

**Recovery:**

1. Circuit breaker automatically attempts recovery after timeout (60 seconds)
2. Enters "half-open" state - allows limited test requests
3. If test requests succeed, circuit closes and normal operation resumes
4. If test requests fail, circuit reopens for another timeout period

**Manual intervention:**

```bash
# Check circuit breaker status
curl http://localhost:8080/api/metrics/circuit-breaker

# Manually reset (after fixing root cause)
curl -X POST http://localhost:8080/api/internal/circuit-breaker/reset \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**See:** [Section 4.1: Circuit Breaker Open](PAYMENT_TROUBLESHOOTING_GUIDE.md#41-circuit-breaker-open)

---

### Q: Why do payments fail with "Insufficient inbound liquidity"?

**A:** Lightning Network channel liquidity issue:

**Explanation:**

- Lightning channels have finite capacity
- "Inbound liquidity" = other nodes' ability to send payments to you
- Receiving payment requires remote balance in channels
- Like having a full bucket - water can't flow in if already full

**Example:**

- Channel capacity: 10,000,000 sats
- Your local balance: 9,500,000 sats
- Inbound liquidity: 500,000 sats
- Max receivable payment: 500,000 sats
- Payment of 1,000,000 sats will fail routing

**Solutions:**

**Short-term:**

1. Make outbound payments to rebalance channels
2. Use submarine swaps to convert on-chain to channel capacity
3. Direct users to smaller payments if possible

**Long-term:**

1. Open new channels with high inbound liquidity
2. Use Lightning Service Providers (LSPs) for liquidity
3. Implement circular rebalancing strategy
4. Monitor liquidity and alert when < 20%

**Check current liquidity:**

```bash
docker exec sovren-lnd lncli channelbalance
docker exec sovren-lnd lncli listchannels | jq '[.channels[] | {
  remote_balance: .remote_balance,
  capacity: .capacity
}]'
```

**Prevention:**

- Monitor liquidity continuously
- Alert when inbound < 20% of total capacity
- Automated rebalancing scripts
- Multiple channels for redundancy

---

### Q: What causes "Invalid state transition" errors?

**A:** Payment state machine rejected illegal state change:

**State machine rules:**

```
pending → processing, failed, expired
processing → verifying, failed
verifying → completed, verification_failed
verification_failed → verifying, failed
completed → refunded, disputed
failed → pending (retry)
```

**Common invalid transitions:**

- `pending → completed` (skipped verification)
- `completed → pending` (can't uncomplete)
- `failed → completed` (can't succeed after failure)

**Causes:**

**1. Out-of-order webhooks**

- "completed" webhook arrives before "processing"
- Solution: Implement optimistic locking with version numbers
- Allow idempotent transitions (arriving at same state is OK)

**2. Manual database updates**

- Admin directly updated status without state machine
- Solution: Always use state machine API, never direct SQL updates

**3. Concurrent updates (race condition)**

- Two webhooks processing same payment simultaneously
- Solution: Row-level locking with `FOR UPDATE NOWAIT`

**4. Replay attack or duplicate webhook**

- Same webhook processed multiple times
- Solution: Idempotency key tracking

**Resolution:**

```bash
# Check current state and history
psql -d sovren -c "
SELECT status FROM payments WHERE payment_hash = '<hash>';
"

psql -d sovren -c "
SELECT from_state, to_state, transitioned_at
FROM payment_state_history
WHERE payment_hash = '<hash>'
ORDER BY transitioned_at;
"

# Force state to match Lightning reality (admin only)
LND_STATE=$(docker exec sovren-lnd lncli lookupinvoice <hash> | jq -r '.state')
# Then manually update based on LND state
```

**See:** [Section 5.1: Invalid State Transitions](PAYMENT_TROUBLESHOOTING_GUIDE.md#51-invalid-state-transitions)

---

### Q: How do I handle a payment that failed due to routing issues?

**A:** Lightning routing failures are common and usually retryable:

**Common routing error messages:**

- "No route found"
- "Insufficient capacity"
- "Channel offline"
- "Temporary channel failure"

**User-facing response:**

1. **Inform user payment failed** (don't charge wallet)
2. **Generate new invoice** (different routing attempt)
3. **Suggest alternative:**
   - Try smaller amount if possible
   - Wait a few minutes and retry
   - Try different Lightning wallet
   - Use different payment method if available

**System actions:**

```typescript
// Handle routing failure
if (payment.status === 'failed' && payment.error_message?.includes('routing')) {
  // Log routing failure
  logger.info('Routing failure, allowing retry', {
    payment_hash: payment.payment_hash,
    amount: payment.amount_sats,
  });

  // Allow user to request new invoice
  // Don't block user from retrying
  // New invoice = new routing attempt

  // Monitor routing failure rate
  if (routingFailureRate > 0.1) {
    // Alert if > 10% of payments fail routing
    alertOps('High routing failure rate');
  }
}
```

**Not a system error:**

- Routing failures are normal in Lightning Network
- Happens due to network topology changes
- Not indicative of our system problems
- User should simply retry with new invoice

**When to escalate:**

- Routing failure rate > 10%
- Same user failing repeatedly
- All payments to specific creator failing
- Pattern suggests channel or node issue

---

## 6. Performance & Scaling

### Q: What's considered "normal" payment verification latency?

**A:** Performance targets:

**Target latencies (from invoice creation to confirmation):**

- **P50 (median):** < 2 seconds
- **P95:** < 5 seconds
- **P99:** < 10 seconds
- **Maximum:** < 30 seconds

**Breakdown:**

1. Invoice creation: 50-200ms
2. User pays: 1-3 seconds (user action)
3. Lightning network routing: 0.5-2 seconds
4. Webhook delivery: 0.1-1 second
5. Verification with LND: 50-500ms
6. Database update: 10-100ms
7. User notification: 50-200ms

**When to investigate:**

- P95 > 10 seconds: Check webhook delays
- P99 > 30 seconds: Check Lightning node performance
- Any payment > 60 seconds: Critical issue

**Monitoring query:**

```bash
psql -d sovren -c "
SELECT
  PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (verified_at - created_at)) * 1000) as p50_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (verified_at - created_at)) * 1000) as p95_ms,
  PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (verified_at - created_at)) * 1000) as p99_ms
FROM payments
WHERE verified_at IS NOT NULL
  AND created_at > NOW() - INTERVAL '1 hour';
"
```

---

### Q: How many payments can the system handle concurrently?

**A:** Capacity and scaling limits:

**Current capacity (single instance):**

- **Invoice creation:** 100-200 requests/second
- **Concurrent verifications:** 50-100 simultaneous
- **Database:** 500+ concurrent connections (with pooling)
- **Lightning node:** 1,000+ concurrent invoice lookups/second

**Bottlenecks:**

1. **Lightning node RPC** (most common)
   - Single LND instance: ~200 requests/second
   - Solution: Connection pooling, caching
2. **Database writes** (during high load)
   - Postgres: 5,000+ writes/second (properly tuned)
   - Solution: Write batching, connection pooling
3. **Webhook processing**
   - Network I/O bound
   - Solution: Async processing with queue

**Scaling strategies:**

**Horizontal scaling:**

- Multiple API instances behind load balancer
- Shared database and Redis cache
- Single LND node (can't horizontally scale easily)

**Vertical scaling:**

- Increase LND node resources (CPU, RAM)
- Larger database instance
- More connection pool capacity

**Current tested limits:**

- **Peak:** 50 payments/second sustained
- **Burst:** 150 payments/second for 1 minute
- **Daily volume:** 1M+ payments

**Monitoring thresholds:**

- Alert at 70% capacity (35 payments/second)
- Scale at 80% capacity (40 payments/second)
- Emergency at 90% capacity (45 payments/second)

---

### Q: Why is the database slow during high payment volume?

**A:** Common database performance issues:

**Diagnosis:**

```bash
# Check active connections
psql -d sovren -c "
SELECT count(*), state
FROM pg_stat_activity
GROUP BY state;
"

# Check slow queries
psql -d sovren -c "
SELECT query, mean_exec_time
FROM pg_stat_statements
WHERE query LIKE '%payments%'
ORDER BY mean_exec_time DESC
LIMIT 5;
"

# Check lock waits
psql -d sovren -c "
SELECT COUNT(*) as blocked_count
FROM pg_locks
WHERE NOT granted;
"
```

**Common causes:**

**1. Missing indexes**

```sql
-- Add essential indexes
CREATE INDEX CONCURRENTLY idx_payments_hash ON payments(payment_hash);
CREATE INDEX CONCURRENTLY idx_payments_status_created ON payments(status, created_at DESC);
```

**2. Connection pool exhaustion**

```javascript
// Increase pool size
DB_POOL_SIZE = 20; // up from 10
DB_POOL_MIN = 5;
```

**3. Long-running transactions**

```bash
# Find and terminate
psql -d sovren -c "
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle in transaction'
  AND query_start < NOW() - INTERVAL '5 minutes';
"
```

**4. Table bloat**

```sql
-- Vacuum and analyze
VACUUM ANALYZE payments;

-- Tune autovacuum
ALTER TABLE payments SET (
  autovacuum_vacuum_scale_factor = 0.05
);
```

**See:** [Section 6.2: Database Performance Bottlenecks](PAYMENT_TROUBLESHOOTING_GUIDE.md#62-database-performance-bottlenecks)

---

## 7. Security & Compliance

### Q: How do we prevent duplicate payment processing?

**A:** Multiple safeguards against duplicates:

**1. Idempotency key tracking**

```typescript
// Track processed webhook IDs in Redis
const processedWebhooks = new Map<string, string>();

const webhookId = req.headers['x-webhook-id'];
if (await redis.get(`webhook:${webhookId}`)) {
  return res.status(200).json({ success: true, message: 'Already processed' });
}

await redis.setex(`webhook:${webhookId}`, 86400, 'processing'); // 24h TTL
```

**2. Database uniqueness constraints**

```sql
-- Unique constraint on payment_hash
ALTER TABLE payments ADD CONSTRAINT unique_payment_hash UNIQUE (payment_hash);

-- Prevents inserting same payment twice
```

**3. State machine validation**

```typescript
// Reject invalid state transitions
if (currentState === 'completed' && newState === 'completed') {
  // Idempotent - already completed, ignore
  return;
}
```

**4. Optimistic locking**

```sql
-- Version-based concurrency control
UPDATE payments
SET status = $1, version = version + 1
WHERE payment_hash = $2 AND version = $3
```

**Audit trail:**

```sql
-- Log all payment processing attempts
INSERT INTO payment_processing_log (
  payment_hash, webhook_id, processed_at, action
) VALUES ($1, $2, NOW(), $3);
```

---

### Q: How do we ensure webhook requests are authentic?

**A:** Multi-layer authentication:

**1. HMAC-SHA256 signature verification**

```typescript
const computedSignature = crypto
  .createHmac('sha256', WEBHOOK_SECRET)
  .update(`${timestamp}.${JSON.stringify(body)}`)
  .digest('base64');

if (computedSignature !== receivedSignature) {
  throw new Error('Invalid webhook signature');
}
```

**2. Timestamp validation**

```typescript
const requestTime = parseInt(headers['x-webhook-timestamp']);
const now = Math.floor(Date.now() / 1000);

if (Math.abs(now - requestTime) > 300) {
  // 5 minutes
  throw new Error('Webhook timestamp expired');
}
```

**3. Replay attack prevention**

```typescript
// Store processed webhook IDs
const webhookId = headers['x-webhook-id'];
if (await seenWebhookId(webhookId)) {
  return '200 OK - Already processed';
}
await recordWebhookId(webhookId, 24 * 60 * 60); // 24h TTL
```

**4. IP allowlisting (optional)**

```typescript
const allowedIPs = ['52.89.214.238', '34.212.75.30']; // Provider IPs
if (!allowedIPs.includes(requestIP)) {
  throw new Error('Webhook from unauthorized IP');
}
```

**5. Rate limiting**

```typescript
// Max 100 webhooks per minute per IP
const rateLimitKey = `webhook:ratelimit:${clientIP}`;
const count = await redis.incr(rateLimitKey);

if (count === 1) {
  await redis.expire(rateLimitKey, 60);
}

if (count > 100) {
  throw new Error('Rate limit exceeded');
}
```

**Security logging:**

```typescript
// Log all security events
logger.security('Webhook authentication', {
  webhook_id: webhookId,
  signature_valid: signatureValid,
  timestamp_valid: timestampValid,
  source_ip: clientIP,
  user_agent: userAgent,
});
```

---

### Q: What payment data needs to be encrypted?

**A:** Data protection requirements:

**Encrypted at rest:**

- Lightning node private keys (LND wallet)
- Webhook secrets (in environment variables)
- Database backups
- Logs containing sensitive data

**NOT encrypted (no PII):**

- Payment hashes (public identifiers)
- Invoice amounts
- Payment status
- Timestamps
- Transaction IDs

**Lightning Network privacy:**

- Payments are pseudonymous (no personal info required)
- Payment hash doesn't reveal identity
- Invoice can include optional metadata (description)
- On-chain settlement is public Bitcoin blockchain

**GDPR/CCPA compliance:**

```typescript
// Minimal data collection
interface Payment {
  payment_hash: string; // Public identifier
  amount_sats: number; // Not PII
  status: PaymentStatus; // Not PII
  created_at: Date; // Not PII
  user_id?: string; // Link to user (optional for logged-in)
  // NO email, name, address, etc.
}
```

**Data retention:**

- Payment records: 7 years (tax compliance)
- Webhook logs: 90 days
- Error logs: 30 days
- User can request payment history export (GDPR right to data portability)

---

## 8. Recovery & Debugging

### Q: How do I manually mark a payment as completed?

**A:** Only do this after verifying payment with Lightning node:

**Step 1: Verify payment actually settled**

```bash
PAYMENT_HASH="<payment-hash>"

# Check with Lightning node
docker exec sovren-lnd lncli lookupinvoice $PAYMENT_HASH | jq '{
  settled: .settled,
  state: .state,
  amt_paid_sat: .amt_paid_sat
}'

# MUST see: "settled": true
```

**Step 2: Update database**

```bash
psql -d sovren << EOF
BEGIN;

-- Update payment status
UPDATE payments
SET status = 'completed',
    settled_at = NOW(),
    updated_at = NOW(),
    notes = COALESCE(notes, '') || ' [Manually confirmed by support]'
WHERE payment_hash = '$PAYMENT_HASH'
  AND status != 'completed';

-- Record state transition
INSERT INTO payment_state_history (
  payment_hash, from_state, to_state, triggered_by, notes
)
SELECT
  '$PAYMENT_HASH',
  status,
  'completed',
  'manual_intervention',
  'Support manually confirmed via Lightning node verification'
FROM payments
WHERE payment_hash = '$PAYMENT_HASH';

COMMIT;
EOF
```

**Step 3: Trigger post-payment actions**

```bash
# Trigger webhooks, notifications, access grants
curl -X POST http://localhost:8080/api/internal/trigger-payment-confirmation \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d "{\"payment_hash\": \"$PAYMENT_HASH\"}"
```

**Step 4: Document why manual intervention was needed**

```bash
# Log incident for review
echo "$(date): Manually confirmed payment $PAYMENT_HASH - Webhook delivery failed" \
  >> /var/log/sovren/manual-interventions.log
```

**WARNING:** Never mark payment completed without verifying with Lightning node first!

---

### Q: How do I run the payment reconciliation job manually?

**A:** Use the recovery script:

```bash
#!/bin/bash
# File: /usr/local/bin/reconcile-payments.sh

echo "=== Payment Reconciliation Starting ==="
echo "Time: $(date)"

# Find payments in inconsistent states
INCONSISTENT=$(psql -d sovren -t -c "
SELECT payment_hash
FROM payments
WHERE status IN ('pending', 'processing', 'verifying', 'verification_failed')
  AND updated_at < NOW() - INTERVAL '5 minutes';
")

COUNT=$(echo "$INCONSISTENT" | wc -l)
echo "Found $COUNT payments to reconcile"

FIXED=0
FAILED=0

for PAYMENT_HASH in $INCONSISTENT; do
  echo "Checking: $PAYMENT_HASH"

  # Get Lightning node status
  LND_INFO=$(docker exec sovren-lnd lncli lookupinvoice "$PAYMENT_HASH" 2>&1)

  if echo "$LND_INFO" | grep -q "unable to locate invoice"; then
    echo "  WARNING: Invoice not found in LND, marking as failed"
    psql -d sovren -c "
    UPDATE payments
    SET status = 'failed',
        error_message = 'Invoice not found in Lightning node',
        updated_at = NOW()
    WHERE payment_hash = '$PAYMENT_HASH';
    "
    FAILED=$((FAILED + 1))
    continue
  fi

  STATE=$(echo "$LND_INFO" | jq -r '.state')
  SETTLED=$(echo "$LND_INFO" | jq -r '.settled')

  case "$STATE" in
    SETTLED)
      if [ "$(psql -d sovren -t -c "SELECT status FROM payments WHERE payment_hash='$PAYMENT_HASH';")" != "completed" ]; then
        echo "  FIXING: Marking as completed"
        psql -d sovren -c "
        UPDATE payments
        SET status = 'completed',
            settled_at = NOW(),
            updated_at = NOW()
        WHERE payment_hash = '$PAYMENT_HASH';
        "
        FIXED=$((FIXED + 1))
      fi
      ;;
    CANCELED|EXPIRED)
      echo "  FIXING: Marking as failed"
      psql -d sovren -c "
      UPDATE payments
      SET status = 'failed',
          error_message = 'Invoice $STATE',
          updated_at = NOW()
      WHERE payment_hash = '$PAYMENT_HASH';
      "
      FAILED=$((FAILED + 1))
      ;;
    OPEN)
      echo "  OK: Still pending, no action needed"
      ;;
  esac
done

echo ""
echo "=== Reconciliation Complete ==="
echo "Total processed: $COUNT"
echo "Fixed (completed): $FIXED"
echo "Failed: $FAILED"
echo "Time: $(date)"
```

**Run manually:**

```bash
sudo /usr/local/bin/reconcile-payments.sh
```

**Schedule with cron (recommended):**

```bash
# Run every 5 minutes
*/5 * * * * /usr/local/bin/reconcile-payments.sh >> /var/log/sovren/reconciliation.log 2>&1
```

---

### Q: Where can I find more detailed troubleshooting information?

**A:** Documentation resources:

**Primary guides:**

1. **[Payment Troubleshooting Guide](PAYMENT_TROUBLESHOOTING_GUIDE.md)**
   - Comprehensive issue diagnosis and resolution
   - Section-by-section coverage of all problem categories
   - Emergency procedures and recovery operations

2. **[Payment Debugging Commands](PAYMENT_DEBUGGING_COMMANDS.md)**
   - Quick command reference
   - Copy-paste ready scripts
   - Database queries and Lightning CLI commands

3. **[Decision Tree Diagrams](../architecture/diagrams/troubleshooting/)**
   - Visual troubleshooting flows
   - Quick diagnosis paths
   - Mermaid diagrams for common scenarios

**Architecture documentation:**

- `docs/features/LIGHTNING_PAYMENT_ARCHITECTURE.md` - System design
- `docs/deployment/PAYMENT_MONITORING.md` - Monitoring and alerts
- `LIGHTNING-NETWORK-INTEGRATION-COMPLETE.md` - Implementation details

**Support channels:**

- **Critical (P0):** #sovren-payment-critical on Slack
- **High (P1):** #sovren-payment-support
- **Standard:** #sovren-engineering

**Escalation:**

1. Try troubleshooting guide first
2. Check debugging commands reference
3. Review decision trees
4. If unresolved after 15 minutes, escalate to on-call engineer

---

**Version:** 1.0.0
**Maintained By:** Platform Engineering Team
**Feedback:** engineering@sovren.com
