/**
 * NOSTR Backup Encryption Service
 * US-322: Secure backup and recovery - Encryption Service
 *
 * Features:
 * - AES-256-GCM encryption
 * - PBKDF2 key derivation (100,000 iterations)
 * - Password strength validation
 * - Zero-knowledge architecture
 */

import {
  type EncryptionMetadata,
  type EncryptedBackup,
  EncryptedBackupSchema,
  type PasswordStrength,
} from './types/backup';

/**
 * Encryption Configuration Constants
 */
const ENCRYPTION_CONFIG = {
  ALGORITHM: 'AES-GCM' as const,
  KEY_LENGTH: 256,
  IV_LENGTH: 12, // 96 bits for GCM
  SALT_LENGTH: 32, // 256 bits
  TAG_LENGTH: 16, // 128 bits
  PBKDF2_ITERATIONS: 100000, // OWASP recommendation
  HASH_ALGORITHM: 'SHA-256' as const,
  VERSION: '1.0.0',
} as const;

/**
 * Password validation constants
 */
const PASSWORD_CONFIG = {
  MIN_LENGTH: 12,
  MIN_ENTROPY_BITS: 50,
  REQUIRED_SCORE: 60, // out of 100
} as const;

/**
 * Backup Encryption Service
 */
export class BackupEncryptionService {
  /**
   * Encrypt backup data with password
   */
  async encryptBackup(data: string, password: string): Promise<EncryptedBackup> {
    if (!data) {
      throw new Error('Cannot encrypt empty backup data');
    }

    // Validate password strength
    const strength = this.validatePasswordStrength(password);
    if (!strength.valid) {
      throw new Error(`Password too weak. Requirements: ${strength.feedback.join(', ')}`);
    }

    try {
      // Generate salt
      const salt = crypto.getRandomValues(new Uint8Array(ENCRYPTION_CONFIG.SALT_LENGTH));

      // Derive encryption key from password
      const cryptoKey = await this.deriveKey(password, salt);

      // Generate IV
      const iv = crypto.getRandomValues(new Uint8Array(ENCRYPTION_CONFIG.IV_LENGTH));

      // Encrypt data
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(data);

      const encryptedBuffer = await crypto.subtle.encrypt(
        {
          name: ENCRYPTION_CONFIG.ALGORITHM,
          iv,
        },
        cryptoKey,
        dataBuffer
      );

      // Extract auth tag (last 16 bytes)
      const encryptedArray = new Uint8Array(encryptedBuffer);
      const ciphertext = encryptedArray.slice(0, -ENCRYPTION_CONFIG.TAG_LENGTH);
      const authTag = encryptedArray.slice(-ENCRYPTION_CONFIG.TAG_LENGTH);

      // Create encrypted backup object
      const encryptedBackup: EncryptedBackup = {
        encryptedData: this.arrayBufferToBase64(ciphertext),
        salt: this.arrayBufferToBase64(salt),
        iv: this.arrayBufferToBase64(iv),
        authTag: this.arrayBufferToBase64(authTag),
        encryption: this.getEncryptionMetadata(),
      };

      return EncryptedBackupSchema.parse(encryptedBackup);
    } catch (error) {
      throw new Error(
        `Backup encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Decrypt backup data with password
   */
  async decryptBackup(encryptedBackup: EncryptedBackup, password: string): Promise<string> {
    try {
      // Validate encrypted backup structure
      const validated = EncryptedBackupSchema.parse(encryptedBackup);

      // Convert base64 back to Uint8Array buffers.
      // crypto.subtle requires TypedArray/Uint8Array for salt/iv, not plain ArrayBuffer.
      const salt = new Uint8Array(this.base64ToArrayBuffer(validated.salt));
      const iv = new Uint8Array(this.base64ToArrayBuffer(validated.iv));
      const ciphertext = this.base64ToArrayBuffer(validated.encryptedData);
      const authTag = this.base64ToArrayBuffer(validated.authTag);

      // Derive decryption key
      const cryptoKey = await this.deriveKey(password, salt);

      // Combine ciphertext and auth tag
      const encryptedData = new Uint8Array(ciphertext.byteLength + authTag.byteLength);
      encryptedData.set(new Uint8Array(ciphertext), 0);
      encryptedData.set(new Uint8Array(authTag), ciphertext.byteLength);

      // Decrypt data
      const decryptedBuffer = await crypto.subtle.decrypt(
        {
          name: ENCRYPTION_CONFIG.ALGORITHM,
          iv,
        },
        cryptoKey,
        encryptedData
      );

      // Convert buffer to string
      const decoder = new TextDecoder();
      return decoder.decode(decryptedBuffer);
    } catch (error) {
      if (error instanceof Error && error.name === 'OperationError') {
        throw new Error('Decryption failed: Invalid password or corrupted backup');
      }
      throw new Error(
        `Backup decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Derive encryption key from password using PBKDF2
   */
  private async deriveKey(password: string, salt: Uint8Array | ArrayBuffer): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);

    // Import password as key material
    const keyMaterial = await crypto.subtle.importKey('raw', passwordBuffer, 'PBKDF2', false, [
      'deriveBits',
      'deriveKey',
    ]);

    // Derive key using PBKDF2
    return await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: ENCRYPTION_CONFIG.PBKDF2_ITERATIONS,
        hash: ENCRYPTION_CONFIG.HASH_ALGORITHM,
      },
      keyMaterial,
      {
        name: ENCRYPTION_CONFIG.ALGORITHM,
        length: ENCRYPTION_CONFIG.KEY_LENGTH,
      },
      false, // not extractable
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Validate password strength
   */
  validatePasswordStrength(password: string): PasswordStrength {
    const requirements = {
      minLength: password.length >= PASSWORD_CONFIG.MIN_LENGTH,
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      hasSpecial: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password),
    };

    const feedback: string[] = [];
    let score = 0;

    // Check requirements
    if (!requirements.minLength) {
      feedback.push(`At least ${PASSWORD_CONFIG.MIN_LENGTH} characters`);
    } else {
      score += 20;
    }

    if (!requirements.hasUppercase) {
      feedback.push('At least one uppercase letter');
    } else {
      score += 15;
    }

    if (!requirements.hasLowercase) {
      feedback.push('At least one lowercase letter');
    } else {
      score += 15;
    }

    if (!requirements.hasNumber) {
      feedback.push('At least one number');
    } else {
      score += 15;
    }

    if (!requirements.hasSpecial) {
      feedback.push('At least one special character');
    } else {
      score += 20;
    }

    // Calculate entropy
    const entropy = this.calculatePasswordEntropy(password);
    if (entropy < PASSWORD_CONFIG.MIN_ENTROPY_BITS) {
      feedback.push(`Increase password complexity (entropy: ${entropy.toFixed(1)} bits)`);
    } else {
      score += 15;
    }

    const valid = score >= PASSWORD_CONFIG.REQUIRED_SCORE;

    return {
      score,
      valid,
      requirements,
      entropy,
      feedback,
    };
  }

