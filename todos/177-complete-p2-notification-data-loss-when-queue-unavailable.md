# 177 - P2 - Notification Data Loss When QueueService Unavailable

## Priority: P2 (Important)

## Source

PR #83 — Review Agent: data-integrity-guardian

## Description

When `queueService` is null/undefined (e.g., Redis not connected, DI resolution failed), the `addToQueue()` method silently drops notifications:

```typescript
// NotificationService.ts:689-691
if (!this.queueService) {
  this.logger.warn('QueueService not available, dropping notification retry');
  return;
}
```

The old in-memory queue kept notifications in memory for the process lifetime. The new implementation drops them entirely if the queue backend is unavailable. This means:

1. If Redis is down at startup, ALL failed notification retries are silently dropped
2. No fallback mechanism exists for queue unavailability
3. The log message says "dropping" which confirms data loss by design

Similarly, the `initializeQueue()` method (line 728-733) gracefully degrades to "direct send only" mode — but this means the `retryOnFailure` path in `send()` (line 213) will call `addToQueue()` which will drop the notification.

## Files

- `packages/backend/src/services/NotificationService.ts:689-691` (silent drop)
- `packages/backend/src/services/NotificationService.ts:728-733` (graceful degradation)
- `packages/backend/src/services/NotificationService.ts:213` (retry path)

## Fix

Options (in order of preference):

1. **Fall back to in-memory queue** when BullMQ is unavailable (keep the old array-based queue as degraded mode)
2. **Throw an error** instead of silently dropping, so callers know the retry failed
3. **Log at ERROR level** (not WARN) and emit a metric/event so monitoring can detect notification loss

## Impact

Data integrity — notifications silently lost when Redis/BullMQ unavailable.
