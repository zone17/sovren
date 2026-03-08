---
status: pending
priority: p1
issue_id: 768
tags: [code-review, performance, database, pagination]
dependencies: []
---

# Unbounded DB Queries in Session Stats and Payment Stats

## Problem Statement

Multiple services perform unbounded SELECT queries without LIMIT, risking OOM and slow responses.

## Findings

- **Performance Agent**: P1-002 — DatabaseSessionManager.ts lines 418-474 (no LIMIT on getSessionStats)
- **Performance Agent**: P1-004 — PaymentProcessingService.ts lines 749-803 (Number.MAX_SAFE_INTEGER as limit)
- **Performance Agent**: P2 — 63 unbounded `SELECT *` across services

## Proposed Solutions

Apply paginated accumulation pattern (PAGE_SIZE=500) per critical-patterns.md #3.

## Acceptance Criteria

- [ ] All SELECT queries have explicit LIMIT
- [ ] Session stats and payment stats use pagination
- [ ] No Number.MAX_SAFE_INTEGER as limit value
