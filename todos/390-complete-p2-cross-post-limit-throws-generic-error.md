---
status: pending
priority: p2
issue_id: "407"
tags: [code-review, error-handling, pr-87]
dependencies: []
---

# CrossPostService limit check throws generic Error instead of ValidationError

## Problem Statement

The new cross-post limit check in `CrossPostService.publish()` throws a bare `new Error(...)` instead of the project's canonical `ValidationError` class. This bypasses the error-handler middleware's structured error response, resulting in a 500 Internal Server Error instead of a 400 with a proper error body.

## Findings

- `CrossPostService.ts:57-61`: `throw new Error(...)` when `request.platforms.length > MAX_CROSS_POST_TARGETS`
- The Zod validator in `distribution.ts` already has `.max(10)` on the `platforms` array, so this is a defense-in-depth check
- However, if the Zod validation is bypassed (e.g., direct service call from another service), the error would surface as an unhandled 500
- The `ValidationError` class from `../../utils/errors` is the canonical pattern used across all route files in this same PR
- This is inconsistent with the rest of the PR which standardizes on `ValidationError` for input validation failures

## Proposed Solutions

### Option 1: Change to ValidationError

**Approach:** Replace `throw new Error(...)` with `throw new ValidationError(...)`.

**Pros:**
- Consistent with the rest of the PR
- Returns 400 with structured error body
- 1-line change

**Cons:**
- None

**Effort:** 5 minutes

**Risk:** Low

## Recommended Action

Change to `throw new ValidationError(...)`. One-line fix.

## Technical Details

**Affected files:**
- `packages/backend/src/services/distribution/CrossPostService.ts:57-61`

**Fix:**
```typescript
import { ValidationError } from '../../utils/errors';
// ...
if (request.platforms.length > MAX_CROSS_POST_TARGETS) {
  throw new ValidationError(
    `Cannot cross-post to more than ${MAX_CROSS_POST_TARGETS} platforms at once (received ${request.platforms.length})`
  );
}
```

## Acceptance Criteria

- [ ] `CrossPostService.publish()` throws `ValidationError` for limit violations
- [ ] Error returns 400 with structured body, not 500

## Work Log

### 2026-02-20 - Code Review Discovery

**By:** Claude Code (PR #87 review)

**Actions:**
- Identified generic Error throw in CrossPostService
- Verified ValidationError is the canonical pattern

## Resources

- **PR:** #87
- **Pattern:** common-solutions.md #4 (createApiResponse error format)
