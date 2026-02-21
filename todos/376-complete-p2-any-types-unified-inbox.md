---
status: pending
priority: p2
issue_id: 376
tags:
  - code-review
  - typescript
  - type-safety
dependencies: []
---

# Explicit `any` Types in UnifiedInboxService and Route Handlers

## Problem Statement

UnifiedInboxService and some route handlers still use explicit `any` types, bypassing TypeScript's type safety. The pre-commit anti-pattern scanner should catch these but they persist, undermining the type system's ability to prevent runtime errors.

## Findings

**Source agents:** typescript-agent, type-safety-agent, code-review-agent

**Evidence:**

- File: `packages/backend/src/services/distribution/UnifiedInboxService.ts`
- Issue: Uses explicit `any` types for message payloads and service method parameters
- File: Various route handlers
- Issue: Handler functions typed with `any` for request body or query params

## Proposed Solutions

### Option A: Replace any with proper types

- **Approach:** Replace `any` with proper types. Use `unknown` + type narrowing for truly dynamic data, or specific interfaces for known shapes. Update the anti-pattern scanner to catch remaining instances.
- **Effort:** Medium
- **Risk:** Low

## Recommended Action

_To be filled during triage_

## Technical Details

**Affected files:**

- `packages/backend/src/services/distribution/UnifiedInboxService.ts`
- Various route handlers in `packages/backend/src/routes/v2/`

## Acceptance Criteria

- [ ] No explicit `any` types remain in UnifiedInboxService
- [ ] Route handlers use typed request/response generics instead of `any`
- [ ] Anti-pattern scanner catches any future `any` usage
- [ ] All existing tests pass with the stricter types

## Work Log

| Date       | Action  | Notes                      |
| ---------- | ------- | -------------------------- |
| 2026-02-19 | Created | PR #86 code review finding |

## Resources

- PR: https://github.com/zone17/sovren/pull/86
