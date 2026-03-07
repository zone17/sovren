---
status: pending
priority: p3
issue_id: "688"
tags: [code-review, backend, error-handling, slice-8]
dependencies: []
---

# FollowService + NotificationPersistenceService throw ValidationError for DB errors

## Problem Statement

Both services throw `ValidationError` (HTTP 400) for infrastructure/DB failures instead of `ServiceError` (HTTP 500). Some catch blocks also leak raw Supabase error messages to callers. Misleads monitoring (400 vs 500 bucket) and exposes schema details.

**Agent consensus: 3/8** (Pattern, TypeScript, Architecture)

## Fix

Replace `throw new ValidationError(...)` with `throw new ServiceError(...)` at all DB error catch sites:
- `FollowService.ts`: 8 locations (lines 58, 62, 102, 118, 140, 170, 201, 209)
- `NotificationPersistenceService.ts`: 7 locations (lines 271, 299, 326, 355, 388, 406, 437)

Log the raw error via `this.logger.error(...)` (already done). Do not include raw `error.message` in thrown message.

## Acceptance Criteria

- [ ] All DB error catch blocks throw ServiceError, not ValidationError
- [ ] Raw DB error messages not exposed in thrown error
- [ ] Import `ServiceError` added to both files
