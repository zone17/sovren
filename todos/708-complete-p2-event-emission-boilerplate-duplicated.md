---
status: pending
priority: p2
issue_id: '708'
tags: [code-review, backend, duplication, refactor, slice-8]
dependencies: []
---

# Event emission boilerplate duplicated

## Problem Statement

Each of CreatorCircleService.ts, MentorshipService.ts, FollowService.ts, and NotificationPersistenceService.ts has its own `emitEvent()` helper (~20 LOC) with an identical fire-and-forget pattern.

**Agent consensus: 3/9** (Simplicity, Pattern, TypeScript)

## Fix

Extract the `emitEvent()` helper to a base class or shared utility (e.g., `packages/backend/src/utils/event-emitter-helper.ts` or a `BaseService` class). Update all 4 services (CreatorCircleService.ts, MentorshipService.ts, FollowService.ts, NotificationPersistenceService.ts) to use the shared implementation.
