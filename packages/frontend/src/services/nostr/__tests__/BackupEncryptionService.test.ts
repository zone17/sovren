/**
 * Backup Encryption Service Tests
 * US-322: Secure backup and recovery - Encryption Tests
 *
 * Coverage Target: 95%+
 */

import { BackupEncryptionService } from '../BackupEncryptionService';
import type { EncryptedBackup } from '../types/backup';

describe('BackupEncryptionService', () => {
  let service: BackupEncryptionService;

  beforeEach(() => {
    service = new BackupEncryptionService();
  });

  describe('Password Validation', () => {
    it('should validate strong passwords', () => {
      const password = 'MyStr0ng!P@ssword123';
      const result = service.validatePasswordStrength(password);

      expect(result.valid).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(60);
      expect(result.requirements.minLength).toBe(true);
      expect(result.requirements.hasUppercase).toBe(true);
      expect(result.requirements.hasLowercase).toBe(true);
      expect(result.requirements.hasNumber).toBe(true);
      expect(result.requirements.hasSpecial).toBe(true);
      expect(result.feedback).toHaveLength(0);
    });

    it('should reject weak passwords', () => {
      const weakPassword = 'weak';
      const result = service.validatePasswordStrength(weakPassword);

      expect(result.valid).toBe(false);
      expect(result.score).toBeLessThan(60);
      expect(result.feedback.length).toBeGreaterThan(0);
    });

    it('should validate minimum length requirement', () => {
      const shortPassword = 'Short1!';
      const result = service.validatePasswordStrength(shortPassword);

      expect(result.requirements.minLength).toBe(false);
      expect(result.feedback).toContain('At least 12 characters');
    });

    it('should check for uppercase letters', () => {
      const noUppercase = 'nocapitals123!@#';
      const result = service.validatePasswordStrength(noUppercase);

      expect(result.requirements.hasUppercase).toBe(false);
      expect(result.feedback).toContain('At least one uppercase letter');
    });

    it('should check for lowercase letters', () => {
      const noLowercase = 'NOLOWERCASE123!@#';
      const result = service.validatePasswordStrength(noLowercase);

      expect(result.requirements.hasLowercase).toBe(false);
      expect(result.feedback).toContain('At least one lowercase letter');
    });

    it('should check for numbers', () => {
      const noNumbers = 'NoNumbersHere!@#';
      const result = service.validatePasswordStrength(noNumbers);

      expect(result.requirements.hasNumber).toBe(false);
      expect(result.feedback).toContain('At least one number');
    });

    it('should check for special characters', () => {
      const noSpecial = 'NoSpecialChars123';
      const result = service.validatePasswordStrength(noSpecial);

      expect(result.requirements.hasSpecial).toBe(false);
      expect(result.feedback).toContain('At least one special character');
    });

    it('should calculate password entropy', () => {
      const complexPassword = 'C0mpl3x!P@ssw0rd#123';
      const result = service.validatePasswordStrength(complexPassword);

      expect(result.entropy).toBeGreaterThan(50);
    });
  });

  describe('Password Generation', () => {
    it('should generate passwords with correct length', () => {
      const password = service.generateSecurePassword(16);
      expect(password).toHaveLength(16);
    });

    it('should generate passwords with default length', () => {
      const password = service.generateSecurePassword();
      expect(password).toHaveLength(16);
    });

    it('should generate strong passwords', () => {
      const password = service.generateSecurePassword(20);
      const strength = service.validatePasswordStrength(password);

      expect(strength.valid).toBe(true);
      expect(strength.score).toBeGreaterThanOrEqual(80);
    });

    it('should generate unique passwords', () => {
      const password1 = service.generateSecurePassword();
      const password2 = service.generateSecurePassword();

      expect(password1).not.toBe(password2);
    });

    it('should include all character types', () => {
      const password = service.generateSecurePassword(20);

      expect(/[a-z]/.test(password)).toBe(true);
      expect(/[A-Z]/.test(password)).toBe(true);
      expect(/[0-9]/.test(password)).toBe(true);
      expect(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)).toBe(true);
    });
  });

  describe('Encryption/Decryption', () => {
    const testPassword = 'TestP@ssw0rd123!';
    const testData = 'This is sensitive NOSTR backup data';

    it('should encrypt data successfully', async () => {
      const encrypted = await service.encryptBackup(testData, testPassword);

      expect(encrypted).toBeDefined();
      expect(encrypted.encryptedData).toBeDefined();
      expect(encrypted.salt).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.authTag).toBeDefined();
      expect(encrypted.encryption).toBeDefined();
      expect(encrypted.encryption.algorithm).toBe('AES-256-GCM');
      expect(encrypted.encryption.keyDerivation).toBe('PBKDF2');
      expect(encrypted.encryption.iterations).toBeGreaterThanOrEqual(100000);
    });

    it('should decrypt data successfully', async () => {
      const encrypted = await service.encryptBackup(testData, testPassword);
      const decrypted = await service.decryptBackup(encrypted, testPassword);

      expect(decrypted).toBe(testData);
    });

    it('should fail with wrong password', async () => {
      const encrypted = await service.encryptBackup(testData, testPassword);

      await expect(
        service.decryptBackup(encrypted, 'WrongPassword123!')
      ).rejects.toThrow();
    });

    it('should encrypt different data differently', async () => {
      const data1 = 'First backup data';
      const data2 = 'Second backup data';

      const encrypted1 = await service.encryptBackup(data1, testPassword);
      const encrypted2 = await service.encryptBackup(data2, testPassword);

      expect(encrypted1.encryptedData).not.toBe(encrypted2.encryptedData);
    });

    it('should use unique salt for each encryption', async () => {
      const encrypted1 = await service.encryptBackup(testData, testPassword);
      const encrypted2 = await service.encryptBackup(testData, testPassword);

      expect(encrypted1.salt).not.toBe(encrypted2.salt);
    });

    it('should use unique IV for each encryption', async () => {
      const encrypted1 = await service.encryptBackup(testData, testPassword);
      const encrypted2 = await service.encryptBackup(testData, testPassword);

      expect(encrypted1.iv).not.toBe(encrypted2.iv);
    });

    it('should reject weak passwords for encryption', async () => {
      const weakPassword = 'weak';

      await expect(
        service.encryptBackup(testData, weakPassword)
      ).rejects.toThrow('Password too weak');
    });

    it('should reject empty data', async () => {
      await expect(
        service.encryptBackup('', testPassword)
      ).rejects.toThrow('Cannot encrypt empty backup data');
    });

    it('should handle large data', async () => {
      const largeData = 'x'.repeat(1000000); // 1MB
      const encrypted = await service.encryptBackup(largeData, testPassword);
      const decrypted = await service.decryptBackup(encrypted, testPassword);

      expect(decrypted).toBe(largeData);
    });

    it('should handle special characters in data', async () => {
      const specialData = 'Data with émojis 🔐🔑 and spëcial çhars!';
      const encrypted = await service.encryptBackup(specialData, testPassword);
      const decrypted = await service.decryptBackup(encrypted, testPassword);

      expect(decrypted).toBe(specialData);
    });

    it('should handle JSON data', async () => {
      const jsonData = JSON.stringify({
        keys: ['key1', 'key2'],
        events: [{ id: '1', content: 'test' }],
      });

      const encrypted = await service.encryptBackup(jsonData, testPassword);
      const decrypted = await service.decryptBackup(encrypted, testPassword);

      expect(decrypted).toBe(jsonData);
      expect(JSON.parse(decrypted)).toEqual(JSON.parse(jsonData));
    });
  });

  describe('Hashing and Checksums', () => {
    const testData = 'Test data for hashing';

    it('should generate SHA-256 hash', async () => {
      const hash = await service.hashData(testData);

      expect(hash).toBeDefined();
      expect(hash).toHaveLength(64); // SHA-256 hex length
      expect(/^[0-9a-f]{64}$/i.test(hash)).toBe(true);
    });

    it('should generate consistent hashes', async () => {
      const hash1 = await service.hashData(testData);
      const hash2 = await service.hashData(testData);

      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different data', async () => {
      const hash1 = await service.hashData('Data 1');
      const hash2 = await service.hashData('Data 2');

      expect(hash1).not.toBe(hash2);
    });

    it('should verify correct checksum', async () => {
      const hash = await service.hashData(testData);
      const isValid = await service.verifyChecksum(testData, hash);

      expect(isValid).toBe(true);
    });

    it('should reject incorrect checksum', async () => {
      const hash = await service.hashData(testData);
      const isValid = await service.verifyChecksum('Modified data', hash);

      expect(isValid).toBe(false);
    });

    it('should handle empty string hashing', async () => {
      const hash = await service.hashData('');

      expect(hash).toBeDefined();
      expect(hash).toHaveLength(64);
    });
  });

  describe('Security Properties', () => {
    it('should use PBKDF2 with sufficient iterations', async () => {
      const encrypted = await service.encryptBackup('test', 'TestP@ssw0rd123!');

      expect(encrypted.encryption.iterations).toBeGreaterThanOrEqual(100000);
    });

    it('should use AES-256-GCM encryption', async () => {
      const encrypted = await service.encryptBackup('test', 'TestP@ssw0rd123!');

      expect(encrypted.encryption.algorithm).toBe('AES-256-GCM');
    });

    it('should use sufficient salt length', async () => {
      const encrypted = await service.encryptBackup('test', 'TestP@ssw0rd123!');

      expect(encrypted.encryption.saltLength).toBeGreaterThanOrEqual(32);
    });

    it('should include authentication tag', async () => {
      const encrypted = await service.encryptBackup('test', 'TestP@ssw0rd123!');

      expect(encrypted.authTag).toBeDefined();
      expect(encrypted.authTag.length).toBeGreaterThan(0);
    });

    it('should validate encrypted backup structure', async () => {
      const encrypted = await service.encryptBackup('test', 'TestP@ssw0rd123!');

      // Should have all required fields
      expect(encrypted.encryptedData).toBeDefined();
      expect(encrypted.salt).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.authTag).toBeDefined();
      expect(encrypted.encryption).toBeDefined();
      expect(encrypted.encryption.version).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should throw error for invalid encrypted backup structure', async () => {
      const invalidBackup = {
        encryptedData: 'invalid',
        // Missing required fields
      } as any;

      await expect(
        service.decryptBackup(invalidBackup, 'TestP@ssw0rd123!')
      ).rejects.toThrow();
    });

    it('should throw error for corrupted encrypted data', async () => {
      const encrypted = await service.encryptBackup('test', 'TestP@ssw0rd123!');
      encrypted.encryptedData = 'corrupted_data';

      await expect(
        service.decryptBackup(encrypted, 'TestP@ssw0rd123!')
      ).rejects.toThrow();
    });

    it('should throw error for corrupted auth tag', async () => {
      const encrypted = await service.encryptBackup('test', 'TestP@ssw0rd123!');
      encrypted.authTag = 'corrupted_tag';

      await expect(
        service.decryptBackup(encrypted, 'TestP@ssw0rd123!')
      ).rejects.toThrow();
    });
  });
});
