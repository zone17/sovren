---
status: pending
priority: p2
issue_id: 739
tags: [code-review, slice-8, validation, routes, pagination, follow-service]
dependencies: []
---

# #739 - parseInt Instead of Zod for Pagination Params

## Problem Statement

Follow routes use `parseInt(req.query.limit as string)` for query parameter parsing instead of a Zod schema. This approach has no upper bound, no integer check, and produces `NaN` for non-numeric input — all of which are then passed directly to the database query. A client sending `limit=abc` or `limit=999999` can cause unexpected behavior or DoS conditions.

## Findings

Single agent finding during Slice 8 Creator Network review.

- `routes/v2/follow.routes.ts` parses pagination query parameters using `parseInt(req.query.limit as string)`
- No maximum bound — a client can request `limit=999999` and cause a massive DB query
- `parseInt('abc')` returns `NaN` — if not checked, `NaN` propagates into the Supabase `.range()` call
- No default value — missing `limit` param results in `NaN` as well
- The project already has a standard Zod pagination pattern used elsewhere in the codebase

## Proposed Solutions

Replace manual `parseInt` parsing with a Zod schema:

```typescript
import { z } from 'zod';

const PaginationQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
});

// In route handler:
router.get('/followers', authenticate, async (req, res, next) => {
  const queryResult = PaginationQuerySchema.safeParse(req.query);
  if (!queryResult.success) {
    return next(new ValidationError('Invalid pagination parameters', queryResult.error));
  }
  const { limit, offset } = queryResult.data;
  // safe to use limit and offset
});
```

## Technical Details

- **File**: `routes/v2/follow.routes.ts`
- **Current code**: `parseInt(req.query.limit as string)` with no validation
- **Max limit**: `100` is the recommended cap (consistent with other paginated endpoints)
- **Default limit**: `20` (consistent with existing follow service defaults)
- **Zod `.coerce.number()`**: Handles string-to-number conversion safely, returns error for non-numeric

## Acceptance Criteria

- [ ] All pagination query params in `follow.routes.ts` parsed via Zod schema (not `parseInt`)
- [ ] Schema enforces: integer, positive, max 100, default 20 for limit; non-negative, default 0 for offset
- [ ] Invalid params return 400 `ValidationError` (not a runtime crash or DB error)
- [ ] `NaN` can no longer reach the database query
- [ ] Unit test added: verify 400 returned for non-numeric limit
- [ ] Unit test added: verify default limit applied when param is absent
- [ ] Unit test added: verify 400 returned for limit > 100
