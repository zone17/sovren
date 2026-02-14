---
status: pending
priority: p2
issue_id: '055'
tags: [code-review, security, csrf]
dependencies: []
---

# CSRF Not Session-Bound and Plaintext Credential Backup

## Problem Statement

Two security issues: (1) CSRF double-submit cookie implementation uses `httpOnly: false` (required for SPA access) but token is not bound to server-side session, allowing XSS on any subdomain to read cookie and replay token since sameSite: 'lax' only protects top-level navigation, not XHR/fetch; (2) Plaintext credential backup exists in rotate-database-credentials.ts where credentials are stored before encryption.

## Findings

**Location**:

- `middleware/csrf.ts:29-46`
- `scripts/rotate-database-credentials.ts`

**Issue 1: CSRF Token Not Session-Bound**:

**Current Implementation**:

```typescript
res.cookie('csrf-token', token, {
  httpOnly: false, // Required for SPA to read
  secure: true,
  sameSite: 'lax', // Only protects top-level navigation
  maxAge: 3600000,
});
```

**Vulnerability Chain**:

1. SPA reads CSRF token from cookie via JavaScript
2. `httpOnly: false` means cookie is JavaScript-readable (by design)
3. XSS on any subdomain can read cookie value
4. `sameSite: 'lax'` only protects against cross-site top-level navigation
5. Does NOT protect against XHR/fetch from attacker site
6. Token not bound to server session - attacker can replay token
7. Attacker with stolen token can make valid requests

**sameSite: 'lax' Limitations**:

- Protects: `<a href>`, `<form>` (GET), `window.location`
- Does NOT protect: `fetch()`, `XMLHttpRequest`, `<form method="POST">`
- Modern CSRF attacks use fetch/XHR, not form submissions

**Session Binding Missing**:

- Token should be validated against server-side session
- Current implementation only checks token presence/format
- No cryptographic binding to user session
- Allows token replay across sessions

**Issue 2: Plaintext Credential Backup**:

```typescript
// scripts/rotate-database-credentials.ts
const credentials = {
  password: newPassword,
  apiKey: newApiKey,
};

// Stored in plaintext before encryption
fs.writeFileSync('backup.json', JSON.stringify(credentials));

// Later encrypted
encrypt(credentials);
```

- Window where credentials exist unencrypted on disk
- Race condition: crash before encryption = plaintext leak
- Backup files may persist after encryption

## Proposed Solutions

1. **Session-Bound CSRF Tokens** (Recommended):

   ```typescript
   // Server-side session storage
   const csrfToken = generateToken();
   const sessionId = req.session.id;

   // Store binding
   await redisClient.set(`csrf:${sessionId}`, csrfToken, 'EX', 3600);

   // Validation
   const storedToken = await redisClient.get(`csrf:${req.session.id}`);
   if (storedToken !== receivedToken) {
     throw new ForbiddenError('Invalid CSRF token');
   }
   ```

2. **Upgrade sameSite to 'strict'**:

   - More restrictive but better security
   - May break legitimate cross-site flows
   - Requires application audit

3. **Encrypt Before Write**:
   ```typescript
   // NEVER write plaintext
   const encryptedCredentials = encrypt(credentials);
   fs.writeFileSync('backup.json', encryptedCredentials);
   ```

## Technical Details

**CSRF Mitigation Layers**:

```
Current (weak):
- sameSite: lax (bypassed by fetch)
- Double-submit cookie (no session binding)

Proposed (strong):
- sameSite: strict (or lax with session binding)
- Server-side session validation
- Token rotation per request (optional)
```

**Session Binding Implementation**:

```typescript
// middleware/csrf.ts
export function generateCsrfToken(sessionId: string): string {
  const token = randomBytes(32).toString('hex');

  // Store in Redis with session binding
  redisClient.setex(`csrf:${sessionId}`, 3600, token);

  return token;
}

export function validateCsrfToken(sessionId: string, token: string): boolean {
  const storedToken = redisClient.get(`csrf:${sessionId}`);
  return storedToken === token && storedToken !== null;
}
```

**Credential Rotation Fix**:

```typescript
// scripts/rotate-database-credentials.ts

// Before
const credentials = generateCredentials();
writeBackup(credentials); // Plaintext on disk
encrypt(credentials); // Later encrypted

// After
const credentials = generateCredentials();
const encrypted = encrypt(credentials);
writeBackup(encrypted); // Never plaintext on disk
```

## Acceptance Criteria

- [ ] CSRF tokens bound to server-side session
- [ ] Token validation checks session binding
- [ ] XSS on subdomain cannot replay stolen token
- [ ] Token invalidated on session expiration
- [ ] Redis stores session-token mapping
- [ ] No plaintext credential writes in rotation scripts
- [ ] Credentials encrypted before disk write
- [ ] No plaintext backup files created
- [ ] Unit tests verify session binding
- [ ] Security test: stolen token cannot be replayed
- [ ] Integration tests verify CSRF protection
- [ ] Documentation updated with CSRF architecture

## Work Log

Created: 2026-02-12

## Resources

- PR #73 post-remediation review
- OWASP CSRF Prevention Cheat Sheet
- sameSite cookie attribute specification
- Session management best practices
