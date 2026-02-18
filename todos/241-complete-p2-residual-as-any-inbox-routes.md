# Todo 241: Residual `as any` cast in inbox.routes.ts

**Priority**: P2
**Category**: TypeScript Quality
**Status**: pending
**Found by**: TypeScript review of P3 remediation (commit d928918)

## Problem

`packages/backend/src/routes/v2/inbox.routes.ts:48` still casts the constructed query object with `as any`:

```typescript
const result = await getInboxService().getMessages(req.user.nostr_pubkey, query as any);
```

This defeats the type safety improvements made across all other route files in this PR. The `query` object is built from parsed `req.query` strings and should be typed to match the service method's expected parameter type.

## Fix

1. Import or define the query parameter type expected by `IUnifiedInboxService.getMessages()`
2. Type the `query` variable explicitly instead of using `as any`
3. If the service method expects a specific interface, cast individual fields rather than the whole object

## Files

- `packages/backend/src/routes/v2/inbox.routes.ts` (line 48)
