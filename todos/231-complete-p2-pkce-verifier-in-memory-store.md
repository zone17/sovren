# Todo 231: PKCE code verifiers stored in ephemeral in-memory Map

**Priority**: P2
**Status**: pending
**Category**: Security / Architecture
**Found by**: Architecture review of P3 remediation commit d928918

## Problem

`TwitterAdapter` (line 29) and `BlueskyAdapter` (line 29) both use `private readonly pkceStore = new Map<string, string>()` to store PKCE code_verifier values during OAuth flows. This has three problems:

1. **Multi-instance loss**: In a multi-instance deployment (Docker replicas, k8s pods), the instance handling the OAuth callback may differ from the one that generated the code_verifier. The PKCE exchange will fail.

2. **Memory leak**: The Map has no TTL or size bounds. If a user starts an OAuth flow but never completes the callback, the entry stays forever. Under load or repeated abandoned flows, memory grows unbounded.

3. **Restart loss**: Any server restart between auth URL generation and callback handling loses all pending PKCE verifiers, breaking in-flight OAuth flows.

## Files

- `packages/backend/src/services/distribution/adapters/TwitterAdapter.ts:29`
- `packages/backend/src/services/distribution/adapters/BlueskyAdapter.ts:29`

## Fix Options

1. **Session-based**: Store the code_verifier in the user's session (via express-session + Redis)
2. **Database-based**: Store in a `pending_oauth_flows` table with TTL
3. **Redis-based**: Store with a 10-minute TTL key `pkce:{state}`
4. **Encrypted state**: Encode the code_verifier into the `state` parameter (encrypted with a server-side key)

Option 4 is stateless and avoids infrastructure deps. Option 3 is simplest if Redis is already available.

## Impact

OAuth flows will silently fail in any multi-instance or restart scenario. Currently mitigated by single-instance development, but will break in production deployment.
