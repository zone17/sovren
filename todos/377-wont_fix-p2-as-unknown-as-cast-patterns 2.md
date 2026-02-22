---
status: pending
priority: p2
issue_id: 377
tags:
  - code-review
  - typescript
  - type-safety
dependencies: []
---

# `as unknown as T` Double-Cast Pattern Bypasses Type Checking

## Problem Statement

Several locations use the `as unknown as T` double-cast pattern to force type compatibility. This bypasses compile-time checking entirely, hiding real type mismatches that could cause runtime errors.

## Findings

**Source agents:** typescript-agent, type-safety-agent, code-review-agent

**Evidence:**

- File: Various backend services
- Issue: Double-cast pattern used to bridge DB row types to interface types. Often related to snake_case DB columns vs camelCase TS interfaces (see also #367).

## Proposed Solutions

### Option A: Fix underlying type mismatches

- **Approach:** Fix the underlying type mismatch instead of casting. Common pattern: DB row types don't match interface types due to snake_case/camelCase mismatch. Create proper mapping functions or use a transformation layer.
- **Effort:** Medium
- **Risk:** Medium — may surface hidden type errors that need fixing

## Recommended Action

_To be filled during triage_

## Technical Details

**Affected files:**

- Various backend services in `packages/backend/src/services/`

## Acceptance Criteria

- [ ] No `as unknown as T` double-cast patterns remain in backend services
- [ ] Proper type mapping functions exist for DB row to interface conversions
- [ ] Anti-pattern scanner flags `as unknown as` usage
- [ ] All existing tests pass after removing casts

## Work Log

| Date       | Action  | Notes                      |
| ---------- | ------- | -------------------------- |
| 2026-02-19 | Created | PR #86 code review finding |

## Resources

- PR: https://github.com/zone17/sovren/pull/86
