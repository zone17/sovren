---
status: complete
priority: p2
issue_id: 672
tags: [code-review, type-safety, tech-debt, finance]
dependencies: []
---

## Problem Statement

`@ts-nocheck` at line 1 of TaxService.ts disables the TypeScript compiler for the entire file. New, well-typed code (e.g., `ExportExpenseRow`, `buildExpenseQuery`) added in Slice 7 is not verified by the compiler. Type annotations are cosmetic only — type errors, wrong property names, and incorrect function signatures are invisible.

## Findings

- **Reporter**: pattern-recognition (1 agent)
- **File**: `packages/backend/src/services/finance/TaxService.ts:1`
- `// @ts-nocheck` disables all TypeScript checking in the file
- New code with type annotations (ExportExpenseRow, buildExpenseQuery) appears type-safe but is not verified
- The file likely had @ts-nocheck added during a prior sprint (PR #111 CI/CD zero-failures added @ts-nocheck to 104 files)
- Removing @ts-nocheck may reveal pre-existing type errors unrelated to Slice 7

## Proposed Solutions

1. **Track as tech debt, address separately**: Document the @ts-nocheck as known debt. Create a follow-up task to remove it and fix all type errors in TaxService.ts. This prevents scope creep in the current slice.

2. **Remove @ts-nocheck and fix type errors now**: Remove the directive, run `tsc --noEmit` on the file, fix all errors. This ensures Slice 7 code is verified but may reveal many pre-existing issues that expand scope.

3. **Replace @ts-nocheck with targeted @ts-expect-error**: Remove the file-level suppression and add `@ts-expect-error` comments only on pre-existing problem lines. New code gets type checking while legacy issues remain suppressed with documentation.

## Recommended Action

## Technical Details

- `@ts-nocheck` was likely added in PR #111 (CI/CD zero-failures sprint) which added it to 104 files to get CI green
- The file contains new well-typed code from Slice 7:
  - `ExportExpenseRow` type/interface
  - `buildExpenseQuery` function
  - Year validation logic
  - Export pagination
- Removing @ts-nocheck requires running `npx tsc --noEmit -p packages/backend/tsconfig.json` and fixing all errors in the file
- Option 3 is a middle ground: per-package tsc (common-solutions.md #62) can verify this file once targeted suppressions replace the blanket one

## Acceptance Criteria

- [ ] Decision made: defer vs. fix now vs. targeted suppression
- [ ] If deferred: tech debt ticket created with clear scope
- [ ] If fixed: @ts-nocheck removed, all type errors resolved, `tsc --noEmit` passes for the file
- [ ] If targeted: @ts-nocheck replaced with specific @ts-expect-error comments on pre-existing issues only
- [ ] New Slice 7 code is type-checked by the compiler

## Work Log

## Resources

- `packages/backend/src/services/finance/TaxService.ts`
- common-solutions.md #62 (per-package tsc)
- PR #111 (CI/CD zero-failures — context for @ts-nocheck additions)
