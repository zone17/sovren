---
status: pending
priority: p3
issue_id: '695'
tags: [code-review, backend, performance, security, slice-8]
dependencies: []
---

# createBatch() unbounded INSERT + TOCTOU on mentor capacity

## Problem Statement

Two backend concurrency/scale issues:

1. `NotificationPersistenceService.createBatch()` has no chunk limit — single INSERT with unbounded rows. Safe at current 20-member cap but fragile.
2. `MentorshipService.requestMentorship()` has TOCTOU: counts active mentorships before INSERT. Concurrent requests can both pass check, exceeding capacity.

**Agent consensus: 2/8 (Performance, Security) + 1/8 (Security)**

## Fix

### createBatch

Add CHUNK_SIZE=500, loop with sliced batches.

### Mentorship TOCTOU

Apply insert-then-verify pattern (critical-patterns.md #1a): INSERT first, count after, rollback if over capacity.

## Acceptance Criteria

- [ ] `createBatch()` processes in chunks of 500
- [ ] Mentor capacity enforced atomically
