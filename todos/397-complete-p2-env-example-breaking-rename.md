---
status: complete
priority: p2
issue_id: "414"
tags: [code-review, infra, breaking-change, pr-87]
dependencies: []
---

# .env.example renames LNBITS vars without migration guide

## Problem Statement

The `.env.example` renames 4 LNBits environment variables:
- `LNBITS_URL` -> `LNBITS_API_URL`
- `LNBITS_API_KEY` -> `LNBITS_ADMIN_KEY`
- (new) `LNBITS_INVOICE_READ_KEY`
- `LIGHTNING_WEBHOOK_SECRET` -> `LNBITS_WEBHOOK_SECRET`

Existing developers with `.env` files using the old names will silently lose their LNBits configuration on next startup, since the Zod validation schema expects the new names. There is no migration guide, deprecation warning, or backward-compatible fallback.

## Findings

- `.env.example` has 4 renamed variables
- `env-validation.ts` now checks for `LNBITS_API_URL` and `LNBITS_ADMIN_KEY` (new names)
- The env-validation warns if the new names are missing in production, but does NOT check for the old names as a fallback
- Any existing `.env` files will silently have LNBits features disabled
- No CHANGELOG entry for this breaking change

## Proposed Solutions

### Option 1: Add backward-compatible fallback in env-validation

**Approach:** Check for old names as fallback: `process.env.LNBITS_API_URL || process.env.LNBITS_URL`. Emit a deprecation warning when old names are used.

**Pros:**
- Zero breakage for existing developers
- Graceful migration path

**Cons:**
- Slightly more complex env handling

**Effort:** 30 minutes

**Risk:** Low

---

### Option 2: Document the breaking change

**Approach:** Add a CHANGELOG entry and migration note in the PR description. No code change.

**Pros:**
- Simple
- Forces developers to update

**Cons:**
- Anyone who misses the note will have silent failures

**Effort:** 10 minutes

**Risk:** Medium (silent failures possible)

## Recommended Action

Option 1: add backward-compatible fallback with deprecation warning. This is the safer approach and follows the project's graceful degradation philosophy (same as the Redis change in this PR).

## Technical Details

**Affected files:**
- `packages/backend/.env.example`
- `packages/backend/src/utils/env-validation.ts`

**Old -> New mapping:**
| Old Name | New Name |
|----------|----------|
| `LNBITS_URL` | `LNBITS_API_URL` |
| `LNBITS_API_KEY` | `LNBITS_ADMIN_KEY` |
| `LNBITS_WALLET_ID` | (removed) |
| `LIGHTNING_WEBHOOK_SECRET` | `LNBITS_WEBHOOK_SECRET` |
| (new) | `LNBITS_INVOICE_READ_KEY` |

## Acceptance Criteria

- [ ] Old env var names work as fallback with deprecation warning
- [ ] CHANGELOG entry documents the rename
- [ ] Or: decision to accept breaking change documented

## Work Log

### 2026-02-20 - Code Review Discovery

**By:** Claude Code (PR #87 review)

**Actions:**
- Identified 4 renamed env variables with no backward compatibility
- Verified env-validation only checks new names

## Resources

- **PR:** #87
- **Original finding:** Todo #386 (lnbits-env-vars)
