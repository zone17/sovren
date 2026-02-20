/**
 * Secrets Service Unit Tests
 * Comprehensive test coverage for AWS Secrets Manager integration
 *
 * @jest-environment node
 */

import { SecretsService, SecretError, SecretErrorType, resetSecretsService } from '../SecretsService';
import { SecretsConfig } from '../../config/secrets.config';
import {
  SecretsManagerClient,
  GetSecretValueCommand,
  ResourceNotFoundException,
  InvalidRequestException,
} from '@aws-sdk/client-secrets-manager';

// Mock AWS SDK
vi.mock('@aws-sdk/client-secrets-manager', () => {
  return {
    SecretsManagerClient: vi.fn().mockImplementation(() => ({
      send: vi.fn(),
    })),
    GetSecretValueCommand: vi.fn().mockImplementation((input) => ({ input })),
    ResourceNotFoundException: class ResourceNotFoundException extends Error {
      constructor(opts: any) {
        super(opts.message);
        this.name = 'ResourceNotFoundException';
        Object.assign(this, opts);
      }
    },
    InvalidRequestException: class InvalidRequestException extends Error {
      constructor(opts: any) {
        super(opts.message);
        this.name = 'InvalidRequestException';
        Object.assign(this, opts);
      }
    },
    InvalidParameterException: class InvalidParameterException extends Error {
      constructor(opts: any) {
        super(opts.message);
        this.name = 'InvalidParameterException';
        Object.assign(this, opts);
      }
    },
  };
});

const MockedSecretsManagerClient = vi.mocked(SecretsManagerClient);

