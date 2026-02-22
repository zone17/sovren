---
status: complete
priority: p2
issue_id: 459
tags: [code-review, typescript, quality]
dependencies: []
---

# P2: supabase-mock.ts uses `any` types in new code

## Problem Statement

The newly extracted `createMockChain()` utility in `packages/backend/src/test-utils/supabase-mock.ts` uses `any` for both its parameter (`terminalData: any`) and internal chain object (`const chain: any`). While test-utils are excluded from the anti-pattern scanner, this is new code that should follow the project's `any` → `unknown` migration standard.

## Findings

- `terminalData: any = []` on line 21 — could be `unknown`
- `const chain: any = {}` on line 22 — harder to type, but could use `Record<string, ReturnType<typeof vi.fn>>`
- Only 1 consumer currently (`CrossPostService.test.ts`)
- Scanner exclusion for `test-utils/` means this won't be caught automatically

Source: TypeScript quality reviewer, Architecture reviewer (PR #93)

## Proposed Solutions

### Option A: Type the chain with Record (Recommended)
```typescript
export function createMockChain(terminalData: unknown = []) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  // ...
}
```
- Pros: Type-safe, follows project standard
- Cons: Slightly more verbose
- Effort: Small
- Risk: Low

### Option B: Leave as-is (test code exception)
- Pros: No changes needed, scanner already excludes test-utils
- Cons: Sets bad precedent for new test utility code
- Effort: None
- Risk: None

## Recommended Action

Option A — type properly since this is new code.

## Technical Details

- **Affected files**: `packages/backend/src/test-utils/supabase-mock.ts`

## Acceptance Criteria

- [ ] `terminalData` parameter typed as `unknown`
- [ ] Internal chain object typed with `Record` or equivalent
- [ ] Tests still pass

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-21 | Created from PR #93 review | TypeScript reviewer flagged as blocker |

## Resources

- PR #93: https://github.com/zone17/sovren/pull/93
- common-solutions.md #7 (mock chain builder pattern)
