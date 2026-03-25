---
status: pending
priority: p2
issue_id: '204'
tags: [code-review, pr-85, database]
---

# Refresh Token IV/AuthTag Migration Timing Issue

## Problem Statement

Migration 200500 adds refresh_token_iv/authTag columns in a separate migration from table creation (200000). If tokens are stored between these migrations, refresh tokens become permanently undecryptable.

## Findings

- **Files**: `supabase/migrations/20260216200000_epic009_*.sql`, `supabase/migrations/20260216200500_epic009_*.sql`
- Migration `200000` creates the `platform_connections` table with encrypted token columns
- Migration `200500` adds `refresh_token_iv` and `refresh_token_auth_tag` columns needed for AES-GCM decryption
- If any platform connections are created between these two migrations (e.g., during a staged deployment), the refresh tokens will be stored without IV/authTag values
- Those tokens become permanently undecryptable since AES-GCM requires the exact IV and authTag used during encryption
- This is a data loss scenario for any tokens created in the gap

## Proposed Solutions

1. Merge the `refresh_token_iv` and `refresh_token_auth_tag` columns into the original table creation migration (`200000`). Since these are new tables with no existing data, this is safe and eliminates the timing gap entirely.
2. If migrations cannot be merged (already deployed), add a NOT NULL constraint with a migration script that re-encrypts any tokens missing IV/authTag values.

## Acceptance Criteria

- [ ] refresh_token_iv and refresh_token_auth_tag columns exist in the same migration as the table creation
- [ ] No migration timing gap exists where tokens could be stored without encryption metadata
- [ ] All encrypted token columns (iv, authTag) are present from the first row insertion
- [ ] Migration sequence passes `supabase db reset` cleanly
