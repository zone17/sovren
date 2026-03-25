---
status: pending
priority: p1
issue_id: 767
tags: [code-review, performance, redis, blocking]
dependencies: []
---

# Redis KEYS Command in Production Hot Path

## Problem Statement

CacheService uses Redis `KEYS` command (O(N) blocking) in production hot paths. At scale, this blocks the entire Redis instance for all clients.

## Findings

- **Performance Agent**: P1-001 — CacheService.ts lines 72-73, 340, 515, 631, 654

## Proposed Solutions

Replace `KEYS` with `SCAN` (cursor-based, non-blocking) for pattern matching. Use Redis Sets for tag-based cache invalidation instead of KEYS pattern scan.

## Acceptance Criteria

- [ ] Zero `KEYS` commands in production code paths
- [ ] SCAN used for pattern operations
- [ ] Cache invalidation uses set-based tracking
