---
status: pending
priority: p2
issue_id: '102'
tags: [code-review, security, encryption, credentials]
dependencies: []
---

# Hardcoded Salt in Credential Rotation Script Encryption

## Problem Statement

Both credential rotation scripts use `crypto.scryptSync(key, 'salt', 32)` with the literal string `'salt'` as the salt parameter at `automated-github-token-rotation.ts:190` and `automated-supabase-rotation.ts:239`. A static salt defeats the purpose of salting: identical keys across environments produce identical derived keys, making rainbow table attacks viable. A unique random salt should be generated per backup and stored alongside the IV.

## Findings

**Vulnerable Code (2 occurrences):**

1. **automated-github-token-rotation.ts:190**

   ```typescript
   const derivedKey = crypto.scryptSync(
     encryptionKey,
     'salt', // ← HARDCODED
     32
   );
   ```

2. **automated-supabase-rotation.ts:239**
   ```typescript
   const derivedKey = crypto.scryptSync(
     masterKey,
     'salt', // ← HARDCODED
     32
   );
   ```

**Security Issues:**

1. **Rainbow Table Attacks:**

   - Same salt across all backups = same derived key for same password
   - Attacker can precompute derived keys for common passwords
   - Breaks key derivation security model

2. **Cross-Environment Key Leakage:**

   - Dev and prod use same salt
   - Derived key from dev environment works on prod backup if same password
   - Password compromise in one environment affects all environments

3. **No Salt Rotation:**

   - Even if password changes, salt stays the same
   - Limits security improvement from password rotation

4. **Identical Derived Keys Across Backups:**
   - Multiple backups with same password have identical derived keys
   - Compromise of one backup's key compromises all backups

**Proper Salt Usage:**

- Salt must be random and unique per backup
- Salt is not secret (stored alongside ciphertext)
- Purpose: prevents precomputation attacks and ensures unique derived keys
- Should be generated with `crypto.randomBytes(16)`

**Current Encryption Flow (VULNERABLE):**

```
Password + 'salt' → scryptSync → Derived Key (same for all backups)
Derived Key + IV + Plaintext → AES-256-GCM → Ciphertext
Store: { ciphertext, iv, authTag }  ← salt not stored, hardcoded
```

**Correct Encryption Flow:**

```
Password + Random Salt → scryptSync → Derived Key (unique per backup)
Derived Key + IV + Plaintext → AES-256-GCM → Ciphertext
Store: { ciphertext, iv, authTag, salt }  ← salt stored for decryption
```

## Proposed Solutions

### Option 1: Generate Random Salt Per Backup

**Pros:**

- Proper cryptographic security
- Each backup has unique derived key
- Rainbow table attacks infeasible
- Standard practice (OWASP, NIST)
- Simple fix: replace 'salt' with crypto.randomBytes(16)

**Cons:**

- Must store salt alongside ciphertext
- Need to update decryption logic to read salt
- Breaks backward compatibility with existing encrypted backups

**Effort:** Low (2 hours)
**Risk:** Low

### Option 2: Environment-Specific Static Salt

**Pros:**

- Different salts for dev/staging/prod
- Partial mitigation of cross-environment risk
- No need to store salt (config-based)

**Cons:**

- Still vulnerable to rainbow tables per environment
- Multiple backups in same environment still share derived key
- Not proper cryptographic practice
- Minimal security improvement

**Effort:** Low (1 hour)
**Risk:** Low

### Option 3: Use Higher-Level Encryption Library (e.g., `@47ng/cloak`)

**Pros:**

- Handles salt, IV, key derivation automatically
- Battle-tested implementation
- Fewer opportunities for crypto mistakes
- Clean API

**Cons:**

- Adds external dependency
- Overkill for simple backup encryption
- Team must learn new API

**Effort:** Medium (3 hours)
**Risk:** Low

## Recommended Action

**Option 1: Generate Random Salt Per Backup**

This is the correct cryptographic approach and aligns with industry standards. The implementation is straightforward, and the slight increase in complexity (storing salt) is worth the security improvement.

Implementation:

1. **Update Encryption Function:**

   ```typescript
   // Before (VULNERABLE)
   function encryptBackup(plaintext: string, password: string) {
     const derivedKey = crypto.scryptSync(password, 'salt', 32);
     const iv = crypto.randomBytes(16);
     const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey, iv);

     const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
     const authTag = cipher.getAuthTag();

     return { ciphertext, iv, authTag };
   }

   // After (SECURE)
   function encryptBackup(plaintext: string, password: string) {
     const salt = crypto.randomBytes(16); // ← Generate random salt
     const derivedKey = crypto.scryptSync(password, salt, 32);
     const iv = crypto.randomBytes(16);
     const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey, iv);

     const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
     const authTag = cipher.getAuthTag();

     return {
       ciphertext,
       iv,
       authTag,
       salt, // ← Include salt in output
     };
   }
   ```

