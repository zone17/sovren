---
status: pending
priority: p2
issue_id: '121'
tags:
  - code-review
  - security
  - middleware
  - error-handling
dependencies: []
---

# 121: Auth Middleware authorize() Bypasses Centralized Error Handler

## Problem Statement

In `/packages/backend/src/middleware/auth.ts`, `authorize()` (lines 64-86), `requireNostrSignature()` (lines 140-196), and `requireOwnership()` write error responses directly via `res.status().json()` instead of calling `next(error)`. This means auth errors don't include `metadata.requestId`, `metadata.timestamp`, or the `code` field. Machine clients get inconsistent error shapes from auth failures vs validation/service failures.

## Findings

`authenticate()` correctly uses `next(error)`. But `authorize()` lines 73, 80, 85 use `res.status(401/403).json()`. `requireNostrSignature()` lines 147, 157, 178, 191 same. This bypasses the centralized error handler and creates inconsistent API responses.

## Proposed Solutions

1. **Option A**: Replace `res.status().json()` with `throw new UnauthorizedError()` / `throw new AuthorizationError()` + `next(error)`. Effort: Small, Risk: Low.
2. **Option B**: Create a shared `sendAuthError()` helper. Effort: Small, Risk: Low.

## Acceptance Criteria

- [ ] All auth middleware errors go through centralized error handler
- [ ] Error response shape consistent across all endpoints
- [ ] requestId and timestamp present in all auth error responses
- [ ] Tests verify error envelope consistency

## Work Log

| Date       | Action                                      | Learnings                                                                         |
| ---------- | ------------------------------------------- | --------------------------------------------------------------------------------- |
| 2026-02-14 | Identified in code review round 6 of PR #73 | Direct response writes bypass error handler and create inconsistent API contracts |
