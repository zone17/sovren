---
status: pending
priority: p1
issue_id: '610'
tags: [code-review, frontend, react-query, content-shield]
dependencies: []
---

# P1: useSignProvenance Mutex Returns Undefined = Phantom Success

## Problem Statement

In `useSignProvenance.ts`, the `submitting` ref guard returns `undefined` from `mutationFn` when a second call arrives while the first is in flight. TanStack Query treats `undefined` as a successful result, fires `onSuccess`, and invalidates provenance queries. The caller (`usePublishWithProvenance`) proceeds as if signing succeeded.

## Findings

- **Races Agent 1 (F1)**: "useMutation will treat undefined as a successful result, call onSuccess, and proceed to invalidate the provenance queries"
- **Races Agent 2 (F2)**: "The mutex does not actually prevent a double-submit from the caller's perspective. It prevents the API call, yes, but then lies about it."
- **Kieran TS (P1-2)**: "The inferred return type becomes ApiResponse | undefined — consumers cannot trust it"
- **Simplicity (Bug)**: "Cache invalidation without actual state change"
- **Consensus**: 4/5 agents flagged this independently

## Evidence

```typescript
// useSignProvenance.ts:12-14
mutationFn: async (data: SignProvenanceBody) => {
  if (submitting.current) return;  // Returns undefined → phantom success
  submitting.current = true;
```

## Proposed Solutions

### Option A: Remove the mutex entirely (Recommended)

The outer hook (`usePublishWithProvenance`) already has its own `savingRef` guard. The inner mutex is redundant and buggy.

- Pros: Removes the bug, simplifies code, -8 LOC
- Cons: Standalone callers of useSignProvenance have no guard (use `isPending` in UI)
- Effort: Small
- Risk: Low

### Option B: Throw instead of returning

Replace `return;` with `throw new Error('Signing already in progress')` so TanStack enters error state.

- Pros: Honest state reporting
- Cons: Keeping redundant mutex adds complexity
- Effort: Small
- Risk: Low

## Recommended Action

Option A — remove the `submitting` ref from `useSignProvenance` entirely.

## Technical Details

**Affected files:**

- `packages/frontend/src/features/content-shield/hooks/useSignProvenance.ts`

## Acceptance Criteria

- [ ] `submitting` ref removed from `useSignProvenance`
- [ ] No `undefined` can be returned from `mutationFn`
- [ ] `onSuccess` only fires after a real API call

## Work Log

| Date       | Action                      | Learnings                              |
| ---------- | --------------------------- | -------------------------------------- |
| 2026-03-03 | Created from PR #132 review | 4/5 agent consensus — strongest signal |

## Resources

- PR #132: https://github.com/zone17/sovren/pull/132
