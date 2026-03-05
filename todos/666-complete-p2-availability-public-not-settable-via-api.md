---
status: complete
priority: p2
issue_id: 666
tags: [code-review, api-gap, data-integrity, wellness, boundary]
dependencies: []
---

## Problem Statement

The `availability_public` column exists in the database with DEFAULT false, and `getBoundaries` returns it in the response, but `BoundaryUpdateInput` does not include it. There is no API path for a user to set `availability_public` to true. The column is effectively write-dead while being read-visible, which is confusing and suggests incomplete feature implementation.

## Findings

- **Reporters**: data-integrity-guardian, architecture-strategist, agent-native (3 agent consensus)
- **Files**:
  - `packages/backend/src/interfaces/wellness/IBoundaryService.ts`
  - `packages/backend/src/services/wellness/BoundaryService.ts`
- `availability_public` column has DEFAULT false in the database
- `getBoundaries` includes the field in its return data
- `BoundaryUpdateInput` interface/type does not include `availability_public`
- `updateBoundaries` method does not handle the field in its payload assignment
- No other endpoint or service sets this column

## Proposed Solutions

1. **Add to BoundaryUpdateInput and updateBoundaries**: Add `availability_public?: boolean` to the `BoundaryUpdateInput` type. In `updateBoundaries`, include it in the payload object that gets sent to Supabase. This completes the feature.

2. **Remove the column from getBoundaries response**: If the feature is not ready for users, stop returning `availability_public` in the API response to avoid frontend confusion. Add a todo for when the feature is ready.

3. **Add a dedicated toggle endpoint**: Create a separate `PATCH /boundaries/availability` endpoint specifically for toggling public availability, keeping it decoupled from the general boundary update. This allows independent authorization or rate limiting.

## Recommended Action

## Technical Details

- `BoundaryUpdateInput` needs: `availability_public?: boolean`
- In `updateBoundaries` method, the payload construction needs to include the field:
  ```typescript
  if (input.availability_public !== undefined) {
    payload.availability_public = input.availability_public;
  }
  ```
- The validator (if Zod-based) also needs `availability_public: z.boolean().optional()`
- Consider whether there are any authorization implications (e.g., should all creators be allowed to make availability public?)

## Acceptance Criteria

- [ ] `BoundaryUpdateInput` includes `availability_public` as an optional boolean field
- [ ] `updateBoundaries` persists the field to the database when provided
- [ ] Validator accepts boolean values for `availability_public`
- [ ] GET /boundaries continues to return the field
- [ ] PATCH /boundaries can set `availability_public` to true or false
- [ ] Existing tests pass; new test covers setting availability_public

## Work Log

## Resources

- `packages/backend/src/interfaces/wellness/IBoundaryService.ts`
- `packages/backend/src/services/wellness/BoundaryService.ts`
- Database migration defining the `availability_public` column
