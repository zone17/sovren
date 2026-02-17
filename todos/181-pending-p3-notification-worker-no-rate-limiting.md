# 181 - P3 - Notification Worker Has No Rate Limiting

## Priority: P3 (Nice-to-have)

## Source
PR #83 — Review Agent: performance-oracle

## Description

The notification processor in `NotificationService.ts:746` sets `concurrency: 5`, processing 5 jobs simultaneously. Each job calls `this.send()` which can trigger email services, push notifications, websocket messages, etc.

During a queue drain scenario (e.g., after Redis/backend recovery from downtime), hundreds of queued notifications would be processed at 5 concurrent workers with no rate limiting. This could:
- Overwhelm downstream email providers (e.g., SendGrid rate limits)
- Trigger spam detection on push notification services
- Create a thundering herd on the websocket server

BullMQ supports built-in rate limiting via the `limiter` option on queues.

## Files

- `packages/backend/src/services/NotificationService.ts:746` (concurrency setting)

## Fix

Add rate limiting to the notification queue:

```typescript
qs.createQueue(NOTIFICATION_QUEUE, {
  defaultJobOptions: {
    // existing options
  },
  limiter: {
    max: 20,      // max 20 jobs
    duration: 1000, // per second
  },
});
```

## Impact
Performance — potential to overwhelm downstream services during queue drain.
