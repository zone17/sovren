/**
 * Secrets Management Service
 * Production-grade secrets management with AWS Secrets Manager integration
 *
 * Features:
 * - AWS Secrets Manager integration for production
 * - In-memory caching with TTL for performance
 * - Graceful fallback to .env in development
 * - Automatic retry with exponential backoff
 * - Type-safe secret access
 * - Comprehensive error handling
 *
 * @module SecretsService
 */

import {
  SecretsManagerClient,
  GetSecretValueCommand,
  GetSecretValueCommandOutput,
  ResourceNotFoundException,
  InvalidRequestException,
  InvalidParameterException,
} from '@aws-sdk/client-secrets-manager';
import { getSecretsConfig, SecretsConfig } from '../config/secrets.config';

/**
 * Cache entry for a secret value
 */
interface CachedSecret {
  value: string;
  expiresAt: number;
}

/**
 * Error types for secrets operations
 */
export enum SecretErrorType {
  NOT_FOUND = 'SECRET_NOT_FOUND',
  INVALID_SECRET = 'INVALID_SECRET',
  AWS_ERROR = 'AWS_ERROR',
  CACHE_ERROR = 'CACHE_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
}

/**
 * Custom error for secrets operations
 */
export class SecretError extends Error {
  constructor(
    public type: SecretErrorType,
    message: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'SecretError';
    Object.setPrototypeOf(this, SecretError.prototype);
  }
}

/**
 * Secrets retrieval statistics
 */
export interface SecretsStats {
  cacheHits: number;
  cacheMisses: number;
  awsCalls: number;
  envFallbacks: number;
  errors: number;
  lastRefresh?: Date;
}

/**
 * Secrets Management Service
 *
 * Manages secure secret loading from AWS Secrets Manager with caching
 * Falls back to environment variables in development
 *
 * @example
 * ```typescript
 * const secretsService = new SecretsService();
 * await secretsService.initialize();
 *
 * const jwtSecret = await secretsService.getSecret('JWT_SECRET');
 * const dbUrl = await secretsService.getSecret('SUPABASE_URL');
 * ```
 */
export class SecretsService {
  private cache: Map<string, CachedSecret>;
  private secretsManager: SecretsManagerClient | null;
  private config: SecretsConfig;
  private initialized: boolean;
  private stats: SecretsStats;

  constructor(config?: Partial<SecretsConfig>) {
    this.cache = new Map();
    this.config = { ...getSecretsConfig(), ...config };
    this.initialized = false;
    this.secretsManager = null;
    this.stats = {
      cacheHits: 0,
      cacheMisses: 0,
      awsCalls: 0,
      envFallbacks: 0,
      errors: 0,
    };
  }

  /**
   * Initialize the secrets service
   * Sets up AWS Secrets Manager client if needed
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Only create AWS client if we're using AWS secrets
    if (this.config.useAwsSecrets) {
      this.secretsManager = new SecretsManagerClient({
        region: this.config.awsRegion,
        maxAttempts: this.config.retry.maxAttempts,
      });

      console.log(
        `[SecretsService] Initialized with AWS Secrets Manager (region: ${this.config.awsRegion})`
      );
    } else {
      console.log('[SecretsService] Initialized with environment variable fallback');
    }

    this.initialized = true;
  }

  /**
   * Get a secret value by environment variable name
   *
   * Priority:
   * 1. Check in-memory cache
   * 2. Load from AWS Secrets Manager (if enabled)
   * 3. Fallback to environment variable
   *
   * @param envVarName - Environment variable name (e.g., 'JWT_SECRET')
   * @returns Secret value
   * @throws {SecretError} If secret not found and required
   */
  async getSecret(envVarName: string): Promise<string> {
    if (!this.initialized) {
      throw new SecretError(
        SecretErrorType.VALIDATION_ERROR,
        'SecretsService not initialized. Call initialize() first.'
      );
    }

    // Check cache first
    const cached = this.getCachedSecret(envVarName);
    if (cached) {
      this.stats.cacheHits++;
      return cached;
    }

    this.stats.cacheMisses++;

    // Find secret mapping
    const mapping = this.config.secrets.find((s) => s.envVar === envVarName);

    // If using AWS secrets and mapping exists, try AWS first
    if (this.config.useAwsSecrets && mapping) {
      try {
        const value = await this.loadFromAWS(mapping.secretName, mapping.jsonKey);
        this.setCachedSecret(envVarName, value);
        return value;
      } catch (error) {
        // If AWS fails and we're in production, this is critical
        if (this.config.environment === 'production' && mapping.required) {
          this.stats.errors++;
          throw error;
        }
        // Otherwise, fall through to env var fallback
        console.warn(
          `[SecretsService] AWS lookup failed for ${envVarName}, falling back to env var`
        );
      }
    }

    // Fallback to environment variable
    const value = this.loadFromEnv(envVarName);

    if (!value) {
      // Check if this is a required secret
      const isRequired = mapping?.required && this.config.environment === 'production';

      if (isRequired) {
        this.stats.errors++;
        throw new SecretError(
          SecretErrorType.NOT_FOUND,
          `Required secret '${envVarName}' not found in AWS Secrets Manager or environment variables`
        );
      }

      // Return empty string for optional secrets
      return '';
    }

    this.stats.envFallbacks++;
    this.setCachedSecret(envVarName, value);
    return value;
  }

  /**
   * Get multiple secrets at once
   * More efficient than calling getSecret multiple times
   *
   * @param envVarNames - Array of environment variable names
   * @returns Object mapping env var names to secret values
   */
  async getSecrets(envVarNames: string[]): Promise<Record<string, string>> {
    const secrets: Record<string, string> = {};

    await Promise.all(
      envVarNames.map(async (name) => {
        try {
          secrets[name] = await this.getSecret(name);
        } catch (error) {
          // If a secret fails, log but continue with others
          console.error(`[SecretsService] Failed to load secret ${name}:`, error);
          secrets[name] = '';
        }
      })
    );

    return secrets;
  }

