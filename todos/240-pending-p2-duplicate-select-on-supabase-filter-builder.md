# Todo 240: Duplicate `select()` declaration on SupabaseFilterBuilder

**Priority**: P2
**Category**: TypeScript Quality
**Status**: pending
**Found by**: TypeScript review of P3 remediation (commit d928918)

## Problem

`SupabaseFilterBuilder<T>` in `packages/backend/src/interfaces/shared/ISupabaseClient.ts:59` declares a second `select(columns?: string): SupabaseFilterBuilder<T>` under a "Result access" comment. This duplicates the `select()` already on `SupabaseQueryBuilder<T>` (line 25).

In the real Supabase API, the filter builder does support a chained `.select()` (e.g., `.insert(...).select()`), but the current duplicate declaration:
1. Has a different signature than the query builder's `select` (missing the `options` parameter with `count`/`head`)
2. Creates confusion about which `select` is which
3. In TypeScript, the last overload wins for type inference, meaning the simpler signature shadows the richer one if both are on the same chain

## Fix

Either:
- Remove line 59 entirely (filter builder inherits chaining from returning `SupabaseFilterBuilder<T>`)
- Or make it match Supabase's actual `.select()` on filter builders, which returns a different builder type (`PostgrestTransformBuilder`)

## Files

- `packages/backend/src/interfaces/shared/ISupabaseClient.ts` (line 59)
