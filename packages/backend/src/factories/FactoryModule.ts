/**
 * Factory Module Registration System
 * Central registration of all service factories
 * Part of Epic 005 - Backend Service Refactoring - Story E5-004
 */

import { IServiceRegistry, IServiceModule } from '../interfaces/shared/IServiceRegistry';
import { ServiceFactoryRegistry } from './ServiceFactory';

// Import all factory implementations
import {
  PAYMENT_SERVICE_TOKENS,
  InvoiceServiceFactory,
  PaymentProcessingServiceFactory,
  SubscriptionServiceFactory,
} from './payment/PaymentServiceFactory';

import {
  CONTENT_SERVICE_TOKENS,
  ContentCreationServiceFactory,
  ContentPublishingServiceFactory,
  ContentSearchServiceFactory,
} from './content/ContentServiceFactory';

import {
  USER_SERVICE_TOKENS,
  UserAuthenticationServiceFactory,
  UserProfileServiceFactory,
  UserRelationshipServiceFactory,
} from './user/UserServiceFactory';

import {
  SHARED_SERVICE_TOKENS,
  EmailServiceFactory,
  NotificationServiceFactory,
  AuditLogServiceFactory,
  CacheServiceFactory,
} from './shared/SharedServiceFactory';

/**
 * Payment Services Module
 */
export class PaymentServicesModule implements IServiceModule {
  name = 'PaymentServices';

  register(registry: IServiceRegistry): void {
    // Register factories for payment services
    registry.registerSingletonFactory(PAYMENT_SERVICE_TOKENS.InvoiceService, (container) =>
      new InvoiceServiceFactory(container).create()
    );

    registry.registerSingletonFactory(
      PAYMENT_SERVICE_TOKENS.PaymentProcessingService,
      (container) => new PaymentProcessingServiceFactory(container).create()
    );

    registry.registerSingletonFactory(PAYMENT_SERVICE_TOKENS.SubscriptionService, (container) =>
      new SubscriptionServiceFactory(container).create()
    );
  }
}

/**
 * Content Services Module
 */
export class ContentServicesModule implements IServiceModule {
  name = 'ContentServices';

  register(registry: IServiceRegistry): void {
    // Register factories for content services
    registry.registerSingletonFactory(CONTENT_SERVICE_TOKENS.ContentCreationService, (container) =>
      new ContentCreationServiceFactory(container).create()
    );

    registry.registerSingletonFactory(
      CONTENT_SERVICE_TOKENS.ContentPublishingService,
      (container) => new ContentPublishingServiceFactory(container).create()
    );

    registry.registerSingletonFactory(CONTENT_SERVICE_TOKENS.ContentSearchService, (container) =>
      new ContentSearchServiceFactory(container).create()
    );
  }
}

/**
 * User Services Module
 */
export class UserServicesModule implements IServiceModule {
  name = 'UserServices';

  register(registry: IServiceRegistry): void {
    // Register factories for user services
    registry.registerSingletonFactory(USER_SERVICE_TOKENS.UserAuthenticationService, (container) =>
      new UserAuthenticationServiceFactory(container).create()
    );

    registry.registerSingletonFactory(USER_SERVICE_TOKENS.UserProfileService, (container) =>
      new UserProfileServiceFactory(container).create()
    );

    registry.registerSingletonFactory(USER_SERVICE_TOKENS.UserRelationshipService, (container) =>
      new UserRelationshipServiceFactory(container).create()
    );
  }
}

/**
 * Shared Services Module
 */
export class SharedServicesModule implements IServiceModule {
  name = 'SharedServices';

  register(registry: IServiceRegistry): void {
    // Register factories for shared services
    registry.registerSingletonFactory(SHARED_SERVICE_TOKENS.EmailService, (container) =>
      new EmailServiceFactory(container).create()
    );

    registry.registerSingletonFactory(SHARED_SERVICE_TOKENS.NotificationService, (container) =>
      new NotificationServiceFactory(container).create()
    );

    registry.registerSingletonFactory(SHARED_SERVICE_TOKENS.AuditLogService, (container) =>
      new AuditLogServiceFactory(container).create()
    );

    registry.registerSingletonFactory(SHARED_SERVICE_TOKENS.CacheService, (container) =>
      new CacheServiceFactory(container).create()
    );
  }
}

/**
 * Analytics Services Module
 */
export class AnalyticsServicesModule implements IServiceModule {
  name = 'AnalyticsServices';

  register(registry: IServiceRegistry): void {
    // Analytics service registrations would go here
    // Placeholder for now - will be implemented in Phase 3
  }
}

/**
 * Master module that registers all service modules
 */
export class MasterServicesModule implements IServiceModule {
  name = 'MasterServices';

