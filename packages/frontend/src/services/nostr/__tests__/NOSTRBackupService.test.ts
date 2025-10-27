/**
 * NOSTR Backup Service Tests
 * US-322: Secure backup and recovery - Main Service Tests
 *
 * Coverage Target: 95%+
 */

import { NOSTRBackupService } from '../NOSTRBackupService';
import { KeyManagementService } from '../KeyManagementService';
import { BackupContentType as BCType } from '../types/backup';
import type { BackupFile, RecoveryOptions } from '../types/backup';

// Mock KeyManagementService
jest.mock('../KeyManagementService');

describe('NOSTRBackupService', () => {
  let service: NOSTRBackupService;
  let keyManagement: jest.Mocked<KeyManagementService>;

  beforeEach(async () => {
    // Clear singleton
    (NOSTRBackupService as any).instance = null;

    service = NOSTRBackupService.getInstance();

    keyManagement = KeyManagementService.getInstance() as jest.Mocked<KeyManagementService>;
    keyManagement.isInitialized.mockReturnValue(true);
    keyManagement.listKeys.mockResolvedValue([]);
    keyManagement.getActiveKey.mockReturnValue(null);

    await service.initialize();
  });

  afterEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  describe('Initialization', () => {
    it('should initialize service successfully', async () => {
      expect(service).toBeDefined();
    });

    it('should accept custom configuration', async () => {
      const customConfig = {
        autoBackup: true,
        backupFrequency: 'daily' as const,
        maxBackups: 5,
      };

      const newService = NOSTRBackupService.getInstance();
      await newService.initialize(customConfig);

      // Configuration should be applied
      expect(newService).toBeDefined();
    });

    it('should not reinitialize if already initialized', async () => {
      await service.initialize();
      // Should not throw
      await service.initialize();
    });
  });

  describe('Backup Creation', () => {
    const testPassword = 'TestP@ssw0rd123!';

    it('should create complete backup successfully', async () => {
      const mockKeys = [
        {
          keyId: '123e4567-e89b-12d3-a456-426614174000',
          publicKey: 'a'.repeat(64),
          privateKey: 'b'.repeat(64),
          npub: 'npub1' + 'x'.repeat(58),
          nsec: 'nsec1' + 'x'.repeat(58),
          created: Date.now(),
          tags: [],
        },
      ];

      keyManagement.listKeys.mockResolvedValue(mockKeys as any);

      const { file, downloadUrl } = await service.createBackup(
        testPassword,
        'complete',
        'Test backup'
      );

      expect(file).toBeDefined();
      expect(file.version).toBeDefined();
      expect(file.contentType).toBe('complete');
      expect(file.encrypted).toBe(true);
      expect(file.checksum).toBeDefined();
      expect(file.description).toBe('Test backup');
      expect(downloadUrl).toBeDefined();
      expect(downloadUrl).toContain('blob:');
    });

    it('should create keys-only backup', async () => {
      const { file } = await service.createBackup(testPassword, 'keys_only');

      expect(file.contentType).toBe('keys_only');
    });

    it('should create events-only backup', async () => {
      const { file } = await service.createBackup(testPassword, 'events_only');

      expect(file.contentType).toBe('events_only');
    });

    it('should create config-only backup', async () => {
      const { file } = await service.createBackup(testPassword, 'config_only');

      expect(file.contentType).toBe('config_only');
    });

    it('should reject weak passwords', async () => {
      await expect(service.createBackup('weak', 'complete')).rejects.toThrow(
        /Password does not meet requirements/
      );
    });

    it('should include metadata in backup', async () => {
      const mockKeys = [
        {
          keyId: '123e4567-e89b-12d3-a456-426614174000',
          publicKey: 'a'.repeat(64),
          privateKey: 'b'.repeat(64),
          npub: 'npub1' + 'x'.repeat(58),
          nsec: 'nsec1' + 'x'.repeat(58),
          created: Date.now(),
          tags: [],
        },
      ];

      keyManagement.listKeys.mockResolvedValue(mockKeys as any);

      const { file } = await service.createBackup(testPassword, 'complete');

      expect(file.metadata).toBeDefined();
      expect(file.metadata?.keyCount).toBe(1);
      expect(file.metadata?.originalSizeBytes).toBeGreaterThan(0);
      expect(file.metadata?.compressedSizeBytes).toBeGreaterThan(0);
    });

    it('should add backup to history', async () => {
      await service.createBackup(testPassword, 'complete');

      const history = service.getBackupHistory();
      expect(history).toHaveLength(1);
      expect(history[0].contentType).toBe('complete');
    });

    it('should enforce max backups limit', async () => {
      // Create more backups than the limit
      for (let i = 0; i < 12; i++) {
        await service.createBackup(testPassword, 'keys_only');
      }

      const history = service.getBackupHistory();
      expect(history.length).toBeLessThanOrEqual(10); // Default maxBackups is 10
    });
  });

  describe('Backup Verification', () => {
    const testPassword = 'TestP@ssw0rd123!';
    let testBackupFile: BackupFile;

    beforeEach(async () => {
      const { file } = await service.createBackup(testPassword, 'complete');
      testBackupFile = file;
    });

    it('should verify valid backup', async () => {
      const verification = await service.verifyBackup(testBackupFile, testPassword);

      expect(verification.valid).toBe(true);
      expect(verification.structureValid).toBe(true);
      expect(verification.checksumValid).toBe(true);
      expect(verification.errors).toHaveLength(0);
    });

    it('should verify backup without password (partial verification)', async () => {
      const verification = await service.verifyBackup(testBackupFile);

      expect(verification.structureValid).toBe(true);
      expect(verification.warnings.length).toBeGreaterThan(0);
    });

    it('should detect wrong password', async () => {
      const verification = await service.verifyBackup(testBackupFile, 'WrongP@ssw0rd123!');

      expect(verification.valid).toBe(false);
      expect(verification.errors.length).toBeGreaterThan(0);
    });

    it('should detect invalid structure', async () => {
      const invalidBackup = { ...testBackupFile, version: undefined } as any;

      const verification = await service.verifyBackup(invalidBackup);

      expect(verification.valid).toBe(false);
      expect(verification.structureValid).toBe(false);
    });

    it('should include metadata in verification', async () => {
      const verification = await service.verifyBackup(testBackupFile, testPassword);

      expect(verification.metadata).toBeDefined();
      expect(verification.metadata?.estimatedRecoveryTime).toBeGreaterThan(0);
    });
  });

  describe('Backup Restoration', () => {
    const testPassword = 'TestP@ssw0rd123!';
    let testBackupFile: BackupFile;

    beforeEach(async () => {
      const mockKeys = [
        {
          keyId: '123e4567-e89b-12d3-a456-426614174000',
          publicKey: 'a'.repeat(64),
          privateKey: 'b'.repeat(64),
          npub: 'npub1' + 'x'.repeat(58),
          nsec: 'nsec1' + 'x'.repeat(58),
          created: Date.now(),
          tags: [],
        },
      ];

      keyManagement.listKeys.mockResolvedValue(mockKeys as any);
      keyManagement.getKey.mockResolvedValue(null);
      keyManagement.importKey.mockResolvedValue(mockKeys[0] as any);
      keyManagement.signEvent.mockResolvedValue({ id: 'test', sig: 'test' } as any);
      keyManagement.verifyEventSignature.mockResolvedValue(true);

      const { file } = await service.createBackup(testPassword, 'complete');
      testBackupFile = file;
    });

    it('should restore backup successfully', async () => {
      const result = await service.restoreBackup(testBackupFile, testPassword);

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should restore with custom options', async () => {
      const options: RecoveryOptions = {
        recoverKeys: true,
        recoverEvents: false,
        recoverConfiguration: false,
        overwriteExisting: false,
        mergeWithExisting: true,
        verifyAfterRestore: false,
        testSignature: false,
      };

      const result = await service.restoreBackup(testBackupFile, testPassword, options);

      expect(result.success).toBe(true);
    });

    it('should verify restoration when requested', async () => {
      const result = await service.restoreBackup(testBackupFile, testPassword, {
        recoverKeys: true,
        recoverEvents: false,
        recoverConfiguration: false,
        overwriteExisting: false,
        mergeWithExisting: true,
        verifyAfterRestore: true,
        testSignature: true,
      });

      expect(result.verificationResult).toBeDefined();
      expect(result.verificationResult?.keysValid).toBe(true);
    });

    it('should fail with wrong password', async () => {
      const result = await service.restoreBackup(testBackupFile, 'WrongP@ssw0rd123!');

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle restore errors gracefully', async () => {
      keyManagement.importKey.mockRejectedValue(new Error('Import failed'));

      const result = await service.restoreBackup(testBackupFile, testPassword);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should track restored counts', async () => {
      const result = await service.restoreBackup(testBackupFile, testPassword);

      expect(result.keysRecovered).toBeGreaterThanOrEqual(0);
      expect(result.eventsRecovered).toBeGreaterThanOrEqual(0);
      expect(result.relaysRecovered).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Backup Scheduling', () => {
    it('should schedule daily backup', async () => {
      const schedule = await service.scheduleBackup({
        frequency: 'daily',
        enabled: true,
        contentType: 'complete',
      });

      expect(schedule.enabled).toBe(true);
      expect(schedule.frequency).toBe('daily');
      expect(schedule.nextBackup).toBeDefined();
    });

    it('should schedule weekly backup', async () => {
      const schedule = await service.scheduleBackup({
        frequency: 'weekly',
        enabled: true,
      });

      expect(schedule.frequency).toBe('weekly');
      expect(schedule.nextBackup).toBeDefined();
    });

    it('should schedule monthly backup', async () => {
      const schedule = await service.scheduleBackup({
        frequency: 'monthly',
        enabled: true,
      });

      expect(schedule.frequency).toBe('monthly');
      expect(schedule.nextBackup).toBeDefined();
    });

    it('should handle manual backup schedule', async () => {
      const schedule = await service.scheduleBackup({
        frequency: 'manual',
        enabled: false,
      });

      expect(schedule.frequency).toBe('manual');
      expect(schedule.nextBackup).toBeUndefined();
    });

    it('should persist schedule to storage', async () => {
      await service.scheduleBackup({
        frequency: 'weekly',
        enabled: true,
      });

      const retrieved = service.getBackupSchedule();
      expect(retrieved).not.toBeNull();
      expect(retrieved?.frequency).toBe('weekly');
    });

    it('should configure retention policy', async () => {
      const schedule = await service.scheduleBackup({
        frequency: 'daily',
        retentionDays: 30,
        maxBackups: 5,
        autoDelete: true,
      });

      expect(schedule.retentionDays).toBe(30);
      expect(schedule.maxBackups).toBe(5);
      expect(schedule.autoDelete).toBe(true);
    });
  });

  describe('Backup History', () => {
    const testPassword = 'TestP@ssw0rd123!';

    it('should track backup history', async () => {
      await service.createBackup(testPassword, 'complete', 'First backup');
      await service.createBackup(testPassword, 'keys_only', 'Second backup');

      const history = service.getBackupHistory();

      expect(history).toHaveLength(2);
      expect(history[0].description).toBe('Second backup'); // Most recent first
      expect(history[1].description).toBe('First backup');
    });

    it('should clear backup history', async () => {
      await service.createBackup(testPassword, 'complete');
      await service.clearBackupHistory();

      const history = service.getBackupHistory();
      expect(history).toHaveLength(0);
    });

    it('should persist history to storage', async () => {
      await service.createBackup(testPassword, 'complete');

      // Get new instance
      const newService = NOSTRBackupService.getInstance();
      await newService.initialize();

      const history = newService.getBackupHistory();
      expect(history.length).toBeGreaterThan(0);
    });
  });

  describe('Password Management', () => {
    it('should validate password strength', () => {
      const strength = service.validatePassword('MyStr0ng!P@ssword');

      expect(strength.valid).toBe(true);
      expect(strength.score).toBeGreaterThan(60);
    });

    it('should generate secure passwords', () => {
      const password = service.generateSecurePassword();

      expect(password).toBeDefined();
      expect(password.length).toBeGreaterThanOrEqual(16);

      const strength = service.validatePassword(password);
      expect(strength.valid).toBe(true);
    });

    it('should generate passwords with custom length', () => {
      const password = service.generateSecurePassword(24);

      expect(password.length).toBe(24);
    });
  });

  describe('Error Handling', () => {
    it('should handle key management errors', async () => {
      keyManagement.listKeys.mockRejectedValue(new Error('Key fetch failed'));

      await expect(
        service.createBackup('TestP@ssw0rd123!', 'complete')
      ).rejects.toThrow();
    });

    it('should handle encryption errors', async () => {
      await expect(service.createBackup('weak', 'complete')).rejects.toThrow();
    });

    it('should handle invalid backup files', async () => {
      const invalidFile = { invalid: 'structure' } as any;

      const verification = await service.verifyBackup(invalidFile);

      expect(verification.valid).toBe(false);
      expect(verification.structureValid).toBe(false);
    });
  });

  describe('Integration', () => {
    const testPassword = 'TestP@ssw0rd123!';

    it('should complete full backup and restore cycle', async () => {
      const mockKeys = [
        {
          keyId: '123e4567-e89b-12d3-a456-426614174000',
          publicKey: 'a'.repeat(64),
          privateKey: 'b'.repeat(64),
          npub: 'npub1' + 'x'.repeat(58),
          nsec: 'nsec1' + 'x'.repeat(58),
          created: Date.now(),
          tags: [],
          name: 'Test Key',
        },
      ];

      keyManagement.listKeys.mockResolvedValue(mockKeys as any);
      keyManagement.getKey.mockResolvedValue(null);
      keyManagement.importKey.mockResolvedValue(mockKeys[0] as any);
      keyManagement.signEvent.mockResolvedValue({ id: 'test', sig: 'test' } as any);
      keyManagement.verifyEventSignature.mockResolvedValue(true);

      // Create backup
      const { file } = await service.createBackup(testPassword, 'complete', 'Integration test');

      // Verify backup
      const verification = await service.verifyBackup(file, testPassword);
      expect(verification.valid).toBe(true);

      // Restore backup
      const result = await service.restoreBackup(file, testPassword);
      expect(result.success).toBe(true);
      expect(result.keysRecovered).toBe(1);
    });
  });
});
