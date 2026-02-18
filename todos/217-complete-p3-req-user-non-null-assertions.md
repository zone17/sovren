---
status: pending
priority: p3
issue_id: "217"
tags: [code-review, pr-85, type-safety]
---

# req.user! Non-Null Assertions in Route Handlers

## Problem Statement
14 occurrences of req.user! non-null assertion across route handlers. If authenticate middleware fails silently, these crash at runtime.

## Findings
- File: `packages/backend/src/routes/v2/distribute.routes.ts` — multiple `req.user!` assertions
- File: `packages/backend/src/routes/v2/shield.routes.ts` — multiple `req.user!` assertions
- File: `packages/backend/src/routes/v2/platforms.routes.ts` — multiple `req.user!` assertions
- File: `packages/backend/src/routes/v2/wellness.routes.ts` — multiple `req.user!` assertions
- 14 total occurrences across these files
- If the authenticate middleware fails to set `req.user` (e.g., due to a bug or misconfiguration), the non-null assertion causes a runtime crash with an unhelpful error message instead of a clear 401 response

## Proposed Solutions
1. Create a type guard helper function (e.g., `assertAuthenticated(req)`) that throws a 401 AppError if `req.user` is null/undefined and narrows the type otherwise
2. Use a middleware wrapper that guarantees `req.user` is set and provides a typed request object to downstream handlers

## Acceptance Criteria
- [ ] All 14 `req.user!` non-null assertions are replaced with a type-safe guard that returns 401 if user is null
- [ ] The guard function narrows the TypeScript type so downstream code does not need assertions
- [ ] A test verifies that a missing user results in a 401 response, not a runtime crash
