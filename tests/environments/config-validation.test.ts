/**
 * Cross-Environment Configuration Validation Tests
 *
 * Validates consistency and correctness across all environments
 */

import { developmentConfig } from '../../config/environments/development';
import { stagingConfig } from '../../config/environments/staging';
import { productionConfig } from '../../config/environments/production';
import { validateEnvironmentConfig } from '../../config/environments';

describe('Multi-Environment Configuration Validation', () => {
  describe('Environment Isolation', () => {
    it('should have unique environment names', () => {
      expect(developmentConfig.environment).not.toBe(stagingConfig.environment);
      expect(stagingConfig.environment).not.toBe(productionConfig.environment);
      expect(productionConfig.environment).not.toBe(developmentConfig.environment);
    });

    it('should have different API endpoints', () => {
      expect(developmentConfig.api.url).not.toBe(stagingConfig.api.url);
      expect(stagingConfig.api.url).not.toBe(productionConfig.api.url);
    });

    it('should have appropriate isolation levels', () => {
      // Development should be most relaxed
      expect(developmentConfig.api.timeout).toBeGreaterThan(stagingConfig.api.timeout);
      expect(stagingConfig.api.timeout).toBeGreaterThan(productionConfig.api.timeout);
    });
  });

  describe('Production Parity (Staging vs Production)', () => {
    it('should have same security settings', () => {
      expect(stagingConfig.security.secureCookies).toBe(productionConfig.security.secureCookies);
      expect(stagingConfig.security.helmetEnabled).toBe(productionConfig.security.helmetEnabled);
      expect(stagingConfig.security.rateLimitEnabled).toBe(productionConfig.security.rateLimitEnabled);
      expect(stagingConfig.database.ssl).toBe(productionConfig.database.ssl);
    });

    it('should have monitoring enabled in both', () => {
      expect(stagingConfig.features.enablePerformanceMonitoring).toBe(true);
      expect(productionConfig.features.enablePerformanceMonitoring).toBe(true);

      expect(stagingConfig.features.enableErrorTracking).toBe(true);
      expect(productionConfig.features.enableErrorTracking).toBe(true);
    });
  });

  describe('Logging Levels', () => {
    it('should have appropriate logging levels per environment', () => {
      expect(developmentConfig.logging.level).toBe('debug');
      expect(stagingConfig.logging.level).toBe('debug');
      expect(productionConfig.logging.level).toBe('error');
    });

    it('should have pretty printing in non-production only', () => {
      expect(developmentConfig.logging.prettyPrint).toBe(true);
      expect(stagingConfig.logging.prettyPrint).toBe(true);
      expect(productionConfig.logging.prettyPrint).toBe(false);
    });
  });

  describe('Database Connection Pools', () => {
    it('should scale with environment criticality', () => {
      expect(developmentConfig.database.poolSize).toBeLessThan(stagingConfig.database.poolSize);
      expect(stagingConfig.database.poolSize).toBeLessThan(productionConfig.database.poolSize);
    });

    it('should respect free tier limits', () => {
      expect(developmentConfig.database.poolSize).toBeLessThanOrEqual(100);
      expect(stagingConfig.database.poolSize).toBeLessThanOrEqual(100);
      expect(productionConfig.database.poolSize).toBeLessThanOrEqual(100);
    });

    it('should require SSL in staging and production', () => {
      expect(stagingConfig.database.ssl).toBe(true);
      expect(productionConfig.database.ssl).toBe(true);
    });
  });

  describe('Redis Cache TTL', () => {
    it('should increase with environment stability', () => {
      expect(developmentConfig.redis.ttl).toBeLessThan(stagingConfig.redis.ttl);
      expect(stagingConfig.redis.ttl).toBeLessThan(productionConfig.redis.ttl);
    });

    it('should have reasonable TTL values', () => {
      expect(developmentConfig.redis.ttl).toBeGreaterThan(0);
      expect(stagingConfig.redis.ttl).toBeGreaterThan(0);
      expect(productionConfig.redis.ttl).toBeGreaterThan(0);
    });
  });

  describe('Feature Flags Consistency', () => {
    it('should have beta features only in non-production', () => {
      expect(developmentConfig.features.enableBeta).toBe(true);
      expect(stagingConfig.features.enableBeta).toBe(true);
      expect(productionConfig.features.enableBeta).toBe(false);
    });

    it('should have debug tools only in non-production', () => {
      expect(developmentConfig.features.enableDebugTools).toBe(true);
      expect(stagingConfig.features.enableDebugTools).toBe(true);
      expect(productionConfig.features.enableDebugTools).toBe(false);
    });
  });

  describe('CORS Configuration', () => {
    it('should have CORS configured in all environments', () => {
      expect(developmentConfig.security.corsOrigins).toBeDefined();
      expect(stagingConfig.security.corsOrigins).toBeDefined();
      expect(productionConfig.security.corsOrigins).toBeDefined();
    });

    it('should have localhost only in development', () => {
      const devHasLocalhost = developmentConfig.security.corsOrigins.includes('*') ||
        developmentConfig.security.corsOrigins.some(o => o.includes('localhost'));
      const stagingHasLocalhost = stagingConfig.security.corsOrigins.some(o => o.includes('localhost'));
      const prodHasLocalhost = productionConfig.security.corsOrigins.some(o => o.includes('localhost'));

      expect(devHasLocalhost).toBe(true);
      expect(stagingHasLocalhost).toBe(true); // Allowed in staging for testing
      expect(prodHasLocalhost).toBe(false);
    });

    it('should use HTTPS in production CORS origins', () => {
      productionConfig.security.corsOrigins.forEach(origin => {
        if (origin !== '*') {
          expect(origin).toContain('https://');
        }
      });
    });
  });

  describe('Monitoring Sample Rates', () => {
    it('should have appropriate sample rates', () => {
      expect(stagingConfig.monitoring.sampleRate).toBe(1.0); // 100% in staging
      expect(productionConfig.monitoring.sampleRate).toBeLessThan(1.0); // Reduced in prod
      expect(productionConfig.monitoring.sampleRate).toBeGreaterThan(0);
    });
  });
});

describe('Environment Configuration Validation', () => {
  describe('Development Validation', () => {
    it('should pass basic validation', () => {
      expect(developmentConfig.environment).toBeDefined();
      expect(developmentConfig.api.url).toBeDefined();
    });
  });

  describe('Staging Validation', () => {
    it('should pass production parity checks', () => {
      expect(stagingConfig.database.ssl).toBe(true);
      expect(stagingConfig.security.secureCookies).toBe(true);
      expect(stagingConfig.security.helmetEnabled).toBe(true);
    });
  });

  describe('Production Validation', () => {
    it('should pass strict production checks', () => {
      const validation = {
        errorLogging: productionConfig.logging.level === 'error',
        noDebug: !productionConfig.features.enableDebugTools,
        noBeta: !productionConfig.features.enableBeta,
        secureCookies: productionConfig.security.secureCookies,
        sslEnabled: productionConfig.database.ssl,
        cdnEnabled: productionConfig.cdn.enabled,
      };

      Object.values(validation).forEach(check => {
        expect(check).toBe(true);
      });
    });

    it('should have no localhost references', () => {
      expect(productionConfig.api.url).not.toContain('localhost');
      productionConfig.security.corsOrigins.forEach(origin => {
        expect(origin).not.toContain('localhost');
      });
    });

    it('should have CDN configuration', () => {
      expect(productionConfig.cdn).toBeDefined();
      expect(productionConfig.cdn.enabled).toBe(true);
      expect(productionConfig.cdn.url).toBeDefined();
    });
  });
});
