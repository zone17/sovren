---
status: pending
priority: p1
issue_id: 002
tags: [code-review, security]
dependencies: []
---

# Hardcoded Cryptographic Keys in Vault Client

## Problem Statement

Hardcoded cryptographic fallback key ('default-sovren-vault-key-32bytes!') and static salt ('sovren-salt') in vault-client.ts line 271. Also hardcoded Vault root token ('root-token-sovren') at line 50.

## Findings

Security-sentinel found default encryption key and static salt at line 271. If VAULT_ENCRYPTION_KEY not set, all locally encrypted secrets use publicly visible key. Vault token fallback at line 50 means unauthenticated access if VAULT_TOKEN is unset. OWASP A02:2021 Crypto Failures + A07:2021 Auth Failures.

## Proposed Solutions

### Option A: Remove Hardcoded Defaults with Error Handling

Remove all hardcoded defaults, throw errors when required env vars missing.

**Pros:** Forces proper configuration, immediate visibility of misconfiguration, simple implementation
**Cons:** May break development environments, requires documentation updates
**Effort:** Small
**Risk:** Low

### Option B: Per-Secret Random Salts

Generate random per-secret salts stored alongside encrypted data.

**Pros:** Enhanced security posture, eliminates static salt vulnerability, industry best practice
**Cons:** Requires data migration, more complex implementation, storage overhead
**Effort:** Medium
**Risk:** Low

## Technical Details

**Affected Files:** scripts/lib/vault-client.ts (lines 50, 271)

## Acceptance Criteria

- [ ] No hardcoded keys, tokens, or salts in source code
- [ ] Missing env vars cause immediate error, not silent fallback
- [ ] All encryption operations use environment-provided keys
- [ ] Vault authentication requires valid token from environment

## Work Log

- 2026-02-11: Created from /workflows:review multi-agent code review
