# Runbook: Queue Job Failures (BullMQ Dead Letter Queue Growth)

**Alert name:** `bullmq_dead_letter_queue_growing`
**Severity:** P2 — Background processing degraded; no immediate user-facing outage unless payment/notification jobs are failing
**Service:** `sovren-api` / BullMQ workers (Redis-backed)
**On-call rotation:** Backend squad

---

## Symptoms

- Prometheus alert: `bullmq_failed_jobs_total{queue="*"}` rising continuously
- Grafana dashboard: dead-letter queue (DLQ) depth > threshold (default: 50 failed jobs)
- Background tasks not completing:
  - Webhook deliveries to creators/supporters not sending
  - Payment confirmation emails / notifications delayed or missing
  - Lightning invoice polling loops not resolving pending invoices
  - Analytics aggregation falling behind
- Log pattern: `[BullMQ] Job <id> failed after <n> attempts` appearing repeatedly
- Redis memory usage climbing (unconsumed failed job payloads accumulating)

---

## Investigation Steps

### 1. Identify which queues have failures

```bash
# Connect to Redis CLI
redis-cli -u $REDIS_URL

# List all BullMQ queues (failed jobs are stored as sorted sets)
KEYS bull:*:failed

# Get failed job count per queue
ZCARD bull:<queue-name>:failed
```

Or use the BullMQ Board (if deployed):
```
https://api-staging.sovren.dev/admin/bull-board
```

### 2. Inspect failed job payloads and stack traces

```bash
# Get the most recent 5 failed job IDs from a queue
ZRANGE bull:<queue-name>:failed 0 4

# Read the job data (replace <job-id>)
HGETALL bull:<queue-name>:<job-id>
# Fields: data (payload), opts, failedReason, stacktrace, processedOn, finishedOn, attemptsMade
```

Key fields to check:
- `failedReason`: The error message from the last failed attempt
- `stacktrace`: Full stack trace of the failure
- `attemptsMade`: How many retries were exhausted
- `data`: The original job payload (check for malformed data)

### 3. Check worker health

```bash
# Verify worker processes are running
docker exec sovren-api ps aux | grep worker

# Check worker logs for panic/crash patterns
docker logs sovren-api --tail 300 | grep -E "(worker|queue|bull|BullMQ)" | grep -i error
```

### 4. Check Redis connectivity and memory

```bash
# Redis memory usage
redis-cli -u $REDIS_URL INFO memory | grep -E "(used_memory_human|maxmemory_human|mem_fragmentation)"

# Check if Redis is rejecting writes (OOM policy)
redis-cli -u $REDIS_URL CONFIG GET maxmemory-policy
# If "noeviction" and memory is full — this blocks all enqueues

# Check active connections
redis-cli -u $REDIS_URL INFO clients | grep connected_clients
```

### 5. Identify the failure pattern

Classify the failure by `failedReason`:

| Error pattern | Likely cause |
|--------------|--------------|
| `ECONNREFUSED` / `ETIMEDOUT` | External service (LND, Supabase, webhook endpoint) unreachable |
| `JWT expired` / `401 Unauthorized` | Service credentials expired in job payload |
| `unique constraint violated` | Duplicate job enqueued — idempotency issue |
| `Cannot read properties of undefined` | Malformed job payload or code bug |
| `Too Many Requests` / `429` | External rate limit hit; need backoff |
| `ENOMEM` / `OOM` | Worker process OOM-killed |

---

## Common Causes and Fixes

### Cause 1: Downstream service temporarily unavailable (most common)

Jobs that call LND, Supabase, or external webhook endpoints fail when those services are down.

**Fix:**
1. Resolve the downstream outage first (see relevant runbook: `lightning-node-unreachable.md` or `high-error-rate.md`).
2. Retry failed jobs after the service recovers:
   ```bash
   # Retry all failed jobs in a queue (BullMQ CLI or Board)
   redis-cli -u $REDIS_URL EVAL "
     local jobs = redis.call('ZRANGE', KEYS[1], 0, -1)
     for _, id in ipairs(jobs) do
       redis.call('HSET', 'bull:' .. ARGV[1] .. ':' .. id, 'attempts', 0)
       redis.call('ZADD', 'bull:' .. ARGV[1] .. ':wait', 0, id)
       redis.call('ZREM', KEYS[1], id)
     end
     return #jobs
   " 1 bull:<queue-name>:failed <queue-name>
   ```
   Or use BullMQ Board: navigate to the queue → Failed → Retry All.

### Cause 2: Worker process crashed / not running

**Fix:**
```bash
# Restart the API service (workers start automatically)
docker restart sovren-api

# Verify workers resumed processing
docker logs sovren-api --tail 50 | grep "worker started"
```

### Cause 3: Malformed job payload (code bug)

If `failedReason` contains a TypeError or property access error on `undefined`:

**Fix:**
1. Identify the commit that introduced the bug (`git log --oneline -10`).
2. Discard the malformed jobs (they cannot be retried successfully):
   ```bash
   redis-cli -u $REDIS_URL DEL bull:<queue-name>:failed
   ```
3. Hot-fix the code, deploy, verify with a test job.

### Cause 4: Redis memory exhausted

**Fix:**
1. Clear the dead-letter queues for non-critical job types (analytics, notifications):
   ```bash
   redis-cli -u $REDIS_URL DEL bull:analytics:failed
   redis-cli -u $REDIS_URL DEL bull:notifications:failed
   ```
2. Do NOT delete `bull:payments:failed` without manual review — each job represents a payment event.
3. Increase Redis memory limit or upgrade instance via infrastructure.

### Cause 5: Rate limiting by external service

**Fix:**
1. Check `attemptsMade` — if exhausted quickly, the retry delay is too short.
2. Update the queue configuration to use exponential backoff:
   ```typescript
   // In the worker/queue config
   defaultJobOptions: {
     attempts: 5,
     backoff: { type: 'exponential', delay: 2000 },
   }
   ```
3. Deploy and retry the failed jobs.

---

## Recovery Checklist

- [ ] Identified which queues are failing and the error pattern
- [ ] Confirmed downstream services are healthy
- [ ] Retried or discarded failed jobs as appropriate
- [ ] Verified workers are processing new jobs (DLQ depth is decreasing)
- [ ] Checked Redis memory is below 80% threshold
- [ ] For payment-related job failures: manually verified no revenue was lost (check Supabase `payments` table)
- [ ] Updated queue retry/backoff config if the failure was rate-limiting
- [ ] Filed a bug ticket if failure was caused by a code defect

---

## Escalation

| Condition | Escalate to |
|-----------|-------------|
| `bull:payments:failed` depth growing (revenue jobs) | Payments squad lead immediately |
| Redis OOM and cannot free enough memory | Infrastructure engineer |
| DLQ growing faster than it can be cleared | Backend squad lead + incident channel |
| Worker crash loop (restart count > 5) | Senior backend engineer |

**Incident channel:** `#incidents` in Slack
**Severity upgrade to P1:** if `bull:payments:failed` > 100 jobs or invoice polling is broken for > 10 minutes.
