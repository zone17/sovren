---
status: pending
priority: p2
issue_id: 325
tags: [code-review, typescript]
---

# Unsafe quarter type assertion in tax routes

## Problem Statement

The tax routes file uses `as 1 | 2 | 3 | 4` type assertion on the quarter parameter before validation. This assertion happens before the value is validated, meaning an invalid value (e.g., 5, 0, or a string) would be treated as a valid quarter type, bypassing TypeScript's safety guarantees.

## Findings

- `packages/backend/src/routes/v2/business-tax.routes.ts:46` — `as 1 | 2 | 3 | 4` assertion applied before validation
- The assertion should come after validation, using the validated result's type

## Proposed Solutions

1. Use Zod enum or literal union validation (e.g., `z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)])`)
2. Extract the typed value from the validated result instead of asserting before validation
3. Return a 400 error if the quarter value is not in the valid set

## Technical Details

- **Affected Files**: packages/backend/src/routes/v2/business-tax.routes.ts

## Acceptance Criteria

- [ ] Type assertion removed from pre-validation code
- [ ] Zod validation enforces quarter is 1, 2, 3, or 4
- [ ] Typed value extracted from validated result
- [ ] Invalid quarter values return 400 error
- [ ] TypeScript compiles without errors
