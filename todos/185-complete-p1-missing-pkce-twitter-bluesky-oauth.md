---
status: pending
priority: p1
issue_id: "185"
tags: [code-review, pr-85, security]
---

# Missing PKCE Implementation in Twitter and Bluesky OAuth Adapters

## Problem Statement
Twitter and Bluesky adapters declare `code_challenge_method: 'S256'` but never generate a `code_challenge` or `code_verifier`. This means the OAuth authorization request claims PKCE S256 but sends no challenge, and the token exchange sends no verifier. Depending on the provider's strictness, this either fails silently (auth broken) or the provider ignores the missing challenge (PKCE security bypassed, vulnerable to authorization code interception).

## Findings
- **File**: `packages/backend/src/services/distribution/adapters/BlueskyAdapter.ts`
  - Declares `code_challenge_method: 'S256'` in authorization URL parameters
  - No `code_challenge` parameter is generated or included
  - No `code_verifier` is stored in session/state for later use in token exchange
- **File**: `packages/backend/src/services/distribution/adapters/TwitterAdapter.ts`
  - Same pattern: declares S256 method but never generates challenge/verifier pair
  - Token exchange endpoint does not send `code_verifier` parameter

## Proposed Solutions

### Solution 1: Implement Full PKCE Flow (Recommended)
1. Generate a cryptographically random `code_verifier` (43-128 chars, unreserved URI characters)
2. Compute `code_challenge = BASE64URL(SHA256(code_verifier))`
3. Include `code_challenge` and `code_challenge_method` in the authorization URL
4. Store `code_verifier` in encrypted session state (keyed by OAuth state parameter)
5. Send `code_verifier` in the token exchange request

**Pros**: Standards-compliant (RFC 7636), protects against authorization code interception
**Cons**: Requires session/state storage for the verifier between auth request and callback

### Solution 2: Remove PKCE Declaration
Remove the `code_challenge_method: 'S256'` parameter entirely if the providers don't require it.

**Pros**: Simple fix, no broken claims
**Cons**: Loses PKCE security benefit, Twitter API v2 may require PKCE for public clients

## Acceptance Criteria
- [ ] Both BlueskyAdapter and TwitterAdapter generate a random code_verifier per OAuth flow
- [ ] code_challenge is computed as BASE64URL(SHA256(code_verifier)) and included in authorization URL
- [ ] code_verifier is securely stored between authorization request and token exchange callback
- [ ] code_verifier is sent in the token exchange request body
- [ ] End-to-end OAuth flow tested against both providers (or mocked provider responses)
- [ ] Unit tests verify PKCE parameter generation, hashing, and inclusion in requests