describe('SecretsService', () => {
  let secretsService: SecretsService;
  let mockSend: any;

  const mockConfig: Partial<SecretsConfig> = {
    awsRegion: 'us-east-1',
    environment: 'test',
    cacheTtlSeconds: 60,
    useAwsSecrets: false, // Default to false for most tests
    secrets: [
      {
        envVar: 'TEST_SECRET',
        secretName: 'sovren/test/secret',
        required: true,
        description: 'Test secret',
      },
      {
        envVar: 'OPTIONAL_SECRET',
        secretName: 'sovren/test/optional',
        required: false,
        description: 'Optional secret',
      },
      {
        envVar: 'JSON_SECRET',
        secretName: 'sovren/test/json-secret',
        jsonKey: 'nested.value',
        required: false,
        description: 'JSON secret with nested key',
      },
    ],
    retry: {
      maxAttempts: 3,
      baseDelay: 100,
      maxDelay: 1000,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    resetSecretsService();

    // Setup mock send function
    mockSend = vi.fn();
    MockedSecretsManagerClient.mockImplementation(() => ({
      send: mockSend,
    }));

    secretsService = new SecretsService(mockConfig);
  });

  afterEach(async () => {
    await secretsService.shutdown();
    delete process.env.TEST_SECRET;
    delete process.env.OPTIONAL_SECRET;
    delete process.env.JSON_SECRET;
  });

  describe('Initialization', () => {
    it('should initialize without AWS client when useAwsSecrets is false', async () => {
      await secretsService.initialize();

      expect(secretsService.isUsingAWS()).toBe(false);
      expect(MockedSecretsManagerClient).not.toHaveBeenCalled();
    });

    it('should initialize with AWS client when useAwsSecrets is true', async () => {
      const awsService = new SecretsService({
        ...mockConfig,
        useAwsSecrets: true,
      });

      await awsService.initialize();

      expect(awsService.isUsingAWS()).toBe(true);
      expect(MockedSecretsManagerClient).toHaveBeenCalledWith({
        region: 'us-east-1',
        maxAttempts: 3,
      });

      await awsService.shutdown();
    });

    it('should only initialize once', async () => {
      await secretsService.initialize();
      await secretsService.initialize();
      await secretsService.initialize();

      // Should only create client once
      expect(MockedSecretsManagerClient).toHaveBeenCalledTimes(0); // Not called since useAwsSecrets is false
    });

    it('should throw error if getSecret called before initialize', async () => {
      await expect(secretsService.getSecret('TEST_SECRET')).rejects.toThrow(
        'SecretsService not initialized',
      );
    });
  });

  describe('Environment Variable Fallback', () => {
    beforeEach(async () => {
      await secretsService.initialize();
    });

    it('should load secret from environment variable', async () => {
      process.env.TEST_SECRET = 'env-secret-value';

      const value = await secretsService.getSecret('TEST_SECRET');

      expect(value).toBe('env-secret-value');
      expect(mockSend).not.toHaveBeenCalled();
    });

    it('should return empty string for missing optional secret', async () => {
      const value = await secretsService.getSecret('OPTIONAL_SECRET');

      expect(value).toBe('');
    });

    it('should track envFallbacks in stats', async () => {
      process.env.TEST_SECRET = 'env-value';

      await secretsService.getSecret('TEST_SECRET');

      const stats = secretsService.getStats();
      expect(stats.envFallbacks).toBe(1);
    });
  });

  describe('Caching', () => {
    beforeEach(async () => {
      await secretsService.initialize();
      process.env.TEST_SECRET = 'cached-value';
    });

    it('should cache secret values', async () => {
      const value1 = await secretsService.getSecret('TEST_SECRET');
      const value2 = await secretsService.getSecret('TEST_SECRET');

      expect(value1).toBe('cached-value');
      expect(value2).toBe('cached-value');

      const stats = secretsService.getStats();
      expect(stats.cacheMisses).toBe(1);
      expect(stats.cacheHits).toBe(1);
    });

    it('should expire cached secrets after TTL', async () => {
      // Create service with 1-second TTL
      const shortTtlService = new SecretsService({
        ...mockConfig,
        cacheTtlSeconds: 1,
      });

      await shortTtlService.initialize();

      process.env.TEST_SECRET = 'initial-value';
      const value1 = await shortTtlService.getSecret('TEST_SECRET');

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 1100));

      process.env.TEST_SECRET = 'updated-value';
      const value2 = await shortTtlService.getSecret('TEST_SECRET');

      expect(value1).toBe('initial-value');
      expect(value2).toBe('updated-value');

      await shortTtlService.shutdown();
    });

    it('should clear cache on clearCache()', async () => {
      process.env.TEST_SECRET = 'value1';
      await secretsService.getSecret('TEST_SECRET');

      secretsService.clearCache();

      process.env.TEST_SECRET = 'value2';
      const value = await secretsService.getSecret('TEST_SECRET');

      expect(value).toBe('value2');

      const stats = secretsService.getStats();
      expect(stats.cacheMisses).toBe(2); // Once before clear, once after
    });
  });

  describe('AWS Secrets Manager Integration', () => {
    beforeEach(async () => {
      secretsService = new SecretsService({
        ...mockConfig,
        useAwsSecrets: true,
      });
      await secretsService.initialize();
    });

    it('should load secret from AWS Secrets Manager', async () => {
      mockSend.mockResolvedValueOnce({
        SecretString: 'aws-secret-value',
      });

      const value = await secretsService.getSecret('TEST_SECRET');

      expect(value).toBe('aws-secret-value');
      expect(mockSend).toHaveBeenCalled();
      const callArg = mockSend.mock.calls[0][0];
      expect(callArg.input.SecretId).toBe('sovren/test/secret');

      const stats = secretsService.getStats();
      expect(stats.awsCalls).toBe(1);
    });

    it('should handle binary secrets from AWS', async () => {
      const binarySecret = Buffer.from('binary-secret-value', 'utf-8');

      mockSend.mockResolvedValueOnce({
        SecretBinary: binarySecret,
      });

      const value = await secretsService.getSecret('TEST_SECRET');

      expect(value).toBe('binary-secret-value');
    });

    it('should extract JSON key from AWS secret', async () => {
      const jsonSecret = JSON.stringify({
        nested: {
          value: 'extracted-value',
        },
      });

      mockSend.mockResolvedValueOnce({
        SecretString: jsonSecret,
      });

      const value = await secretsService.getSecret('JSON_SECRET');

      expect(value).toBe('extracted-value');
    });

    it('should throw error if JSON key not found', async () => {
      const awsService = new SecretsService({
        ...mockConfig,
        useAwsSecrets: true,
      });

      mockSend = vi.fn();
      MockedSecretsManagerClient.mockImplementation(() => ({
        send: mockSend,
      }));

      await awsService.initialize();

      mockSend.mockResolvedValueOnce({
        SecretString: JSON.stringify({ wrong: 'structure' }),
      });

      await expect(awsService.getSecret('JSON_SECRET')).rejects.toThrow();

      await awsService.shutdown();
    });

    it('should throw error if secret not found in AWS', async () => {
      const awsService = new SecretsService({
        ...mockConfig,
        useAwsSecrets: true,
      });

      mockSend = vi.fn();
      MockedSecretsManagerClient.mockImplementation(() => ({
        send: mockSend,
      }));

      await awsService.initialize();

      // ResourceNotFoundException already available from import above

      mockSend.mockRejectedValueOnce(
        new ResourceNotFoundException({
          message: 'Secret not found',
          $metadata: {},
        }),
      );

      await expect(awsService.getSecret('TEST_SECRET')).rejects.toThrow();

      await awsService.shutdown();
    });

    it('should throw error on invalid AWS request', async () => {
      const awsService = new SecretsService({
        ...mockConfig,
        useAwsSecrets: true,
      });

      mockSend = vi.fn();
      MockedSecretsManagerClient.mockImplementation(() => ({
        send: mockSend,
      }));

      await awsService.initialize();

      // InvalidRequestException already available from import above

      mockSend.mockRejectedValueOnce(
        new InvalidRequestException({
          message: 'Invalid request',
          $metadata: {},
        }),
      );

      await expect(awsService.getSecret('TEST_SECRET')).rejects.toThrow();

      await awsService.shutdown();
    });

    it('should handle network errors', async () => {
      const awsService = new SecretsService({
        ...mockConfig,
        useAwsSecrets: true,
      });

      mockSend = vi.fn();
      MockedSecretsManagerClient.mockImplementation(() => ({
        send: mockSend,
      }));

      await awsService.initialize();

      const networkError = new Error('Network error');
      networkError.name = 'NetworkingError';

      mockSend.mockRejectedValueOnce(networkError);

      await expect(awsService.getSecret('TEST_SECRET')).rejects.toThrow();

      await awsService.shutdown();
    });

    it('should fallback to env var if AWS fails for non-required secret', async () => {
      mockSend.mockRejectedValueOnce(new Error('AWS error'));
      process.env.OPTIONAL_SECRET = 'fallback-value';

      const value = await secretsService.getSecret('OPTIONAL_SECRET');

      expect(value).toBe('fallback-value');
      expect(secretsService.getStats().envFallbacks).toBe(1);
    });

    it('should throw if AWS fails for required secret in production', async () => {
      const prodService = new SecretsService({
        ...mockConfig,
        environment: 'production',
        useAwsSecrets: true,
      });
      await prodService.initialize();

      mockSend.mockRejectedValueOnce(new Error('AWS error'));

      await expect(prodService.getSecret('TEST_SECRET')).rejects.toThrow();

      await prodService.shutdown();
    });
  });

  describe('Batch Operations', () => {
    beforeEach(async () => {
      await secretsService.initialize();
    });

    it('should get multiple secrets at once', async () => {
      process.env.TEST_SECRET = 'value1';
      process.env.OPTIONAL_SECRET = 'value2';

      const secrets = await secretsService.getSecrets(['TEST_SECRET', 'OPTIONAL_SECRET']);

      expect(secrets).toEqual({
        TEST_SECRET: 'value1',
        OPTIONAL_SECRET: 'value2',
      });
    });

    it('should handle errors in batch operations gracefully', async () => {
      process.env.TEST_SECRET = 'value1';
      // OPTIONAL_SECRET not set

      const secrets = await secretsService.getSecrets(['TEST_SECRET', 'OPTIONAL_SECRET']);

      expect(secrets.TEST_SECRET).toBe('value1');
      expect(secrets.OPTIONAL_SECRET).toBe(''); // Empty string for missing
    });

    it('should refresh all secrets', async () => {
      process.env.TEST_SECRET = 'initial';
      await secretsService.getSecret('TEST_SECRET');

      process.env.TEST_SECRET = 'updated';
      await secretsService.refreshSecrets();

      // Cache should be cleared and reloaded
      const value = await secretsService.getSecret('TEST_SECRET');
      expect(value).toBe('updated');

      const stats = secretsService.getStats();
      expect(stats.lastRefresh).toBeDefined();
    });
  });

  describe('Statistics', () => {
    beforeEach(async () => {
      await secretsService.initialize();
    });

    it('should track cache hits and misses', async () => {
      process.env.TEST_SECRET = 'value';

      await secretsService.getSecret('TEST_SECRET'); // miss
      await secretsService.getSecret('TEST_SECRET'); // hit
      await secretsService.getSecret('TEST_SECRET'); // hit

      const stats = secretsService.getStats();
      expect(stats.cacheHits).toBe(2);
      expect(stats.cacheMisses).toBe(1);
    });

    it('should track errors', async () => {
      const awsService = new SecretsService({
        ...mockConfig,
        environment: 'production',
        useAwsSecrets: true,
      });
      await awsService.initialize();

      mockSend.mockRejectedValueOnce(new Error('AWS error'));

      try {
        await awsService.getSecret('TEST_SECRET');
      } catch (error) {
        // Expected
      }

      const stats = awsService.getStats();
      expect(stats.errors).toBeGreaterThan(0);

      await awsService.shutdown();
    });

    it('should return stats copy, not reference', async () => {
      const stats1 = secretsService.getStats();
      stats1.cacheHits = 999;

      const stats2 = secretsService.getStats();
      expect(stats2.cacheHits).toBe(0); // Not modified
    });
  });

  describe('Shutdown', () => {
    it('should clear cache on shutdown', async () => {
      await secretsService.initialize();
      process.env.TEST_SECRET = 'value';

      await secretsService.getSecret('TEST_SECRET');
      await secretsService.shutdown();

      // Service should not be initialized anymore
      await expect(secretsService.getSecret('TEST_SECRET')).rejects.toThrow(
        'SecretsService not initialized',
      );
    });
  });

  describe('Edge Cases', () => {
    beforeEach(async () => {
      await secretsService.initialize();
    });

    it('should handle empty secret value', async () => {
      process.env.TEST_SECRET = '';

      const value = await secretsService.getSecret('TEST_SECRET');
      expect(value).toBe('');
    });

    it('should handle whitespace-only secret', async () => {
      process.env.TEST_SECRET = '   ';

      const value = await secretsService.getSecret('TEST_SECRET');
      expect(value).toBe('   ');
    });

    it('should handle secrets with special characters', async () => {
      const specialSecret = 'secret!@#$%^&*()_+-={}[]|\\:";\'<>?,./ ';
      process.env.TEST_SECRET = specialSecret;

      const value = await secretsService.getSecret('TEST_SECRET');
      expect(value).toBe(specialSecret);
    });

    it('should handle unmapped environment variables', async () => {
      process.env.UNMAPPED_SECRET = 'value';

      const value = await secretsService.getSecret('UNMAPPED_SECRET');
      expect(value).toBe('value'); // Falls back to env var
    });
  });

  describe('Error Handling', () => {
    it('should throw SecretError with proper type', async () => {
      await secretsService.initialize();

      const awsService = new SecretsService({
        ...mockConfig,
        environment: 'production',
        useAwsSecrets: true,
      });
      await awsService.initialize();

      mockSend.mockRejectedValueOnce(
        new ResourceNotFoundException({
          message: 'Not found',
          $metadata: {},
        }),
      );

      try {
        await awsService.getSecret('TEST_SECRET');
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(SecretError);
        expect((error as SecretError).type).toBe(SecretErrorType.NOT_FOUND);
        expect((error as SecretError).name).toBe('SecretError');
      }

      await awsService.shutdown();
    });

    it('should include original error in SecretError', async () => {
      const awsService = new SecretsService({
        ...mockConfig,
        useAwsSecrets: true,
      });

      // Re-mock for this specific service instance
      mockSend = vi.fn();
      MockedSecretsManagerClient.mockImplementation(() => ({
        send: mockSend,
      }));

      await awsService.initialize();

      const originalError = new Error('Original AWS error');
      mockSend.mockRejectedValueOnce(originalError);

      try {
        await awsService.getSecret('TEST_SECRET');
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(SecretError);
        expect((error as SecretError).originalError).toBeDefined();
      }

      await awsService.shutdown();
    });
  });

  describe('Singleton Pattern', () => {
    it('should provide singleton instance', async () => {
      const { getSecretsService } = await import('../SecretsService');

      const instance1 = await getSecretsService();
      const instance2 = await getSecretsService();

      expect(instance1).toBe(instance2);
    });

    it('should reset singleton', async () => {
      const { getSecretsService, resetSecretsService } = await import('../SecretsService');

      const instance1 = await getSecretsService();
      resetSecretsService();
      const instance2 = await getSecretsService();

      expect(instance1).not.toBe(instance2);
    });
  });
});
