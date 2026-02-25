---
status: pending
priority: p2
issue_id: 509
tags: [code-review, frontend, abstract-class, pre-existing]
dependencies: []
---

# P2: ContentTransformationService missing getCustomMetrics() implementation

## Problem Statement

`ContentTransformationService` extends `BaseService` but does not implement the abstract `getCustomMetrics()` method. This is a pre-existing issue that was masked because TypeScript doesn't enforce abstract method implementation at runtime — it only fails when `getCustomMetrics()` is actually called (e.g., via `getMetrics()`).

The `performCleanup()` gap was fixed in this PR (changed to default no-op), but `getCustomMetrics()` remains abstract and unimplemented.

## Findings

**File:** `packages/frontend/src/features/content/services/ContentTransformationService.ts`

BaseService declares:
```typescript
protected abstract getCustomMetrics(): Promise<Record<string, any>>;
```

ContentTransformationService does NOT implement it. Calling `serviceContainer.getMetrics()` on this service will throw at runtime.

## Proposed Solutions

### Option A: Add no-op implementation (Recommended)
- Add `protected async getCustomMetrics() { return {}; }` to ContentTransformationService
- Pros: Quick fix, consistent with performCleanup approach
- Cons: Returns empty metrics (may be misleading)
- Effort: Small
- Risk: Low

### Option B: Add meaningful metrics
- Implement actual transformation metrics (transforms count, cache stats, etc.)
- Pros: Useful operational data
- Cons: More effort, may not be needed yet
- Effort: Medium
- Risk: Low

## Recommended Action

Option A — prevents runtime crash.

## Technical Details

- **Affected files:** `packages/frontend/src/features/content/services/ContentTransformationService.ts`

## Acceptance Criteria

- [ ] `getCustomMetrics()` is implemented in ContentTransformationService
- [ ] `serviceContainer.getMetrics()` does not throw

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-25 | Identified during manual PR #98 review | Pre-existing — masked by TypeScript not enforcing at runtime |

## Resources

- PR #98: fix/backend-startup
