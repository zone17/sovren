---
status: pending
priority: p1
issue_id: '728'
tags: [code-review, slice-8, backend, events, di, community]
dependencies: []
---

# subscribeToEvents called twice (duplicate handlers)

## Problem Statement

`NotificationPersistenceService.subscribeToEvents()` is invoked in two separate places during application startup:

1. Inside the DI factory in `container/bindings/community.bindings.ts` (called during service resolution)
2. In `server.ts` via the eager-init pattern introduced as the fix for todo #702: `container.resolve(TYPES.NotificationPersistenceService)`

The result is that every domain event is processed twice — by two separate handler registrations — causing duplicate notifications, duplicate database writes, and potential data corruption for any event that `NotificationPersistenceService` handles.

**Agent consensus: duplicate handler registration**

## Findings

In `packages/backend/src/container/bindings/community.bindings.ts`:

```typescript
// WRONG — subscribeToEvents called in factory during DI resolution
container.bind(TYPES.NotificationPersistenceService).toDynamicValue(() => {
  const service = new NotificationPersistenceService(/* deps */);
  service.subscribeToEvents(); // <-- first registration
  return service;
});
```

In `packages/backend/src/server.ts` (the #702 fix):

```typescript
// This resolve() call triggers the factory above, registering handlers once
// Then it also directly calls subscribeToEvents() OR resolves triggers it again
container.resolve(TYPES.NotificationPersistenceService); // <-- second registration path
```

Every event processed by `NotificationPersistenceService` (e.g. `PostCreated`, `MentorshipAccepted`) will fire the handler twice, resulting in:

- Duplicate notification rows inserted into the database
- Duplicate external notifications sent (if any)
- Potential unique-constraint violations if notifications have unique keys

## Proposed Solutions

Remove `subscribeToEvents()` from the DI factory. The factory should only construct and return the service. The eager-init call in `server.ts` is the correct and only place for subscription:

```typescript
// community.bindings.ts — CORRECT: factory only constructs, does not subscribe
container.bind(TYPES.NotificationPersistenceService).toDynamicValue(() => {
  return new NotificationPersistenceService(/* deps */);
  // NO subscribeToEvents() here
});

// server.ts — CORRECT: single subscription point via eager init (the #702 fix)
const notificationService = container.resolve(TYPES.NotificationPersistenceService);
notificationService.subscribeToEvents(); // called exactly once
```

This follows the principle established by the #702 fix: eager init in `server.ts` is the canonical subscription point, not the DI factory.

## Technical Details

- Affected files: `packages/backend/src/container/bindings/community.bindings.ts`, `packages/backend/src/server.ts`
- The fix for #702 established that `server.ts` is responsible for triggering `subscribeToEvents()`
- DI factories must remain side-effect-free (construction only) — event subscriptions are a startup side effect and belong in the application bootstrap sequence
- Verify there are no other services with `subscribeToEvents()` calls inside DI factories (grep `bindings/` directory)
- After fixing, add a guard in `subscribeToEvents()` itself to warn if called more than once (idempotency guard):

```typescript
private subscribed = false;

subscribeToEvents(): void {
  if (this.subscribed) {
    this.logger.warn('subscribeToEvents called more than once — ignoring duplicate registration');
    return;
  }
  this.subscribed = true;
  // ... register handlers
}
```

## Acceptance Criteria

- [ ] `subscribeToEvents()` is NOT called inside any DI factory in `community.bindings.ts` (or any other `bindings/*.ts` file)
- [ ] `subscribeToEvents()` is called exactly once in `server.ts` after DI container resolution
- [ ] Idempotency guard added to `subscribeToEvents()` to prevent future duplicate registrations
- [ ] Unit test: publishing a domain event results in exactly one notification record (not two)
- [ ] Integration or manual test: server startup logs show a single subscription registration message
- [ ] Grep of `bindings/` directory confirms no other service factories call `subscribeToEvents()` or similar subscription methods
