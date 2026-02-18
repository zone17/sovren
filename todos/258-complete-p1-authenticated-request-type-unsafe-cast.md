# Todo 258: AuthenticatedRequest cast is type-unsafe at runtime (P1)

## Priority: P1 — Type Safety / Runtime Correctness

## Found in: review-agent-native (commit d928918)

## File: packages/backend/src/middleware/auth.ts, all v2 route files

## Problem

The `AuthenticatedRequest` interface declares `user: Express.AuthenticatedUser` (non-optional), but the route handlers cast `req` to `AuthenticatedRequest` purely via the function signature — Express has no knowledge of this type, and no runtime assertion occurs at the cast site.

The handlers rely on the `authenticate` middleware having run first to populate `req.user`. But:

1. **If middleware ordering changes or is accidentally removed**, `req.user` will be `undefined` at runtime but TypeScript will not flag it because the cast says it's guaranteed.
2. **The `getAuthUser()` helper was added** precisely for this purpose — it does a runtime check and throws `UnauthorizedError`. However, **it is never used**. Zero call sites reference `getAuthUser` in the entire codebase.

This is worse than the original `req.user!` pattern because:

- `req.user!` with `noUncheckedIndexedAccess` would at least force the developer to acknowledge the assertion
- The `AuthenticatedRequest` cast silently hides the assumption

## Impact

- If `authenticate` middleware is removed from a route (refactor accident), the error is a raw `TypeError: Cannot read properties of undefined (reading 'nostr_pubkey')` instead of a clean 401
- The safety net (`getAuthUser`) was built but not wired in
- ~40 route handlers across 6 files are affected

## Fix

Either:

1. **Use `getAuthUser(req)` in handlers** instead of `req.user.nostr_pubkey` — provides runtime safety without the interface cast
2. **Add a runtime assertion at the top of each AuthenticatedRequest handler** (e.g., assert `req.user` exists)
3. **Create middleware that narrows the type** — have `authenticate` return `AuthenticatedRequest` by assigning to `res.locals.user`

Option 1 is cheapest: replace `req.user.nostr_pubkey` with `getAuthUser(req).nostr_pubkey` in all handlers that currently use `AuthenticatedRequest`.

## Files to Change

- `packages/backend/src/routes/v2/shield.routes.ts` (~15 occurrences)
- `packages/backend/src/routes/v2/wellness.routes.ts` (~14 occurrences)
- `packages/backend/src/routes/v2/distribute.routes.ts` (~7 occurrences)
- `packages/backend/src/routes/v2/inbox.routes.ts` (~3 occurrences)
- `packages/backend/src/routes/v2/platforms.routes.ts` (~4 occurrences)
- `packages/backend/src/routes/v2/analytics-crossplatform.routes.ts` (~3 occurrences)
