# NIP-04 Encrypted Direct Messages: Security Best Practices

**US-313: NIP-04 Encrypted DM Support - Security Documentation**
**Epic 003: NOSTR Consolidation**

## Table of Contents

1. [Overview](#overview)
2. [Encryption Best Practices](#encryption-best-practices)
3. [Key Management](#key-management)
4. [Implementation Security](#implementation-security)
5. [Threat Mitigation](#threat-mitigation)
6. [Operational Security](#operational-security)
7. [Audit Trail](#audit-trail)
8. [Compliance Checklist](#compliance-checklist)

---

## Overview

This document provides comprehensive security guidelines for implementing and using NIP-04 encrypted direct messages in the Sovren platform.

### Security Objectives

- **Confidentiality**: Protect message content from unauthorized access
- **Integrity**: Detect message tampering (limited by NIP-04 spec)
- **Availability**: Prevent denial-of-service attacks
- **Forward Secrecy**: Minimize impact of key compromise
- **Privacy**: Protect user metadata where possible

### Threat Model

See [threat-model.mmd](/docs/architecture/diagrams/nip04/threat-model.mmd) for visual representation.

**Critical Threats:**
- T1: Private key extraction
- T2: Man-in-the-middle attacks
- T6: Message tampering
- T7: IV reuse attacks

**Medium Threats:**
- T3: Replay attacks
- T4: Timing attacks
- T5: Spam/DoS attacks
- T9: Session key rollback

---

## Encryption Best Practices

### 1. Initialization Vector (IV) Generation

**CRITICAL: Every encryption MUST use a unique, random IV**

```typescript
// ✅ CORRECT: Cryptographically secure random IV
const iv = crypto.getRandomValues(new Uint8Array(16));

// ❌ WRONG: Predictable IV
const iv = new Uint8Array(16); // All zeros - NEVER DO THIS

// ❌ WRONG: Reusing IV
const staticIV = savedIV; // Reuse breaks security
```

**Requirements:**
- 16 bytes (128 bits) for AES-256-CBC
- Generated using `crypto.getRandomValues()` (CSPRNG)
- **NEVER** reuse an IV with the same key
- **NEVER** use sequential or predictable IVs

**Why This Matters:**
Reusing an IV with the same key allows attackers to:
1. Detect identical messages (pattern analysis)
2. Recover plaintext through XOR attacks
3. Completely break encryption in some cases

### 2. Shared Secret Derivation (ECDH)

**Use secp256k1 Elliptic Curve Diffie-Hellman**

```typescript
// ✅ CORRECT: Proper ECDH with validation
async function deriveSharedSecret(
  privateKey: string,
  recipientPublicKey: string
): Promise<Uint8Array> {
  // 1. Validate key formats
  if (!/^[0-9a-f]{64}$/i.test(privateKey)) {
    throw new Error('Invalid private key format');
  }
  if (!/^[0-9a-f]{64}$/i.test(recipientPublicKey)) {
    throw new Error('Invalid public key format');
  }

  // 2. Perform ECDH
  const sharedPoint = secp256k1.multiply(recipientPublicKey, privateKey);

  // 3. Use x-coordinate as shared secret (32 bytes)
  return sharedPoint.slice(1, 33);
}
```

**Security Notes:**
- Always validate key lengths (64 hex characters = 32 bytes)
- Use constant-time operations to prevent timing attacks
- Never log or expose the shared secret
- Shared secret should be ephemeral (not stored long-term)

### 3. AES-256-CBC Encryption

**NIP-04 Standard: AES-256-CBC with PKCS7 padding**

```typescript
// ✅ CORRECT: Proper AES-256-CBC encryption
const encrypted = await crypto.subtle.encrypt(
  {
    name: 'AES-CBC',
    iv: randomIV,
  },
  aesKey,
  plaintext
);
```

**Requirements:**
- Algorithm: AES-256-CBC
- Key size: 256 bits (32 bytes)
- Padding: PKCS7
- Mode: CBC (Cipher Block Chaining)

**Output Format:**
```
base64_ciphertext?iv=base64_iv
```

Example:
```
dGVzdCBjaXBoZXJ0ZXh0?iv=cmFuZG9tSVYxMjM0NTY=
```

### 4. Message Format Validation

**ALWAYS validate encrypted message format before decryption**

```typescript
// ✅ CORRECT: Validation before decryption
function validateEncryptedFormat(encrypted: string): void {
  // Check for IV separator
  if (!encrypted.includes('?iv=')) {
    throw new Error('Invalid format: missing IV separator');
  }

  // Split and validate parts
  const parts = encrypted.split('?iv=');
  if (parts.length !== 2) {
    throw new Error('Invalid format: malformed structure');
  }

  // Validate base64 encoding
  const [ciphertext, iv] = parts;
  if (!isValidBase64(ciphertext) || !isValidBase64(iv)) {
    throw new Error('Invalid format: corrupted base64');
  }
}
```

---

## Key Management

### 1. Private Key Storage

**CRITICAL: Private keys MUST be protected at all times**

**Best Practices:**

```typescript
// ✅ CORRECT: Use KeyManagementService
const nip04Service = NIP04Service.getInstance();
await nip04Service.initialize(keyManagementService);

// Keys stored securely in KeyManagementService
const encrypted = await nip04Service.encrypt(message, recipientPubkey);

// ❌ WRONG: Hardcoding keys
const privateKey = '0000...'; // NEVER hardcode keys

// ❌ WRONG: Storing in localStorage unencrypted
localStorage.setItem('privateKey', key); // NEVER do this
```

**Storage Requirements:**
- Use browser extension (Alby, nos2x) when possible
- If local storage needed:
  - Encrypt with user password (PBKDF2, Argon2)
  - Use secure storage APIs (Web Crypto API)
  - Never store in plain localStorage/sessionStorage
- Consider hardware wallets for high-security scenarios

### 2. Session Key Rotation

**Implement forward secrecy through session key rotation**

```typescript
// ✅ CORRECT: Automatic rotation after 100 messages
class NIP04Service {
  async maybeRotateSessionKey(conversationPubkey: string): Promise<boolean> {
    const sessionKey = this.getSessionKey(conversationPubkey);

    if (!sessionKey) return false;

    sessionKey.messageCount++;

    // Rotate after threshold
    if (sessionKey.messageCount >= sessionKey.rotationThreshold) {
      await this.generateSessionKey(conversationPubkey);
      return true;
    }

    return false;
  }
}
```

**Why Rotate Keys:**
- Limits damage from key compromise
- Forward secrecy: old messages safe even if current key leaked
- Backward secrecy: future messages safe if old key leaked

**Rotation Triggers:**
- Every 100 messages (default)
- Every 24 hours
- After suspected compromise
- On explicit user request

### 3. Key Destruction

**Securely destroy keys when no longer needed**

```typescript
// ✅ CORRECT: Secure key destruction
async destroy(): Promise<void> {
  // Clear all sensitive data
  this.threads.clear();
  this.messageCache.clear();
  this.threadMetadata.clear();

  // Clear session keys
  for (const metadata of this.threadMetadata.values()) {
    if (metadata.sessionKey) {
      // Zero out private key memory
      metadata.sessionKey.privateKey = '0'.repeat(64);
      delete metadata.sessionKey;
    }
  }

  this.initialized = false;
}
```

---

## Implementation Security

### 1. Input Validation

**Validate ALL inputs before processing**

```typescript
// ✅ CORRECT: Comprehensive input validation
function validateInputs(message: string, recipientPubkey: string): void {
  // Validate message
  if (typeof message !== 'string') {
    throw new Error('Message must be a string');
  }

  if (message.length > 100000) {
    throw new Error('Message too long (max 100KB)');
  }

  // Validate public key format
  if (!/^[0-9a-f]{64}$/i.test(recipientPubkey)) {
    throw new Error('Invalid recipient public key format');
  }

  // Check for malicious patterns
  if (containsSQLInjection(recipientPubkey)) {
    throw new Error('Invalid characters in public key');
  }
}
```

### 2. Error Handling

**Never leak sensitive information in error messages**

```typescript
// ✅ CORRECT: Safe error handling
try {
  const decrypted = await decrypt(encrypted, senderPubkey);
} catch (error) {
  // Log full error for debugging (server-side only)
  console.error('[NIP04] Decryption failed:', error);

  // Return generic error to user
  throw new Error('Decryption failed: Invalid encrypted content');
  // ❌ NEVER: throw new Error(`Failed with key ${privateKey}: ${error}`)
}
```

**Error Message Rules:**
- Never include private keys
- Never include plaintext content
- Never include detailed crypto errors
- Use generic messages for user-facing errors
- Log details only server-side (if applicable)

### 3. Timing Attack Prevention

**Use constant-time operations for sensitive comparisons**

```typescript
// ✅ CORRECT: Constant-time comparison
function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
}

// ❌ WRONG: Early return leaks timing information
function insecureEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false; // Early return = timing leak
  }
  return true;
}
```

### 4. Rate Limiting

**Prevent spam and DoS attacks**

```typescript
// ✅ CORRECT: Multi-tier rate limiting
const spamConfig: SpamProtectionConfig = {
  rateLimit: {
    maxMessagesPerMinute: 10,  // Prevent rapid-fire spam
    maxMessagesPerHour: 200,    // Prevent sustained attacks
  },
  requirePoW: false,            // Optional PoW for unknown senders
  powDifficulty: 16,            // 16-bit difficulty
  blockList: new Set<string>(), // Blocked pubkeys
  allowList: new Set<string>(), // Trusted contacts
};

// Check before processing message
const allowed = await checkSpamProtection(senderPubkey, event);
if (!allowed) {
  throw new Error('Rate limit exceeded or sender blocked');
}
```

---

## Threat Mitigation

### Threat Matrix

| Threat | Severity | Mitigation | Status |
|--------|----------|------------|--------|
| T1: Key Extraction | CRITICAL | Never log/store plaintext keys | ✅ |
| T2: MITM | HIGH | ECDH + secp256k1 | ✅ |
| T3: Replay Attacks | MEDIUM | Message IDs + timestamps | ✅ |
| T4: Timing Attacks | MEDIUM | Constant-time operations | ✅ |
| T5: Spam/DoS | MEDIUM | Rate limiting + PoW | ✅ |
| T6: Tampering | HIGH | No HMAC in NIP-04 | ⚠️ |
| T7: IV Reuse | CRITICAL | CSPRNG per message | ✅ |
| T8: Known Plaintext | LOW | Unique IV per message | ✅ |
| T9: Session Rollback | MEDIUM | Session key rotation | ✅ |
| T10: Memory Leaks | LOW | Cleanup on destroy | ✅ |

**Note on T6 (Message Tampering):**
NIP-04 does **not** provide message authentication (no HMAC). Tampering may go undetected. For critical applications, consider:
- Implementing application-level signatures
- Using NIP-44 (future) with authenticated encryption
- Adding checksums/hashes in message content

### Defense in Depth

**Layer 1: Cryptography**
- AES-256-CBC encryption
- secp256k1 ECDH key exchange
- CSPRNG IV generation

**Layer 2: Input Validation**
- Key format validation
- Message format validation
- Content size limits

**Layer 3: Rate Limiting**
- Per-sender message limits
- Proof-of-work for unknown senders
- Block/allow lists

**Layer 4: Session Security**
- Session key rotation
- Forward secrecy
- Secure key destruction

**Layer 5: Monitoring**
- Read receipts (kind 1515)
- Typing indicators (kind 20004)
- Audit logging

---

## Operational Security

### 1. Development

**Secure Development Practices:**

- Never commit private keys to git
- Use `.env` files (not checked in) for test keys
- Rotate all test keys before production
- Use separate keys for dev/staging/production
- Enable strict TypeScript mode
- Use ESLint security rules

### 2. Testing

**Security Testing Checklist:**

- ✅ IV uniqueness tests (1000+ iterations)
- ✅ Known-plaintext resistance tests
- ✅ Ciphertext tampering detection
- ✅ Malicious IV handling
- ✅ Key rotation security tests
- ✅ Rate limiting under attack
- ✅ Memory leak prevention
- ✅ Timing attack tests

### 3. Deployment

**Production Security:**

- Use HTTPS for all connections
- Enable CORS restrictions
- Set CSP headers
- Use Subresource Integrity (SRI)
- Implement HSTS
- Regular security audits
- Penetration testing

### 4. Monitoring

**Security Monitoring:**

```typescript
// Log security events (no sensitive data)
console.log('[SECURITY] Rate limit exceeded', {
  pubkey: senderPubkey.slice(0, 8) + '...', // Truncated
  timestamp: Date.now(),
  messageCount: count,
});

// Monitor for attacks
if (rateLimitViolations > 100) {
  alertSecurityTeam('Possible DDoS attack detected');
}
```

---

## Audit Trail

### Security Event Logging

**Events to Log:**

1. **Encryption/Decryption Events**
   ```typescript
   {
     event: 'encryption',
     timestamp: Date.now(),
     recipientPubkey: pubkey.slice(0, 8) + '...',
     messageSize: plaintext.length,
     sessionKeyId: sessionKey?.keyId,
   }
   ```

2. **Key Rotation Events**
   ```typescript
   {
     event: 'key_rotation',
     timestamp: Date.now(),
     conversationPubkey: pubkey.slice(0, 8) + '...',
     oldKeyId: oldKey.keyId,
     newKeyId: newKey.keyId,
     messageCount: 100,
   }
   ```

3. **Security Violations**
   ```typescript
   {
     event: 'rate_limit_exceeded',
     timestamp: Date.now(),
     pubkey: senderPubkey.slice(0, 8) + '...',
     violationType: 'per_minute',
     attemptedCount: 50,
     allowedCount: 10,
   }
   ```

4. **Spam/Block Events**
   ```typescript
   {
     event: 'message_blocked',
     timestamp: Date.now(),
     pubkey: blockedPubkey.slice(0, 8) + '...',
     reason: 'blocklist',
   }
   ```

**NEVER Log:**
- ❌ Private keys
- ❌ Plaintext message content
- ❌ Shared secrets
- ❌ Full public keys (truncate)

---

## Compliance Checklist

### Pre-Deployment Security Checklist

**Cryptography:**
- [ ] All IVs generated with CSPRNG
- [ ] No IV reuse possible
- [ ] AES-256-CBC properly configured
- [ ] ECDH using secp256k1
- [ ] Shared secrets ephemeral only

**Key Management:**
- [ ] Private keys never logged
- [ ] KeyManagementService integrated
- [ ] Session key rotation enabled
- [ ] Secure key destruction implemented
- [ ] Browser extension support tested

**Input Validation:**
- [ ] All public key formats validated
- [ ] Message size limits enforced
- [ ] Encrypted content format validated
- [ ] Malicious input handling tested

**Rate Limiting:**
- [ ] Per-minute limits configured
- [ ] Per-hour limits configured
- [ ] Block list functionality tested
- [ ] Allow list bypass verified
- [ ] Proof-of-work optional enabled

**Testing:**
- [ ] Test coverage ≥ 95%
- [ ] Security tests passing
- [ ] Timing attack tests passing
- [ ] IV uniqueness tests passing
- [ ] Key rotation tests passing
- [ ] Spam protection tests passing

**Documentation:**
- [ ] Security architecture diagram
- [ ] Encryption flow diagram
- [ ] Threat model documented
- [ ] Best practices guide
- [ ] Audit trail specification

**Operational:**
- [ ] Error handling doesn't leak secrets
- [ ] Logging doesn't include sensitive data
- [ ] Memory cleanup on destroy()
- [ ] No hardcoded keys in codebase
- [ ] Security monitoring enabled

---

## References

### NIP Specifications

- [NIP-04: Encrypted Direct Messages](https://github.com/nostr-protocol/nips/blob/master/04.md)
- [NIP-07: Browser Extension](https://github.com/nostr-protocol/nips/blob/master/07.md)
- [NIP-44: Encrypted Payloads (Versioned)](https://github.com/nostr-protocol/nips/blob/master/44.md) - Future upgrade

### Cryptography Standards

- [NIST SP 800-38A](https://csrc.nist.gov/publications/detail/sp/800-38a/final) - Block Cipher Modes
- [RFC 5869](https://datatracker.ietf.org/doc/html/rfc5869) - HKDF
- [secp256k1](https://en.bitcoin.it/wiki/Secp256k1) - Elliptic Curve

### Security Resources

- [OWASP Cryptographic Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [Timing Attacks](https://en.wikipedia.org/wiki/Timing_attack)

---

## Appendix: Security Contact

For security issues or questions:

- **Security Team**: security@sovren.app
- **GitHub**: Create a security advisory
- **Responsible Disclosure**: 90-day disclosure policy

**DO NOT** publicly disclose security vulnerabilities before coordinating with the team.

---

*Document Version: 1.0*
*Last Updated: 2025-10-26*
*Author: Elite Backend Engineer (US-313)*
