---
status: pending
priority: p2
issue_id: 781
tags: [code-review, performance, n-plus-1, database]
dependencies: []
---

# O(n\*m) Content Recommendation with N+1 Queries

## Problem Statement

ContentRecommendationService.ts (lines 212-256, 459-498) performs O(n\*m) content similarity computation with N+1 queries — iterating over candidates and making individual DB calls per content item.

## Findings

- **Performance Agent**: P1-003

## Proposed Solutions

1. Batch content fetching with .in() filter
2. Use database-level similarity scoring (pg_trgm, or precomputed similarity table)
3. Limit candidate set before similarity computation

## Acceptance Criteria

- [ ] Recommendation queries are O(n) or O(n log n), not O(n\*m)
- [ ] No N+1 query pattern in content recommendations
- [ ] Response time <500ms for typical recommendation requests
