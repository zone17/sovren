---
status: pending
priority: p2
issue_id: 378
tags:
  - code-review
  - simplicity
  - duplication
dependencies: []
---

# Duplicate Type Definitions Across Shared, Backend, and Frontend

## Problem Statement

Same type definitions exist in multiple locations: shared/types/, backend service files, and frontend types/. Changes in one location don't propagate to others, creating drift between packages and silent type mismatches at runtime.

## Findings

**Source agents:** simplicity-agent, duplication-agent, code-review-agent

**Evidence:**

- File: `packages/shared/src/types/finance.ts`
- Issue: Finance types defined here but also duplicated inline in backend services
- File: `packages/shared/src/types/community.ts`
- Issue: Community types duplicated across packages
- File: `packages/backend/src/services/finance/*.ts`
- Issue: Inline type definitions that shadow shared types
- File: `packages/frontend/src/features/*/types/`
- Issue: Frontend-local type copies that drift from shared definitions

## Proposed Solutions

### Option A: Consolidate all types into shared package

- **Approach:** Move all canonical type definitions to `packages/shared/src/types/`. Backend and frontend import from `@shared/types`. Remove inline type definitions from services and frontend feature directories.
- **Effort:** Large
- **Risk:** Medium — requires coordinated changes across all packages

## Recommended Action

_To be filled during triage_

## Technical Details

**Affected files:**

- `packages/shared/src/types/finance.ts`
- `packages/shared/src/types/community.ts`
- `packages/backend/src/services/finance/*.ts` (inline types)
- `packages/frontend/src/features/*/types/`

## Acceptance Criteria

- [ ] All shared types live in `packages/shared/src/types/` as single source of truth
- [ ] Backend services import from `@shared/types` instead of defining inline types
- [ ] Frontend features import from `@shared/types` instead of maintaining local copies
- [ ] No duplicate type definitions remain across packages
- [ ] All existing tests pass after consolidation

## Work Log

| Date       | Action  | Notes                      |
| ---------- | ------- | -------------------------- |
| 2026-02-19 | Created | PR #86 code review finding |

## Resources

- PR: https://github.com/zone17/sovren/pull/86
