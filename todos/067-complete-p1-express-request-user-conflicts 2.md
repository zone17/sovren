---
status: pending
priority: p1
issue_id: 067
tags: [code-review, typescript, type-safety]
dependencies: []
---

# Express.Request.user 3 Conflicting Type Augmentations

## Problem Statement

Three files declare conflicting `Express.Request.user` types:

1. `packages/backend/src/types/express.d.ts`: `role?: string` (too wide)
2. `packages/backend/src/middleware/auth.ts`: `role?: 'creator' | 'supporter' | 'admin'` (narrow union)
3. `packages/backend/src/middleware/nostr-auth.ts`: separate `req.nostr` with `session?: any`

TypeScript declaration merging means all three merge, with `string` widening the narrow union. This defeats type-safe role checks and allows nonsensical role values to compile without error.

## Findings

- **TypeScript Quality P1-001**: Three conflicting augmentations merge unpredictably.
- **Pattern Recognition**: Auth middleware sends JSON directly instead of throwing AppErrors (separate but related issue).

## Proposed Solutions

### Option A: Single canonical type declaration (Recommended)

Keep one `express.d.ts` with the narrow `role?: 'creator' | 'supporter' | 'admin'` union. Remove the `declare global` blocks from `auth.ts` and `nostr-auth.ts`.
**Pros:** Single source of truth, type-safe role checks
**Cons:** Need to update imports in auth middleware
**Effort:** Small
**Risk:** Low

## Technical Details

- **Affected files:** `packages/backend/src/types/express.d.ts`, `packages/backend/src/middleware/auth.ts`, `packages/backend/src/middleware/nostr-auth.ts`
- **Components:** Type system, authentication
- **Runtime impact:** Type unsafety allowing invalid role values

## Acceptance Criteria

- [ ] Single `Express.Request.user` declaration with narrow role union
- [ ] `express.d.ts` is the sole augmentation file
- [ ] `auth.ts` and `nostr-auth.ts` no longer declare global augmentations
- [ ] `role?: string` replaced with `role?: 'creator' | 'supporter' | 'admin'`
- [ ] TypeScript compiles with no errors

## Work Log

| Date       | Action                          | Learnings                 |
| ---------- | ------------------------------- | ------------------------- |
| 2026-02-13 | Created from full PR #73 review | TypeScript Quality P1-001 |

## Resources

- PR #73 full review
- TypeScript Quality agent report
