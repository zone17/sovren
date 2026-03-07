---
status: pending
priority: p2
issue_id: 736
tags: [code-review, slice-8, type-safety, validation, events, notifications]
dependencies: []
---

# #736 - Unsafe Double-Cast Event Payloads in NotificationPersistenceService

## Problem Statement

`NotificationPersistenceService.ts` has 7 event handler branches that cast `event.payload` through `Record<string, unknown>` and then immediately to a specific typed interface. No runtime validation occurs — any malformed event payload silently passes both casts, and the handler proceeds with `undefined` fields where typed values are expected.

## Findings

Single agent finding during Slice 8 Creator Network review.

Pattern observed in 7 handler branches:

```typescript
// UNSAFE — both casts are compile-time only, zero runtime protection
const payload = event.payload as Record<string, unknown>;
const followPayload = payload as FollowCreatedPayload;
// followPayload.followerId is now accessed but may be undefined
```

Impact:

- Malformed events (from bugs, schema drift, or external sources) silently corrupt notification records
- Runtime errors surface far from the source (when the undefined field is used) rather than at ingestion
- Difficult to debug because the failure appears in notification rendering, not event handling

## Proposed Solutions

Define Zod schemas for each of the 7 event payload types and validate at the handler boundary:

```typescript
import { z } from 'zod';

const FollowCreatedPayloadSchema = z.object({
  followerId: z.string().uuid(),
  followingId: z.string().uuid(),
});

const CirclePostCreatedPayloadSchema = z.object({
  circleId: z.string().uuid(),
  postId: z.string().uuid(),
  authorId: z.string().uuid(),
});

// ... schemas for all 7 event types

// In handler:
private handleFollowCreated(event: DomainEvent): void {
  const result = FollowCreatedPayloadSchema.safeParse(event.payload);
  if (!result.success) {
    this.logger.error('Invalid FollowCreated payload', {
      error: result.error,
      payload: event.payload,
    });
    return; // or throw, depending on desired behavior
  }
  const { followerId, followingId } = result.data;
  // safe to use followerId and followingId
}
```

## Technical Details

- **File**: `services/community/NotificationPersistenceService.ts`
- **Handler count**: 7 event handler branches
- **Event types to schema**: all domain events that the service subscribes to
- **Decision**: fail-fast (throw) vs. skip (log + return) on invalid payload — recommend log+return to avoid one bad event blocking all subsequent events in the queue
- **Zod is already a project dependency** — no new packages required

## Acceptance Criteria

- [ ] Zod schema defined for each of the 7 event payload types
- [ ] Each handler validates payload with `safeParse` before accessing fields
- [ ] Invalid payloads logged at error level with raw payload attached
- [ ] Service continues processing after a single invalid event (no throw from handler)
- [ ] All 7 schemas are co-located (same file or dedicated `event-schemas.ts`)
- [ ] Unit tests: verify each handler gracefully handles a malformed payload
- [ ] Unit tests: verify each handler processes valid payloads correctly
