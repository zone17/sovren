---
status: pending
priority: p2
issue_id: "158"
tags: [code-review, pr-82, phase-7, typescript, duplication, shared-types]
dependencies: []
---

# Frontend Type Duplication ~339 Lines Diverging from Shared Types

## Problem Statement
Frontend feature modules duplicate type definitions that already exist in `packages/shared/src/types/`. The wellness module has ~189 lines and content-shield has ~150 lines of duplicated types that will diverge from the shared package over time.

## Findings
- `packages/frontend/src/features/wellness/types/index.ts` — 189 lines of types already in `packages/shared/src/types/wellness.ts`
- `packages/frontend/src/features/content-shield/types/index.ts` — 150 lines of types already in `packages/shared/src/types/provenance.ts`
- Frontend types use slightly different naming in some places
- Barrel re-export in `packages/shared/src/types/index.ts` already exports these types
- Flagged by: code-simplicity-reviewer, kieran-typescript-reviewer, architecture-strategist

## Proposed Solutions
### Option 1: Import from Shared Package (Recommended)
**Approach:** Replace frontend type files with re-exports from `@sovren/shared/types`. Add any frontend-only types (e.g., UI state) as extensions.
**Pros:** Single source of truth, -339 lines, guaranteed consistency
**Cons:** Frontend depends on shared package types (already the case for other features)
**Effort:** 1 hour
**Risk:** Low

## Technical Details
- `packages/frontend/src/features/wellness/types/index.ts`
- `packages/frontend/src/features/content-shield/types/index.ts`
- `packages/shared/src/types/wellness.ts`
- `packages/shared/src/types/provenance.ts`

## Acceptance Criteria
- [ ] Frontend types import from @sovren/shared
- [ ] No duplicate type definitions
- [ ] Frontend-only types (UI state) properly extended
- [ ] All frontend components still compile

## Resources
- **PR:** #82
- **Agents:** code-simplicity-reviewer, kieran-typescript-reviewer, architecture-strategist

## Work Log
### 2026-02-14 - Discovery
**By:** Claude Code Review
Tags: typescript, duplication, shared-types
