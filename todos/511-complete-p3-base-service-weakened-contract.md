---
status: pending
priority: p3
issue_id: 511
tags: [code-review, frontend, abstract-class, design]
dependencies: []
---

# P3: BaseService performCleanup weakened contract

## Problem Statement

`BaseService.performCleanup()` was changed from `abstract` to a default no-op to fix a runtime crash in ContentTransformationService. This weakens the TypeScript enforcement — new subclasses won't get compile-time errors if they forget to implement cleanup.

## Findings

**File:** `packages/frontend/src/features/content/services/core/BaseService.ts:296`

4 of 5 existing subclasses implement `performCleanup()`. Only ContentTransformationService was missing it. The fix is pragmatic but reduces type safety for future subclasses.

## Proposed Solutions

### Option A: Accept as-is (Recommended)
- The fix is pragmatic and prevents crashes
- Future subclasses should implement cleanup if they hold resources
- Add a code comment noting the design decision
- Effort: None
- Risk: Low

### Option B: Restore abstract, fix ContentTransformationService
- Revert performCleanup to abstract
- Add empty implementation to ContentTransformationService
- Pros: Restores compile-time enforcement
- Cons: Needs both changes together
- Effort: Small
- Risk: Low

## Technical Details

- **Affected files:** `packages/frontend/src/features/content/services/core/BaseService.ts`

## Acceptance Criteria

- [ ] Design decision documented (comment or ADR)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-25 | Identified during manual PR #98 review | Trade-off: runtime safety vs compile-time enforcement |

## Resources

- PR #98: fix/backend-startup
