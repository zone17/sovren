---
status: pending
priority: p2
issue_id: 076
tags: [code-review, patterns, duplication]
dependencies: [075]
---

# Three Competing Validation Middleware Files

## Problem Statement

Three validation middleware files exist with overlapping functionality:

1. `validation.ts` (legacy, minimal)
2. `validation-middleware.ts` (active, Zod-based)
3. `input-validation.ts` (unused, comprehensive but dead)

This creates confusion about which to use and fragments validation logic.

## Findings

- **Pattern Recognition P1-03**: Three competing validation middleware.
- **Code Simplicity P1-004**: Three validation files when one would suffice.

## Proposed Solutions

### Option A: Consolidate to validation-middleware.ts (Recommended)

Keep `validation-middleware.ts` as the single validation file. Delete `input-validation.ts` (dead, covered by 075). Merge any unique logic from `validation.ts` into `validation-middleware.ts`, then delete it.
**Pros:** Single source of truth for validation
**Cons:** Need to update any imports from validation.ts
**Effort:** Small | **Risk:** Low

## Acceptance Criteria

- [ ] Single validation middleware file
- [ ] All validation imports point to consolidated file
- [ ] No duplicate validation logic
