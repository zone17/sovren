---
status: pending
priority: p2
issue_id: 383
tags:
  - code-review
  - pattern
  - consistency
dependencies: []
---

# Inconsistent Middleware Ordering Across Routes

## Problem Statement

Route middleware ordering is inconsistent. Some routes apply `authenticate, validate, rateLimiter` while others use `authenticate, rateLimiter, validate`. Inconsistent ordering makes behavior unpredictable and can waste CPU validating requests that should have been rate-limited first.

## Findings

**Source agents:** pattern-agent, consistency-agent, code-review-agent

**Evidence:**

- File: `packages/backend/src/routes/v2/*.ts`
- Issue: Middleware order varies between routes — some validate before rate limiting, others rate limit before validating. No established convention.

## Proposed Solutions

### Option A: Standardize middleware order

- **Approach:** Standardize middleware order to: `authenticate` -> `rateLimiter` -> `validate` -> `handler`. Rate limiting before validation prevents wasting CPU on invalid requests that are already rate-limited.
- **Effort:** Medium
- **Risk:** Low

## Recommended Action

_To be filled during triage_

## Technical Details

**Affected files:**

- `packages/backend/src/routes/v2/*.ts`

## Acceptance Criteria

- [ ] All routes follow the standard middleware order: authenticate -> rateLimiter -> validate -> handler
- [ ] No routes have validate before rateLimiter
- [ ] A code comment or doc explains the middleware ordering convention
- [ ] All existing tests pass with the reordered middleware

## Work Log

| Date       | Action  | Notes                      |
| ---------- | ------- | -------------------------- |
| 2026-02-19 | Created | PR #86 code review finding |

## Resources

- PR: https://github.com/zone17/sovren/pull/86
