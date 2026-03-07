/**
 * Staging Environment Validation Tests
 *
 * Validates that staging environment is properly configured
 * with production parity and appropriate staging-specific settings.
 */

import { stagingConfig } from '../../config/environments/staging';

describe('Staging Environment Configuration', () => {
  describe('Environment Identity', () => {
    it('should be configured as staging environment', () => {
      expect(stagingConfig.environment).toBe('staging');
    });
  });

  describe('API Configuration', () => {
    it('should have staging API endpoint', () => {
      expect(stagingConfig.api.url).toContain('staging');
    });

    it('should have generous timeout for testing', () => {
      expect(stagingConfig.api.timeout).toBeGreaterThanOrEqual(30000);
    });

    it('should have retry configuration', () => {
      expect(stagingConfig.api.retries).toBeGreaterThanOrEqual(1);
    });

    it('should have rate limiting configured', () => {
      expect(stagingConfig.api.rateLimit).toBeDefined();
      expect(stagingConfig.api.rateLimit.maxRequests).toBeGreaterThan(0);
    });
  });

  describe('Database Configuration', () => {
    it('should have moderate connection pool', () => {
      expect(stagingConfig.database.poolSize).toBe(10);
      expect(stagingConfig.database.poolSize).toBeLessThanOrEqual(50); // Free tier limit
    });

    it('should require SSL connections', () => {
      expect(stagingConfig.database.ssl).toBe(true);
    });

    it('should have appropriate timeouts', () => {
      expect(stagingConfig.database.connectionTimeout).toBeGreaterThan(0);
      expect(stagingConfig.database.idleTimeout).toBeGreaterThan(0);
    });
  });

  describe('Redis Configuration', () => {
    it('should have Redis URL configured', () => {
      expect(stagingConfig.redis.url).toBeDefined();
    });

    it('should have appropriate TTL', () => {
      expect(stagingConfig.redis.ttl).toBe(3600); // 1 hour
      expect(stagingConfig.redis.ttl).toBeGreaterThan(0);
    });

    it('should have retry configuration', () => {
      expect(stagingConfig.redis.maxRetries).toBeGreaterThanOrEqual(1);
      expect(stagingConfig.redis.retryDelay).toBeGreaterThan(0);
    });
  });

  describe('Logging Configuration', () => {
    it('should have debug logging enabled', () => {
      expect(stagingConfig.logging.level).toBe('debug');
    });

    it('should have performance logging enabled', () => {
      expect(stagingConfig.logging.performance).toBe(true);
    });

    it('should have pretty printing enabled for readability', () => {
      expect(stagingConfig.logging.prettyPrint).toBe(true);
    });
  });

  describe('Feature Flags', () => {
    it('should have beta features enabled', () => {
      expect(stagingConfig.features.enableBeta).toBe(true);
    });

    it('should have debug tools enabled', () => {
      expect(stagingConfig.features.enableDebugTools).toBe(true);
    });

    it('should have performance monitoring enabled', () => {
      expect(stagingConfig.features.enablePerformanceMonitoring).toBe(true);
    });

    it('should have error tracking enabled', () => {
      expect(stagingConfig.features.enableErrorTracking).toBe(true);
    });
  });

  describe('Security Configuration', () => {
    it('should have CORS origins configured', () => {
      expect(stagingConfig.security.corsOrigins).toBeDefined();
      expect(Array.isArray(stagingConfig.security.corsOrigins)).toBe(true);
      expect(stagingConfig.security.corsOrigins.length).toBeGreaterThan(0);
    });

    it('should include staging domain in CORS origins', () => {
      const hasStaging = stagingConfig.security.corsOrigins.some((origin) =>
        origin.includes('staging')
      );
      expect(hasStaging).toBe(true);
    });

    it('should allow localhost for testing', () => {
      const hasLocalhost = stagingConfig.security.corsOrigins.some((origin) =>
        origin.includes('localhost')
      );
      expect(hasLocalhost).toBe(true);
    });

    it('should have secure cookies enabled', () => {
      expect(stagingConfig.security.secureCookies).toBe(true);
    });

    it('should have Helmet security headers enabled', () => {
      expect(stagingConfig.security.helmetEnabled).toBe(true);
    });

    it('should have rate limiting enabled', () => {
      expect(stagingConfig.security.rateLimitEnabled).toBe(true);
    });
  });

  describe('Monitoring Configuration', () => {
    it('should have Sentry environment set to staging', () => {
      expect(stagingConfig.monitoring.sentryEnvironment).toBe('staging');
    });

    it('should have 100% sample rate for staging', () => {
      expect(stagingConfig.monitoring.sampleRate).toBe(1.0);
    });
  });

  describe('Production Parity', () => {
    it('should mirror production security settings', () => {
      // Staging should have same security as production
      expect(stagingConfig.security.secureCookies).toBe(true);
      expect(stagingConfig.security.helmetEnabled).toBe(true);
      expect(stagingConfig.security.rateLimitEnabled).toBe(true);
    });

    it('should use SSL for database connections', () => {
      expect(stagingConfig.database.ssl).toBe(true);
    });

    it('should have monitoring enabled', () => {
      expect(stagingConfig.features.enablePerformanceMonitoring).toBe(true);
      expect(stagingConfig.features.enableErrorTracking).toBe(true);
    });
  });
});

describe('Staging Environment Health Checks', () => {
  it('should validate configuration completeness', () => {
    const requiredKeys = [
      'environment',
      'api',
      'database',
      'redis',
      'logging',
      'features',
      'security',
      'monitoring',
    ];

    requiredKeys.forEach((key) => {
      expect(stagingConfig).toHaveProperty(key);
    });
  });

  it('should have no undefined critical values', () => {
    expect(stagingConfig.environment).toBeDefined();
    expect(stagingConfig.api.url).toBeDefined();
    expect(stagingConfig.logging.level).toBeDefined();
  });
});
