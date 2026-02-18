# Todo 230: UserController still uses req.user! assertions

**Priority**: P2
**Status**: pending
**Category**: Type Safety
**Found by**: Architecture review of P3 remediation commit d928918

## Problem

Todo 217 introduced `AuthenticatedRequest` and `getAuthUser()` to eliminate non-null assertions on `req.user`. The v2 routes were fully migrated, but `UserController.ts` still has 6 instances of `req.user!`:

- `packages/backend/src/controllers/user/UserController.ts:105`
- `packages/backend/src/controllers/user/UserController.ts:114`
- `packages/backend/src/controllers/user/UserController.ts:123`
- `packages/backend/src/controllers/user/UserController.ts:132`
- `packages/backend/src/controllers/user/UserController.ts:177`
- `packages/backend/src/controllers/user/UserController.ts:186`

## Fix

Either:

1. Use `getAuthUser(req)` in each handler (preferred for v1 controller pattern), or
2. Type the handler parameter as `AuthenticatedRequest` if the route is behind `authenticate` middleware

## Impact

Type safety gap: if `authenticate` middleware is ever removed from a route, `req.user!` will crash at runtime instead of failing at compile time.
