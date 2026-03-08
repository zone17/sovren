---
status: pending
priority: p3
issue_id: 789
tags: [code-review, performance, memory-leak, eventbus]
dependencies: []
---

# EventBusService Timer Leak + Event Store Copy

## Problem Statement

EventBusService.executeHandler (lines 431-439) leaks timers. The in-memory event store uses slice() to copy arrays on every getEvents call (lines 546-558), causing O(n) memory allocation.

## Findings

- **Performance Agent**: P1-005, P1-006

## Proposed Solutions

Clear timers in dispose/cleanup. Replace slice() with pagination or cursor on the event store.

## Acceptance Criteria

- [ ] No timer leaks in EventBus
- [ ] Event store access doesn't copy entire array
