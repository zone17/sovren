---
status: complete
priority: p2
issue_id: '278'
tags: [code-review, performance, scalability]
dependencies: []
---

# Unbounded SELECTs Across 8+ Endpoints

## Problem Statement

Multiple service methods execute SELECT \* without LIMIT, returning all matching rows. As data grows, these become progressively slower and can cause OOM on large result sets.

## Findings

- `packages/backend/src/services/community/CreatorCircleService.ts` — getCircleMembers, getCircles
- `packages/backend/src/services/community/MentorshipService.ts` — getMentorships
- `packages/backend/src/services/community/CollaborativeContentService.ts` — getCollaborations
- `packages/backend/src/services/finance/RevenueTrackingService.ts` — getRevenueEntries
- `packages/backend/src/services/finance/TaxPreparationService.ts` — getExpenses, getDeductions

## Proposed Solutions

### Option 1: Add pagination to all list endpoints

**Approach:** Accept page/limit params (default limit 50, max 100). Use .range() for Supabase queries. Return total count in response.
**Effort:** 3-4h **Risk:** Low

## Acceptance Criteria

- [ ] All list endpoints accept page/limit parameters
- [ ] Default limit of 50 applied
- [ ] Maximum limit of 100 enforced
- [ ] Total count returned for pagination UI

## Work Log

### 2026-02-18 - Code Review Discovery

**By:** Claude Code (13-agent parallel review)
