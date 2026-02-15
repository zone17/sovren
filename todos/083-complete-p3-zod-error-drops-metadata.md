---
status: pending
priority: p3
issue_id: 083
tags: [code-review, error-handling]
dependencies: []
---

# ZodError Handler Drops Metadata

## Problem Statement

The `handleZodError` function in `error-handler-middleware.ts` constructs validation error details but doesn't include all Zod metadata (e.g., expected type, received value) that would help clients debug validation failures.

## Findings

- **Data Integrity Finding 6**: ZodError handler drops useful metadata from error response.

## Proposed Solutions

Include `expected` and `received` from Zod error issues in the validation error details.
**Effort:** Small | **Risk:** Low

## Acceptance Criteria

- [ ] Zod validation errors include field path, message, expected type
