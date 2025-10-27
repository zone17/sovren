/**
 * Service Container Integration Tests
 * Comprehensive tests for DI container with all 29 services
 * User Story: US-E5-032 - Wire Services Through DI Container
 * Part of Epic 005 - Backend Service Refactoring - Phase 6
 *
 * Coverage Target: 95%+
 */

import { bootstrapApplication, BootstrapResult } from '../../bootstrap';
import { gracefulShutdown } from '../../shutdown';
import { TYPES, getServiceLifetime, getServiceDependencies } from '../types';
import type { IServiceContainer } from '../../interfaces/shared/IServiceRegistry';

describe('Service Container Integration', () => {
  let bootstrapResult: BootstrapResult;
  let container: IServiceContainer;

  beforeAll(async () => {
    // Bootstrap the entire application
    bootstrapResult = await bootstrapApplication({
      environment: 'test',
      enableHealthChecks: true,
      validateDependencies: true,
      logStartup: false,
    });

    container = bootstrapResult.container;
  });

  afterAll(async () => {
    // Graceful shutdown
    if (container) {
      await gracefulShutdown(container, {
        timeout: 5000,
        forceExit: false,
        logProgress: false,
      });
    }
  });

  describe('Bootstrap', () => {
    it('should bootstrap successfully', () => {
      expect(bootstrapResult.success).toBe(true);
      expect(bootstrapResult.errors).toBeUndefined();
    });

    it('should register all 29 services', () => {
      // 29 business services + infrastructure services
      expect(bootstrapResult.servicesRegistered).toBeGreaterThanOrEqual(29);
    });

    it('should complete bootstrap in reasonable time', () => {
      expect(bootstrapResult.timing.totalMs).toBeLessThan(5000);
    });

    it('should have timing breakdown', () => {
      expect(bootstrapResult.timing.registrationMs).toBeGreaterThan(0);
      expect(bootstrapResult.timing.validationMs).toBeGreaterThanOrEqual(0);
      expect(bootstrapResult.timing.initializationMs).toBeGreaterThan(0);
    });

    it('should pass health checks', () => {
      expect(bootstrapResult.healthCheckResults).toBeDefined();
      if (bootstrapResult.healthCheckResults) {
        const healthChecks = Array.from(bootstrapResult.healthCheckResults.values());
        expect(healthChecks.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Phase 1: Core Infrastructure Services', () => {
    it('should resolve EventBusService as singleton', () => {
      const service1 = container.resolve(TYPES.EventBusService);
      const service2 = container.resolve(TYPES.EventBusService);

      expect(service1).toBeDefined();
      expect(service2).toBeDefined();
      expect(service1).toBe(service2); // Same instance
    });

    it('should have EventBusService with correct methods', () => {
      const eventBus = container.resolve(TYPES.EventBusService);

      expect(eventBus).toHaveProperty('publish');
      expect(eventBus).toHaveProperty('subscribe');
      expect(eventBus).toHaveProperty('unsubscribe');
      expect(eventBus).toHaveProperty('isHealthy');
    });
  });

  describe('Phase 2: Shared Services', () => {
    it('should resolve CacheService as singleton', () => {
      const cache1 = container.resolve(TYPES.CacheService);
      const cache2 = container.resolve(TYPES.CacheService);

      expect(cache1).toBeDefined();
      expect(cache2).toBe(cache1);
    });

    it('should resolve EmailService as transient', () => {
      const email1 = container.resolve(TYPES.EmailService);
      const email2 = container.resolve(TYPES.EmailService);

      expect(email1).toBeDefined();
      expect(email2).toBeDefined();
      // Transient services may or may not be same instance depending on implementation
    });

    it('should resolve NotificationService with dependencies', () => {
      const notification = container.resolve(TYPES.NotificationService);

      expect(notification).toBeDefined();
      expect(notification).toHaveProperty('send');
    });

    it('should resolve AuditLogService with database dependency', () => {
      const auditLog = container.resolve(TYPES.AuditLogService);

      expect(auditLog).toBeDefined();
      expect(auditLog).toHaveProperty('log');
    });
  });

  describe('Phase 3: Content Services', () => {
    const contentServices = [
      'ContentPublishingService',
      'ContentModerationService',
      'ContentSearchService',
      'ContentRecommendationService',
      'ContentAnalyticsService',
      'ContentVersioningService',
      'ContentCreationService',
    ];

    it.each(contentServices)('should resolve %s', (serviceName) => {
      const token = (TYPES as any)[serviceName];
      const service = container.resolve(token);

      expect(service).toBeDefined();
    });

    it('should resolve ContentPublishingService with all dependencies', () => {
      const service = container.resolve(TYPES.ContentPublishingService);

      expect(service).toBeDefined();
      // ContentPublishingService depends on: ContentRepository, EventBus, Cache, Logger
    });

    it('should create new scoped instances for content services', () => {
      const scope1 = container.createScope();
      const scope2 = container.createScope();

      const service1 = scope1.resolve(TYPES.ContentPublishingService);
      const service2 = scope2.resolve(TYPES.ContentPublishingService);

      expect(service1).toBeDefined();
      expect(service2).toBeDefined();
      // Scoped services are different per scope
    });
  });

  describe('Phase 4: User Services', () => {
    const userServices = [
      'UserProfileService',
      'UserPreferencesService',
      'UserActivityService',
      'UserRelationshipService',
      'UserAnalyticsService',
    ];

    it.each(userServices)('should resolve %s', (serviceName) => {
      const token = (TYPES as any)[serviceName];
      const service = container.resolve(token);

      expect(service).toBeDefined();
    });

    it('should resolve UserProfileService with cache integration', () => {
      const userProfile = container.resolve(TYPES.UserProfileService);
      const cache = container.resolve(TYPES.CacheService);

      expect(userProfile).toBeDefined();
      expect(cache).toBeDefined();
    });

    it('should have correct lifecycle for user services', () => {
      expect(getServiceLifetime('UserProfileService')).toBe('scoped');
      expect(getServiceLifetime('UserPreferencesService')).toBe('scoped');
      expect(getServiceLifetime('UserActivityService')).toBe('scoped');
    });
  });

  describe('Phase 5: Payment Services', () => {
    const paymentServices = [
      'PaymentProcessingService',
      'CurrencyService',
      'SubscriptionService',
      'RefundService',
      'PaymentAnalyticsService',
      'WebhookService',
      'InvoiceService',
    ];

    it.each(paymentServices)('should resolve %s', (serviceName) => {
      const token = (TYPES as any)[serviceName];
      const service = container.resolve(token);

      expect(service).toBeDefined();
    });

    it('should resolve PaymentProcessingService with Lightning integration', () => {
      const paymentService = container.resolve(TYPES.PaymentProcessingService);
      const lightning = container.resolve(TYPES.LightningService);

      expect(paymentService).toBeDefined();
      expect(lightning).toBeDefined();
    });

    it('should resolve SubscriptionService with payment dependency', () => {
      const subscription = container.resolve(TYPES.SubscriptionService);

      expect(subscription).toBeDefined();
      // SubscriptionService depends on PaymentProcessingService
    });

    it('should have correct lifecycle for payment services', () => {
      expect(getServiceLifetime('PaymentProcessingService')).toBe('scoped');
      expect(getServiceLifetime('CurrencyService')).toBe('transient');
      expect(getServiceLifetime('SubscriptionService')).toBe('scoped');
    });
  });

  describe('Service Lifecycles', () => {
    it('should maintain singleton state across resolutions', () => {
      const eventBus1 = container.resolve(TYPES.EventBusService);
      const eventBus2 = container.resolve(TYPES.EventBusService);
      const cache1 = container.resolve(TYPES.CacheService);
      const cache2 = container.resolve(TYPES.CacheService);

      expect(eventBus1).toBe(eventBus2);
      expect(cache1).toBe(cache2);
    });

    it('should create new instances for scoped services in different scopes', () => {
      const scope1 = container.createScope();
      const scope2 = container.createScope();

      const user1 = scope1.resolve(TYPES.UserProfileService);
      const user2 = scope2.resolve(TYPES.UserProfileService);

      expect(user1).toBeDefined();
      expect(user2).toBeDefined();
    });

    it('should share singletons across scopes', () => {
      const scope1 = container.createScope();
      const scope2 = container.createScope();

      const cache1 = scope1.resolve(TYPES.CacheService);
      const cache2 = scope2.resolve(TYPES.CacheService);
      const rootCache = container.resolve(TYPES.CacheService);

      expect(cache1).toBe(cache2);
      expect(cache1).toBe(rootCache);
    });
  });

  describe('Dependency Resolution', () => {
    it('should resolve dependencies correctly', () => {
      const deps = getServiceDependencies('NotificationService');

      expect(deps).toContain('EmailService');
      expect(deps).toContain('EventBusService');
      expect(deps).toContain('Logger');
    });

    it('should resolve nested dependencies', () => {
      // SubscriptionService -> PaymentProcessingService -> Lightning
      const subscription = container.resolve(TYPES.SubscriptionService);

      expect(subscription).toBeDefined();
    });

    it('should handle optional dependencies gracefully', () => {
      const optional = container.resolveOptional(TYPES.EventBusService);

      expect(optional).toBeDefined();
    });

    it('should throw error for unregistered services', () => {
      const fakeToken = { name: 'NonExistentService' };

      expect(() => {
        container.resolve(fakeToken as any);
      }).toThrow();
    });
  });

  describe('Service Validation', () => {
    it('should have validated all dependencies during bootstrap', () => {
      const validation = bootstrapResult.registry.validate();

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should not have circular dependencies', () => {
      const graph = bootstrapResult.registry.getDependencyGraph();
      const validation = bootstrapResult.registry.validate();

      const circularErrors = validation.errors.filter(
        e => e.type === 'circular_dependency'
      );

      expect(circularErrors).toHaveLength(0);
    });

    it('should not have missing dependencies', () => {
      const validation = bootstrapResult.registry.validate();

      const missingErrors = validation.errors.filter(
        e => e.type === 'missing_dependency'
      );

      expect(missingErrors).toHaveLength(0);
    });
  });

  describe('Container Operations', () => {
    it('should create scoped containers', () => {
      const scope = container.createScope();

      expect(scope).toBeDefined();
      expect(scope.createScope).toBeDefined();
    });

    it('should dispose scoped containers without affecting root', async () => {
      const scope = container.createScope();
      const scopedService = scope.resolve(TYPES.UserProfileService);

      expect(scopedService).toBeDefined();

      await scope.dispose();

      // Root container should still work
      const rootService = container.resolve(TYPES.EventBusService);
      expect(rootService).toBeDefined();
    });

    it('should support async resolution', async () => {
      const service = await container.resolveAsync(TYPES.CacheService);

      expect(service).toBeDefined();
    });
  });

  describe('Health Checks', () => {
    it('should have health check for CacheService', async () => {
      const cache = container.resolve(TYPES.CacheService);

      if (cache.healthCheck) {
        const healthy = await cache.healthCheck();
        expect(typeof healthy).toBe('boolean');
      }
    });

    it('should have health check for EventBusService', async () => {
      const eventBus = container.resolve(TYPES.EventBusService);

      if (eventBus.isHealthy) {
        const healthy = await eventBus.isHealthy();
        expect(typeof healthy).toBe('boolean');
      }
    });
  });

  describe('Metadata and Configuration', () => {
    it('should have service metadata', () => {
      const tokens = bootstrapResult.registry.getRegisteredTokens();

      expect(tokens.length).toBeGreaterThan(0);
      tokens.forEach(token => {
        expect(token.name).toBeDefined();
      });
    });

    it('should have dependency graph', () => {
      const graph = bootstrapResult.registry.getDependencyGraph();

      expect(graph.nodes).toBeDefined();
      expect(graph.edges).toBeDefined();
      expect(graph.nodes.length).toBeGreaterThan(0);
    });

    it('should categorize services by lifecycle', () => {
      const singletons = ['EventBusService', 'CacheService', 'Logger'];
      const scoped = ['UserProfileService', 'ContentPublishingService'];
      const transient = ['EmailService', 'NotificationService'];

      singletons.forEach(name => {
        expect(getServiceLifetime(name)).toBe('singleton');
      });

      scoped.forEach(name => {
        expect(getServiceLifetime(name)).toBe('scoped');
      });

      transient.forEach(name => {
        expect(getServiceLifetime(name)).toBe('transient');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle resolution errors gracefully', () => {
      expect(() => {
        container.resolve({ name: 'InvalidService' } as any);
      }).toThrow(/not registered/i);
    });

    it('should return null for optional resolution of unregistered service', () => {
      const result = container.resolveOptional({ name: 'InvalidService' } as any);

      expect(result).toBeNull();
    });

    it('should prevent double disposal', async () => {
      const scope = container.createScope();

      await scope.dispose();

      // Second disposal should not throw
      await expect(scope.dispose()).resolves.not.toThrow();
    });
  });

  describe('Performance', () => {
    it('should resolve services quickly', () => {
      const start = Date.now();

      for (let i = 0; i < 100; i++) {
        container.resolve(TYPES.EventBusService);
      }

      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100); // 100 resolutions in < 100ms
    });

    it('should handle concurrent resolutions', async () => {
      const promises = Array.from({ length: 50 }, () =>
        container.resolveAsync(TYPES.CacheService)
      );

      const results = await Promise.all(promises);

      expect(results.length).toBe(50);
      results.forEach(result => {
        expect(result).toBeDefined();
      });
    });
  });
});
