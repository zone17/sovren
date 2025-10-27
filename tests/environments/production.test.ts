/**
 * Production Environment Validation Tests
 *
 * Validates that production environment is properly configured
 * with strict security, performance optimizations, and production-ready settings.
 */

import { productionConfig } from '../../config/environments/production';

describe('Production Environment Configuration', () => {
  describe('Environment Identity', () => {
    it('should be configured as production environment', () => {
      expect(productionConfig.environment).toBe('production');
    });
  });

  describe('API Configuration', () => {
    it('should have production API endpoint', () => {
      expect(productionConfig.api.url).not.toContain('staging');
      expect(productionConfig.api.url).not.toContain('localhost');
      expect(productionConfig.api.url).toContain('https://');
    });

    it('should have strict timeout for performance', () => {
      expect(productionConfig.api.timeout).toBeLessThanOrEqual(10000);
    });

    it('should have higher retry count for reliability', () => {
      expect(productionConfig.api.retries).toBeGreaterThanOrEqual(5);
    });

    it('should have strict rate limiting', () => {
      expect(productionConfig.api.rateLimit).toBeDefined();
      expect(productionConfig.api.rateLimit.maxRequests).toBeGreaterThan(0);
      expect(productionConfig.api.rateLimit.windowMs).toBeGreaterThan(0);
    });
  });

  describe('Database Configuration', () => {
    it('should have maximum connection pool', () => {
      expect(productionConfig.database.poolSize).toBe(50);
      expect(productionConfig.database.poolSize).toBeLessThanOrEqual(100); // Free tier max
    });

    it('should require SSL connections', () => {
      expect(productionConfig.database.ssl).toBe(true);
    });

    it('should have replication enabled', () => {
      expect(productionConfig.database.replication).toBe(true);
    });

    it('should have strict timeouts', () => {
      expect(productionConfig.database.connectionTimeout).toBeLessThanOrEqual(15000);
      expect(productionConfig.database.idleTimeout).toBeGreaterThan(0);
    });
  });

  describe('Redis Configuration', () => {
    it('should have Redis URL configured', () => {
      expect(productionConfig.redis.url).toBeDefined();
    });

    it('should have longer TTL for production', () => {
      expect(productionConfig.redis.ttl).toBe(7200); // 2 hours
      expect(productionConfig.redis.ttl).toBeGreaterThan(3600);
    });

    it('should have higher retry count', () => {
      expect(productionConfig.redis.maxRetries).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Logging Configuration', () => {
    it('should have error-only logging in production', () => {
      expect(productionConfig.logging.level).toBe('error');
    });

    it('should have performance logging disabled', () => {
      expect(productionConfig.logging.performance).toBe(false);
    });

    it('should have JSON logging (not pretty print)', () => {
      expect(productionConfig.logging.prettyPrint).toBe(false);
    });
  });

  describe('Feature Flags', () => {
    it('should have beta features DISABLED', () => {
      expect(productionConfig.features.enableBeta).toBe(false);
    });

    it('should have debug tools DISABLED', () => {
      expect(productionConfig.features.enableDebugTools).toBe(false);
    });

    it('should have performance monitoring enabled', () => {
      expect(productionConfig.features.enablePerformanceMonitoring).toBe(true);
    });

    it('should have error tracking enabled', () => {
      expect(productionConfig.features.enableErrorTracking).toBe(true);
    });
  });

  describe('Security Configuration', () => {
    it('should have CORS origins configured', () => {
      expect(productionConfig.security.corsOrigins).toBeDefined();
      expect(Array.isArray(productionConfig.security.corsOrigins)).toBe(true);
      expect(productionConfig.security.corsOrigins.length).toBeGreaterThan(0);
    });

    it('should NOT include staging or localhost in CORS', () => {
      const hasStaging = productionConfig.security.corsOrigins.some(
        origin => origin.includes('staging')
      );
      const hasLocalhost = productionConfig.security.corsOrigins.some(
        origin => origin.includes('localhost')
      );

      expect(hasStaging).toBe(false);
      expect(hasLocalhost).toBe(false);
    });

    it('should only include production domains', () => {
      productionConfig.security.corsOrigins.forEach(origin => {
        expect(origin).toContain('https://');
        expect(origin).not.toContain('localhost');
        expect(origin).not.toContain('staging');
      });
    });

    it('should have secure cookies enabled', () => {
      expect(productionConfig.security.secureCookies).toBe(true);
    });

    it('should have Helmet security headers enabled', () => {
      expect(productionConfig.security.helmetEnabled).toBe(true);
    });

    it('should have rate limiting enabled', () => {
      expect(productionConfig.security.rateLimitEnabled).toBe(true);
    });
  });

  describe('CDN Configuration', () => {
    it('should have CDN enabled', () => {
      expect(productionConfig.cdn.enabled).toBe(true);
    });

    it('should have CDN URL configured', () => {
      expect(productionConfig.cdn.url).toBeDefined();
      expect(productionConfig.cdn.url).toContain('https://');
    });
  });

  describe('Monitoring Configuration', () => {
    it('should have Sentry environment set to production', () => {
      expect(productionConfig.monitoring.sentryEnvironment).toBe('production');
    });

    it('should have reduced sample rate for cost optimization', () => {
      expect(productionConfig.monitoring.sampleRate).toBeLessThan(1.0);
      expect(productionConfig.monitoring.sampleRate).toBeGreaterThan(0);
    });
  });

  describe('Production Security Checks', () => {
    it('should have all critical security features enabled', () => {
      expect(productionConfig.database.ssl).toBe(true);
      expect(productionConfig.security.secureCookies).toBe(true);
      expect(productionConfig.security.helmetEnabled).toBe(true);
      expect(productionConfig.security.rateLimitEnabled).toBe(true);
    });

    it('should have no debug features enabled', () => {
      expect(productionConfig.features.enableDebugTools).toBe(false);
      expect(productionConfig.logging.level).not.toBe('debug');
      expect(productionConfig.logging.level).not.toBe('trace');
    });

    it('should use HTTPS for all external URLs', () => {
      expect(productionConfig.api.url).toContain('https://');
      expect(productionConfig.cdn.url).toContain('https://');
    });
  });

  describe('Production Performance Checks', () => {
    it('should have optimized timeouts', () => {
      expect(productionConfig.api.timeout).toBeLessThanOrEqual(10000);
      expect(productionConfig.database.connectionTimeout).toBeLessThanOrEqual(15000);
    });

    it('should have high connection pools for performance', () => {
      expect(productionConfig.database.poolSize).toBeGreaterThanOrEqual(50);
    });

    it('should have optimized cache TTLs', () => {
      expect(productionConfig.redis.ttl).toBeGreaterThan(3600); // > 1 hour
    });

    it('should have JSON logging for parsing', () => {
      expect(productionConfig.logging.prettyPrint).toBe(false);
    });
  });
});

describe('Production Environment Health Checks', () => {
  it('should validate configuration completeness', () => {
    const requiredKeys = [
      'environment',
      'api',
      'database',
      'redis',
      'logging',
      'features',
      'security',
      'cdn',
      'monitoring',
    ];

    requiredKeys.forEach(key => {
      expect(productionConfig).toHaveProperty(key);
    });
  });

  it('should have no undefined critical values', () => {
    expect(productionConfig.environment).toBeDefined();
    expect(productionConfig.api.url).toBeDefined();
    expect(productionConfig.logging.level).toBeDefined();
    expect(productionConfig.cdn.url).toBeDefined();
  });

  it('should pass production readiness checklist', () => {
    const checks = {
      'Error-only logging': productionConfig.logging.level === 'error',
      'No debug tools': !productionConfig.features.enableDebugTools,
      'No beta features': !productionConfig.features.enableBeta,
      'Secure cookies': productionConfig.security.secureCookies,
      'SSL required': productionConfig.database.ssl,
      'CDN enabled': productionConfig.cdn.enabled,
      'Monitoring enabled': productionConfig.features.enableErrorTracking,
    };

    Object.entries(checks).forEach(([check, passed]) => {
      expect(passed).toBe(true);
    });
  });
});
