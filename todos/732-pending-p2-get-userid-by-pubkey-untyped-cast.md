---
status: pending
priority: p2
issue_id: 732
tags: [code-review, slice-8, type-safety, validation, supabase]
dependencies: []
---

# #732 - getUserIdByPubkey Untyped Cast

## Problem Statement

`getUserIdByPubkey.ts` uses `as { id: string }` to cast an untyped Supabase query result without any runtime validation. If the query returns an unexpected shape (null, missing field, wrong type), the cast silently passes and downstream code receives `undefined` where a string is expected, causing cryptic runtime errors rather than a clear validation failure.

## Findings

Single agent finding during Slice 8 Creator Network review.

- `utils/getUserIdByPubkey.ts` performs a Supabase SELECT and casts the result with `as { id: string }`
- TypeScript's `as` casts provide zero runtime protection — they are erased at compile time
- If Supabase returns `null`, `{}`, or `{ id: 123 }` (number), the cast silently succeeds
- Downstream callers receive a value they believe is a valid UUID string but may be `undefined` or wrong type
- This pattern is the root cause of subtle bugs where invalid IDs reach database queries

## Proposed Solutions

**Option A (preferred): Zod schema validation**

```typescript
import { z } from 'zod';

const UserIdSchema = z.object({ id: z.string().uuid() });

export async function getUserIdByPubkey(pubkey: string): Promise<string | null> {
  const { data, error } = await supabase.from('users').select('id').eq('pubkey', pubkey).single();

  if (error || !data) return null;

  const parsed = UserIdSchema.safeParse(data);
  if (!parsed.success) {
    logger.warn('getUserIdByPubkey: unexpected shape', { data, error: parsed.error });
    return null;
  }
  return parsed.data.id;
}
```

**Option B: Supabase typed select**

Use the generated Supabase types with a typed `.select('id')` call and avoid the cast entirely by relying on the generated DB types.

## Technical Details

- **File**: `utils/getUserIdByPubkey.ts`
- **Anti-pattern**: `as { id: string }` on unvalidated external data
- **Risk class**: Silent type confusion — `undefined` propagates as a "valid" string into downstream DB queries
- **Related todo**: #703 (getUserIdByPubkey duplicated logic) — fix both together if possible

## Acceptance Criteria

- [ ] `as { id: string }` cast removed from `getUserIdByPubkey.ts`
- [ ] Runtime validation added (Zod schema or equivalent)
- [ ] Function returns `null` (not throws) when data shape is invalid
- [ ] Invalid shape logged at warn level with the raw data for debugging
- [ ] Existing callers continue to compile and work correctly
- [ ] Unit test added: verify function returns null when Supabase returns malformed shape