  dependencies = [
    new SharedServicesModule(),
    new UserServicesModule(),
    new ContentServicesModule(),
    new PaymentServicesModule(),
    new AnalyticsServicesModule(),
  ];

  register(registry: IServiceRegistry): void {
    // Register core infrastructure services first
    this.registerInfrastructureServices(registry);

    // Then register all domain service modules
    for (const module of this.dependencies) {
      registry.registerModule(module);
    }
  }

  private registerInfrastructureServices(registry: IServiceRegistry): void {
    // Register logger
    registry.registerSingleton(SHARED_SERVICE_TOKENS.Logger, {
      info: (msg: string, meta?: any) => console.log(`[INFO] ${msg}`, meta),
      error: (msg: string, err?: Error) => console.error(`[ERROR] ${msg}`, err),
      warn: (msg: string, meta?: any) => console.warn(`[WARN] ${msg}`, meta),
      debug: (msg: string, meta?: any) => console.debug(`[DEBUG] ${msg}`, meta),
    });

    // Register database (mock for now)
    registry.registerSingleton(SHARED_SERVICE_TOKENS.Database, {
      query: async <T>(sql: string, params?: any[]): Promise<T[]> => {
        console.log(`[DB Query] ${sql}`, params);
        return [];
      },
      execute: async (sql: string, params?: any[]): Promise<void> => {
        console.log(`[DB Execute] ${sql}`, params);
      },
      transaction: async <T>(fn: () => Promise<T>): Promise<T> => {
        console.log('[DB Transaction] Starting');
        const result = await fn();
        console.log('[DB Transaction] Complete');
        return result;
      },
    });
  }
}

/**
 * Factory registry singleton for global access
 */
export const globalFactoryRegistry = new ServiceFactoryRegistry();

/**
 * Initialize all service factories
 */
export function initializeFactories(registry: IServiceRegistry): void {
  const masterModule = new MasterServicesModule();
  registry.registerModule(masterModule);
}

/**
 * Service factory configuration for different environments
 */
export interface FactoryConfiguration {
  environment: 'development' | 'staging' | 'production' | 'test';
  enableMocking?: boolean;
  enableCaching?: boolean;
  enableLogging?: boolean;
  customFactories?: Map<string, any>;
}

/**
 * Configure factories based on environment
 */
export function configureFactories(config: FactoryConfiguration, registry: IServiceRegistry): void {
  // Environment-specific configuration
  if (config.environment === 'test' && config.enableMocking) {
    // Register mock implementations for testing
    registerMockFactories(registry);
  }

  if (config.enableCaching === false) {
    // Override cache service with no-op implementation
    registry.registerSingleton(SHARED_SERVICE_TOKENS.CacheService, createNoOpCache());
  }

  if (config.customFactories) {
    // Register custom factory overrides
    for (const [tokenName, factory] of config.customFactories) {
      // Custom registration logic
    }
  }
}

/**
 * Register mock factories for testing
 */
function registerMockFactories(registry: IServiceRegistry): void {
  // Mock implementations for testing
  registry.registerSingleton(SHARED_SERVICE_TOKENS.EmailService, {
    sendEmail: async () => ({ success: true, messageId: 'mock', timestamp: new Date() }),
    sendBulkEmails: async () => ({ total: 0, successful: 0, failed: 0, results: [] }),
    validateEmail: () => true,
    getEmailTemplate: async () => null,
    trackEmailEvent: async () => {},
    getEmailStats: async () => ({}),
  });
}

/**
 * Create no-op cache implementation
 */
function createNoOpCache() {
  return {
    get: async () => null,
    set: async () => {},
    delete: async () => {},
    deletePattern: async () => 0,
    exists: async () => false,
    expire: async () => {},
    flush: async () => {},
    getStats: async () => ({
      hits: 0,
      misses: 0,
      keys: 0,
      memoryUsage: 0,
      evictions: 0,
      hitRate: 0,
    }),
  };
}

/**
 * Export all service tokens for easy access
 */
export const SERVICE_TOKENS: Record<string, any> = {
  ...PAYMENT_SERVICE_TOKENS,
  ...CONTENT_SERVICE_TOKENS,
  ...USER_SERVICE_TOKENS,
  ...SHARED_SERVICE_TOKENS,
};

/**
 * Export all factory classes for direct use
 */
export {
  // Payment factories
  InvoiceServiceFactory,
  PaymentProcessingServiceFactory,
  SubscriptionServiceFactory,

  // Content factories
  ContentCreationServiceFactory,
  ContentPublishingServiceFactory,
  ContentSearchServiceFactory,

  // User factories
  UserAuthenticationServiceFactory,
  UserProfileServiceFactory,
  UserRelationshipServiceFactory,

  // Shared factories
  EmailServiceFactory,
  NotificationServiceFactory,
  AuditLogServiceFactory,
  CacheServiceFactory,
};
