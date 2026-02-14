---
status: pending
priority: p2
issue_id: 079
tags: [code-review, reliability, infrastructure]
dependencies: []
---

# Redis Client Singleton No Shutdown/Retry Guard

## Problem Statement

The Redis client singleton in `packages/backend/src/lib/redis.ts` has no graceful shutdown handler, no retry cap on reconnection attempts, and a potential race condition where multiple callers could create duplicate clients during initialization.

## Findings

- **Data Integrity Finding 3**: Redis singleton issues — no shutdown, no retry cap, race condition.
- **Performance Oracle P2**: Redis connection sprawl across services.

## Proposed Solutions

### Option A: Add shutdown hook, retry cap, and init lock (Recommended)

Add `process.on('SIGTERM')` handler to close Redis. Cap reconnect attempts at ~10 with backoff. Use a promise-based init lock to prevent duplicate clients.
**Pros:** Production-grade Redis lifecycle
**Cons:** ~30 lines of additional code
**Effort:** Small | **Risk:** Low

## Acceptance Criteria

- [ ] Redis client closes on SIGTERM/SIGINT
- [ ] Reconnection has a max retry count with backoff
- [ ] Only one Redis client created even under concurrent init
