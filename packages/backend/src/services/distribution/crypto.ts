/**
 * AES-256-GCM Token Encryption Utility
 * EPIC-009: OAuth token encryption at rest
 *
 * SECURITY: Never log plaintext tokens. Only encrypted blobs are stored.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // 256 bits

export interface EncryptedToken {
  encrypted: Buffer;
  iv: Buffer;
  authTag: Buffer;
}

/**
 * Encrypt a plaintext token using AES-256-GCM.
 * @param plaintext - The token to encrypt (NEVER log this value)
 * @param key - 32-byte encryption key from SecretsService
 */
export function encryptToken(plaintext: string, key: Buffer): EncryptedToken {
  if (key.length !== KEY_LENGTH) {
    throw new Error(`Encryption key must be ${KEY_LENGTH} bytes (${KEY_LENGTH * 8} bits)`);
  }

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return { encrypted, iv, authTag };
}

/**
 * Decrypt an encrypted token using AES-256-GCM.
 * @param encrypted - The ciphertext
 * @param key - 32-byte encryption key
 * @param iv - Initialization vector used during encryption
 * @param authTag - Authentication tag for integrity verification
 * @returns The original plaintext token (NEVER log the return value)
 */
export function decryptToken(
  encrypted: Buffer,
  key: Buffer,
  iv: Buffer,
  authTag: Buffer
): string {
  if (key.length !== KEY_LENGTH) {
    throw new Error(`Encryption key must be ${KEY_LENGTH} bytes (${KEY_LENGTH * 8} bits)`);
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

/**
 * Get the encryption key from environment variable.
 * Must be a 64-character hex string (32 bytes).
 */
export function getEncryptionKey(): Buffer {
  const keyHex = process.env.PLATFORM_TOKEN_ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error(
      'PLATFORM_TOKEN_ENCRYPTION_KEY environment variable is required for OAuth token encryption'
    );
  }

  if (keyHex.length !== 64) {
    throw new Error(
      'PLATFORM_TOKEN_ENCRYPTION_KEY must be a 64-character hex string (32 bytes / 256 bits)'
    );
  }

  return Buffer.from(keyHex, 'hex');
}
