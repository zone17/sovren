---
status: pending
priority: p1
issue_id: '042'
tags: [code-review, security, encryption, credential-rotation]
dependencies: []
---

# Broken Encrypt Secret

## Problem Statement

The `encryptSecret` method returns base64 encoding instead of encryption, and backup encryption in rotation scripts uses a hardcoded static `'salt'` string, defeating the purpose of salting. These are production security vulnerabilities in credential rotation workflows.

## Findings

**Locations**:

- `/Users/fp/Desktop/Sovren/scripts/automated-github-token-rotation.ts:303-313` (encryptSecret)
- `/Users/fp/Desktop/Sovren/scripts/automated-supabase-rotation.ts:217` (static salt)
- `/Users/fp/Desktop/Sovren/scripts/automated-github-token-rotation.ts:188` (static salt)

**Found by**: Code Simplicity Reviewer, Data Integrity Guardian

**Issue 1 - Fake Encryption**:

```typescript
private encryptSecret(secret: string): string {
  // This is NOT encryption - it's base64 encoding
  return Buffer.from(secret).toString('base64');
  // Comment says: "simplified version - use proper sodium encryption in production"
  // But this IS the production code
}
```

Base64 is **encoding**, not **encryption**:

- No key required to decode
- Trivially reversible: `atob()` or `Buffer.from(b64, 'base64')`
- Provides zero security
- Anyone with access to the encoded value has the secret

This is used when updating GitHub secrets, meaning rotated tokens are stored in "encrypted" form that's actually plaintext with extra steps.

**Issue 2 - Static Salt**:
Both rotation scripts use hardcoded `'salt'` string for scrypt:

```typescript
const encryptionKey = scryptSync(
  process.env.BACKUP_ENCRYPTION_PASSWORD || 'default-password',
  'salt', // ← Static salt defeats the purpose
  32
);
```

Salts must be random and unique per encryption operation. A static salt:

- Enables rainbow table attacks
- Makes all backups encrypted with the same derived key
- If one backup is compromised, all backups with same password are compromised

**Security implications**:

1. Rotated GitHub tokens stored in "encrypted" format can be trivially decoded
2. Backup files are vulnerable to rainbow table attacks
3. False sense of security - code looks like it's doing encryption
4. Compliance violations if treating encoded data as encrypted

## Proposed Solutions

### Option 1: Implement libsodium Encryption (Recommended)

Use `libsodium` (or `tweetnacl`) for actual authenticated encryption. Use random salts stored alongside ciphertext.

**Pros**:

- Industry-standard cryptography
- Authenticated encryption (detects tampering)
- Proper key derivation
- Misuse-resistant

**Cons**:

- Requires libsodium dependency
- Need to manage nonces
- More complex than base64

**Implementation**:

```typescript
import sodium from 'libsodium-wrappers';

async encryptSecret(secret: string): Promise<string> {
  await sodium.ready;

  const key = sodium.from_base64(process.env.GITHUB_SECRET_KEY);
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
  const ciphertext = sodium.crypto_secretbox_easy(secret, nonce, key);

  // Return nonce + ciphertext as base64
  return Buffer.from([...nonce, ...ciphertext]).toString('base64');
}

// For backups:
const salt = randomBytes(32);
const encryptionKey = scryptSync(password, salt, 32);
// Store salt alongside encrypted data
```

### Option 2: AWS KMS / Secrets Manager Native Encryption

Use AWS KMS to encrypt secrets instead of doing it in application code.

**Pros**:

- No encryption code in application
- Key rotation handled by AWS
- Audit trail in CloudTrail
- Integrates with IAM

**Cons**:

- AWS dependency
- API latency
- Costs per operation
- Requires AWS credentials

### Option 3: Remove Encryption Claims

If encryption isn't actually needed, remove the pretense and document that secrets are stored encoded (not encrypted).

**Pros**:

- Honest about security model
- No false sense of security

**Cons**:

- Still not secure
- Doesn't solve the actual problem
- Unacceptable for production

## Technical Details

**Root cause**: TODO comment merged into production. Code comment explicitly says "simplified version - use proper sodium encryption in production" but this IS the production code.

**Base64 is not encryption**:

```typescript
const secret = 'ghp_supersecrettoken123';
const "encrypted" = Buffer.from(secret).toString('base64');
// "encrypted" = "Z2hwX3N1cGVyc2VjcmV0dG9rZW4xMjM="

// "Decryption" is trivial:
const decrypted = Buffer.from("encrypted", 'base64').toString();
// decrypted = "ghp_supersecrettoken123"
```

**Static salt vulnerability**:

```typescript
// With static salt, scrypt always produces the same key for same password
const key1 = scryptSync('password', 'salt', 32);
const key2 = scryptSync('password', 'salt', 32);
// key1 === key2 - attacker can precompute keys

// With random salt:
const salt1 = randomBytes(32);
const salt2 = randomBytes(32);
const key1 = scryptSync('password', salt1, 32);
const key2 = scryptSync('password', salt2, 32);
// key1 !== key2 - each encryption uses unique key
```

**Attack scenario**:

1. Attacker gains read access to backup directory
2. Extracts "encrypted" token: `Z2hwX3N1cGVyc2VjcmV0...`
3. Runs `echo "Z2hwX3N1cGVyc2VjcmV0..." | base64 -d`
4. Has plaintext GitHub token
5. Uses token to access repositories

## Acceptance Criteria

- [ ] `encryptSecret` uses libsodium or equivalent for authenticated encryption
- [ ] Random salt generated for each encryption operation
- [ ] Salt stored alongside ciphertext (or in separate well-known location)
- [ ] Nonce/IV properly managed (never reused with same key)
- [ ] Decryption method implemented and tested
- [ ] Key management documented (where keys are stored, rotation policy)
- [ ] Remove TODO comments claiming "simplified version"
- [ ] Security review confirms encryption implementation
- [ ] Tests verify ciphertext cannot be decoded without key
- [ ] Tests verify different salts produce different ciphertexts for same input
- [ ] Backward compatibility plan for existing "encrypted" data

## Work Log

_No work logged yet_

## Resources

- libsodium documentation: https://doc.libsodium.org/
- OWASP Cryptographic Storage: https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html
- Node.js crypto module: https://nodejs.org/api/crypto.html
- Why base64 is not encryption: https://paragonie.com/blog/2015/08/you-wouldnt-base64-a-password-cryptography-decoded
- Related files:
  - `/Users/fp/Desktop/Sovren/scripts/automated-github-token-rotation.ts`
  - `/Users/fp/Desktop/Sovren/scripts/automated-supabase-rotation.ts`
