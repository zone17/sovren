---
status: pending
priority: p3
issue_id: 105
tags: [code-review, logging, observability]
dependencies: []
---

# Sensitive Fields Over-Matching

## Problem Statement

`sensitive-fields.ts` at `packages/backend/src/lib/sensitive-fields.ts:6-23` includes `'key'` and `'auth'` as standalone sensitive field names with word-boundary regex matching (`\\b${field}\\b`).

This causes **over-redaction** in production logs:

- `primaryKey` → redacted (legitimate database field)
- `authMethod` → redacted (authentication strategy, not secret)
- `publicKey` → redacted (public data by definition)
- `authRole` → redacted (RBAC role, needed for debugging)
- Any field containing "key" or "auth" with word boundaries

**Impact**: Significant information loss in production logs, making debugging authentication and database issues harder.

## Findings

- **File**: `packages/backend/src/lib/sensitive-fields.ts:6-23`
- **Current pattern**: Uses broad terms `'key'`, `'auth'` in sensitive fields list
- **Regex**: Word-boundary matching `\\b${field}\\b` triggers on substrings
- **Production impact**: Logs redact non-sensitive fields, reducing observability
- **Examples of over-redaction**:
  - `{ primaryKey: 123, authMethod: 'oauth2', publicKey: 'pk_...' }` → all redacted
  - Error logs showing "authRole" context → redacted
  - Database query logs with "foreignKey" references → redacted

## Proposed Solutions

### Option 1: Use Specific Field Names

**Description**: Replace broad terms with specific sensitive patterns:

- `'key'` → `'apiKey'`, `'secretKey'`, `'privateKey'`, `'encryptionKey'`
- `'auth'` → `'authToken'`, `'authSecret'`, `'authorization'`
- Keep existing: `'password'`, `'token'`, `'secret'`, `'credential'`

**Pros**:

- Precise redaction, minimal false positives
- Preserves legitimate fields like `primaryKey`, `authMethod`, `publicKey`
- Better production observability
- Simple to implement (update array)

**Cons**:

- May miss new sensitive field names introduced in future
- Requires periodic review to add new patterns
- Slightly longer sensitive fields list

**Effort**: Low (1 hour)
**Risk**: Low (only affects logging, testable with sample payloads)

### Option 2: Allowlist + Blocklist Approach

**Description**: Keep broad patterns but add explicit allowlist for known-safe fields:

- Blocklist: Current broad patterns (`'key'`, `'auth'`)
- Allowlist: `['primaryKey', 'foreignKey', 'publicKey', 'authMethod', 'authRole']`
- Matching logic: If field matches blocklist BUT is in allowlist → don't redact

**Pros**:

- Catches new sensitive fields automatically
- Explicit control over exceptions
- More robust for evolving schema

**Cons**:

- More complex logic (allowlist checking)
- Allowlist needs maintenance as schema evolves
- Harder to understand redaction behavior

**Effort**: Medium (2-3 hours)
**Risk**: Medium (more complex logic, potential for allowlist gaps)

## Recommended Action

**Option 1** - Use specific field names.

**Rationale**: Logging redaction should be precise, not broad. The current over-redaction is causing **production debugging friction** (confirmed by mentions in PR review). Specific patterns are easier to reason about, maintain, and test. The risk of missing new sensitive fields is mitigated by code review (any new field with "password", "secret", "token" in name will be caught).

**Implementation approach**:

1. Update sensitive fields list in `packages/backend/src/lib/sensitive-fields.ts`:
   ```typescript
   const SENSITIVE_FIELDS = [
     'password',
     'token',
     'secret',
     'credential',
     'apiKey',
     'secretKey',
     'privateKey',
     'encryptionKey',
     'authToken',
     'authSecret',
     'authorization',
     'sessionId',
     'refreshToken',
     'accessToken',
   ];
   ```
2. Remove broad `'key'` and `'auth'` entries
3. Add test cases:
   - `{ apiKey: 'secret' }` → redacted
   - `{ primaryKey: 123 }` → NOT redacted
   - `{ authToken: 'secret' }` → redacted
   - `{ authMethod: 'oauth2' }` → NOT redacted
4. Review existing logs to confirm improved observability

## Technical Details

**Current implementation** (`sensitive-fields.ts:6-23`):

```typescript
const SENSITIVE_FIELDS = [
  'password',
  'token',
  'secret',
  'key', // TOO BROAD
  'auth', // TOO BROAD
  'credential',
  // ...
];

// Regex pattern with word boundaries
const pattern = new RegExp(`\\b(${SENSITIVE_FIELDS.join('|')})\\b`, 'i');
```

**Problem**: Word-boundary regex `\\b(key|auth)\\b` matches:

- `primaryKey` → matches "Key" (case-insensitive)
- `authMethod` → matches "auth"
- `publicKey` → matches "Key"

**Proposed specific patterns**:

```typescript
const SENSITIVE_FIELDS = [
  // Existing precise terms
  'password',
  'token',
  'secret',
  'credential',

  // Specific key patterns (NOT broad 'key')
  'apiKey',
  'secretKey',
  'privateKey',
  'encryptionKey',
  'signingKey',

  // Specific auth patterns (NOT broad 'auth')
  'authToken',
  'authSecret',
  'authorization',

  // Token variants
  'accessToken',
  'refreshToken',
  'sessionId',
  'sessionToken',
];
```

**Testing strategy**:

```typescript
// Should redact
{ apiKey: 'sk_live_123' } → { apiKey: '[REDACTED]' }
{ authToken: 'Bearer xyz' } → { authToken: '[REDACTED]' }

// Should NOT redact
{ primaryKey: 123 } → { primaryKey: 123 }
{ authMethod: 'oauth2' } → { authMethod: 'oauth2' }
{ publicKey: 'pk_test_456' } → { publicKey: 'pk_test_456' }
```

**Backward compatibility**: No breaking changes. Logs will show MORE information (previously redacted safe fields), which is the desired outcome.

## Acceptance Criteria

- [ ] `'key'` and `'auth'` removed from sensitive fields list
- [ ] Specific patterns added: `apiKey`, `secretKey`, `privateKey`, `authToken`, `authSecret`, `authorization`
- [ ] Test cases confirm `primaryKey`, `authMethod`, `publicKey` are NOT redacted
- [ ] Test cases confirm `apiKey`, `authToken` ARE redacted
- [ ] Production logs reviewed to confirm improved observability (no over-redaction)
- [ ] Documentation updated with current sensitive fields list
- [ ] No regression in existing sensitive field redaction (password, token, secret)

## Work Log

### 2026-02-14

- Identified in PR #73 full code review

## Resources

- PR #73: https://github.com/zone17/sovren/pull/73
- Sensitive fields file: `packages/backend/src/lib/sensitive-fields.ts:6-23`
- Related: Production logging observability, debugging authentication issues
