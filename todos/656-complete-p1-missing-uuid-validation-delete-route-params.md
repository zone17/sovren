---
status: complete
priority: p1
issue_id: 656
tags: [code-review, validation, p1]
dependencies: []
---

## Problem Statement

The DELETE /expenses/:id and DELETE /categories/:id routes in the business-tax routes pass `req.params.id` directly to the service layer without UUID format validation. Malformed input (e.g., SQL fragments, random strings, empty values) reaches the database query, potentially causing unexpected errors or information leakage through error messages.

## Findings

**Consensus**: 1/8 agents (pattern-recognition-specialist)

**File**: `packages/backend/src/routes/v2/business-tax.routes.ts:174,190`

1. **No UUID validation on DELETE /expenses/:id** — `req.params.id` is passed directly to `TaxService.deleteExpense(id)` without any format check. If the ID is not a valid UUID, the Supabase query fails with a PostgreSQL type error that may leak schema information in the error response.

2. **No UUID validation on DELETE /categories/:id** — Same issue on the category delete route.

3. **Inconsistency with other routes** — Other routes in the codebase (e.g., wellness routes, content routes) validate UUID params before passing to services. These two DELETE routes are outliers.

## Proposed Solutions

### Option A: Inline Zod Validation (Recommended)

Add `z.string().uuid()` safeParse on `req.params.id` at the top of each route handler. Throw ValidationError on failure.

```typescript
// In each DELETE handler:
const idResult = z.string().uuid().safeParse(req.params.id);
if (!idResult.success) {
  throw new ValidationError('Invalid ID format');
}
const id = idResult.data;
// ... pass id to service
```

- **Pros**: Consistent with existing validation patterns. Clear error message. Prevents malformed input from reaching DB.
- **Cons**: Slight code duplication across two routes (mitigated by being only 3 lines each).
- **Effort**: Minimal (15-30 minutes)
- **Risk**: Very low

### Option B: Shared Middleware for UUID Params

Create a reusable middleware `validateUuidParam('id')` that validates any `:id` route param.

```typescript
const validateUuidParam = (param: string) => (req, res, next) => {
  const result = z.string().uuid().safeParse(req.params[param]);
  if (!result.success) {
    return next(new ValidationError(`Invalid ${param} format`));
  }
  next();
};

router.delete('/expenses/:id', requireCreator, validateUuidParam('id'), async (req, res, next) => { ... });
router.delete('/categories/:id', requireCreator, validateUuidParam('id'), async (req, res, next) => { ... });
```

- **Pros**: Reusable across all routes. DRY. Single point of change.
- **Cons**: Adds another middleware layer. May be overkill if only 2 routes need it (though likely more will benefit).
- **Effort**: Small (30-60 minutes)
- **Risk**: Very low

### Option C: Service-Layer Validation

Move UUID validation into `TaxService.deleteExpense()` and `TaxService.deleteExpenseCategory()`.

- **Pros**: Defense in depth — service validates regardless of caller.
- **Cons**: Validation should happen at the boundary (route layer), not deep in the service. Mixes concerns.
- **Effort**: Small (30-60 minutes)
- **Risk**: Low, but architecturally suboptimal

## Recommended Action

<!-- To be filled by tech lead -->

## Technical Details

- **Zod's `z.string().uuid()`** validates UUID v4 format (8-4-4-4-12 hex pattern). This matches PostgreSQL's `uuid` type.
- **PostgreSQL type error on invalid UUID**: Supabase returns error code `22P02` (invalid_text_representation) when a non-UUID string is used in a UUID column filter. The error message includes the invalid value, which could leak to clients if not caught.
- **Existing patterns**: Check `packages/backend/src/routes/v2/wellness.routes.ts` and `packages/backend/src/routes/v2/content.routes.ts` for existing UUID validation patterns to follow.
- This is a recurring pattern — see todo #623 (complete) which fixed the same issue on other routes.

## Acceptance Criteria

- [ ] DELETE /expenses/:id validates `req.params.id` as UUID before calling service
- [ ] DELETE /categories/:id validates `req.params.id` as UUID before calling service
- [ ] Invalid UUID returns 400 ValidationError with clear message (no schema leakage)
- [ ] Valid UUIDs continue to work as before
- [ ] Tests added for invalid UUID input on both routes
- [ ] Consistent with UUID validation pattern used in other routes

## Work Log

<!-- Append entries as work progresses -->

## Resources

- todo #623 (complete) — same pattern fixed on other routes
- [Zod UUID validation](https://zod.dev/?id=strings)
- [PostgreSQL error code 22P02](https://www.postgresql.org/docs/current/errcodes-appendix.html)
