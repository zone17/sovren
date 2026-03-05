---
status: complete
priority: p1
issue_id: 657
tags: [code-review, data-integrity, p1]
dependencies: []
---

## Problem Statement

The `deleteExpense` and `deleteExpenseCategory` methods in TaxService do not verify whether the DELETE operation actually affected any rows. If the target ID does not exist or belongs to a different creator, the Supabase `.delete()` call silently succeeds as a no-op (0 rows deleted), and the route returns `{ deleted: true }` regardless. This masks authorization bypasses and missing resource errors.

## Findings

**Consensus**: 2/8 agents (pattern-recognition, security-sentinel)

**File**: `packages/backend/src/services/finance/TaxService.ts:459-468,474-483`

1. **deleteExpense silent no-op** — The method calls `.delete().eq('id', id).eq('creator_id', creatorId)` but does not check the returned count. If the ID doesn't exist, no error is thrown. If the ID belongs to another creator, the `creator_id` filter silently excludes it, and the route reports successful deletion.

2. **deleteExpenseCategory silent no-op** — Same issue. A DELETE for a non-existent or unauthorized category reports success.

3. **Security implication** — An attacker can probe for valid IDs by attempting deletion. Both existing and non-existing IDs return the same `{ deleted: true }` response, but the lack of a 404 for non-existent resources is inconsistent with REST conventions and masks potential authorization issues.

4. **Route layer returns success unconditionally** — The route handler in `business-tax.routes.ts` returns `{ deleted: true }` without checking whether the service actually deleted anything.

## Proposed Solutions

### Option A: Use `{ count: 'exact' }` and Check Count (Recommended)

Add the `count: 'exact'` option to the Supabase `.delete()` call and check the returned count. Throw NotFoundError if count === 0.

```typescript
async deleteExpense(creatorId: string, expenseId: string): Promise<void> {
  const { count, error } = await this.supabase
    .from('business_expenses')
    .delete({ count: 'exact' })
    .eq('id', expenseId)
    .eq('creator_id', creatorId);

  if (error) throw error;
  if (count === 0) {
    throw new NotFoundError('Expense not found');
  }
}

async deleteExpenseCategory(creatorId: string, categoryId: string): Promise<void> {
  const { count, error } = await this.supabase
    .from('expense_categories')
    .delete({ count: 'exact' })
    .eq('id', categoryId)
    .eq('creator_id', creatorId);

  if (error) throw error;
  if (count === 0) {
    throw new NotFoundError('Expense category not found');
  }
}
```

- **Pros**: Minimal change. Uses built-in Supabase count feature. Consistent error handling. NotFoundError -> 404 via global error handler.
- **Cons**: Adds one extra column to the Supabase response (count header). Negligible overhead.
- **Effort**: Minimal (30 minutes)
- **Risk**: Very low

### Option B: SELECT Before DELETE

Check if the resource exists and belongs to the creator with a SELECT, then DELETE.

```typescript
const { data } = await this.supabase
  .from('business_expenses')
  .select('id')
  .eq('id', expenseId)
  .eq('creator_id', creatorId)
  .single();

if (!data) throw new NotFoundError('Expense not found');

await this.supabase.from('business_expenses').delete().eq('id', expenseId);
```

- **Pros**: Can distinguish "not found" from "not authorized" if needed (separate queries).
- **Cons**: TOCTOU race condition — resource could be deleted between SELECT and DELETE. Two round-trips instead of one.
- **Effort**: Small (1 hour)
- **Risk**: Medium — introduces a TOCTOU race (the exact anti-pattern flagged in todo #655)

### Option C: Return Deleted Row and Check

Use `.delete().select().single()` to return the deleted row. If no row returned, throw NotFoundError.

```typescript
const { data, error } = await this.supabase
  .from('business_expenses')
  .delete()
  .eq('id', expenseId)
  .eq('creator_id', creatorId)
  .select()
  .single();

if (error?.code === 'PGRST116') {
  // No rows returned
  throw new NotFoundError('Expense not found');
}
if (error) throw error;
```

- **Pros**: Atomic — single round-trip. Returns deleted data if needed for audit.
- **Cons**: Returns full row data which is immediately discarded. `PGRST116` error code coupling.
- **Effort**: Small (30 minutes)
- **Risk**: Low

## Recommended Action

<!-- To be filled by tech lead -->

## Technical Details

- **Supabase `{ count: 'exact' }`**: Adds a `Content-Range` header to the response with the exact count of affected rows. This is the idiomatic Supabase way to check row counts.
- **NotFoundError -> 404**: Verify the global error handler maps NotFoundError to HTTP 404. This should already be the case based on the existing error class hierarchy.
- **Silent deletion is an anti-pattern**: REST APIs should return 404 for DELETE on non-existent resources (RFC 7231). The current behavior violates this convention.
- **Authorization vs. Not Found**: The `creator_id` filter means a missing row and an unauthorized row both result in count=0. This is actually desirable — it prevents ID enumeration attacks. The caller gets a generic 404 regardless of the reason.

## Acceptance Criteria

- [ ] `deleteExpense` throws NotFoundError when no rows are deleted
- [ ] `deleteExpenseCategory` throws NotFoundError when no rows are deleted
- [ ] Route handler returns 404 (not 200 with `{ deleted: true }`) for non-existent resources
- [ ] Route handler returns 404 for resources belonging to other creators (no ID enumeration)
- [ ] Tests added for: successful delete, non-existent ID, wrong creator ID
- [ ] Existing delete tests still pass

## Work Log

<!-- Append entries as work progresses -->

## Resources

- [Supabase delete with count](https://supabase.com/docs/reference/javascript/delete)
- [RFC 7231 - DELETE semantics](https://www.rfc-editor.org/rfc/rfc7231#section-4.3.5)
- common-solutions.md #8 (insert-then-verify pattern)
