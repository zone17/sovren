# PAY-002: Integration Guide - Race Condition Handling

**Quick Reference**: How to integrate PAY-002 race condition handling into existing webhook system

---

## 🚀 QUICK START (5 Minutes)

### Step 1: Run Database Migration

```bash
# Navigate to Sovren root
cd /Users/fp/Desktop/Sovren

# Apply webhook event log migration
psql $DATABASE_URL -f supabase/migrations/20251024000000_add_webhook_event_log.sql

# OR using Supabase CLI
supabase migration up
```

**Verify Migration**:

```sql
-- Should return webhook_events table
SELECT table_name FROM information_schema.tables
WHERE table_name = 'webhook_events';

-- Should return 6 webhook functions
SELECT routine_name FROM information_schema.routines
WHERE routine_name LIKE '%webhook%';
```

---

### Step 2: Replace Webhook Handler

**Option A: Direct Replacement** (Recommended for new deployments)

```bash
cd packages/backend/src/routes

# Backup existing handler
mv webhooks.ts webhooks-legacy-backup.ts

# Activate race-condition-hardened handler
mv webhooks-race-condition-hardened.ts webhooks.ts
```

**Option B: Gradual Migration** (Recommended for production)

```bash
# Keep both handlers active
# Route new webhooks to hardened handler, legacy to old handler
# See "Gradual Migration Strategy" below
```

---

### Step 3: Test Locally

```bash
# Start backend server
npm run dev

# Test webhook endpoint (health check)
curl http://localhost:3001/api/webhooks/health

# Expected response:
{
  "success": true,
  "service": "webhooks",
  "status": "healthy",
  "features": {
    "idempotency": true,
    "rowLocking": true,
    "atomicTransactions": true,
    "webhookLogging": true,
    "timestampOrdering": true
  }
}
```

---

### Step 4: Test Race Conditions

```bash
# Run race condition test suite
npm test -- webhooks-race-conditions.test.ts

# Expected: 10 tests passing
# ✓ Concurrent webhook processing (3 tests)
# ✓ Out-of-order handling (2 tests)
# ✓ Duplicate detection (3 tests)
# ✓ Metrics and history (2 tests)
```

---

## 📊 MONITORING SETUP

### Dashboard Queries

```sql
-- Real-time webhook metrics (last hour)
SELECT * FROM get_webhook_processing_metrics(
  NOW() - INTERVAL '1 hour',
  NOW()
);

-- Duplicate webhook rate
SELECT
  COUNT(*) FILTER (WHERE status = 'duplicate') * 100.0 / COUNT(*) as duplicate_rate_pct,
  COUNT(*) as total_webhooks
FROM webhook_events
WHERE created_at > NOW() - INTERVAL '24 hours';

-- Out-of-order webhook detection
SELECT
  payment_hash,
  event_type,
  event_timestamp,
  is_out_of_order
FROM webhook_events
WHERE is_out_of_order = true
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- Failed webhooks for debugging
SELECT
  payment_hash,
  event_type,
  error_message,
  created_at
FROM webhook_events
WHERE status = 'failed'
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 20;
```

### Grafana/DataDog Metrics

```javascript
// Webhook processing time (p95)
SELECT
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY processing_duration_ms) as p95
FROM webhook_events
WHERE created_at > NOW() - INTERVAL '5 minutes';

// Duplicate rate (alert if > 20%)
SELECT
  COUNT(*) FILTER (WHERE status = 'duplicate') * 100.0 / NULLIF(COUNT(*), 0)
FROM webhook_events
WHERE created_at > NOW() - INTERVAL '5 minutes';

// Failed webhook rate (alert if > 5%)
SELECT
  COUNT(*) FILTER (WHERE status = 'failed') * 100.0 / NULLIF(COUNT(*), 0)
FROM webhook_events
WHERE created_at > NOW() - INTERVAL '5 minutes';
```

---

## 🔧 GRADUAL MIGRATION STRATEGY

For production systems with existing webhooks:

### Phase 1: Deploy with Feature Flag (Week 1)

```typescript
// In your main app.ts or server.ts
import webhooksLegacy from './routes/webhooks';
import webhooksHardened from './routes/webhooks-race-condition-hardened';

const USE_HARDENED_WEBHOOKS = process.env.USE_HARDENED_WEBHOOKS === 'true';

if (USE_HARDENED_WEBHOOKS) {
  app.use('/api/webhooks', webhooksHardened);
  console.log('[WEBHOOKS] Using race-condition-hardened handler');
} else {
  app.use('/api/webhooks', webhooksLegacy);
  console.log('[WEBHOOKS] Using legacy handler');
}
```

### Phase 2: A/B Testing (Week 2)

