---
status: complete
priority: p2
issue_id: '496'
tags:
  - code-review
  - typescript
  - e2e-testing
  - type-safety
dependencies: []
---

# isValidEvent Uses `any` Instead of `unknown` in Type Guard

## Problem Statement

`isValidEvent` in `test-events.ts` accepts `any` instead of `unknown`:

```typescript
export function isValidEvent(event: any): event is NostrEvent {
```

This bypasses all type checking on the input. A caller could pass a primitive (`isValidEvent(42)`) and TypeScript would not complain. The function also lacks a `typeof event === 'object' && event !== null` guard, so property accesses would throw at runtime if `event` were `null` or a primitive.

## Findings

**Agent consensus: 1/4** (kieran-typescript-reviewer)

- `any` violates strict TypeScript standards
- Missing null/object guard means runtime crash possible
- Only type guard in the E2E fixtures that uses `any`

## Proposed Solutions

### Option A: Change to `unknown` with proper narrowing (Recommended)

```typescript
export function isValidEvent(event: unknown): event is NostrEvent {
  return (
    typeof event === 'object' &&
    event !== null &&
    typeof (event as Record<string, unknown>).id === 'string' &&
    typeof (event as Record<string, unknown>).pubkey === 'string' &&
    typeof (event as Record<string, unknown>).created_at === 'number' &&
    typeof (event as Record<string, unknown>).kind === 'number' &&
    Array.isArray((event as Record<string, unknown>).tags) &&
    typeof (event as Record<string, unknown>).content === 'string' &&
    typeof (event as Record<string, unknown>).sig === 'string'
  );
}
```

- Pros: Type-safe, catches invalid inputs at compile time
- Cons: Slightly more verbose
- Effort: Small
- Risk: Low

## Technical Details

**Affected files:**

- `packages/frontend/e2e/fixtures/test-events.ts` (line 317)

## Acceptance Criteria

- [ ] `isValidEvent` accepts `unknown` instead of `any`
- [ ] Null/object guard prevents runtime crash on primitive input
- [ ] All 20 tests still pass

## Work Log

| Date       | Action                                   | Outcome                                                |
| ---------- | ---------------------------------------- | ------------------------------------------------------ |
| 2026-02-24 | Identified by kieran-typescript-reviewer | P2 — type safety violation                             |
| 2026-02-24 | Fixed — changed to unknown               | Added object/null guard, Record<string, unknown> casts |
