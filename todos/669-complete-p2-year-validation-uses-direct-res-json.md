---
status: complete
priority: p2
issue_id: 669
tags: [code-review, consistency, error-handling, business-tax]
dependencies: []
---

## Problem Statement

The year validation on the /export endpoint uses `res.status(400).json(createApiResponse(...))` instead of `throw new ValidationError()`. This is inconsistent with the rest of the file and the project's error handling conventions, bypassing centralized error middleware (logging, error formatting, monitoring).

## Findings

- **Reporter**: pattern-recognition (1 agent)
- **File**: `packages/backend/src/routes/v2/business-tax.routes.ts:215-221`
- Year validation on /export manually constructs the error response with `res.status(400).json()`
- Other validation errors in the same file and across the project use `throw new ValidationError()`
- Manual response bypasses the centralized error handling middleware
- Error format may differ from what the error middleware produces (inconsistent client experience)

## Proposed Solutions

1. **Replace with throw new ValidationError()**: Remove the `res.status(400).json(createApiResponse(...))` block and replace with `throw new ValidationError('Year must be between 2020 and {currentYear+1}')`. The error middleware handles status code and response formatting.

2. **Replace with throw + Zod validation**: Move the year range check into the Zod schema for the /export route so it is validated before the handler runs, consistent with other route parameter validation.

3. **Keep manual response but wrap in helper**: If there is a reason to bypass middleware (e.g., performance), at least use a shared error response helper to ensure consistent format. (Not recommended — the middleware approach is preferred.)

## Recommended Action

## Technical Details

- Current code (lines 215-221):
  ```typescript
  if (year < 2020 || year > new Date().getFullYear() + 1) {
    return res.status(400).json(createApiResponse(null, 'Invalid year'));
  }
  ```
- Should become:
  ```typescript
  if (year < 2020 || year > new Date().getFullYear() + 1) {
    throw new ValidationError('Year must be between 2020 and ' + (new Date().getFullYear() + 1));
  }
  ```
- This aligns with common-solutions.md #24 (error class selection matrix)
- Related to #662 which addresses the same validation being missing on /summary

## Acceptance Criteria

- [ ] Year validation on /export uses `throw new ValidationError()` instead of `res.status(400).json()`
- [ ] Error message is descriptive (includes valid range)
- [ ] Error middleware handles the ValidationError and returns proper response format
- [ ] Response format matches other validation errors in the API
- [ ] Existing tests pass; update test assertions if error format changes

## Work Log

## Resources

- `packages/backend/src/routes/v2/business-tax.routes.ts`
- Related: #662 (year validation missing on /summary)
- common-solutions.md #24 (error class selection matrix)
