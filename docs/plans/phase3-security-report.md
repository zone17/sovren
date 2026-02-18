# Phase 3 Security Audit Report

**Auditor**: Security Audit Agent (Claude Opus 4.6)
**Branch**: `feature/phase1-epics`
**Date**: 2026-02-16
**Scope**: EPIC-007, EPIC-008, EPIC-009 implementations

## Overall Score: 82/100

The implementation demonstrates strong security fundamentals: AES-256-GCM encryption at rest, proper CSRF state parameters, RLS on all tables, Zod validation on all routes, rate limiting, and auth middleware. The score is reduced by 5 P2-level issues that should be addressed before production, plus several P3 improvements.

---

## Critical Findings (P1)

**None.** No vulnerabilities that block merge were found. The encryption implementation is correct, OAuth flow is sound, and no injection vectors were identified.

---

## Important Findings (P2)

### P2-001: Missing Input Validation on POST /provenance/sign

**File**: `packages/backend/src/routes/v2/shield.routes.ts:104-124`
**Severity**: P2 (Important)
**Category**: Input Validation

The `POST /provenance/sign` route handler does NOT apply Zod validation to the request body. It directly destructures `req.body` fields without any schema validation:

```typescript
router.post(
  '/provenance/sign',
  authenticate,
  requireCreator,
  mutationRateLimiter,
  // NO validate({ body: ... }) middleware here
  async (req: Request, res: Response, next: NextFunction) => {
    const data = await getProvenanceService().signContent({
      contentId: req.body.content_id,      // unvalidated
      creatorId: req.user!.nostr_pubkey,
      contentBody: req.body.content_body,  // unvalidated - no size limit
      nostrEventId: req.body.nostr_event_id, // unvalidated
      signature: req.body.signature,        // unvalidated
      relays: req.body.relays || [],        // unvalidated array
    });
```

**Risk**: An attacker could submit an extremely large `content_body` (gigabytes) to cause memory exhaustion, or inject unexpected types for `relays` (not guaranteed to be an array of strings). The `signature` field is stored directly without format validation.

**Recommendation**: Add a Zod schema:
```typescript
const SignContentSchema = z.object({
  content_id: z.string().uuid(),
  content_body: z.string().min(1).max(1_000_000), // 1MB text limit
  nostr_event_id: z.string().min(1).max(256),
  signature: z.string().min(1).max(512),
  relays: z.array(z.string().url()).max(20).default([]),
});
```

---

### P2-002: Refresh Token IV/AuthTag Shared with Access Token

**File**: `packages/backend/src/services/distribution/PlatformConnectionService.ts:305-343`
**Severity**: P2 (Important)
**Category**: Cryptographic Implementation

In `storeEncryptedTokens()`, the access token and refresh token are encrypted with separate calls to `encryptToken()` (each generating a unique IV), which is correct. However, only the access token's `iv` and `authTag` are stored in the database row:

```typescript
const row: any = {
  access_token_encrypted: accessEncrypted.encrypted,
  token_iv: accessEncrypted.iv,          // access token IV
  token_auth_tag: accessEncrypted.authTag, // access token auth tag
  refresh_token_encrypted: refreshEncrypted?.encrypted || null,
  // refresh token IV and auth tag are LOST
};
```

In `refreshExpiringTokens()` (line 270-275), the refresh token is decrypted using the **access token's IV and auth tag**, which is cryptographically incorrect. AES-256-GCM will fail to decrypt (auth tag mismatch) or produce garbage output.

**Risk**: Token refresh will always fail in production, leaving users with expired connections that cannot be auto-renewed. While this is more of a functionality bug than a direct exploit, it means tokens will accumulate as expired, and the refresh mechanism is effectively broken.

**Recommendation**: Add separate columns `refresh_token_iv` and `refresh_token_auth_tag` to the `platform_connections` table, and store/retrieve them independently:
```sql
ALTER TABLE platform_connections ADD COLUMN refresh_token_iv BYTEA;
ALTER TABLE platform_connections ADD COLUMN refresh_token_auth_tag BYTEA;
```

---

### P2-003: OAuth State Store Unbounded In-Memory Map (DoS Vector)

**File**: `packages/backend/src/services/distribution/PlatformConnectionService.ts:24`
**Severity**: P2 (Important)
**Category**: Denial of Service

The OAuth CSRF state store is an unbounded in-memory `Map`:

```typescript
const oauthStateStore = new Map<string, { creatorId: string; platform: SupportedPlatform; expiresAt: number }>();
```