2. **Update Decryption Function:**

   ```typescript
   // Before
   function decryptBackup(encrypted: any, password: string) {
     const derivedKey = crypto.scryptSync(password, 'salt', 32);
     // ...
   }

   // After
   function decryptBackup(encrypted: any, password: string) {
     const { ciphertext, iv, authTag, salt } = encrypted;
     const derivedKey = crypto.scryptSync(password, salt, 32); // ← Use stored salt
     // ...
   }
   ```

3. **Update Storage Format:**

   ```typescript
   // Store encrypted backup with salt
   const encrypted = encryptBackup(backup, BACKUP_PASSWORD);
   await fs.writeFile(
     'backup.enc.json',
     JSON.stringify({
       version: 2, // Increment version for new format
       encrypted: {
         ciphertext: encrypted.ciphertext.toString('base64'),
         iv: encrypted.iv.toString('base64'),
         authTag: encrypted.authTag.toString('base64'),
         salt: encrypted.salt.toString('base64'), // ← Store salt
       },
       timestamp: new Date().toISOString(),
     })
   );
   ```

4. **Handle Backward Compatibility:**

   ```typescript
   // Support old backups (version 1 with hardcoded salt)
   function decryptBackup(encrypted: any, password: string) {
     const salt = encrypted.salt
       ? Buffer.from(encrypted.salt, 'base64')
       : Buffer.from('salt', 'utf8'); // Fallback for old backups

     const derivedKey = crypto.scryptSync(password, salt, 32);
     // ...
   }
   ```

## Technical Details

**Affected Files:**

- `scripts/automated-github-token-rotation.ts` (line 190)
- `scripts/automated-supabase-rotation.ts` (line 239)

**Scrypt Parameters:**

- **Salt:** 16 bytes (128 bits), randomly generated
- **Key length:** 32 bytes (256 bits) for AES-256
- **Cost:** Default (16384) — can be increased for more security

**Security Rationale:**

Without unique salt:

```
Password "mypassword" + "salt" → Derived Key 0x1234... (same every time)
Attacker precomputes: {"mypassword"→0x1234, "password123"→0xABCD, ...}
Attacker tries precomputed keys on all backups (rainbow table)
```

With unique salt:

```
Password "mypassword" + Random Salt A → Derived Key 0x1234...
Password "mypassword" + Random Salt B → Derived Key 0x5678... (different!)
Attacker must brute-force each backup individually (no precomputation)
```

**Testing:**

```typescript
// Verify unique salts generate different keys
const password = 'testpassword';
const salt1 = crypto.randomBytes(16);
const salt2 = crypto.randomBytes(16);

const key1 = crypto.scryptSync(password, salt1, 32);
const key2 = crypto.scryptSync(password, salt2, 32);

assert(!key1.equals(key2), 'Different salts must produce different keys');
```

## Acceptance Criteria

- [ ] Hardcoded `'salt'` string removed from both rotation scripts
- [ ] Random 16-byte salt generated using `crypto.randomBytes(16)` per backup
- [ ] Salt stored alongside ciphertext, IV, and authTag in encrypted backup file
- [ ] Decryption function reads salt from backup file
- [ ] Backward compatibility: Old backups (version 1) can still be decrypted
- [ ] Unit test: Same password + different salts produce different derived keys
- [ ] Unit test: Encrypt → Decrypt round-trip successful
- [ ] Integration test: Full rotation script run produces decryptable backup
- [ ] Documentation updated with correct encryption/decryption examples
- [ ] Security review confirms proper salt usage

## Work Log

**2026-02-14**

- Identified in PR #73 full code review
- Found hardcoded `'salt'` string in both GitHub and Supabase rotation scripts
- Researched proper salt usage (OWASP, NIST guidelines)
- Proposed random salt generation per backup

## Resources

- PR #73: https://github.com/user/sovren/pull/73
- Node.js crypto.scryptSync: https://nodejs.org/api/crypto.html#cryptoscryptsyncpassword-salt-keylen-options
- OWASP Password Storage Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
- NIST SP 800-132 (Key Derivation): https://csrc.nist.gov/publications/detail/sp/800-132/final
- Related: Issue #098 (triple rotation scripts), Issue #096 (timing attacks)
