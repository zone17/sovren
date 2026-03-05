---
status: complete
priority: p2
issue_id: 671
tags: [code-review, dead-code, wellness]
dependencies: []
---

## Problem Statement

The private `activityColumn()` method in WellnessService (lines 468-479) is never called anywhere in the codebase. It is dead code that increases cognitive load, file size, and maintenance burden without providing any value.

## Findings

- **Reporter**: code-simplicity (1 agent)
- **File**: `packages/backend/src/services/wellness/WellnessService.ts:468-479`
- Private method `activityColumn()` exists but has no callers
- Being private, it cannot be called from outside the class
- No references found in the file or codebase
- ~12 lines of dead code

## Proposed Solutions

1. **Delete the method**: Remove lines 468-479 entirely. Since it is private and uncalled, there are no consumers to break.

2. **Comment out with TODO**: If the method was intended for future use, comment it out with a TODO explaining the planned use case. (Not recommended — YAGNI principle.)

3. **Move to a utility file with a note**: If the logic is reusable, extract to a utility function. (Not recommended unless the logic has known future consumers.)

## Recommended Action

## Technical Details

- Method is declared `private` at lines 468-479
- Grep verification needed before deletion to confirm zero references:
  - Search for `activityColumn` in the entire codebase
  - Search for `this.activityColumn` specifically
- This is a safe deletion — private methods cannot be accessed externally
- Follows common-solutions.md pattern for dead code removal with grep verification

## Acceptance Criteria

- [ ] `activityColumn()` method is deleted from WellnessService.ts
- [ ] Grep confirms zero references to the method in the codebase
- [ ] No tests reference or mock this method
- [ ] File compiles without errors after deletion

## Work Log

## Resources

- `packages/backend/src/services/wellness/WellnessService.ts`
