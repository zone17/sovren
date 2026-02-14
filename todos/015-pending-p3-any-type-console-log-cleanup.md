---
status: pending
priority: p3
issue_id: 015
tags: [code-review, quality]
dependencies: []
---

# Any Type and Console Log Cleanup

## Problem Statement

779 uses of `any` type and 624 console.log/error/warn calls across the codebase.

## Findings

Pattern-recognition identified 779 `any` type usages. Architecture-strategist found all DI tokens use ServiceToken<any> eliminating type safety. 624 console.log calls should use structured logging.

## Proposed Solutions

### Option A: Progressively type DI tokens and implement structured logging

**Effort:** Large
**Risk:** Low

Progressively type DI tokens with concrete types. Replace console.log with structured logger. Add eslint rules to prevent future any/console usage.

## Technical Details

**Affected Files:** packages/backend/src/container/types.ts (all tokens), various files with console.log

## Acceptance Criteria

- [ ] DI tokens typed with interface types
- [ ] No console.log in production code paths
- [ ] ESLint rules configured

## Work Log

- 2026-02-11: Created from /workflows:review multi-agent code review
