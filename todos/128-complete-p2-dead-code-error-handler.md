---
status: pending
priority: p2
issue_id: '128'
tags:
  - code-review
  - dead-code
  - error-handling
dependencies: []
---

# 128: Dead Code in Error Handler — handleUnhandledRejections + 4 Dead Error Classes

## Problem Statement

In `error-handler-middleware.ts`:

1. `handleUnhandledRejections()` (lines 306-324) is exported but never called anywhere.
2. `AuthenticationError`, `AuthorizationError`, `DatabaseError`, `ExternalServiceError` (lines 21-49) are defined but never imported outside this file — they duplicate error classes in `utils/errors.ts`.

## Findings

Dead code in critical error handling module. Function and classes defined but unused. Duplication of error classes creates confusion about which to use.

## Proposed Solutions

1. **Option A**: Delete `handleUnhandledRejections` and the 4 dead error classes. Effort: Small, Risk: Low.
2. **Option B**: Keep handleUnhandledRejections but wire it into server.ts startup. Effort: Small, Risk: Low.

## Acceptance Criteria

- [ ] No dead code in error-handler-middleware.ts
- [ ] Grep confirms no imports of deleted classes
- [ ] If keeping handleUnhandledRejections, wired into server startup
- [ ] Single source of truth for error class definitions

## Work Log

| Date       | Action                                      | Learnings                                                                                 |
| ---------- | ------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 2026-02-14 | Identified in code review round 6 of PR #73 | Dead code in error handling module suggests incomplete refactoring or feature abandonment |