While expired entries are cleaned every 5 minutes, an attacker who is authenticated can call `POST /connect/:platform` repeatedly at 10 req/min (rate limit) to create 50 state entries per 5-minute cleanup cycle. With multiple authenticated accounts or a botnet, this could accumulate millions of entries, exhausting Node.js heap memory.

**Risk**: Memory exhaustion leading to process crash (OOM kill).

**Recommendation**:
1. Add a max size check (e.g., 10,000 entries) and reject new connections when full.
2. Better: Replace with Redis-backed store (already noted as TODO in the code comment on line 23).
3. The comment says "In production, use Redis-backed session store" — this should be tracked as a pre-production requirement.

---

### P2-004: OAuth Callback Endpoint Unauthenticated — Open Redirect Risk

**File**: `packages/backend/src/routes/v2/platforms.routes.ts:60-81`
**Severity**: P2 (Important)
**Category**: Open Redirect / CSRF

The `GET /callback/:platform` endpoint has no `authenticate` middleware (correctly, since it's an OAuth redirect from the external provider). However, on both success and failure, it performs a redirect using `process.env.FRONTEND_URL`:

```typescript
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
res.redirect(`${frontendUrl}/settings/platforms?connected=${platform}`);
```

The `platform` parameter is Zod-validated as an enum (good), so XSS via the redirect URL is not possible. However, if `FRONTEND_URL` is misconfigured or absent in production, it defaults to `http://localhost:3000` which would break the OAuth flow silently.

More importantly: while the state parameter provides CSRF protection, if a valid state token is somehow leaked (e.g., through browser history, referer headers), an attacker could complete the OAuth flow and bind their external platform account to the victim's Sovren account. The callback should verify the session/IP of the user who initiated the flow.

**Recommendation**:
1. Store the originating session identifier in the state store and verify it during callback.
2. Ensure `FRONTEND_URL` is required (not optional with localhost default) in production.

---

### P2-005: PKCE Not Implemented for Twitter/Bluesky OAuth

**File**: `packages/backend/src/services/distribution/adapters/TwitterAdapter.ts:37-44`, `BlueskyAdapter.ts:36-45`
**Severity**: P2 (Important)
**Category**: OAuth Security

Both the Twitter and Bluesky adapters include `code_challenge_method: 'S256'` in the authorization URL, which tells the provider to expect PKCE (Proof Key for Code Exchange). However, no `code_verifier` is generated, stored, or sent during the token exchange step:

```typescript
// TwitterAdapter.getAuthorizationUrl
code_challenge_method: 'S256',
// BUT no code_challenge parameter is set

// TwitterAdapter.exchangeCodeForTokens
body: new URLSearchParams({
  grant_type: 'authorization_code',
  code,
  redirect_uri: this.config.callbackUrl,
  // NO code_verifier parameter
}).toString(),
```

**Risk**: If the provider strictly enforces PKCE (Twitter does), the token exchange will fail. If the provider is lenient, PKCE protection is missing, leaving the OAuth flow vulnerable to authorization code interception attacks.

**Recommendation**:
1. Generate a `code_verifier` (random 43-128 char string) and compute `code_challenge = BASE64URL(SHA256(code_verifier))`.
2. Store the `code_verifier` alongside the state token in the state store.
3. Send `code_verifier` in the token exchange request.

---

## Informational (P3)

### P3-001: ContentIdParam in Shield Validators Not UUID-Validated

**File**: `packages/backend/src/validators/shield.ts:13-15`

```typescript
export const ContentIdParamSchema = z.object({
  contentId: z.string().min(1), // Not z.string().uuid()
});
```

The distribution validators correctly use `z.string().uuid()` for content IDs, but the shield validators only require `min(1)`. This allows arbitrary string content IDs to reach the database query layer. While Supabase would reject invalid UUIDs, it's better to fail fast at validation.

---

### P3-002: `nip05_verified` Hardcoded to `true`

**File**: `packages/backend/src/services/provenance/ProvenanceService.ts:46, 132`

```typescript
nip05_verified: true, // Would check NIP-05 verification in production
```

This is documented as a placeholder, but it means the provenance certificate currently claims NIP-05 verification even when it hasn't been performed. This is a trust/integrity issue rather than a security vulnerability.

---

### P3-003: Mastodon Instance URL Not Persisted or Validated

**File**: `packages/backend/src/services/distribution/adapters/MastodonAdapter.ts:37, 52`

The `instance_url` is passed as an option to `getAuthorizationUrl` and `exchangeCodeForTokens`, but it defaults to `https://mastodon.social` and is not persisted in the database. When the token needs to be refreshed or revoked, the original instance URL is lost.

Additionally, the `instance_url` from user input is used directly in a `fetch()` URL without SSRF validation:
```typescript
const response = await fetch(`${instanceUrl}/oauth/token`, { ... });
```
A user could pass `http://169.254.169.254/latest/meta-data` or internal network addresses as `instance_url`, causing SSRF.

**Recommendation**: Validate `instance_url` against an allowlist of known Mastodon instances, or at minimum validate it's a public HTTPS URL and not a private/internal IP.

---

### P3-004: `db: any` Type Annotations Bypass Type Safety

**Files**: Multiple services (`CrossPostService.ts`, `UnifiedInboxService.ts`, `CrossPlatformAnalyticsService.ts`, `RepurposingService.ts`, `CrossPublishProcessor.ts`)

All distribution services use `db: any` for the Supabase client, bypassing TypeScript's type safety. This means SQL/query errors won't be caught at compile time.

---

### P3-005: Race Condition in Token Refresh — No Locking

**File**: `packages/backend/src/services/distribution/PlatformConnectionService.ts:246-303`

The `refreshExpiringTokens()` method iterates over all expiring connections sequentially in a `for` loop but has no distributed lock. If two instances of the service run simultaneously (horizontal scaling), they could both attempt to refresh the same token, causing one to fail (refresh tokens are typically single-use).

**Recommendation**: Use a Redis-based advisory lock (e.g., `SETNX`) before refreshing each token.

---

### P3-006: getPulseHistory Query Params Parsed Twice

**File**: `packages/backend/src/routes/v2/wellness.routes.ts:237-238`

```typescript
const limit = parseInt(req.query.limit as string) || 50;
```

The `GetPulseHistoryQuerySchema` already validates but doesn't include `limit`/`offset` fields. The route manually parses them with `parseInt` and applies different defaults (50/0) than the Zod schema would enforce. This is inconsistent — either add `limit`/`offset` to the Zod schema or remove manual parsing.

---

### P3-007: Error Messages Could Leak Internal Details

**Files**: Multiple adapters

Error messages from platform API calls include HTTP status codes:
```typescript
throw new Error(`Twitter token exchange failed: ${response.status}`);
```

While these are caught by error handlers, if the global error handler passes through the message, it could reveal which third-party APIs are being called and their response codes.

---

## Detailed Analysis

### OAuth Token Security (EPIC-009)

| Check | Status | Notes |
|-------|--------|-------|
| Encryption algorithm | PASS | AES-256-GCM (authenticated encryption) |
| Key source | PASS | Environment variable `PLATFORM_TOKEN_ENCRYPTION_KEY`, validated as 64-char hex |
| IV generation | PASS | `randomBytes(16)` — cryptographically random, unique per encryption |
| IV reuse | PASS | No reuse — fresh IV generated each call |
| Auth tag verification | PASS | `setAuthTag()` called before decryption |
| Key length validation | PASS | Both encrypt/decrypt validate 32-byte key length |
| Token in logs | PASS | Comments explicitly warn against logging tokens; log statements only include IDs |
| Token in API responses | PASS | Encrypted blobs stored; `getStatus()` only returns metadata, not tokens |
| Token in error messages | PASS | Error messages don't include token values |
| CSRF state parameter | PASS | 32-byte random state, validated on callback, single-use, 10-min expiry |
| State token cleanup | PASS | Expired entries cleaned every 5 minutes |
| Refresh token IV/tag | **FAIL** | P2-002: Refresh token uses wrong IV/auth tag |
| PKCE implementation | **FAIL** | P2-005: code_challenge_method declared but not implemented |
| Token refresh locking | INFO | P3-005: No distributed lock for concurrent refresh |

### Content Shield Security (EPIC-008)

| Check | Status | Notes |
|-------|--------|-------|
| Provenance signing input validation | **FAIL** | P2-001: No Zod schema on POST /provenance/sign |
| Provenance record immutability | PASS | Only status column updatable; revoke is soft-delete |
| Certificate access control | PASS | Creator pubkey checked before certificate generation |
| Fingerprint access control | PASS | Route enforces `creatorId === req.user.nostr_pubkey` |
| Alert status transitions | PASS | Zod enum restricts to valid statuses; no escalation from 'new' to invalid states |
| Content scanner SSRF | PASS | Relay connection is placeholder (returns []); no actual outbound connections yet |
| NOSTR key handling | PASS | Keys handled via existing NOSTR service; no private keys stored |
| DMCA report access control | PASS | Auth + requireCreator middleware on all DMCA endpoints |

### Wellness Data Privacy (EPIC-007)

| Check | Status | Notes |
|-------|--------|-------|
| Auth on all endpoints | PASS | All routes have `authenticate` + `requireCreator` (except `/benchmark` which uses `optionalAuth`) |
| Creator data isolation | PASS | All queries filter by `req.user!.nostr_pubkey` |
| IDOR prevention | PASS | No user-supplied creator ID in wellness queries — always from auth token |
| GDPR delete endpoint | PASS | `DELETE /data` calls `deleteAllWellnessData()` |
| Pulse delete endpoint | PASS | `DELETE /pulse` deletes pulse history |
| Benchmark anonymity | PASS | Minimum 10 participants required; no individual data exposed |
| Input validation | PASS | Zod schemas on all mutation endpoints |
| XSS in auto-response | PASS | `UpdateBoundariesSchema` strips HTML tags, event handlers, and javascript: URIs |
| Rate limiting | PASS | Read-only + mutation + expensive rate limiters applied appropriately |

### Cross-Cutting Security

| Check | Status | Notes |
|-------|--------|-------|
| Rate limiting on new endpoints | PASS | All route files apply `readOnlyRateLimiter` globally + `mutationRateLimiter`/`expensiveRateLimiter` on mutations |
| Input validation (Zod) | PARTIAL | All routes except POST /provenance/sign have Zod validation |
| CSRF protection | PASS | OAuth state parameter; other mutations require Bearer token (stateless) |
| SQL injection | PASS | All queries use Supabase client (parameterized); no raw SQL |
| XSS in API responses | PASS | API returns JSON only; no HTML rendering |
| Auth middleware | PASS | All protected routes have `authenticate` + `requireCreator` |
| Error handling | PASS | All handlers use try/catch with `next(err)` |

### Database Migration Security

| Table | RLS Enabled | Policy Correct | Notes |
|-------|------------|----------------|-------|
| platform_connections | YES | YES | `creator_id = current_setting('app.current_user_id', true)` |
| cross_posts | YES | YES | Same RLS pattern |
| repurposed_content | YES | YES | Same RLS pattern |
| inbox_messages | YES | YES | Same RLS pattern |
| platform_metrics_history | YES | YES | Same RLS pattern |

All 5 new tables have:
- RLS enabled
- Consistent `FOR ALL` policy using `current_setting('app.current_user_id', true)`
- Appropriate indexes
- CHECK constraints on enum columns
- No data leakage between creators possible at the database level

**Note**: The RLS policy depends on `app.current_user_id` being set correctly by the backend before each request. If this is not set (e.g., service-to-service calls), RLS will return no rows (safe default due to `true` parameter in `current_setting`).

---

## Recommendations (Prioritized)

1. **[P2-002] Fix refresh token IV/auth tag storage** — Add `refresh_token_iv` and `refresh_token_auth_tag` columns; this is a correctness bug that will break token refresh in production.

2. **[P2-001] Add Zod validation to POST /provenance/sign** — Create a `SignContentSchema` and add `validate({ body: ... })` middleware.

3. **[P2-005] Implement PKCE properly** — Generate code_verifier/code_challenge, store verifier with state, send in token exchange.

4. **[P2-003] Replace in-memory OAuth state store with Redis** — Already noted as TODO in code; should be done before production.

5. **[P2-004] Add session binding to OAuth state** — Store and verify the session/user who initiated the OAuth flow.

6. **[P3-003] Validate Mastodon instance_url against SSRF** — Add URL validation (HTTPS, public IP, optional allowlist).

7. **[P3-001] Upgrade shield contentId validation to UUID** — Change `z.string().min(1)` to `z.string().uuid()`.

8. **[P3-005] Add distributed locking for token refresh** — Use Redis SETNX before refresh to prevent race conditions.

---

## Summary

The Phase 1 epics demonstrate a security-conscious implementation with strong fundamentals. The encryption, authentication, authorization, input validation, and database security are all well-implemented. The 5 P2 findings are addressable without major architectural changes — the most critical being the refresh token IV/auth tag bug (P2-002) which will cause runtime failures, and the missing PKCE implementation (P2-005) which will cause OAuth failures with Twitter. None of the findings represent exploitable vulnerabilities that would lead to data breach with the current code, but they should be resolved before production deployment.
