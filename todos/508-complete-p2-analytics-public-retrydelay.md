---
status: pending
priority: p2
issue_id: 508
tags: [code-review, frontend, encapsulation]
dependencies: []
---

# P2: Public retryDelay property in analyticsService

## Problem Statement

`AnalyticsServiceImpl.retryDelay` is a public property (no access modifier) exposing internal retry logic. This was likely made public for test override convenience but leaks implementation details.

## Findings

**File:** `packages/frontend/src/features/analytics/services/analyticsService.ts:181`

```typescript
class AnalyticsServiceImpl {
  private wsManager = new AnalyticsWebSocketManager();
  private cache = new Map<string, { data: unknown; timestamp: number; ttl: number }>();
  retryDelay: (attempt: number) => number = (attempt) => Math.pow(2, attempt) * 1000; // public!
```

## Proposed Solutions

### Option A: Make private, use MSW for test control (Recommended)
- Change to `private retryDelay`
- Tests should use MSW handlers or dependency injection, not property mutation
- Pros: Proper encapsulation
- Cons: May need test updates
- Effort: Small
- Risk: Low

### Option B: Make protected
- Change to `protected retryDelay`
- Pros: Allows subclass override without full public exposure
- Cons: Still somewhat exposed
- Effort: Small
- Risk: Low

## Recommended Action

Option A.

## Technical Details

- **Affected files:** `packages/frontend/src/features/analytics/services/analyticsService.ts`

## Acceptance Criteria

- [ ] `retryDelay` is not publicly accessible
- [ ] Tests still pass without mutating the property

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-25 | Identified during manual PR #98 review | Test convenience shouldn't drive API design |

## Resources

- PR #98: fix/backend-startup
