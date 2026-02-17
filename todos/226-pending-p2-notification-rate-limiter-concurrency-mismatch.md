# Todo 226 — P2: Rate limiter and concurrency mismatch in notification worker

## Priority: P2 (Performance / Correctness)
## Status: pending
## Found by: performance-review agent
## Commit: d928918

## Description

The notification worker registers with `concurrency: 5` and a BullMQ rate limiter of `max: 50, duration: 60000` (50 jobs/min).

However, the BullMQ Worker `limiter` option applies **per worker instance**. If the application is scaled to N replicas, the effective rate becomes `50 * N` jobs/minute, which defeats the purpose of rate-limiting notification thundering herds.

Additionally, with `concurrency: 5` and the default backoff of `exponential 2s`, a burst of 50 notifications landing at once will have 5 in-flight workers each calling `this.send()`, which itself loops through channels sequentially. If all 5 jobs hit the email provider concurrently, that is 5 concurrent SMTP connections — fine for now, but worth documenting the interaction.

## Specific concern: rate limiter is worker-local, not global

BullMQ's `limiter` option on the Worker is per-worker-instance. It uses Redis to track, so it **is** global across workers sharing the same Redis — but only when using the `group` key feature. Without group keys, each worker instance has its own rate limit counter.

**Update**: After reviewing BullMQ docs more carefully, the Worker `limiter` actually does use Redis-based global rate limiting across all workers on the same queue. This means the 50/min limit IS global. The configuration is adequate for a single-queue setup.

## Remaining concern

The rate limit of 50 notifications/minute means during bulk notification sends (e.g., a creator with 1000 subscribers), it would take 20 minutes to drain the queue. This may be intentional for "prevent thundering herd" purposes, but the `sendBulk()` method in NotificationService also has its own batching (`batchSize: 10`, `delayMs: 100`). If bulk sends go through the queue path, both rate limiters apply — the in-method batching is redundant with the BullMQ limiter.

## Impact

- Not a bug, but the interaction between `sendBulk()` batching and worker rate-limiting should be documented
- The 50/min limit is conservative; may need tuning for production load

## Recommendation

1. Add a comment in `NotificationService.initializeQueue()` documenting that the BullMQ limiter is Redis-global
2. Consider whether `sendBulk()` should bypass the queue and send directly (it currently calls `this.send()` which tries direct first, only queuing on full failure)
3. Make the rate limit configurable (already done via env vars — good)

## File
`packages/backend/src/services/NotificationService.ts:742-749`
