---
status: pending
priority: p2
issue_id: 384
tags:
  - code-review
  - pattern
  - error-handling
dependencies: []
---

# Bare `throw error` Pattern Bypasses Express Error Handling

## Problem Statement

Some route handlers use `throw error` instead of `next(error)`, bypassing Express error handling middleware. In async route handlers without an asyncHandler wrapper, this causes unhandled promise rejections that can crash the process.

## Findings

**Source agents:** pattern-agent, error-handling-agent, code-review-agent

**Evidence:**

- File: `packages/backend/src/routes/v2/*.ts`
- Issue: Route handlers use `throw` instead of `next(error)`. Without an asyncHandler wrapper, thrown errors in async functions become unhandled promise rejections.

## Proposed Solutions

### Option A: Replace throw with next(error) or add asyncHandler wrapper

- **Approach:** Replace `throw` with `next(error)` in all route handlers, or ensure all routes use an `asyncHandler` wrapper that catches thrown errors and forwards them to `next()`.
- **Effort:** Medium
- **Risk:** Low

## Recommended Action

_To be filled during triage_

## Technical Details

**Affected files:**

- `packages/backend/src/routes/v2/*.ts`

## Acceptance Criteria

- [ ] No bare `throw error` statements remain in route handlers
- [ ] All route handlers either use `next(error)` or are wrapped with `asyncHandler`
- [ ] Express error handling middleware receives all errors properly
- [ ] No unhandled promise rejection warnings during error scenarios

## Work Log

| Date       | Action  | Notes                      |
| ---------- | ------- | -------------------------- |
| 2026-02-19 | Created | PR #86 code review finding |

## Resources

- PR: https://github.com/zone17/sovren/pull/86
