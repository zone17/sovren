/**
 * Migration: Encrypt existing plaintext NOSTR private keys
 *
 * This script reads all users with plaintext nostr_private_key values
 * and encrypts them using AES-256-GCM with the key from SecretsService.
 *
 * Usage: npx ts-node src/scripts/encrypt-nostr-keys-migration.ts
 *
 * Prerequisites:
 * - NOSTR_KEY_ENCRYPTION_KEY must be set (env var or AWS Secrets Manager)
 * - Database must be accessible
 */

import { encrypt, isEncrypted } from '../utils/encryption';
import { getSecretsService } from '../services/SecretsService';
import { createClient } from '@supabase/supabase-js';

async function migrateNostrKeys(): Promise<void> {
  console.log('Starting NOSTR private key encryption migration...');

  // Get encryption key
  const secrets = await getSecretsService();
  const encryptionKey = await secrets.getSecret('NOSTR_KEY_ENCRYPTION_KEY');
  if (!encryptionKey || encryptionKey.length !== 64) {
    throw new Error(
      'NOSTR_KEY_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). ' +
        'Set it in environment variables or AWS Secrets Manager before running this migration.'
    );
  }

  // Connect to database
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Fetch all users with nostr_private_key
  const { data: users, error } = await supabase
    .from('users')
    .select('id, nostr_private_key')
    .not('nostr_private_key', 'is', null);

  if (error) {
    throw new Error(`Failed to fetch users: ${error.message}`);
  }

  if (!users || users.length === 0) {
    console.log('No users with NOSTR private keys found. Nothing to migrate.');
    return;
  }

  console.log(`Found ${users.length} users with NOSTR private keys`);

  let encrypted = 0;
  let skipped = 0;
  let errors = 0;

  for (const user of users) {
    try {
      // Skip already-encrypted keys
      if (isEncrypted(user.nostr_private_key)) {
        skipped++;
        continue;
      }

      const encryptedKey = encrypt(user.nostr_private_key, encryptionKey);

      const { error: updateError } = await supabase
        .from('users')
        .update({ nostr_private_key: encryptedKey })
        .eq('id', user.id);

      if (updateError) {
        console.error(`Failed to update user ${user.id}: ${updateError.message}`);
        errors++;
      } else {
        encrypted++;
      }
    } catch (err) {
      console.error(`Error processing user ${user.id}:`, err);
      errors++;
    }
  }

  console.log(
    `Migration complete: ${encrypted} encrypted, ${skipped} already encrypted, ${errors} errors`
  );

  if (errors > 0) {
    process.exit(1);
  }
}

migrateNostrKeys().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
