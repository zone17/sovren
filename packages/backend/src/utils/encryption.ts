/**
 * AES-256-GCM Encryption Utility
 *
 * Provides symmetric encryption/decryption for sensitive data at rest
 * (e.g., NOSTR private keys). Uses AES-256-GCM for authenticated encryption.
 *
 * Key is sourced from SecretsService (AWS Secrets Manager in prod, env var in dev).
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV recommended for GCM
const AUTH_TAG_LENGTH = 16; // 128-bit auth tag

/**
 * Encrypt plaintext using AES-256-GCM.
 *
 * Returns a string in the format: iv:authTag:ciphertext (all hex-encoded).
 *
 * @param plaintext - The string to encrypt
 * @param keyHex - 64-char hex string (32 bytes) encryption key
 */
export function encrypt(plaintext: string, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== 32) {
    throw new Error('Encryption key must be 32 bytes (64 hex characters)');
  }

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt ciphertext produced by encrypt().
 *
 * @param encryptedData - String in format iv:authTag:ciphertext (hex-encoded)
 * @param keyHex - 64-char hex string (32 bytes) encryption key
 */
export function decrypt(encryptedData: string, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== 32) {
    throw new Error('Encryption key must be 32 bytes (64 hex characters)');
  }

  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format. Expected iv:authTag:ciphertext');
  }

  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const ciphertext = parts[2];

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Check if a value looks like it's already encrypted (iv:authTag:ciphertext format).
 */
export function isEncrypted(value: string): boolean {
  const parts = value.split(':');
  if (parts.length !== 3) return false;
  // IV should be 24 hex chars (12 bytes), authTag 32 hex chars (16 bytes)
  return parts[0].length === 24 && parts[1].length === 32 && /^[0-9a-f]+$/.test(parts[0]);
}