```typescript
// Route 50% of traffic to each handler
import crypto from 'crypto';

app.use('/api/webhooks', (req, res, next) => {
  // Hash payment hash to consistently route same payment to same handler
  const paymentHash = req.body.paymentHash || '';
  const hash = crypto.createHash('md5').update(paymentHash).digest('hex');
  const useHardened = parseInt(hash.substring(0, 2), 16) % 2 === 0;

  if (useHardened) {
    webhooksHardened(req, res, next);
  } else {
    webhooksLegacy(req, res, next);
  }
});
```

### Phase 3: Full Migration (Week 3)

```typescript
// 100% traffic to hardened handler
app.use('/api/webhooks', webhooksHardened);

// Keep legacy handler available for emergency rollback
// app.use('/api/webhooks/legacy', webhooksLegacy);
```

---

## 🐛 DEBUGGING

### Check Webhook Processing

```sql
-- View recent webhooks for a payment
SELECT * FROM get_webhook_event_history('payment-uuid-here');

-- Check for duplicates
SELECT
  idempotency_key,
  COUNT(*) as count,
  STRING_AGG(status, ', ') as statuses
FROM webhook_events
WHERE payment_hash = 'payment-hash-here'
GROUP BY idempotency_key
HAVING COUNT(*) > 1;

-- Find stuck webhooks (processing > 1 minute)
SELECT *
FROM webhook_events
WHERE status = 'processing'
  AND processing_started_at < NOW() - INTERVAL '1 minute';
```

### Common Issues

**Issue**: Migration fails with "relation payments does not exist"

```bash
# Ensure payments table exists first
# Run baseline schema migration if needed
psql $DATABASE_URL -f supabase/migrations/baseline/001_baseline_schema.sql
```

**Issue**: "function process_webhook_atomic does not exist"

```bash
# Verify function was created
psql $DATABASE_URL -c "SELECT routine_name FROM information_schema.routines WHERE routine_name = 'process_webhook_atomic';"

# If missing, re-run migration
psql $DATABASE_URL -f supabase/migrations/20251024000000_add_webhook_event_log.sql
```

**Issue**: High duplicate rate (>50%)

```sql
-- Check if webhook provider is sending duplicates
SELECT
  payload->'webhookId' as webhook_id,
  COUNT(*) as delivery_count
FROM webhook_events
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY webhook_id
HAVING COUNT(*) > 2
ORDER BY delivery_count DESC;

-- May indicate webhook provider reliability issues
```

---

## 🧪 TESTING CHECKLIST

### Pre-Deployment Tests

- [ ] Database migration runs successfully
- [ ] All database functions created
- [ ] Unit tests pass (10/10)
- [ ] Integration tests pass
- [ ] Load test: 100 concurrent webhooks handled correctly
- [ ] Idempotency test: Duplicate webhooks return 200 with isDuplicate=true
- [ ] Metrics endpoint returns valid data

### Post-Deployment Validation

- [ ] Webhooks processing successfully (check metrics)
- [ ] No duplicate payments created (check payment_events)
- [ ] Out-of-order webhooks flagged correctly
- [ ] Processing time p95 < 500ms
- [ ] No errors in application logs
- [ ] Duplicate rate within expected range (<10%)

---

## 📞 SUPPORT

### If You Encounter Issues

1. **Check Application Logs**:

   ```bash
   # Look for webhook processing errors
   grep -i "webhook" /path/to/app.log | tail -50
   ```

2. **Check Database Logs**:

   ```sql
   -- Check for constraint violations
   SELECT * FROM pg_stat_database_conflicts;
   ```

3. **Query Webhook Events**:

   ```sql
   -- Find recent failures
   SELECT * FROM webhook_events
   WHERE status = 'failed'
   ORDER BY created_at DESC
   LIMIT 10;
   ```

4. **Rollback if Critical**:
   ```bash
   # Emergency rollback to legacy handler
   mv src/routes/webhooks.ts src/routes/webhooks-hardened-temp.ts
   mv src/routes/webhooks-legacy-backup.ts src/routes/webhooks.ts
   # Restart application
   ```

---

## 📚 ADDITIONAL RESOURCES

- **Full Implementation**: `src/routes/webhooks-race-condition-hardened.ts`
- **Database Schema**: `supabase/migrations/20251024000000_add_webhook_event_log.sql`
- **Test Suite**: `src/__tests__/routes/webhooks-race-conditions.test.ts`
- **Completion Summary**: `PAY-002-COMPLETION-SUMMARY.md`
- **CHANGELOG Entry**: `CHANGELOG.md` (search for "PAY-002")

---

**Need Help?** Check the test suite for examples of how to use the new webhook handler.
