/**
 * Tests for AES-256-GCM Token Encryption
 * EPIC-009: OAuth token encryption at rest
 */

import { encryptToken, decryptToken, getEncryptionKey } from '../crypto';
import { randomBytes } from 'crypto';

describe('Token Encryption (AES-256-GCM)', () => {
  const validKey = randomBytes(32);

  describe('encryptToken', () => {
    it('should encrypt plaintext and return encrypted data with IV and auth tag', () => {
      const plaintext = 'test-oauth-access-token-12345';
      const result = encryptToken(plaintext, validKey);

      expect(result.encrypted).toBeInstanceOf(Buffer);
      expect(result.iv).toBeInstanceOf(Buffer);
      expect(result.authTag).toBeInstanceOf(Buffer);
      expect(result.iv.length).toBe(16); // 128-bit IV
      expect(result.authTag.length).toBe(16); // 128-bit auth tag
      expect(result.encrypted.toString('utf8')).not.toBe(plaintext); // Not plaintext
    });

    it('should produce different ciphertexts for the same plaintext (random IV)', () => {
      const plaintext = 'same-token';
      const result1 = encryptToken(plaintext, validKey);
      const result2 = encryptToken(plaintext, validKey);

      expect(result1.encrypted).not.toEqual(result2.encrypted);
      expect(result1.iv).not.toEqual(result2.iv);
    });

    it('should throw if key is not 32 bytes', () => {
      const shortKey = randomBytes(16);
      expect(() => encryptToken('test', shortKey)).toThrow('Encryption key must be 32 bytes');
    });
  });

  describe('decryptToken', () => {
    it('should decrypt back to the original plaintext', () => {
      const plaintext = 'my-secret-access-token-xyz';
      const { encrypted, iv, authTag } = encryptToken(plaintext, validKey);

      const decrypted = decryptToken(encrypted, validKey, iv, authTag);
      expect(decrypted).toBe(plaintext);
    });

    it('should handle long tokens', () => {
      const longToken = 'a'.repeat(2048);
      const { encrypted, iv, authTag } = encryptToken(longToken, validKey);

      const decrypted = decryptToken(encrypted, validKey, iv, authTag);
      expect(decrypted).toBe(longToken);
    });

    it('should handle unicode tokens', () => {
      const unicodeToken = 'token-with-unicode-\u00e9\u00e8\u00ea';
      const { encrypted, iv, authTag } = encryptToken(unicodeToken, validKey);

      const decrypted = decryptToken(encrypted, validKey, iv, authTag);
      expect(decrypted).toBe(unicodeToken);
    });

    it('should fail with wrong key', () => {
      const plaintext = 'secret-token';
      const { encrypted, iv, authTag } = encryptToken(plaintext, validKey);
      const wrongKey = randomBytes(32);

      expect(() => decryptToken(encrypted, wrongKey, iv, authTag)).toThrow();
    });

    it('should fail with tampered ciphertext (integrity check)', () => {
      const plaintext = 'secret-token';
      const { encrypted, iv, authTag } = encryptToken(plaintext, validKey);

      // Tamper with ciphertext
      const tampered = Buffer.from(encrypted);
      tampered[0] = tampered[0] ^ 0xff;

      expect(() => decryptToken(tampered, validKey, iv, authTag)).toThrow();
    });

    it('should fail with tampered auth tag', () => {
      const plaintext = 'secret-token';
      const { encrypted, iv, authTag } = encryptToken(plaintext, validKey);

      const tamperedTag = Buffer.from(authTag);
      tamperedTag[0] = tamperedTag[0] ^ 0xff;

      expect(() => decryptToken(encrypted, validKey, iv, tamperedTag)).toThrow();
    });

    it('should throw if key is not 32 bytes', () => {
      const shortKey = randomBytes(16);
      const { encrypted, iv, authTag } = encryptToken('test', validKey);
      expect(() => decryptToken(encrypted, shortKey, iv, authTag)).toThrow('Encryption key must be 32 bytes');
    });
  });

  describe('getEncryptionKey', () => {
    const originalEnv = process.env.PLATFORM_TOKEN_ENCRYPTION_KEY;

    afterEach(() => {
      if (originalEnv !== undefined) {
        process.env.PLATFORM_TOKEN_ENCRYPTION_KEY = originalEnv;
      } else {
        delete process.env.PLATFORM_TOKEN_ENCRYPTION_KEY;
      }
    });

    it('should return a 32-byte Buffer from a valid 64-char hex string', () => {
      process.env.PLATFORM_TOKEN_ENCRYPTION_KEY = 'a'.repeat(64);
      const key = getEncryptionKey();
      expect(key).toBeInstanceOf(Buffer);
      expect(key.length).toBe(32);
    });

    it('should throw if env var is not set', () => {
      delete process.env.PLATFORM_TOKEN_ENCRYPTION_KEY;
      expect(() => getEncryptionKey()).toThrow('PLATFORM_TOKEN_ENCRYPTION_KEY environment variable is required');
    });

    it('should throw if env var is wrong length', () => {
      process.env.PLATFORM_TOKEN_ENCRYPTION_KEY = 'abc123';
      expect(() => getEncryptionKey()).toThrow('64-character hex string');
    });
  });
});
