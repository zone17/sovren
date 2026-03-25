---
status: pending
priority: p1
issue_id: '702'
tags: [code-review, backend, architecture, slice-8]
dependencies: []
---

# subscribeToEvents() temporal coupling in DI binding

## Problem Statement

In the DI container setup, `service.subscribeToEvents()` is called inside the singleton factory function for NotificationPersistenceService. This means event subscriptions are only created when the service is first resolved from the container. If nothing resolves NotificationPersistenceService at startup, notifications silently never work — no error, no warning, just missing functionality.

**Agent consensus: 1/9** (Architecture) — architectural P1

## Fix

In `packages/backend/src/container/bindings/community.bindings.ts`, remove the `subscribeToEvents()` call from the factory function. Instead, add an explicit initialization step in the application startup sequence (e.g., in `app.ts` or a startup hook) that resolves NotificationPersistenceService and calls `subscribeToEvents()`. This makes the temporal dependency explicit and guarantees subscriptions are active at boot time.
