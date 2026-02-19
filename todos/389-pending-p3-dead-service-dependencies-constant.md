---
status: pending
priority: p3
issue_id: 389
tags:
  - code-review
  - simplicity
  - dead-code
dependencies: []
---

# Dead SERVICE_DEPENDENCIES Constant

## Problem Statement

The SERVICE_DEPENDENCIES constant is unused legacy code from a prior architecture. It takes up space, confuses readers, and adds cognitive overhead when navigating the container configuration. Dead code should be removed to keep the codebase clean.

## Findings

**Source agents:** simplicity-agent, code-review-agent

**Evidence:**

- File: `packages/backend/src/container/types.ts`
- Issue: SERVICE_DEPENDENCIES constant exists but is not referenced anywhere in the codebase. It was likely part of a previous dependency injection architecture that has since been replaced.

## Proposed Solutions

### Option A: Delete the constant

- **Approach:** Remove the SERVICE_DEPENDENCIES constant after verifying with grep that nothing references it. Check for any comments or documentation that mention it and clean those up as well.
- **Effort:** Small
- **Risk:** Low

## Recommended Action

_To be filled during triage_

## Technical Details

**Affected files:**

- `packages/backend/src/container/types.ts` (or similar location)

## Acceptance Criteria

- [ ] SERVICE_DEPENDENCIES constant is removed
- [ ] Grep confirms no remaining references to SERVICE_DEPENDENCIES
- [ ] TypeScript compilation passes after removal
- [ ] No runtime errors in affected container module

## Work Log

| Date       | Action  | Notes                      |
| ---------- | ------- | -------------------------- |
| 2026-02-19 | Created | PR #86 code review finding |

## Resources

- PR: https://github.com/zone17/sovren/pull/86
