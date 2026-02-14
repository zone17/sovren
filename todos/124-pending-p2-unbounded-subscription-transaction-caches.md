---
status: pending
priority: p2
issue_id: '124'
tags:
  - code-review
  - performance
  - memory
  - payment
dependencies: []
---

# 124: Unbounded In-Memory Caches — subscriptionCache and transactionCache Never Evict

## Problem Statement

`subscriptionCache` in `subscription-management-service.ts` (line 139) and `transactionCache` in `transaction-history-service.ts` (line 134) are plain Maps with no size limit and no TTL. Every subscription/transaction created is cached but never cleaned up. Memory grows linearly with total operations.

## Findings

Unbounded caches lead to memory exhaustion. Both caches grow without limit as subscriptions and transactions accumulate. Similar to issues 063 and 090 fixed in P1 sprint.

## Proposed Solutions

1. **Option A**: Replace with TTLCache (already available in utils/ttl-cache.ts). Effort: Small, Risk: Low.
2. **Option B**: Add periodic cleanup. Effort: Small, Risk: Low.

## Acceptance Criteria

- [ ] Both caches use TTLCache with bounded size
- [ ] Memory stable under sustained load
- [ ] Cache hit rate monitored
- [ ] Load tests verify no memory leak

## Work Log

| Date       | Action                                      | Learnings                                                                                |
| ---------- | ------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 2026-02-14 | Identified in code review round 6 of PR #73 | Unbounded caches are a recurring pattern — need architectural guidance on cache strategy |