  /**
   * Refresh all cached secrets
   * Useful for scheduled cache invalidation
   */
  async refreshSecrets(): Promise<void> {
    console.log('[SecretsService] Refreshing all cached secrets...');

    // Clear the cache
    this.cache.clear();

    // Reload all configured secrets
    const secretNames = this.config.secrets.map((s) => s.envVar);
    await this.getSecrets(secretNames);

    this.stats.lastRefresh = new Date();
    console.log(`[SecretsService] Refreshed ${secretNames.length} secrets`);
  }

  /**
   * Get service statistics
   */
  getStats(): SecretsStats {
    return { ...this.stats };
  }

  /**
   * Clear all cached secrets
   * Useful for testing or forced refresh
   */
  clearCache(): void {
    this.cache.clear();
    console.log('[SecretsService] Cache cleared');
  }

  /**
   * Check if service is using AWS Secrets Manager
   */
  isUsingAWS(): boolean {
    return this.config.useAwsSecrets;
  }

  /**
   * Get cached secret if not expired
   * @private
   */
  private getCachedSecret(key: string): string | null {
    const cached = this.cache.get(key);

    if (!cached) {
      return null;
    }

    // Check if expired
    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return cached.value;
  }

  /**
   * Store secret in cache with TTL
   * @private
   */
  private setCachedSecret(key: string, value: string): void {
    const expiresAt = Date.now() + this.config.cacheTtlSeconds * 1000;

    this.cache.set(key, {
      value,
      expiresAt,
    });
  }

  /**
   * Load secret from AWS Secrets Manager
   * @private
   */
  private async loadFromAWS(secretName: string, jsonKey?: string): Promise<string> {
    if (!this.secretsManager) {
      throw new SecretError(
        SecretErrorType.AWS_ERROR,
        'AWS Secrets Manager client not initialized'
      );
    }

    try {
      this.stats.awsCalls++;

      const command = new GetSecretValueCommand({ SecretId: secretName });
      const response: GetSecretValueCommandOutput = await this.secretsManager.send(command);

      let secretValue: string;

      // Handle both string and binary secrets
      if (response.SecretString) {
        secretValue = response.SecretString;
      } else if (response.SecretBinary) {
        // Decode binary secret
        const buff = Buffer.from(response.SecretBinary);
        secretValue = buff.toString('utf-8');
      } else {
        throw new SecretError(SecretErrorType.INVALID_SECRET, `Secret ${secretName} has no value`);
      }

      // If jsonKey is specified, parse as JSON and extract key
      if (jsonKey) {
        try {
          const parsed = JSON.parse(secretValue);
          const value = this.getNestedValue(parsed, jsonKey);

          if (value === undefined) {
            throw new SecretError(
              SecretErrorType.INVALID_SECRET,
              `JSON key '${jsonKey}' not found in secret ${secretName}`
            );
          }

          return String(value);
        } catch (error) {
          if (error instanceof SecretError) {
            throw error;
          }
          throw new SecretError(
            SecretErrorType.INVALID_SECRET,
            `Failed to parse JSON secret ${secretName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
            error instanceof Error ? error : undefined
          );
        }
      }

      return secretValue;
    } catch (error) {
      // Handle specific AWS errors
      if (error instanceof ResourceNotFoundException) {
        throw new SecretError(
          SecretErrorType.NOT_FOUND,
          `Secret '${secretName}' not found in AWS Secrets Manager`,
          error
        );
      }

      if (error instanceof InvalidRequestException || error instanceof InvalidParameterException) {
        throw new SecretError(
          SecretErrorType.INVALID_SECRET,
          `Invalid secret request for '${secretName}': ${error.message}`,
          error
        );
      }

      // Network or other AWS errors
      if (error instanceof Error && error.name === 'NetworkingError') {
        throw new SecretError(
          SecretErrorType.NETWORK_ERROR,
          `Network error loading secret '${secretName}': ${error.message}`,
          error
        );
      }

      // Re-throw SecretError as-is
      if (error instanceof SecretError) {
        throw error;
      }

      // Wrap unknown errors
      throw new SecretError(
        SecretErrorType.AWS_ERROR,
        `AWS error loading secret '${secretName}': ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Load secret from environment variable
   * @private
   */
  private loadFromEnv(envVarName: string): string {
    const value = process.env[envVarName];
    return value || '';
  }

  /**
   * Get nested value from object using dot notation
   * @private
   */
  private getNestedValue(obj: any, path: string): any {
    const keys = path.split('.');
    let current = obj;

    for (const key of keys) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[key];
    }

    return current;
  }

  /**
   * Graceful shutdown
   * Clears cache and cleans up resources
   */
  async shutdown(): Promise<void> {
    console.log('[SecretsService] Shutting down...');
    this.cache.clear();
    this.secretsManager = null;
    this.initialized = false;
  }
}

/**
 * Singleton instance for application-wide use
 */
let secretsServiceInstance: SecretsService | null = null;

/**
 * Get singleton secrets service instance
 * Automatically initializes on first call
 */
export async function getSecretsService(): Promise<SecretsService> {
  if (!secretsServiceInstance) {
    secretsServiceInstance = new SecretsService();
    await secretsServiceInstance.initialize();
  }
  return secretsServiceInstance;
}

/**
 * Reset singleton instance (for testing)
 */
export function resetSecretsService(): void {
  if (secretsServiceInstance) {
    secretsServiceInstance.shutdown();
    secretsServiceInstance = null;
  }
}
