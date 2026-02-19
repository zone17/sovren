---
status: complete
priority: p2
issue_id: '269'
tags: [code-review, security, encryption]
dependencies: []
---

# NOSTR Private Key Plaintext Fallback

## Problem Statement

NostrReplyAdapter falls back to storing the NOSTR private key in plaintext if encryption setup fails. The BYOK encryption columns (encrypted_api_key, encryption_iv, key_version) exist in the migration but the adapter's error path stores raw keys.

## Findings

- `packages/backend/src/services/inbox/NostrReplyAdapter.ts` — catch block stores unencrypted key
- `supabase/migrations/20260220000000_epic009b_adaptive_polling.sql` — encryption columns exist but no CHECK constraint enforcing they're populated together

## Proposed Solutions

### Option 1: Fail hard on encryption failure

**Approach:** Remove fallback — if encryption fails, reject the key storage entirely. User must retry.
**Effort:** 30min **Risk:** Low

### Option 2: Add DB-level CHECK constraint

**Approach:** Add CHECK that encrypted_api_key, encryption_iv, key_version are all NULL or all NOT NULL.
**Effort:** 1h **Risk:** Low

## Acceptance Criteria

- [ ] No plaintext key storage path exists
- [ ] Encryption failure rejects the operation
- [ ] DB constraint prevents partial encryption state

## Work Log

### 2026-02-18 - Code Review Discovery

**By:** Claude Code (13-agent parallel review)
