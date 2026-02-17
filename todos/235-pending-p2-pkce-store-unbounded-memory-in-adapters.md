# Todo 235: PKCE Store Unbounded Memory in Twitter/Bluesky Adapters

**Priority**: P2
**Category**: Security / Memory Safety
**Status**: pending
**Source**: Pattern recognition review of commit d928918

## Problem

`TwitterAdapter` and `BlueskyAdapter` both store PKCE `code_verifier` values in an unbounded `Map<string, string>` instance field (`this.pkceStore`). If `exchangeCodeForTokens` is never called after `getAuthorizationUrl` (user abandons OAuth flow), the entry is never deleted and memory grows unboundedly.

In a long-running server process with many users, this is a memory leak.

## Files

- `packages/backend/src/services/distribution/adapters/TwitterAdapter.ts:29`
- `packages/backend/src/services/distribution/adapters/BlueskyAdapter.ts:29`

## Recommended Fix

Option A: Use a TTL-based cache (LRU Map or the existing `ICacheService`) instead of a raw Map. OAuth flows that aren't completed within 10 minutes should be expired.

Option B: Use a bounded Map with a maximum size cap (e.g., 10,000 entries) and LRU eviction.

Option C: Store the PKCE verifier in the `state` parameter itself (encrypted), eliminating server-side storage entirely. This is the standard approach for stateless OAuth.

## Context

This is the same class of issue as Todo 063 (unbounded Maps) which was a P1. These Maps are scoped per-adapter instance so the blast radius is smaller, but the pattern is identical.
