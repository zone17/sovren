---
status: pending
priority: p2
issue_id: '703'
tags: [code-review, backend, duplication, refactor, slice-8]
dependencies: []
---

# getUserIdByPubkey duplicated across 3 services

## Problem Statement

The `getUserIdByPubkey()` method (~30 LOC + TTLCache instance) is duplicated across at least 3 services: FollowService, NotificationPersistenceService, and one additional service. Each copy has its own TTLCache instance and identical lookup logic.

**Agent consensus: 7/9** (all except Security, Agent-Native)

## Fix

Extract `getUserIdByPubkey()` into a shared `UserIdResolver` utility or register it as a service in the DI container. The shared version should include the TTLCache for caching. Update FollowService.ts, NotificationPersistenceService.ts, and the third service to import from the shared location instead of maintaining their own copies.
