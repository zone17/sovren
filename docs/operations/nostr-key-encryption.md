# NOSTR Key Encryption -- Operations Runbook

## Overview

NOSTR private keys stored in Supabase must be encrypted at rest using AES-256.
The encryption migration script lives at:

    packages/backend/src/scripts/encrypt-nostr-keys-migration.ts

The production setup wrapper is at:

    scripts/production-setup.sh --encrypt

## Prerequisites

1. **`gh` CLI** authenticated (`gh auth status`)
2. **Supabase CLI** installed and linked to project `pgxpjiarfmsammhwesfx`
3. **`NOSTR_KEY_ENCRYPTION_KEY`** -- a 64-character hex string (32 bytes)
   Generate one with: `openssl rand -hex 32`

## Known Issue: Env Var Name Mismatch

The shell script (`production-setup.sh`) passes the encryption key as
`NOSTR_ENCRYPTION_KEY`, but the TypeScript migration script reads
`NOSTR_KEY_ENCRYPTION_KEY`.

The shell script line:

    NOSTR_ENCRYPTION_KEY="$ENCRYPTION_KEY" npx ts-node packages/backend/src/scripts/encrypt-nostr-keys-migration.ts

should be:

    NOSTR_KEY_ENCRYPTION_KEY="$ENCRYPTION_KEY" npx ts-node packages/backend/src/scripts/encrypt-nostr-keys-migration.ts

**Fix this before running in production.** The mismatch means the migration
will fail with "NOSTR_KEY_ENCRYPTION_KEY must be a 64-character hex string".

## Steps to Run

1. Generate an encryption key:

   ```bash
   export NOSTR_KEY_ENCRYPTION_KEY=$(openssl rand -hex 32)
   ```

2. Run the migration:

   ```bash
   NOSTR_KEY_ENCRYPTION_KEY="$NOSTR_KEY_ENCRYPTION_KEY" \
     npx ts-node packages/backend/src/scripts/encrypt-nostr-keys-migration.ts
   ```

3. Store the key in GitHub Secrets for runtime decryption:

   ```bash
   gh secret set NOSTR_KEY_ENCRYPTION_KEY --body "$NOSTR_KEY_ENCRYPTION_KEY"
   ```

4. Verify encryption by checking the Supabase `nostr_keys` table -- private key
   columns should contain encrypted ciphertext, not raw hex keys.

## DO NOT

- Run this script without database backups
- Store the encryption key in source control
- Use the `--all` flag in `production-setup.sh` without first fixing the env var name
