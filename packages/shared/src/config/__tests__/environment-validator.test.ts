/**
 * Unit Tests for Environment Validator
 * Tests type-safe environment validation for TS-008
 * Coverage target: 95%+
 */

import {
  EnvironmentValidator,
  VALIDATION_RULES,
  ValidationError,
  ValidationResult,
  EnvVarValue,
  validateEnvironmentOnStartup,
  getValidatedConfig,
  isFeatureEnabled,
  getRequiredEnvVar,
  getEnvVar,
} from '../environment-validator';

describe('Environment Validator - TS-008', () => {
  describe('EnvironmentValidator Class', () => {
    describe('validate()', () => {
      it('should validate all required variables in development', () => {
        const mockEnv = {
          NODE_ENV: 'development',
          SUPABASE_URL: 'https://test.supabase.co',
          SUPABASE_ANON_KEY: 'test-anon-key',
          SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
          JWT_SECRET: 'a'.repeat(32),
          SESSION_SECRET: 'b'.repeat(32),
          LNBITS_API_URL: 'https://lnbits.test.com',
          LNBITS_ADMIN_KEY: 'test-admin-key',
          LNBITS_INVOICE_READ_KEY: 'test-invoice-key',
          LNBITS_WEBHOOK_SECRET: 'c'.repeat(16),
          NOSTR_RELAYS: 'wss://relay1.test.com,wss://relay2.test.com',
        };

        const validator = new EnvironmentValidator(mockEnv);
        const result = validator.validate();

        expect(result.success).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.summary.validated).toBeGreaterThan(0);
      });

      it('should fail when required variables are missing', () => {
        const mockEnv = {
          NODE_ENV: 'development',
          // Missing required variables
        };

        const validator = new EnvironmentValidator(mockEnv);
        const result = validator.validate();

        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors.some((e) => e.variable === 'SUPABASE_URL')).toBe(true);
      });

      it('should validate URL formats', () => {
        const mockEnv = {
          NODE_ENV: 'development',
          SUPABASE_URL: 'not-a-valid-url',
          SUPABASE_ANON_KEY: 'test-key',
          SUPABASE_SERVICE_ROLE_KEY: 'test-key',
          JWT_SECRET: 'a'.repeat(32),
          SESSION_SECRET: 'b'.repeat(32),
          LNBITS_API_URL: 'https://lnbits.test.com',
          LNBITS_ADMIN_KEY: 'test-key',
          LNBITS_INVOICE_READ_KEY: 'test-key',
          LNBITS_WEBHOOK_SECRET: 'c'.repeat(16),
          NOSTR_RELAYS: 'wss://relay.test.com',
        };

        const validator = new EnvironmentValidator(mockEnv);
        const result = validator.validate();

        expect(result.success).toBe(false);
        expect(result.errors.some((e) => e.variable === 'SUPABASE_URL')).toBe(true);
      });

      it('should validate port numbers', () => {
        const mockEnv = {
          NODE_ENV: 'development',
          PORT: '99999', // Valid port
          SUPABASE_URL: 'https://test.supabase.co',
          SUPABASE_ANON_KEY: 'test-key',
          SUPABASE_SERVICE_ROLE_KEY: 'test-key',
          JWT_SECRET: 'a'.repeat(32),
          SESSION_SECRET: 'b'.repeat(32),
          LNBITS_API_URL: 'https://lnbits.test.com',
          LNBITS_ADMIN_KEY: 'test-key',
          LNBITS_INVOICE_READ_KEY: 'test-key',
          LNBITS_WEBHOOK_SECRET: 'c'.repeat(16),
          NOSTR_RELAYS: 'wss://relay.test.com',
        };

        const validator = new EnvironmentValidator(mockEnv);
        const result = validator.validate();

        expect(result.success).toBe(true);
        expect(result.config.PORT).toBe(99999);
      });

      it('should reject invalid port numbers', () => {
        const mockEnv = {
          NODE_ENV: 'development',
          PORT: '70000', // Invalid: > 65535
          SUPABASE_URL: 'https://test.supabase.co',
          SUPABASE_ANON_KEY: 'test-key',
          SUPABASE_SERVICE_ROLE_KEY: 'test-key',
          JWT_SECRET: 'a'.repeat(32),
          SESSION_SECRET: 'b'.repeat(32),
          LNBITS_API_URL: 'https://lnbits.test.com',
          LNBITS_ADMIN_KEY: 'test-key',
          LNBITS_INVOICE_READ_KEY: 'test-key',
          LNBITS_WEBHOOK_SECRET: 'c'.repeat(16),
          NOSTR_RELAYS: 'wss://relay.test.com',
        };

        const validator = new EnvironmentValidator(mockEnv);
        const result = validator.validate();

        expect(result.success).toBe(false);
      });

      it('should validate NOSTR relay formats', () => {
        const mockEnv = {
          NODE_ENV: 'development',
          SUPABASE_URL: 'https://test.supabase.co',
          SUPABASE_ANON_KEY: 'test-key',
          SUPABASE_SERVICE_ROLE_KEY: 'test-key',
          JWT_SECRET: 'a'.repeat(32),
          SESSION_SECRET: 'b'.repeat(32),
          LNBITS_API_URL: 'https://lnbits.test.com',
          LNBITS_ADMIN_KEY: 'test-key',
          LNBITS_INVOICE_READ_KEY: 'test-key',
          LNBITS_WEBHOOK_SECRET: 'c'.repeat(16),
          NOSTR_RELAYS: 'https://invalid.com', // Should be wss://
        };

        const validator = new EnvironmentValidator(mockEnv);
        const result = validator.validate();

        expect(result.success).toBe(false);
        expect(result.errors.some((e) => e.variable === 'NOSTR_RELAYS')).toBe(true);
      });

      it('should validate secret minimum lengths', () => {
        const mockEnv = {
          NODE_ENV: 'development',
          SUPABASE_URL: 'https://test.supabase.co',
          SUPABASE_ANON_KEY: 'test-key',
          SUPABASE_SERVICE_ROLE_KEY: 'test-key',
          JWT_SECRET: 'short', // Too short
          SESSION_SECRET: 'b'.repeat(32),
          LNBITS_API_URL: 'https://lnbits.test.com',
          LNBITS_ADMIN_KEY: 'test-key',
          LNBITS_INVOICE_READ_KEY: 'test-key',
          LNBITS_WEBHOOK_SECRET: 'c'.repeat(16),
          NOSTR_RELAYS: 'wss://relay.test.com',
        };

        const validator = new EnvironmentValidator(mockEnv);
        const result = validator.validate();

        expect(result.success).toBe(false);
        expect(result.errors.some((e) => e.variable === 'JWT_SECRET')).toBe(true);
      });

      it('should reject placeholder secrets', () => {
        const mockEnv = {
          NODE_ENV: 'development',
          SUPABASE_URL: 'https://test.supabase.co',
          SUPABASE_ANON_KEY: 'test-key',
          SUPABASE_SERVICE_ROLE_KEY: 'test-key',
          JWT_SECRET: 'change-this-secret-please-123',
          SESSION_SECRET: 'b'.repeat(32),
          LNBITS_API_URL: 'https://lnbits.test.com',
          LNBITS_ADMIN_KEY: 'test-key',
          LNBITS_INVOICE_READ_KEY: 'test-key',
          LNBITS_WEBHOOK_SECRET: 'c'.repeat(16),
          NOSTR_RELAYS: 'wss://relay.test.com',
        };

        const validator = new EnvironmentValidator(mockEnv);
        const result = validator.validate();

        expect(result.success).toBe(false);
      });

      it('should validate boolean coercion', () => {
        const mockEnv = {
          NODE_ENV: 'development',
          SUPABASE_URL: 'https://test.supabase.co',
          SUPABASE_ANON_KEY: 'test-key',
          SUPABASE_SERVICE_ROLE_KEY: 'test-key',
          JWT_SECRET: 'a'.repeat(32),
          SESSION_SECRET: 'b'.repeat(32),
          LNBITS_API_URL: 'https://lnbits.test.com',
          LNBITS_ADMIN_KEY: 'test-key',
          LNBITS_INVOICE_READ_KEY: 'test-key',
          LNBITS_WEBHOOK_SECRET: 'c'.repeat(16),
          NOSTR_RELAYS: 'wss://relay.test.com',
          FEATURE_LIGHTNING_PAYMENTS: 'true',
          FEATURE_AI_CONTENT_GENERATION: 'false',
          FEATURE_NOSTR_PUBLISHING: '1',
        };

        const validator = new EnvironmentValidator(mockEnv);
        const result = validator.validate();

        expect(result.success).toBe(true);
        expect(result.config.FEATURE_LIGHTNING_PAYMENTS).toBe(true);
        expect(result.config.FEATURE_AI_CONTENT_GENERATION).toBe(false);
        expect(result.config.FEATURE_NOSTR_PUBLISHING).toBe(true);
      });
    });

    describe('Production Validations', () => {
      it('should require production-specific variables', () => {
        const mockEnv = {
          NODE_ENV: 'production',
          SUPABASE_URL: 'https://test.supabase.co',
          SUPABASE_ANON_KEY: 'test-key',
          SUPABASE_SERVICE_ROLE_KEY: 'test-key',
          JWT_SECRET: 'a'.repeat(32),
          SESSION_SECRET: 'b'.repeat(32),
          LNBITS_API_URL: 'https://lnbits.test.com',
          LNBITS_ADMIN_KEY: 'test-key',
          LNBITS_INVOICE_READ_KEY: 'test-key',
          LNBITS_WEBHOOK_SECRET: 'c'.repeat(16),
          NOSTR_RELAYS: 'wss://relay.test.com',
          // Missing: DOMAIN, SSL_EMAIL, SENTRY_DSN, CORS_ORIGIN
        };

        const validator = new EnvironmentValidator(mockEnv);
        const result = validator.validate();

        expect(result.success).toBe(false);
        expect(result.errors.some((e) => e.variable === 'DOMAIN')).toBe(true);
        expect(result.errors.some((e) => e.variable === 'SSL_EMAIL')).toBe(true);
        expect(result.errors.some((e) => e.variable === 'SENTRY_DSN')).toBe(true);
        expect(result.errors.some((e) => e.variable === 'CORS_ORIGIN')).toBe(true);
      });

      it('should warn about short secrets in production', () => {
        const mockEnv = {
          NODE_ENV: 'production',
          SUPABASE_URL: 'https://test.supabase.co',
          SUPABASE_ANON_KEY: 'test-key',
          SUPABASE_SERVICE_ROLE_KEY: 'test-key',
          JWT_SECRET: 'a'.repeat(32), // Valid but short for production
          SESSION_SECRET: 'b'.repeat(32),
          LNBITS_API_URL: 'https://lnbits.test.com',
          LNBITS_ADMIN_KEY: 'test-key',
          LNBITS_INVOICE_READ_KEY: 'test-key',
          LNBITS_WEBHOOK_SECRET: 'c'.repeat(16),
          NOSTR_RELAYS: 'wss://relay.test.com',
          DOMAIN: 'example.com',
          SSL_EMAIL: 'admin@example.com',
          SENTRY_DSN: 'https://example@sentry.io/123',
          CORS_ORIGIN: 'https://example.com',
        };

        const validator = new EnvironmentValidator(mockEnv);
        const result = validator.validate();

        expect(result.warnings.some((w) => w.variable === 'JWT_SECRET')).toBe(true);
      });

      it('should warn about development values in production', () => {
        const mockEnv = {
          NODE_ENV: 'production',
          SUPABASE_URL: 'https://localhost:54321', // Development value
          SUPABASE_ANON_KEY: 'test-key',
          SUPABASE_SERVICE_ROLE_KEY: 'test-key',
          JWT_SECRET: 'a'.repeat(64),
          SESSION_SECRET: 'b'.repeat(64),
          LNBITS_API_URL: 'https://lnbits.test.com',
          LNBITS_ADMIN_KEY: 'test-key',
          LNBITS_INVOICE_READ_KEY: 'test-key',
          LNBITS_WEBHOOK_SECRET: 'c'.repeat(16),
          NOSTR_RELAYS: 'wss://relay.test.com',
          DOMAIN: 'example.com',
          SSL_EMAIL: 'admin@example.com',
          SENTRY_DSN: 'https://example@sentry.io/123',
          CORS_ORIGIN: 'https://example.com',
        };

        const validator = new EnvironmentValidator(mockEnv);
        const result = validator.validate();

        expect(result.warnings.some((w) => w.variable === 'SUPABASE_URL')).toBe(true);
      });
    });

    describe('Cross-Variable Validations', () => {
      it('should validate Lightning amount ranges', () => {
        const mockEnv = {
          NODE_ENV: 'development',
          SUPABASE_URL: 'https://test.supabase.co',
          SUPABASE_ANON_KEY: 'test-key',
          SUPABASE_SERVICE_ROLE_KEY: 'test-key',
          JWT_SECRET: 'a'.repeat(32),
          SESSION_SECRET: 'b'.repeat(32),
          LNBITS_API_URL: 'https://lnbits.test.com',
          LNBITS_ADMIN_KEY: 'test-key',
          LNBITS_INVOICE_READ_KEY: 'test-key',
          LNBITS_WEBHOOK_SECRET: 'c'.repeat(16),
          NOSTR_RELAYS: 'wss://relay.test.com',
          LIGHTNING_MIN_AMOUNT: '10000',
          LIGHTNING_MAX_AMOUNT: '5000', // Invalid: min > max
        };

        const validator = new EnvironmentValidator(mockEnv);
        const result = validator.validate();

        expect(result.success).toBe(false);
        expect(result.errors.some((e) => e.variable === 'LIGHTNING_MIN_AMOUNT')).toBe(true);
      });
    });
  });

  describe('Utility Functions', () => {
    describe('validateEnvironmentOnStartup()', () => {
      it('should return validation result without exiting', () => {
        const mockEnv = {
          NODE_ENV: 'test',
          SUPABASE_URL: 'https://test.supabase.co',
          SUPABASE_ANON_KEY: 'test-key',
          SUPABASE_SERVICE_ROLE_KEY: 'test-key',
          JWT_SECRET: 'a'.repeat(32),
          SESSION_SECRET: 'b'.repeat(32),
          LNBITS_API_URL: 'https://lnbits.test.com',
          LNBITS_ADMIN_KEY: 'test-key',
          LNBITS_INVOICE_READ_KEY: 'test-key',
          LNBITS_WEBHOOK_SECRET: 'c'.repeat(16),
          NOSTR_RELAYS: 'wss://relay.test.com',
        };

        const result = validateEnvironmentOnStartup(mockEnv, false);

        expect(result).toBeDefined();
        expect(result.summary).toBeDefined();
      });
    });

    describe('getValidatedConfig()', () => {
      it('should return validated config object', () => {
        const mockEnv = {
          NODE_ENV: 'development',
          SUPABASE_URL: 'https://test.supabase.co',
          SUPABASE_ANON_KEY: 'test-key',
          SUPABASE_SERVICE_ROLE_KEY: 'test-key',
          JWT_SECRET: 'a'.repeat(32),
          SESSION_SECRET: 'b'.repeat(32),
          LNBITS_API_URL: 'https://lnbits.test.com',
          LNBITS_ADMIN_KEY: 'test-key',
          LNBITS_INVOICE_READ_KEY: 'test-key',
          LNBITS_WEBHOOK_SECRET: 'c'.repeat(16),
          NOSTR_RELAYS: 'wss://relay.test.com',
        };

        const config = getValidatedConfig(mockEnv);

        expect(config).toBeDefined();
        expect(config.NODE_ENV).toBe('development');
      });

      it('should throw on validation failure', () => {
        const mockEnv = {
          NODE_ENV: 'development',
          // Missing required variables
        };

        expect(() => getValidatedConfig(mockEnv)).toThrow('Environment validation failed');
      });
    });

    describe('isFeatureEnabled()', () => {
      it('should return true for enabled features', () => {
        const mockEnv = {
          FEATURE_LIGHTNING_PAYMENTS: 'true',
        };

        expect(isFeatureEnabled('FEATURE_LIGHTNING_PAYMENTS', mockEnv)).toBe(true);
      });

      it('should return true for "1" value', () => {
        const mockEnv = {
          FEATURE_AI_CONTENT_GENERATION: '1',
        };

        expect(isFeatureEnabled('FEATURE_AI_CONTENT_GENERATION', mockEnv)).toBe(true);
      });

      it('should return false for disabled features', () => {
        const mockEnv = {
          FEATURE_NOSTR_PUBLISHING: 'false',
        };

        expect(isFeatureEnabled('FEATURE_NOSTR_PUBLISHING', mockEnv)).toBe(false);
      });

      it('should return false for missing features', () => {
        const mockEnv = {};

        expect(isFeatureEnabled('FEATURE_NONEXISTENT', mockEnv)).toBe(false);
      });
    });

    describe('getRequiredEnvVar()', () => {
      it('should return variable value', () => {
        const mockEnv = {
          DATABASE_URL: 'postgresql://localhost:5432/db',
        };

        expect(getRequiredEnvVar('DATABASE_URL', mockEnv)).toBe('postgresql://localhost:5432/db');
      });

      it('should throw when variable is missing', () => {
        const mockEnv = {};

        expect(() => getRequiredEnvVar('DATABASE_URL', mockEnv)).toThrow(
          'Required environment variable DATABASE_URL is not set'
        );
      });

      it('should throw when variable is empty', () => {
        const mockEnv = {
          DATABASE_URL: '',
        };

        expect(() => getRequiredEnvVar('DATABASE_URL', mockEnv)).toThrow(
          'Required environment variable DATABASE_URL is not set'
        );
      });
    });

    describe('getEnvVar()', () => {
      it('should return variable value', () => {
        const mockEnv = {
          LOG_LEVEL: 'debug',
        };

        expect(getEnvVar('LOG_LEVEL', 'info', mockEnv)).toBe('debug');
      });

      it('should return default when variable is missing', () => {
        const mockEnv = {};

        expect(getEnvVar('LOG_LEVEL', 'info', mockEnv)).toBe('info');
      });
    });
  });

  describe('Type Safety', () => {
    it('should have proper EnvVarValue type', () => {
      const value1: EnvVarValue = 'string';
      const value2: EnvVarValue = 123;
      const value3: EnvVarValue = true;
      const value4: EnvVarValue = new URL('https://example.com');

      expect(typeof value1).toBe('string');
      expect(typeof value2).toBe('number');
      expect(typeof value3).toBe('boolean');
      expect(value4).toBeInstanceOf(URL);
    });

    it('should have proper ValidationResult type', () => {
      const result: ValidationResult = {
        success: true,
        errors: [],
        warnings: [],
        config: {},
        summary: {
          total: 10,
          validated: 10,
          errors: 0,
          warnings: 0,
          categories: ['Core', 'Security'],
        },
      };

      expect(result.success).toBe(true);
      expect(result.summary.total).toBe(10);
    });

    it('should have proper ValidationError type', () => {
      const error: ValidationError = {
        variable: 'JWT_SECRET',
        message: 'Secret too short',
        category: 'Security',
        severity: 'error',
      };

      expect(error.severity).toBe('error');
    });
  });

  describe('VALIDATION_RULES', () => {
    it('should have all required validation rules defined', () => {
      expect(VALIDATION_RULES.NODE_ENV).toBeDefined();
      expect(VALIDATION_RULES.SUPABASE_URL).toBeDefined();
      expect(VALIDATION_RULES.JWT_SECRET).toBeDefined();
      expect(VALIDATION_RULES.LNBITS_API_URL).toBeDefined();
      expect(VALIDATION_RULES.NOSTR_RELAYS).toBeDefined();
    });

    it('should have proper categories', () => {
      expect(VALIDATION_RULES.NODE_ENV.category).toBe('Core');
      expect(VALIDATION_RULES.JWT_SECRET.category).toBe('Security');
      expect(VALIDATION_RULES.LNBITS_API_URL.category).toBe('Lightning');
      expect(VALIDATION_RULES.NOSTR_RELAYS.category).toBe('NOSTR');
    });

    it('should have proper required flags', () => {
      expect(VALIDATION_RULES.NODE_ENV.required).toBe(true);
      expect(VALIDATION_RULES.PORT.required).toBe(false);
    });
  });
});
