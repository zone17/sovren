---
status: complete
priority: p3
issue_id: '408'
tags: [code-review, quality, frontend, pr-87]
dependencies: []
---

# useCollaboration hook uses console.error instead of error boundary / toast

## Problem Statement

The `useCollaboration.ts` hook uses `console.error()` for logging partial invite failures. While this is not security-sensitive (it's frontend code), it's inconsistent with the anti-pattern scanner which now detects `console.log` in source files (check 1b added in this PR).

## Findings

- `useCollaboration.ts:32`: `console.error(...)` for partial invite failures
- `useCollaboration.ts:47`: `console.error(...)` in onError callback
- `useCollaboration.ts:67`: `console.error(...)` in onError callback
- `useCollaboration.ts:83`: `console.error(...)` in onError callback
- The anti-pattern scanner check 1b added in this PR catches `console.(log|debug|info|warn|error)` in source files
- The scanner excludes test files and `logger.ts` / `env-validation.ts`, but does NOT exclude frontend hooks
- These console.error calls would be flagged by the scanner on commit

## Proposed Solutions

### Option 1: Leave as-is, add exclusion for frontend

**Approach:** The anti-pattern scanner targets `STAGED_TS_SRC` which includes both backend and frontend. Frontend legitimately uses console for dev-mode logging. Add an exclusion for `packages/frontend/` in check 1b.

**Pros:**

- Frontend doesn't have a logger service equivalent
- Quick fix to the scanner

**Cons:**

- Hides legitimate issues in frontend source

**Effort:** 10 minutes

**Risk:** Low

---

### Option 2: Replace with proper error reporting

**Approach:** Use a toast/notification system or error boundary for user-facing errors. Keep console.error only for dev debugging behind a `process.env.NODE_ENV === 'development'` check.

**Pros:**

- User gets feedback on partial failures
- Cleaner production behavior

**Cons:**

- Requires toast/notification infrastructure
- Larger scope

**Effort:** 1-2 hours

**Risk:** Low

## Recommended Action

Option 1 for now: exclude frontend from the console scanner check, since frontend has no logger service. Create a separate P3 to add user-facing error toasts.

## Technical Details

**Affected files:**

- `packages/frontend/src/features/creator-network/hooks/useCollaboration.ts:32,47,67,83`
- `scripts/check-antipatterns.sh` (check 1b)

## Acceptance Criteria

- [ ] Anti-pattern scanner does not false-positive on frontend console usage
- [ ] Or: frontend console.error calls replaced with proper error reporting

## Work Log

### 2026-02-20 - Code Review Discovery

**By:** Claude Code (PR #87 review)

## Resources

- **PR:** #87
