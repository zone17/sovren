---
status: pending
priority: p2
issue_id: '129'
tags:
  - code-review
  - typescript
  - error-handling
dependencies:
  - '069'
---

# 129: ServiceError Called With Invalid Options — Compile Error Masked by tsc Blockage

## Problem Statement

In `ContentCreationService.ts` (lines 82-84): `throw new ServiceError('...', { errors: validation.errors })`. The `errors` key is NOT a valid `ServiceErrorOptions` property. This would be a TypeScript compile error, but `tsc --noEmit` is blocked by pre-existing TS errors (todo 069). The code runs because ServiceErrorOptions is loosely defined or the extra property is silently ignored at runtime.

## Findings

Invalid ServiceError usage masked by blocked type checking. This is a compile error that would be caught if `tsc --noEmit` was clean. Unblocking todo 069 will surface this issue.

## Proposed Solutions

1. **Option A**: Fix the ServiceError call to use valid options: `throw new ServiceError('...', { statusCode: 400, code: 'VALIDATION_ERROR', details: { errors: validation.errors } })`. Effort: Small, Risk: Low.
2. **Option B**: Extend ServiceErrorOptions to include an `errors` field. Effort: Small, Risk: Low.

## Acceptance Criteria

- [ ] ServiceError called with valid options
- [ ] No compile error when tsc is unblocked
- [ ] All ServiceError usage follows consistent pattern
- [ ] Type checking clean

## Work Log

| Date       | Action                                      | Learnings                                                                                 |
| ---------- | ------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 2026-02-14 | Identified in code review round 6 of PR #73 | Blocked type checking masks errors — fixing todo 069 is force multiplier for code quality |
