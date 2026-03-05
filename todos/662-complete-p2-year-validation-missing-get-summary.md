---
status: complete
priority: p2
issue_id: 662
tags: [code-review, validation, consistency, business-tax]
dependencies: []
---

## Problem Statement

The GET /summary endpoint on business-tax routes lacks the year parameter validation that is already present on the GET /export endpoint. This inconsistency allows callers to pass arbitrary year values (e.g., year=1900 or year=9999), which waste database query resources and produce meaningless results.

## Findings

- **Reporter**: security-sentinel (1 agent)
- **File**: `packages/backend/src/routes/v2/business-tax.routes.ts:48`
- GET /export validates year with a range check (2020 to currentYear+1) and throws ValidationError
- GET /summary accepts any integer year without validation
- Inconsistent validation across sibling endpoints in the same router file
- No boundary check means the DB will attempt queries for impossible years

## Proposed Solutions

1. **Copy validation logic from /export to /summary**: Extract the year range check (2020 to currentYear+1) and apply it identically to the /summary handler. Use `throw new ValidationError()` for consistency.

2. **Extract shared year validation middleware**: Create a `validateYearParam` middleware or utility function used by both /summary and /export, ensuring they stay in sync as the valid range evolves.

3. **Add year validation to the Zod schema**: If these routes use Zod request validation, add `.min(2020).max(new Date().getFullYear() + 1)` to the year field in the shared schema, so all consumers inherit the constraint.

## Recommended Action

## Technical Details

- The /export endpoint already validates: `if (year < 2020 || year > new Date().getFullYear() + 1)`
- The /summary endpoint at line 48 parses year from query params but does not validate the range
- Both endpoints query the same underlying tax data, so the valid year range should be identical
- Fix should use `throw new ValidationError()` not `res.status(400).json()` (see also #669)

## Acceptance Criteria

- [ ] GET /summary rejects year values outside the valid range (2020 to currentYear+1)
- [ ] Rejection uses `throw new ValidationError()` consistent with project error handling patterns
- [ ] GET /export and GET /summary share the same year validation logic (DRY)
- [ ] Existing tests pass; new test covers invalid year on /summary

## Work Log

## Resources

- `packages/backend/src/routes/v2/business-tax.routes.ts`
- Related: #669 (year validation uses wrong error pattern on /export)
