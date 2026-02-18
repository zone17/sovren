# Todo 245: ISupabaseClient hand-rolled types duplicate vendor types and will drift

**Priority**: P2
**Status**: pending
**Category**: Architecture / Type Safety
**Source**: Simplicity review of commit d928918

## Problem

The `ISupabaseClient` interface (`packages/backend/src/interfaces/shared/ISupabaseClient.ts`) was expanded from 2 lines to 55+ lines of hand-written `SupabaseQueryBuilder<T>` and `SupabaseFilterBuilder<T>` interfaces that attempt to replicate the Supabase PostgREST client API.

This creates several issues:

1. **Vendor type duplication**: `@supabase/supabase-js` already exports fully generic, battle-tested types. The hand-rolled version will drift as Supabase releases updates.
2. **Incomplete API surface**: Missing methods (`textSearch`, `overlaps`, `match`, `csv`, etc.) and a duplicate `select()` method on `SupabaseFilterBuilder` that conflicts with `SupabaseQueryBuilder.select()`.
3. **False safety**: `column: string` parameters remain stringly-typed -- no compile-time protection against nonexistent column names. The `any`-to-`Record<string, unknown>` swap provides minimal real value over a lint rule.
4. **Maintenance burden**: Every Supabase version bump requires manual synchronization of the hand-written types.

## Files

- `packages/backend/src/interfaces/shared/ISupabaseClient.ts` (55+ lines of hand-rolled types)

## Recommended Fix

Replace the hand-rolled types with references to Supabase's own exported types:

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';

// For DI/testability, pick only the methods we use
export type ISupabaseClient = Pick<SupabaseClient, 'from' | 'rpc'>;
```

If the Supabase types are too complex for test mocks, create a thin wrapper that delegates to the real types rather than duplicating them:

```typescript
export interface ISupabaseClient {
  from<T extends Record<string, unknown>>(table: string): PostgrestQueryBuilder<T>;
  rpc<T = unknown>(fn: string, params?: Record<string, unknown>): PostgrestFilterBuilder<T>;
}
```

where `PostgrestQueryBuilder` and `PostgrestFilterBuilder` are imported from `@supabase/postgrest-js`.

## Impact

- Low runtime risk (types are erased at compile time)
- Moderate maintenance risk (types will silently diverge from vendor)
- The duplicate `select()` method may cause TS compiler confusion in edge cases
