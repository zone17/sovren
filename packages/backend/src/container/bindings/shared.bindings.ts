// @ts-nocheck
/**
 * Shared Services Binding Module
 * Registers all Phase 2 shared services in the DI container
 * User Story: US-E5-032 - Wire Services Through DI Container
 * Part of Epic 005 - Backend Service Refactoring - Phase 6
 */

import type { IServiceRegistry } from '../../interfaces/shared/IServiceRegistry';
import type { IServiceModule } from '../../interfaces/shared/IServiceRegistry';
import { TYPES } from '../types';

// Import service implementations
import { EmailService } from '../../services/EmailService';
import { NotificationService } from '../../services/NotificationService';
import { AuditLogService } from '../../services/AuditLogService';
import { CacheService } from '../../services/CacheService';
import { EventBusService } from '../../services/EventBusService';

/**
 * Shared Services Module
 * Phase 2: Communication, Caching, Auditing, Event Bus
 * Total Services: 5 (4 from Phase 2 + EventBusService from Phase 1)
 */
export class SharedServicesModule implements IServiceModule {
  name = 'SharedServicesModule';

  register(registry: IServiceRegistry): void {
    // ===========================
    // EventBusService - SINGLETON
    // ===========================
    // Central event-driven communication
    // Stateful: Maintains event subscriptions and event store
    registry.registerSingletonFactory(TYPES.EventBusService, (container) => {
      const logger = container.resolveOptional(TYPES.Logger);
      return new EventBusService(logger);
    });

    // ===========================
    // CacheService - SINGLETON
    // ===========================
    // Redis-based caching with state
    // Stateful: Maintains connection pool and statistics
    registry.registerSingletonFactory(TYPES.CacheService, (container) => {
      const eventBus = container.resolve(TYPES.EventBusService);
      const logger = container.resolve(TYPES.Logger);
      const config = container.resolve(TYPES.Config);

      // Get cache configuration from config service
      const cacheConfig = {
        provider: config.get('CACHE_PROVIDER', 'redis'),
        prefix: config.get('CACHE_PREFIX', 'sovren'),
        defaultTtl: parseInt(config.get('CACHE_DEFAULT_TTL', '3600'), 10),
        redis: {
          host: config.get('REDIS_HOST', 'localhost'),
          port: parseInt(config.get('REDIS_PORT', '6379'), 10),
          password: config.get('REDIS_PASSWORD'),
          db: parseInt(config.get('REDIS_DB', '0'), 10),
        },
        warmup: {
          enabled: config.get('CACHE_WARMUP_ENABLED', 'false') === 'true',
          interval: parseInt(config.get('CACHE_WARMUP_INTERVAL', '3600'), 10),
        },
      };

      return new CacheService(eventBus, logger, cacheConfig);
    });

    // ===========================
    // EmailService - TRANSIENT
    // ===========================
    // Stateless email sending
    // New instance per resolution for isolated email operations
    registry.registerTransient(TYPES.EmailService, (container) => {
      const config = container.resolve(TYPES.Config);
      const logger = container.resolve(TYPES.Logger);

      return new EmailService(config, logger);
    });

    // ===========================
    // NotificationService - TRANSIENT
    // ===========================
    // Multi-channel notification dispatch with BullMQ queue backend
    registry.registerTransient(TYPES.NotificationService, (container) => {
      const eventBus = container.resolve(TYPES.EventBusService);
      const logger = container.resolve(TYPES.Logger);
      const cache = container.resolveOptional(TYPES.CacheService);
      const emailService = container.resolveOptional(TYPES.EmailService);
      const queueService = container.resolveOptional(TYPES.QueueService);

      return new NotificationService(
        eventBus,
        logger,
        cache ?? undefined,
        emailService ?? undefined,
        queueService ?? undefined
      );
    });

    // ===========================
    // AuditLogService - TRANSIENT
    // ===========================
    // Audit trail and compliance logging
    // Stateless: Writes to database without maintaining state
    registry.registerTransient(TYPES.AuditLogService, (container) => {
      const database = container.resolve(TYPES.Database);
      const logger = container.resolve(TYPES.Logger);

      return new AuditLogService(database, logger);
    });
  }

  /**
   * Module dependencies
   * Requires infrastructure services to be registered first
   */
  dependencies = [];
}

/**
 * Helper function to register all shared services
 */
export function registerSharedServices(registry: IServiceRegistry): void {
  const module = new SharedServicesModule();
  registry.registerModule(module);
}

/**
 * Service health check registration
 * Registers health checks for all services with healthCheck capability
 */
export async function registerSharedServiceHealthChecks(container: any): Promise<void> {
  const healthChecks: Array<{ name: string; check: () => Promise<boolean> }> = [
    {
      name: 'EventBusService',
      check: async () => {
        const eventBus = container.resolve(TYPES.EventBusService);
        return eventBus.isHealthy ? await eventBus.isHealthy() : true;
      },
    },
    {
      name: 'CacheService',
      check: async () => {
        const cache = container.resolve(TYPES.CacheService);
        return cache.healthCheck ? await cache.healthCheck() : true;
      },
    },
  ];

  // Return health check registry
  return healthChecks as any;
}

/**
 * Service metadata for shared services
 */
export const SHARED_SERVICE_METADATA = {
  EventBusService: {
    version: '1.0.0',
    description: 'Central event-driven communication system',
    tags: ['infrastructure', 'messaging'],
    metrics: ['event_count', 'subscriber_count', 'processing_time'],
  },
  CacheService: {
    version: '1.0.0',
    description: 'Redis-based distributed caching layer',
    tags: ['infrastructure', 'performance'],
    metrics: ['hit_rate', 'miss_rate', 'memory_usage', 'key_count'],
  },
  EmailService: {
    version: '1.0.0',
    description: 'Email sending and template management',
    tags: ['communication', 'notifications'],
    metrics: ['emails_sent', 'email_failures', 'send_time'],
  },
  NotificationService: {
    version: '1.0.0',
    description: 'Multi-channel notification dispatch',
    tags: ['communication', 'notifications'],
    metrics: ['notifications_sent', 'channel_usage', 'delivery_rate'],
  },
  AuditLogService: {
    version: '1.0.0',
    description: 'Audit trail and compliance logging',
    tags: ['security', 'compliance'],
    metrics: ['logs_written', 'log_size', 'write_time'],
  },
} as const;
