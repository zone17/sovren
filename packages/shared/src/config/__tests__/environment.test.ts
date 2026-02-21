/**
 * Environment Configuration Tests
 * Comprehensive test suite for type-safe environment validation
 */

import {
  getConfig,
  getDatabaseConfig,
  getLightningConfig,
  getNostrConfig,
  isDevelopment,
  isFeatureEnabled,
  isProduction,
  isTest,
  resetConfig,
  validateEnvironment,
} from '../environment';

describe('Environment Configuration', () => {
  // Mock environment variables
  const mockValidEnv = {
    NODE_ENV: 'development',
    PORT: '3001',
    LOG_LEVEL: 'debug',

    // Supabase (required)
    SUPABASE_URL: 'https://test-project.supabase.co',
    SUPABASE_ANON_KEY: 'test-anon-key-12345',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key-12345',

    // Authentication (required)
    JWT_SECRET: 'super-secure-jwt-secret-at-least-32-chars-long',
    SESSION_SECRET: 'super-secure-session-secret-at-least-32-chars-long',

    // Lightning (required)
    LNBITS_API_URL: 'https://test-lnbits.com',
    LNBITS_ADMIN_KEY: 'test-admin-key',
    LNBITS_INVOICE_READ_KEY: 'test-invoice-key',
    LNBITS_WEBHOOK_SECRET: 'test-webhook-secret',

    // NOSTR (required)
    NOSTR_RELAYS: 'wss://relay.test.com,wss://relay2.test.com',

    // Optional with defaults
    LIGHTNING_NETWORK: 'testnet',
    LIGHTNING_MIN_AMOUNT: '1000',
    LIGHTNING_MAX_AMOUNT: '100000000',
    REDIS_URL: 'redis://localhost:6379',
    FEATURE_LIGHTNING_PAYMENTS: 'true',
    FEATURE_AI_CONTENT_GENERATION: 'true',
  };

  beforeEach(() => {
    resetConfig();
    vi.clearAllMocks();
  });

  describe('validateEnvironment', () => {
    it('should validate a complete valid environment', () => {
      const result = validateEnvironment(mockValidEnv);

      expect(result.NODE_ENV).toBe('development');
      expect(result.PORT).toBe(3001);
      expect(result.SUPABASE_URL).toBe('https://test-project.supabase.co');
      expect(result.JWT_SECRET).toBe('super-secure-jwt-secret-at-least-32-chars-long');
      expect(result.LIGHTNING_NETWORK).toBe('testnet');
      expect(result.FEATURE_LIGHTNING_PAYMENTS).toBe(true);
    });

    it('should apply default values for optional fields', () => {
      const minimalEnv = {
        SUPABASE_URL: 'https://test-project.supabase.co',
        SUPABASE_ANON_KEY: 'test-anon-key-12345',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key-12345',
        JWT_SECRET: 'super-secure-jwt-secret-at-least-32-chars-long',
        SESSION_SECRET: 'super-secure-session-secret-at-least-32-chars-long',
        LNBITS_API_URL: 'https://test-lnbits.com',
        LNBITS_ADMIN_KEY: 'test-admin-key',
        LNBITS_INVOICE_READ_KEY: 'test-invoice-key',
        LNBITS_WEBHOOK_SECRET: 'test-webhook-secret',
        NOSTR_RELAYS: 'wss://relay.test.com',
      };

      const result = validateEnvironment(minimalEnv);

      expect(result.NODE_ENV).toBe('development');
      expect(result.PORT).toBe(3001);
      expect(result.LOG_LEVEL).toBe('info');
      expect(result.LIGHTNING_NETWORK).toBe('testnet');
      expect(result.REDIS_URL).toBe('redis://localhost:6379');
      expect(result.FEATURE_LIGHTNING_PAYMENTS).toBe(true);
    });

    it('should throw error for missing required fields', () => {
      const incompleteEnv = {
        NODE_ENV: 'development',
        // Missing SUPABASE_URL and other required fields
      };

      expect(() => validateEnvironment(incompleteEnv)).toThrow('Environment validation failed');
    });

    it('should validate production environment requirements', () => {
      const productionEnv = {
        ...mockValidEnv,
        NODE_ENV: 'production',
        JWT_SECRET: 'super-secure-jwt-secret-at-least-64-characters-long-for-production-use',
        SESSION_SECRET: 'super-secure-session-secret-at-least-64-characters-long-for-production',
        DOMAIN: 'sovren.com',
        SSL_EMAIL: 'admin@sovren.com',
        SENTRY_DSN: 'https://test@sentry.io/123456',
        CORS_ORIGIN: 'https://sovren.com',
      };

      const result = validateEnvironment(productionEnv);
      expect(result.NODE_ENV).toBe('production');
      expect(result.DOMAIN).toBe('sovren.com');
    });

    it('should throw error for production without required fields', () => {
      const invalidProductionEnv = {
        ...mockValidEnv,
        NODE_ENV: 'production',
        // Missing DOMAIN, SSL_EMAIL, etc.
      };

      expect(() => validateEnvironment(invalidProductionEnv)).toThrow(
        'Missing required production environment variables'
      );
    });

    it('should validate JWT secret length in production', () => {
      const shortJWTEnv = {
        ...mockValidEnv,
        NODE_ENV: 'production',
        JWT_SECRET: 'short-secret', // Too short for production
        DOMAIN: 'sovren.com',
        SSL_EMAIL: 'admin@sovren.com',
        SENTRY_DSN: 'https://test@sentry.io/123456',
        CORS_ORIGIN: 'https://sovren.com',
      };

      expect(() => validateEnvironment(shortJWTEnv)).toThrow('Environment validation failed');
    });

    it('should validate NOSTR relay URLs', () => {
      const invalidRelayEnv = {
        ...mockValidEnv,
        NOSTR_RELAYS: 'http://invalid.com,wss://valid.com',
      };

      expect(() => validateEnvironment(invalidRelayEnv)).toThrow('Invalid NOSTR relay URLs');
    });

    it('should validate Lightning amount configuration', () => {
      const invalidLightningEnv = {
        ...mockValidEnv,
        LIGHTNING_MIN_AMOUNT: '1000000',
        LIGHTNING_MAX_AMOUNT: '1000', // Min > Max
      };

      expect(() => validateEnvironment(invalidLightningEnv)).toThrow(
        'LIGHTNING_MIN_AMOUNT must be less than LIGHTNING_MAX_AMOUNT'
      );
    });

    it('should coerce string numbers to numbers', () => {
      const stringNumberEnv = {
        ...mockValidEnv,
        PORT: '8080',
        LIGHTNING_MIN_AMOUNT: '2000',
        RATE_LIMIT_MAX_REQUESTS: '50',
      };

      const result = validateEnvironment(stringNumberEnv);
      expect(result.PORT).toBe(8080);
      expect(result.LIGHTNING_MIN_AMOUNT).toBe(2000);
      expect(result.RATE_LIMIT_MAX_REQUESTS).toBe(50);
    });

    it('should coerce string booleans to booleans', () => {
      const stringBooleanEnv = {
        ...mockValidEnv,
        FEATURE_LIGHTNING_PAYMENTS: 'false',
        DEBUG_ENABLED: 'true',
        ANALYTICS_ENABLED: '1',
      };

      const result = validateEnvironment(stringBooleanEnv);
      expect(result.FEATURE_LIGHTNING_PAYMENTS).toBe(false);
      expect(result.DEBUG_ENABLED).toBe(true);
      expect(result.ANALYTICS_ENABLED).toBe(true);
    });
  });

  describe('Environment utilities', () => {
    beforeEach(() => {
      // Mock process.env
      process.env = { ...mockValidEnv };
    });

    it('should detect development environment', () => {
      process.env.NODE_ENV = 'development';
      expect(isDevelopment()).toBe(true);
      expect(isProduction()).toBe(false);
      expect(isTest()).toBe(false);
    });

    it('should detect production environment', () => {
      process.env.NODE_ENV = 'production';
      expect(isProduction()).toBe(true);
      expect(isDevelopment()).toBe(false);
      expect(isTest()).toBe(false);
    });

    it('should detect test environment', () => {
      process.env.NODE_ENV = 'test';
      expect(isTest()).toBe(true);
      expect(isProduction()).toBe(false);
      expect(isDevelopment()).toBe(false);
    });
  });

  describe('Feature flags', () => {
    beforeEach(() => {
      process.env = { ...mockValidEnv };
    });

    it('should check if feature is enabled', () => {
      process.env.FEATURE_LIGHTNING_PAYMENTS = 'true';
      expect(isFeatureEnabled('FEATURE_LIGHTNING_PAYMENTS')).toBe(true);

      process.env.FEATURE_AI_CONTENT_GENERATION = 'false';
      expect(isFeatureEnabled('FEATURE_AI_CONTENT_GENERATION')).toBe(false);
    });

    it('should use default values for undefined features', () => {
      delete process.env.FEATURE_LIGHTNING_PAYMENTS;
      expect(isFeatureEnabled('FEATURE_LIGHTNING_PAYMENTS')).toBe(true); // Default is true
    });
  });

  describe('Configuration helpers', () => {
    beforeEach(() => {
      process.env = { ...mockValidEnv };
    });

    it('should get database configuration', () => {
      const dbConfig = getDatabaseConfig();

      expect(dbConfig.supabase.url).toBe('https://test-project.supabase.co');
      expect(dbConfig.supabase.anonKey).toBe('test-anon-key-12345');
      expect(dbConfig.supabase.serviceRoleKey).toBe('test-service-role-key-12345');
    });

    it('should get Lightning configuration', () => {
      const lightningConfig = getLightningConfig();

      expect(lightningConfig.apiUrl).toBe('https://test-lnbits.com');
      expect(lightningConfig.adminKey).toBe('test-admin-key');
      expect(lightningConfig.network).toBe('testnet');
      expect(lightningConfig.minAmount).toBe(1000);
      expect(lightningConfig.maxAmount).toBe(100000000);
    });

    it('should get NOSTR configuration', () => {
      process.env.NOSTR_RELAYS = 'wss://relay1.com,wss://relay2.com,wss://relay3.com';
      process.env.NOSTR_PRIVATE_KEY =
        '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      process.env.NOSTR_PUBLIC_KEY =
        'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';

      const nostrConfig = getNostrConfig();

      expect(nostrConfig.relays).toEqual([
        'wss://relay1.com',
        'wss://relay2.com',
        'wss://relay3.com',
      ]);
      expect(nostrConfig.privateKey).toBe(
        '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
      );
      expect(nostrConfig.publicKey).toBe(
        'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
      );
    });

    it('should handle NOSTR relays with whitespace', () => {
      process.env.NOSTR_RELAYS = ' wss://relay1.com , wss://relay2.com , wss://relay3.com ';

      const nostrConfig = getNostrConfig();

      expect(nostrConfig.relays).toEqual([
        'wss://relay1.com',
        'wss://relay2.com',
        'wss://relay3.com',
      ]);
    });
  });

  describe('Configuration singleton', () => {
    beforeEach(() => {
      process.env = { ...mockValidEnv };
      resetConfig();
    });

    it('should return same configuration instance', () => {
      const config1 = getConfig();
      const config2 = getConfig();

      expect(config1).toBe(config2); // Same reference
    });

    it('should reset configuration', () => {
      const config1 = getConfig();
      resetConfig();
      const config2 = getConfig();

      expect(config1).not.toBe(config2); // Different references after reset
      expect(config1.NODE_ENV).toBe(config2.NODE_ENV); // But same values
    });
  });

  describe('Error handling', () => {
    it('should provide detailed error messages for validation failures', () => {
      const invalidEnv = {
        PORT: 'invalid-port',
        SUPABASE_URL: 'not-a-url',
        JWT_SECRET: 'short', // Too short
      };

      expect(() => validateEnvironment(invalidEnv)).toThrow('Environment validation failed');
    });

    it('should handle missing environment gracefully', () => {
      expect(() => validateEnvironment({})).toThrow('Environment validation failed');
    });
  });

  describe('Edge cases', () => {
    it('should handle undefined process.env values', () => {
      const envWithUndefined = {
        ...mockValidEnv,
        OPTIONAL_FIELD: undefined,
      };

      expect(() => validateEnvironment(envWithUndefined)).not.toThrow();
    });

    it('should validate email formats', () => {
      const invalidEmailEnv = {
        ...mockValidEnv,
        SSL_EMAIL: 'not-an-email',
      };

      expect(() => validateEnvironment(invalidEmailEnv)).toThrow();
    });

    it('should validate URL formats', () => {
      const invalidUrlEnv = {
        ...mockValidEnv,
        SUPABASE_URL: 'not-a-url',
      };

      expect(() => validateEnvironment(invalidUrlEnv)).toThrow();
    });

    it('should validate port ranges', () => {
      const invalidPortEnv = {
        ...mockValidEnv,
        PORT: '99999', // Too high
      };

      expect(() => validateEnvironment(invalidPortEnv)).toThrow();
    });

    it('should validate enum values', () => {
      const invalidEnumEnv = {
        ...mockValidEnv,
        NODE_ENV: 'invalid-env',
      };

      expect(() => validateEnvironment(invalidEnumEnv)).toThrow();
    });
  });
});
