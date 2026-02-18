# 178 - P2 - DLQ Write Failure Causes Permanent Notification Loss

## Priority: P2 (Important)

## Source

PR #83 — Review Agent: data-integrity-guardian

## Description

In the `onFailed` handler of the notification processor (`NotificationService.ts:764-787`), when a job fails after all retries, the code:

1. Writes the failed job data to the `notifications-dlq` queue
2. Emits a `notification.permanentFailure` event

If step 1 fails (Redis down, DLQ queue not found, connection error), the error is caught by the outer `.catch()` in `QueueService.ts:108-112` and only logged. At this point:

- The job is already removed from the main `notifications` queue (BullMQ removes it after max retries)
- The DLQ write failed, so the job data is not in the DLQ either
- The notification is permanently lost with only a log line as evidence

The `onFailed` callback itself could throw, which the QueueService catches and logs but does not retry.

## Files

- `packages/backend/src/services/NotificationService.ts:769-780` (DLQ write in onFailed)
- `packages/backend/src/services/queue/QueueService.ts:106-112` (catch handler)

## Fix

1. **Use BullMQ's built-in `removeOnFail: false`** to keep failed jobs in the main queue's failed set (inspectable via Bull Board) instead of removing them and manually copying to DLQ
2. Or wrap the DLQ write in its own retry with a fallback to filesystem logging
3. Set `removeOnFail: { count: 5000 }` (already set as default in QueueService) — this keeps failed jobs in Redis. The manual DLQ copy is then supplementary, not the only copy.

**Note**: The default `removeOnFail: { count: 5000 }` in `QueueService.ts:41` means BullMQ already retains up to 5000 failed jobs. The manual DLQ is redundant if this default is relied upon. Clarify the intent.

## Impact

Data integrity — failed notifications can be permanently lost if DLQ write fails.
