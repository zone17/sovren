# 182 - P3 - Manual DLQ Is Redundant With Built-in removeOnFail Retention

## Priority: P3 (Nice-to-have)

## Source
PR #83 — Review Agent: code-simplicity-reviewer, data-integrity-guardian

## Description

`QueueService.ts:41` sets `removeOnFail: { count: 5000 }` as the default job option, which means BullMQ already retains up to 5000 failed jobs in the queue's failed set (viewable in Bull Board).

`NotificationService.ts:769-780` also manually copies failed job data to a separate `notifications-dlq` queue in the `onFailed` handler.

This creates two copies of failed job data:
1. BullMQ's built-in failed set (retained by `removeOnFail: { count: 5000 }`)
2. The manual `notifications-dlq` queue

The manual DLQ adds complexity and has a failure mode (see todo 178). If the built-in retention is sufficient, the manual DLQ can be removed. If the manual DLQ adds value (e.g., structured dead-letter data with error messages), document why both exist.

## Files

- `packages/backend/src/services/queue/QueueService.ts:41` (removeOnFail default)
- `packages/backend/src/services/NotificationService.ts:738-740,769-780` (manual DLQ)

## Fix

Choose one approach:
1. Remove manual DLQ, rely on BullMQ's built-in failed job retention + Bull Board for inspection
2. Keep manual DLQ but set `removeOnFail: true` (immediate removal from failed set) to avoid duplication

## Impact
Simplicity — redundant data persistence adds maintenance burden without clear benefit.
