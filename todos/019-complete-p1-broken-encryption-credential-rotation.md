---
status: pending
priority: p1
issue_id: '019'
tags: [code-review, security, credential-rotation]
dependencies: []
---

# Broken Encryption & Hardcoded Keys in Credential Rotation Scripts

## Problem Statement

Three critical security issues in the credential rotation scripts make the entire rotation system insecure:

1. **Broken NaCl encryption** (`automated-github-token-rotation-vault.ts:371-381`): The `encryptSecret()` method merely base64-encodes secrets instead of using NaCl sealed-box encryption required by GitHub's API. This means GitHub secret updates will fail or transmit plaintext.

2. **Hardcoded default encryption key** (`automated-github-token-rotation-vault.ts:253-257` and `automated-supabase-rotation-vault.ts:270-274`): Fallback `'default-backup-key'` with hardcoded salt `'salt'` means anyone with source code access can decrypt all credential backups.

3. **Hardcoded Vault dev root token** (`setup-vault.sh:110`, `credential-rotation-vault.yml:111`): Fallback `root-token-sovren` token is used if `VAULT_TOKEN` is not set, giving attackers full Vault access.

## Findings

- **security-sentinel**: CRITICAL-01, CRITICAL-02, CRITICAL-03
- **data-integrity-guardian**: CRITICAL - race condition in credential rotation
- **code-simplicity-reviewer**: Entire rotation system is overengineered (~5,000 lines for a free-tier project)

## Proposed Solutions

### Option A: Fix the cryptographic issues (Medium effort)

- Implement proper NaCl sealed-box encryption using `tweetnacl` or `sodium-native`
- Remove all hardcoded fallback keys; throw errors if env vars missing
- Generate random dev tokens for Vault instead of predictable defaults
- **Pros**: Fixes security issues directly
- **Cons**: Still maintaining 5,000 lines of overengineered rotation code

### Option B: Simplify entire rotation system (Recommended)

- Delete all Vault-variant scripts (no Vault in use)
- Delete duplicate Python/Bash implementations
- Create single ~100-line rotation script
- Use `gh secret set` for GitHub secrets, Supabase Management API for DB passwords
- **Pros**: Eliminates ~4,500 lines, removes attack surface entirely
- **Cons**: Loses HashiCorp Vault integration (not in use anyway)

## Technical Details

**Affected Files:**

- `scripts/automated-github-token-rotation-vault.ts`
- `scripts/automated-supabase-rotation-vault.ts`
- `scripts/setup-vault.sh`
- `.github/workflows/credential-rotation-vault.yml`
- 10+ additional rotation script files

## Acceptance Criteria

- [ ] No hardcoded encryption keys or tokens in any script
- [ ] Encryption uses proper NaCl sealed-box (or scripts removed)
- [ ] Missing env vars cause explicit failures, not silent fallbacks
- [ ] `grep -r 'default-backup-key\|root-token-sovren' scripts/` returns no results