  /**
   * Calculate password entropy
   */
  private calculatePasswordEntropy(password: string): number {
    let characterSpace = 0;

    if (/[a-z]/.test(password)) characterSpace += 26;
    if (/[A-Z]/.test(password)) characterSpace += 26;
    if (/[0-9]/.test(password)) characterSpace += 10;
    if (/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) characterSpace += 32;

    // Entropy = log2(characterSpace^length)
    return Math.log2(Math.pow(characterSpace, password.length));
  }

  /**
   * Get encryption metadata
   */
  private getEncryptionMetadata(): EncryptionMetadata {
    return {
      algorithm: 'AES-256-GCM',
      keyDerivation: 'PBKDF2',
      iterations: ENCRYPTION_CONFIG.PBKDF2_ITERATIONS,
      saltLength: ENCRYPTION_CONFIG.SALT_LENGTH,
      ivLength: ENCRYPTION_CONFIG.IV_LENGTH,
      tagLength: ENCRYPTION_CONFIG.TAG_LENGTH,
      version: ENCRYPTION_CONFIG.VERSION,
    };
  }

  /**
   * Generate a strong random password
   */
  generateSecurePassword(length: number = 16): string {
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const special = '!@#$%^&*()_+-=[]{}|;:,.<>?';

    const allChars = lowercase + uppercase + numbers + special;
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);

    let password = '';

    // Ensure at least one of each type
    password += lowercase[array[0] % lowercase.length];
    password += uppercase[array[1] % uppercase.length];
    password += numbers[array[2] % numbers.length];
    password += special[array[3] % special.length];

    // Fill the rest
    for (let i = 4; i < length; i++) {
      password += allChars[array[i] % allChars.length];
    }

    // Fisher-Yates shuffle with crypto.getRandomValues()
    const chars = password.split('');
    const shuffleBytes = new Uint32Array(chars.length);
    crypto.getRandomValues(shuffleBytes);
    for (let i = chars.length - 1; i > 0; i--) {
      const j = shuffleBytes[i] % (i + 1);
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join('');
  }

  /**
   * Hash data (for checksums)
   */
  async hashData(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    return this.arrayBufferToHex(hashBuffer);
  }

  /**
   * Verify data against checksum
   */
  async verifyChecksum(data: string, expectedChecksum: string): Promise<boolean> {
    const actualChecksum = await this.hashData(data);
    return actualChecksum === expectedChecksum;
  }

  // ========== Helper Methods ==========

  /**
   * Convert ArrayBuffer to base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Convert base64 to ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Convert ArrayBuffer to hex string
   */
  private arrayBufferToHex(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
}

// Export singleton instance
export const backupEncryptionService = new BackupEncryptionService();
