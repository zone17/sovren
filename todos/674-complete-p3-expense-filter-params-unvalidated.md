---
status: complete
priority: p3
issue_id: 674
tags: [code-review, slice-7, validation, routes, zod]
dependencies: []
---

## Problem Statement

Expense filter query parameters (`categoryId`, `startDate`, `endDate`) flow from the route layer into Supabase without format validation. While Supabase uses parameterized queries (no SQL injection risk), invalid date strings or malformed category IDs produce raw PostgREST error messages that leak implementation details to clients.

## Findings

- **File**: `packages/backend/src/routes/v2/business-tax.routes.ts:81-88`
- Query params `categoryId`, `startDate`, `endDate` are extracted from `req.query` and passed directly to the service layer
- No Zod schema validates the format of these parameters before they reach the database
- Invalid dates (e.g., `startDate=not-a-date`) result in raw PostgREST errors bubbling up to the client
- `categoryId` is not validated as a UUID format

## Proposed Solutions

1. Add a Zod schema for expense query params:
   ```typescript
   const expenseQuerySchema = z
     .object({
       categoryId: z.string().uuid().optional(),
       startDate: z.string().date().optional(), // YYYY-MM-DD
       endDate: z.string().date().optional(),
     })
     .refine((data) => !data.startDate || !data.endDate || data.startDate <= data.endDate, {
       message: 'startDate must be before endDate',
     });
   ```
2. Apply the schema via `validateQuery` middleware or inline `.parse()` at the route handler
3. Return a 400 with a structured validation error instead of letting PostgREST errors propagate

## Recommended Action

## Technical Details

- PostgREST parameterized queries prevent SQL injection, so this is a UX/DX issue rather than a security vulnerability
- The existing pattern in other routes uses Zod schemas with `validateBody` middleware; extend the same pattern to query params
- Consider adding a reusable `validateQuery` middleware if one does not already exist

## Acceptance Criteria

- [ ] Zod schema validates `categoryId` as optional UUID, `startDate`/`endDate` as optional ISO date strings
- [ ] Invalid query params return 400 with structured error response (not raw PostgREST errors)
- [ ] Date range validation ensures `startDate <= endDate` when both are provided
- [ ] Existing valid requests continue to work without changes
- [ ] Unit test covers invalid date format, invalid UUID, and reversed date range

## Work Log

## Resources

- `packages/backend/src/routes/v2/business-tax.routes.ts:81-88`
- Existing Zod validation patterns in `packages/backend/src/validators/`
- PostgREST error format documentation
