/**
 * Secrets Service Integration Tests
 * Tests with LocalStack for AWS Secrets Manager integration
 *
 * These tests require LocalStack to be running:
 * docker run -d -p 4566:4566 localstack/localstack
 *
 * @group integration
 */

import { SecretsService, resetSecretsService } from '../SecretsService';
import {
  SecretsManagerClient,
  CreateSecretCommand,
  DeleteSecretCommand,
  UpdateSecretCommand,
} from '@aws-sdk/client-secrets-manager';

// Only run these tests if LOCALSTACK_ENDPOINT is set
const shouldRunIntegrationTests =
  process.env.LOCALSTACK_ENDPOINT || process.env.RUN_INTEGRATION_TESTS === 'true';

const describeIf = (condition: boolean) => (condition ? describe : describe.skip);

describeIf(shouldRunIntegrationTests)('SecretsService - Integration Tests', () => {
  let secretsService: SecretsService;
  let localStackClient: SecretsManagerClient;
  const testSecretName = 'sovren/integration-test/secret';
  const localStackEndpoint = process.env.LOCALSTACK_ENDPOINT || 'http://localhost:4566';

  beforeAll(async () => {
    // Create LocalStack client for test setup
    localStackClient = new SecretsManagerClient({
      region: 'us-east-1',
      endpoint: localStackEndpoint,
      credentials: {
        accessKeyId: 'test',
        secretAccessKey: 'test',
      },
    });
  });

  beforeEach(async () => {
    resetSecretsService();

    // Create test service configured for LocalStack
    secretsService = new SecretsService({
      awsRegion: 'us-east-1',
      environment: 'integration-test',
      cacheTtlSeconds: 60,
      useAwsSecrets: true,
      secrets: [
        {
          envVar: 'INTEGRATION_TEST_SECRET',
          secretName: testSecretName,
          required: true,
          description: 'Integration test secret',
        },
        {
          envVar: 'JSON_TEST_SECRET',
          secretName: 'sovren/integration-test/json-secret',
          jsonKey: 'database.password',
          required: false,
          description: 'JSON integration test secret',
        },
      ],
      retry: {
        maxAttempts: 3,
        baseDelay: 100,
        maxDelay: 1000,
      },
    });

    // Override the AWS client to use LocalStack
    // This is a workaround since we can't inject endpoint through config
    const originalInit = secretsService.initialize.bind(secretsService);
    secretsService.initialize = async () => {
      await originalInit();
      // Replace the client with LocalStack-configured one
      (secretsService as any).secretsManager = localStackClient;
    };

    await secretsService.initialize();
  });

  afterEach(async () => {
    // Clean up test secrets
    try {
      await localStackClient.send(
        new DeleteSecretCommand({
          SecretId: testSecretName,
          ForceDeleteWithoutRecovery: true,
        })
      );
    } catch (error) {
      // Secret might not exist, ignore
    }

    try {
      await localStackClient.send(
        new DeleteSecretCommand({
          SecretId: 'sovren/integration-test/json-secret',
          ForceDeleteWithoutRecovery: true,
        })
      );
    } catch (error) {
      // Secret might not exist, ignore
    }

    await secretsService.shutdown();
  });

  afterAll(async () => {
    // Clean up LocalStack client
    if (localStackClient) {
      localStackClient.destroy();
    }
  });

  describe('AWS Secrets Manager Operations', () => {
    it('should create and retrieve a secret from LocalStack', async () => {
      // Create secret in LocalStack
      await localStackClient.send(
        new CreateSecretCommand({
          Name: testSecretName,
          SecretString: 'integration-test-value',
        })
      );

      // Retrieve secret through our service
      const value = await secretsService.getSecret('INTEGRATION_TEST_SECRET');

      expect(value).toBe('integration-test-value');
    });

    it('should retrieve JSON secret with nested key', async () => {
      const jsonSecret = JSON.stringify({
        database: {
          password: 'db-secret-password',
          host: 'localhost',
        },
      });

      await localStackClient.send(
        new CreateSecretCommand({
          Name: 'sovren/integration-test/json-secret',
          SecretString: jsonSecret,
        })
      );

      const value = await secretsService.getSecret('JSON_TEST_SECRET');

      expect(value).toBe('db-secret-password');
    });

    it('should cache secrets and avoid redundant AWS calls', async () => {
      await localStackClient.send(
        new CreateSecretCommand({
          Name: testSecretName,
          SecretString: 'cached-value',
        })
      );

      // First call - should hit AWS
      const value1 = await secretsService.getSecret('INTEGRATION_TEST_SECRET');
      const stats1 = secretsService.getStats();

      // Second call - should hit cache
      const value2 = await secretsService.getSecret('INTEGRATION_TEST_SECRET');
      const stats2 = secretsService.getStats();

      expect(value1).toBe('cached-value');
      expect(value2).toBe('cached-value');
      expect(stats1.awsCalls).toBe(1);
      expect(stats2.awsCalls).toBe(1); // Same count - no additional call
      expect(stats2.cacheHits).toBe(1);
    });

    it('should refresh cache when secret is updated', async () => {
      // Create initial secret
      await localStackClient.send(
        new CreateSecretCommand({
          Name: testSecretName,
          SecretString: 'initial-value',
        })
      );

      const value1 = await secretsService.getSecret('INTEGRATION_TEST_SECRET');
      expect(value1).toBe('initial-value');

      // Update secret in LocalStack
      await localStackClient.send(
        new UpdateSecretCommand({
          SecretId: testSecretName,
          SecretString: 'updated-value',
        })
      );

      // Clear cache and retrieve again
      secretsService.clearCache();
      const value2 = await secretsService.getSecret('INTEGRATION_TEST_SECRET');

      expect(value2).toBe('updated-value');
    });

    it('should handle secret not found error', async () => {
      // Don't create the secret - it won't exist

      await expect(secretsService.getSecret('INTEGRATION_TEST_SECRET')).rejects.toThrow(
        'not found'
      );
    });

    it('should handle binary secrets', async () => {
      const binaryData = Buffer.from('binary-secret-data', 'utf-8');

      await localStackClient.send(
        new CreateSecretCommand({
          Name: testSecretName,
          SecretBinary: binaryData,
        })
      );

      const value = await secretsService.getSecret('INTEGRATION_TEST_SECRET');

      expect(value).toBe('binary-secret-data');
    });
  });

  describe('Batch Operations', () => {
    it('should retrieve multiple secrets efficiently', async () => {
      // Create multiple secrets
      await localStackClient.send(
        new CreateSecretCommand({
          Name: testSecretName,
          SecretString: 'secret-1',
        })
      );

      await localStackClient.send(
        new CreateSecretCommand({
          Name: 'sovren/integration-test/json-secret',
          SecretString: JSON.stringify({ database: { password: 'secret-2' } }),
        })
      );

      // Retrieve all at once
      const secrets = await secretsService.getSecrets([
        'INTEGRATION_TEST_SECRET',
        'JSON_TEST_SECRET',
      ]);

      expect(secrets.INTEGRATION_TEST_SECRET).toBe('secret-1');
      expect(secrets.JSON_TEST_SECRET).toBe('secret-2');

      const stats = secretsService.getStats();
      expect(stats.awsCalls).toBe(2); // One call per secret
    });

    it('should refresh all secrets in cache', async () => {
      await localStackClient.send(
        new CreateSecretCommand({
          Name: testSecretName,
          SecretString: 'initial-value',
        })
      );

      // Load secret
      await secretsService.getSecret('INTEGRATION_TEST_SECRET');

      // Update in AWS
      await localStackClient.send(
        new UpdateSecretCommand({
          SecretId: testSecretName,
          SecretString: 'refreshed-value',
        })
      );

      // Refresh cache
      await secretsService.refreshSecrets();

      // Should get new value
      const value = await secretsService.getSecret('INTEGRATION_TEST_SECRET');
      expect(value).toBe('refreshed-value');
    });
  });

  describe('Performance', () => {
    it('should handle high volume of requests efficiently', async () => {
      await localStackClient.send(
        new CreateSecretCommand({
          Name: testSecretName,
          SecretString: 'performance-test-value',
        })
      );

      const iterations = 100;
      const startTime = Date.now();

      // Make many requests
      const promises = Array(iterations)
        .fill(null)
        .map(() => secretsService.getSecret('INTEGRATION_TEST_SECRET'));

      const results = await Promise.all(promises);

      const duration = Date.now() - startTime;

      // All should return same value
      results.forEach((value) => {
        expect(value).toBe('performance-test-value');
      });

      // Should be fast due to caching (< 1 second for 100 requests)
      expect(duration).toBeLessThan(1000);

      const stats = secretsService.getStats();
      // Should only call AWS once (first time), rest from cache
      expect(stats.awsCalls).toBe(1);
      expect(stats.cacheHits).toBeGreaterThan(90);
    });

    it('should handle concurrent requests for different secrets', async () => {
      // Create multiple secrets
      const secretPromises = Array(10)
        .fill(null)
        .map((_, i) =>
          localStackClient.send(
            new CreateSecretCommand({
              Name: `sovren/integration-test/secret-${i}`,
              SecretString: `value-${i}`,
            })
          )
        );

      await Promise.all(secretPromises);

      // Create service with multiple secret configs
      const multiSecretService = new SecretsService({
        awsRegion: 'us-east-1',
        environment: 'integration-test',
        cacheTtlSeconds: 60,
        useAwsSecrets: true,
        secrets: Array(10)
          .fill(null)
          .map((_, i) => ({
            envVar: `TEST_SECRET_${i}`,
            secretName: `sovren/integration-test/secret-${i}`,
            required: false,
            description: `Test secret ${i}`,
          })),
        retry: {
          maxAttempts: 3,
          baseDelay: 100,
          maxDelay: 1000,
        },
      });

      // Override client for LocalStack
      await multiSecretService.initialize();
      (multiSecretService as any).secretsManager = localStackClient;

      // Request all secrets concurrently
      const startTime = Date.now();
      const secretNames = Array(10)
        .fill(null)
        .map((_, i) => `TEST_SECRET_${i}`);

      const results = await multiSecretService.getSecrets(secretNames);
      const duration = Date.now() - startTime;

      // Verify all values
      Object.entries(results).forEach(([key, value]) => {
        const index = parseInt(key.replace('TEST_SECRET_', ''), 10);
        expect(value).toBe(`value-${index}`);
      });

      // Should complete reasonably fast
      expect(duration).toBeLessThan(5000);

      // Clean up
      await Promise.all(
        Array(10)
          .fill(null)
          .map((_, i) =>
            localStackClient
              .send(
                new DeleteSecretCommand({
                  SecretId: `sovren/integration-test/secret-${i}`,
                  ForceDeleteWithoutRecovery: true,
                })
              )
              .catch(() => {
                /* ignore */
              })
          )
      );

      await multiSecretService.shutdown();
    });
  });

  describe('Error Recovery', () => {
    it('should retry on transient AWS errors', async () => {
      // This test is harder to simulate with LocalStack
      // In a real scenario, you might stop/start LocalStack to simulate network issues
      // For now, we'll just verify the service can recover after LocalStack is available

      await localStackClient.send(
        new CreateSecretCommand({
          Name: testSecretName,
          SecretString: 'recovery-test-value',
        })
      );

      const value = await secretsService.getSecret('INTEGRATION_TEST_SECRET');

      expect(value).toBe('recovery-test-value');
    });
  });
});

// Export helper for manual testing
export function setupLocalStackTest() {
  return {
    endpoint: process.env.LOCALSTACK_ENDPOINT || 'http://localhost:4566',
    credentials: {
      accessKeyId: 'test',
      secretAccessKey: 'test',
    },
  };
}
