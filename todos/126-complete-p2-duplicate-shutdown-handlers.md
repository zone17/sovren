---
status: pending
priority: p2
issue_id: '126'
tags:
  - code-review
  - architecture
  - reliability
dependencies: []
---

# 126: Duplicate Shutdown Signal Handlers — server.ts and bootstrap.ts Both Register SIGTERM/SIGINT

## Problem Statement

Both `server.ts` `setupGracefulShutdown()` and `bootstrap.ts` `setupGracefulShutdown()` register handlers for SIGTERM and SIGINT. When a signal arrives, both handlers fire — potentially causing race conditions during shutdown (double-closing server, double-disconnecting DB).

## Findings

Duplicate signal handlers create shutdown race conditions. Both handlers execute on same signal, potentially closing resources twice or in wrong order.

## Proposed Solutions

1. **Option A**: Consolidate into one shutdown handler in server.ts (the main entry point). Remove from bootstrap. Effort: Small, Risk: Low.
2. **Option B**: Chain them via event bus — bootstrap registers cleanup, server orchestrates. Effort: Medium, Risk: Low.

## Acceptance Criteria

- [ ] Only one SIGTERM/SIGINT handler registered
- [ ] Graceful shutdown executes in correct order without races
- [ ] All resources cleaned up exactly once
- [ ] Shutdown sequence tested under load

## Work Log

| Date       | Action                                      | Learnings                                                                                  |
| ---------- | ------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 2026-02-14 | Identified in code review round 6 of PR #73 | Duplicate shutdown handlers indicate lack of clear ownership in bootstrapping architecture |
