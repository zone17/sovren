---
status: complete
priority: p2
issue_id: 670
tags: [code-review, dead-code, error-handling, wellness]
dependencies: []
---

## Problem Statement

`Promise.allSettled` is used in WellnessService, but the Supabase client never rejects promises — it returns `{ data, error }` on both success and failure. This means the "rejected" branches in the `allSettled` result handling are dead code that can never execute, adding complexity without value.

## Findings

- **Reporter**: code-simplicity (1 agent)
- **File**: `packages/backend/src/services/wellness/WellnessService.ts`
- `Promise.allSettled` is designed for mixed promise outcomes (some fulfill, some reject)
- Supabase's PostgREST client always resolves — errors are returned in the `error` field of the resolved value
- The rejection branches (`status === 'rejected'`) will never trigger
- Dead code obscures the actual error handling flow and misleads future developers

## Proposed Solutions

1. **Replace with Promise.all + per-result error checks**: Use `Promise.all()` since all promises always resolve. After awaiting, check `error` on each result individually. This is simpler and accurately reflects the Supabase client behavior.

2. **Replace with sequential calls**: If the operations have dependencies or ordering requirements, execute them sequentially with individual error checks. Clearer control flow, easier debugging.

3. **Keep Promise.allSettled but remove dead branches**: Strip the rejection handling code while keeping `allSettled`. This is a minimal change but still uses the wrong abstraction for the scenario.

## Recommended Action

## Technical Details

- Supabase client behavior: `await supabase.from('table').select()` always resolves to `{ data, error }`
- With `Promise.allSettled`, every result will have `status: 'fulfilled'`
- The fix depends on how many parallel queries are being made:
  - 2-3 queries: `Promise.all` is fine
  - 4+ queries with independent error handling: consider sequential for clarity
- Check each result's `.error` field after awaiting
- This aligns with common-solutions.md #13 (Promise.allSettled for batch operations) — but that pattern assumes promises that can actually reject

## Acceptance Criteria

- [ ] Dead rejection branches are removed
- [ ] Each Supabase result's `error` field is properly checked
- [ ] Error handling covers all failure modes (individual query errors)
- [ ] Parallel execution is preserved if queries are independent
- [ ] Existing tests pass; verify no test relied on the rejection path

## Work Log

## Resources

- `packages/backend/src/services/wellness/WellnessService.ts`
- Supabase PostgREST client documentation (always resolves, never rejects)
