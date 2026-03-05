---
status: complete
priority: p1
issue_id: 658
tags: [code-review, testing, p1]
dependencies: []
---

## Problem Statement

Test fixtures in `BoundaryService.test.ts` use Title Case day names ('Monday', 'Tuesday') but the `DayOfWeek` type requires lowercase ('monday', 'tuesday'). The type error is masked by `@ts-nocheck` at the top of the test file. This means the tests validate behavior with incorrect input shapes — if the service logic depends on exact casing (e.g., for comparisons, lookups, or DB queries), the tests provide false confidence.

## Findings

**Consensus**: 1/8 agents (architecture-strategist)

**File**: `packages/backend/src/services/wellness/__tests__/BoundaryService.test.ts`

1. **Title Case vs lowercase mismatch** — Test fixtures use `'Monday'`, `'Tuesday'`, etc. The `DayOfWeek` type is defined as a union of lowercase strings: `'monday' | 'tuesday' | 'wednesday' | ...`. TypeScript would catch this as a compile error, but `@ts-nocheck` suppresses all type checking in the file.

2. **False test confidence** — If `BoundaryService` performs case-sensitive comparisons on day names (e.g., `if (day === 'monday')`), the tests pass input that would fail in production. The tests may pass because the service is lenient or because the comparison path isn't exercised.

3. **@ts-nocheck masking real issues** — The broader issue is that `@ts-nocheck` in test files hides type errors. This specific casing mismatch is a symptom; there may be other type errors in the same file.

## Proposed Solutions

### Option A: Fix Fixture Values to Lowercase (Recommended)

Change all day name values in test fixtures from Title Case to lowercase to match the `DayOfWeek` type.

```typescript
// Before
const schedule = { monday: true, dayOfWeek: 'Monday' };

// After
const schedule = { monday: true, dayOfWeek: 'monday' };
```

- **Pros**: Minimal change. Tests now validate with correct input shapes. Can be done as search-and-replace.
- **Cons**: If the service actually handles Title Case (e.g., normalizes input), changing fixtures may cause tests to stop testing that code path. Verify service behavior first.
- **Effort**: Minimal (15-30 minutes)
- **Risk**: Very low — but verify the service doesn't depend on Title Case input.

### Option B: Fix Fixtures + Remove @ts-nocheck

Fix the day name casing AND remove `@ts-nocheck` from the test file. Fix any additional type errors that surface.

- **Pros**: Comprehensive fix. Restores full type safety to the test file. Catches other hidden type errors.
- **Cons**: May surface many type errors requiring additional fixes. Could expand scope significantly.
- **Effort**: Small to Medium (30 minutes to 2 hours depending on number of type errors)
- **Risk**: Low-Medium — type errors may reveal other fixture or mock issues.

### Option C: Add Case Normalization to Service

If the service should accept both 'Monday' and 'monday', add a `.toLowerCase()` normalization step in the service and keep the Title Case fixtures as valid test inputs.

- **Pros**: Makes the service more robust against input casing variations.
- **Cons**: Changes service behavior. May mask bugs where the caller sends wrong casing. The type system already enforces lowercase — normalization undermines that contract.
- **Effort**: Small (30 minutes)
- **Risk**: Low, but architecturally questionable

## Recommended Action

<!-- To be filled by tech lead -->

## Technical Details

- **DayOfWeek type location**: Check `packages/shared/types/` or `packages/backend/src/types/` for the DayOfWeek definition. Common patterns:
  ```typescript
  type DayOfWeek =
    | 'monday'
    | 'tuesday'
    | 'wednesday'
    | 'thursday'
    | 'friday'
    | 'saturday'
    | 'sunday';
  ```
- **@ts-nocheck history**: Many test files have `@ts-nocheck` from the Vitest migration (PR #86). This was a pragmatic decision to unblock CI, but it means type errors accumulate silently.
- **Search scope**: Grep for Title Case day names in other test files to check if this pattern exists elsewhere: `grep -rn "'Monday'\|'Tuesday'\|'Wednesday'" packages/backend/src/services/wellness/`
- **BoundaryService behavior**: Read `BoundaryService.ts` to understand how it uses the `dayOfWeek` field — does it compare directly, use as a Map key, or pass to a DB query?

## Acceptance Criteria

- [ ] All day name values in BoundaryService.test.ts fixtures match the `DayOfWeek` type (lowercase)
- [ ] Tests still pass after the fix (if they fail, the service has a casing bug too)
- [ ] Verify no other test files have the same Title Case day name issue
- [ ] Consider removing `@ts-nocheck` from the file if feasible (stretch goal)

## Work Log

<!-- Append entries as work progresses -->

## Resources

- [TypeScript @ts-nocheck](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-7.html#-ts-nocheck-in-typescript-files)
- common-solutions.md #42 (structuredClone prevents shared-state leaks in tests)
- MEMORY.md: "@ts-nocheck suppresses type checking" pattern from Vitest migration
