# Todo 236: MastodonAdapter.refreshTokens Signature Mismatch with Interface

**Priority**: P2
**Category**: Type Safety
**Status**: pending
**Source**: Pattern recognition review of commit d928918

## Problem

`MastodonAdapter.refreshTokens` has the signature:

```typescript
async refreshTokens(
  _refreshToken: string,
  options?: { instance_url?: string }
): Promise<OAuthTokens>
```

But `IPlatformAdapter` defines:

```typescript
refreshTokens(refreshToken: string): Promise<OAuthTokens>;
```

And `BasePlatformAdapter` declares:

```typescript
abstract refreshTokens(refreshToken: string): Promise<OAuthTokens>;
```

The extra `options` parameter on `MastodonAdapter` is not in the interface contract. TypeScript allows this because extra params are optional, but:

1. Any caller using the `IPlatformAdapter` interface cannot pass the `instance_url` option
2. The `validateInstanceUrl` call on line 117 is unreachable via the interface
3. This breaks the Liskov Substitution Principle — the Mastodon adapter behaves differently from other adapters when called via the interface

## Files

- `packages/backend/src/services/distribution/adapters/MastodonAdapter.ts:112-121`
- `packages/backend/src/services/distribution/adapters/IPlatformAdapter.ts:30`

## Recommended Fix

Either:

1. Add `options?: { instance_url?: string }` to the `IPlatformAdapter` interface's `refreshTokens` method (and `BasePlatformAdapter`)
2. Or store the `instance_url` during `exchangeCodeForTokens` and reuse it in `refreshTokens` without requiring it as a parameter
