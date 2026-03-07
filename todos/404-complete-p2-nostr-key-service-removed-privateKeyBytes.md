---
status: pending
priority: p2
issue_id: '421'
tags: [code-review, security, correctness, pr-87]
dependencies: []
---

# NostrKeyManagementService: removed privateKeyBytes variable may indicate orphaned code

## Problem Statement

The PR removes `const privateKeyBytes = new Uint8Array(Buffer.from(keyPair.privateKey, 'hex'));` from `createMnemonicBackup()` in `NostrKeyManagementService.ts:744`. This variable was used to convert the private key to bytes before generating a mnemonic.

However, the next line `const mnemonic = generateMnemonic(256)` generates a RANDOM mnemonic, not one derived from the private key bytes. This means the original code had an unused variable (the private key bytes were computed but never used), and the mnemonic backup is NOT actually derived from the private key.

This is either:

1. A bug in the original implementation (mnemonic should be derived from private key, but isn't)
2. Intentional design (mnemonic is a separate random recovery method, not derived from the key)

## Findings

- `NostrKeyManagementService.ts:744`: Removed `privateKeyBytes` computation
- `NostrKeyManagementService.ts:747` (now 744): `generateMnemonic(256)` generates a random 24-word mnemonic
- The mnemonic is stored alongside the key pair but is NOT derived FROM the key pair
- If the mnemonic is supposed to enable key recovery, it needs to actually be derived from or able to recreate the private key
- This is a pre-existing issue, NOT introduced by this PR -- the PR just removed the dead code
- The removal is correct (the variable was unused), but the underlying mnemonic-key relationship should be verified

## Proposed Solutions

### Option 1: Document that mnemonic is separate from key

**Approach:** Add a comment explaining the design: mnemonic is a separate recovery phrase, not derived from the private key.

**Effort:** 5 minutes

**Risk:** None

---

### Option 2: Derive mnemonic from private key

**Approach:** Use the private key bytes as entropy for `generateMnemonic()` (if the library supports custom entropy input). This ensures the mnemonic can reconstruct the key.

**Effort:** 1-2 hours (needs crypto review)

**Risk:** High (security-sensitive)

## Recommended Action

Investigate the intended relationship between mnemonic and private key. If mnemonics should be able to recreate the key, this is a P1 design flaw. If they're independent backup methods, add a comment.

## Technical Details

**Affected files:**

- `packages/shared/src/services/NostrKeyManagementService.ts:741-748`

## Acceptance Criteria

- [ ] Mnemonic-key relationship documented
- [ ] If derived: verified that mnemonic can reconstruct the private key
- [ ] If independent: documented in code comments

## Work Log

### 2026-02-20 - Code Review Discovery

**By:** Claude Code (PR #87 review)

**Actions:**

- Found removed unused variable was masking a potential design issue
- The mnemonic backup may not actually enable key recovery

## Resources

- **PR:** #87
