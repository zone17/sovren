---
status: pending
priority: p3
issue_id: 390
tags:
  - code-review
  - simplicity
  - testing
dependencies: []
---

# Test Factory Duplication Across Service Tests

## Problem Statement

The same test setup patterns (mock chain builders, test data factories) are duplicated across multiple test files instead of being shared helpers. This violates DRY, makes tests harder to maintain, and means fixes to test patterns must be applied in multiple places.

## Findings

**Source agents:** simplicity-agent, code-review-agent

**Evidence:**

- File: `packages/backend/src/services/**/__tests__/*.test.ts`
- Issue: Multiple test files contain identical or near-identical mock chain builders, test data factory functions, and setup patterns. When a mock pattern needs updating, every duplicated instance must be found and changed.

## Proposed Solutions

### Option A: Extract shared test factories

- **Approach:** Create a shared test utilities module at `packages/testing/src/factories/` (or `packages/backend/src/__tests__/factories/`) containing common mock builders, test data factories, and setup helpers. Import these in individual test files.
- **Effort:** Medium
- **Risk:** Low

### Option B: Shared test utils file per domain

- **Approach:** Create a `__tests__/helpers.ts` file within each service domain that contains the shared patterns for that domain. Less centralized but keeps test helpers closer to their usage.
- **Effort:** Small
- **Risk:** Low

## Recommended Action

_To be filled during triage_

## Technical Details

**Affected files:**

- `packages/backend/src/services/**/__tests__/*.test.ts`
- New: `packages/testing/src/factories/` or `packages/backend/src/__tests__/factories/`

## Acceptance Criteria

- [ ] Common test factories extracted into shared module
- [ ] Duplicated factory code in individual test files replaced with imports
- [ ] All existing tests pass after refactor
- [ ] New shared factories are documented with usage examples

## Work Log

| Date       | Action  | Notes                      |
| ---------- | ------- | -------------------------- |
| 2026-02-19 | Created | PR #86 code review finding |

## Resources

- PR: https://github.com/zone17/sovren/pull/86
