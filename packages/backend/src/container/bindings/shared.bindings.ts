/**
 * Shared Services Binding Module
 * Registers all Phase 2 shared services in the DI container
 * User Story: US-E5-032 - Wire Services Through DI Container
 * Part of Epic 005 - Backend Service Refactoring - Phase 6
 */

import type { IServiceRegistry, IServiceContainer } from '../../interfaces/shared/IServiceRegistry';
import type { IServiceModule } from '../../interfaces/shared/IServiceRegistry';
import type { IEventBus } from '../../interfaces/shared/IEventBus';
import type { ILogger } from '../../interfaces/shared/ILogger';
import type { ICacheService } from '../../interfaces/shared/ICacheService';
import type { IEmailService } from '../../interfaces/communication/IEmailService';
import type { INotificationService } from '../../interfaces/communication/INotificationService';
import type { IAuditLogService } from '../../interfaces/shared/IAuditLogService';
import type { IQueueService } from '../../interfaces/queue/IQueueService';
import { TYPES } from '../types';

// Import service implementations
import { EmailService } from '../../services/EmailService';
import { NotificationService } from '../../services/NotificationService';
import { AuditLogService } from '../../services/AuditLogService';
import { CacheService } from '../../services/CacheService';
import { EventBusService } from '../../services/EventBusService';

/** Helper to read env-like config from a record with fallback */
function configGet(config: Record<string, unknown>, key: string, fallback: string = ''): string {
  const val = config[key];
  if (typeof val === 'string') return val;
  if (typeof (config as Record<string, any>).get === 'function') {
    return String((config as Record<string, any>).get(key, fallback));
  }
  return fallback;
}

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
    registry.registerSingletonFactory(TYPES.EventBusService, (container) => {
      const logger = container.resolveOptional(TYPES.Logger) ?? undefined;
      return new EventBusService(logger) as unknown as IEventBus;
    });

    // ===========================
    // CacheService - SINGLETON
    // ===========================
    registry.registerSingletonFactory(TYPES.CacheService, (container) => {
      const eventBus = container.resolve(TYPES.EventBusService);
      const logger = container.resolve(TYPES.Logger);
      const config = container.resolve(TYPES.Config) as Record<string, unknown>;

      const cacheConfig = {
        provider: configGet(config, 'CACHE_PROVIDER', 'redis'),
        prefix: configGet(config, 'CACHE_PREFIX', 'sovren'),
        defaultTtl: parseInt(configGet(config, 'CACHE_DEFAULT_TTL', '3600'), 10),
        redis: {
          host: configGet(config, 'REDIS_HOST', 'localhost'),
          port: parseInt(configGet(config, 'REDIS_PORT', '6379'), 10),
          password: configGet(config, 'REDIS_PASSWORD'),
          db: parseInt(configGet(config, 'REDIS_DB', '0'), 10),
        },
        warmup: {
          enabled: configGet(config, 'CACHE_WARMUP_ENABLED', 'false') === 'true',
          interval: parseInt(configGet(config, 'CACHE_WARMUP_INTERVAL', '3600'), 10),
        },
      };

      return new CacheService(eventBus, logger, cacheConfig) as unknown as ICacheService;
    });

    // ===========================
    // EmailService - TRANSIENT
    // ===========================
    registry.registerTransient(TYPES.EmailService, (container) => {
      const eventBus = container.resolve(TYPES.EventBusService);
      const logger = container.resolve(TYPES.Logger);
      const config = container.resolve(TYPES.Config) as Record<string, unknown>;
      const cache = container.resolveOptional(TYPES.CacheService) ?? undefined;

      const emailConfig = {
        provider: configGet(config, 'EMAIL_PROVIDER', 'smtp'),
        fromEmail: configGet(config, 'EMAIL_FROM', 'noreply@sovren.dev'),
        fromName: configGet(config, 'EMAIL_FROM_NAME', 'Sovren'),
        apiKey: configGet(config, 'EMAIL_API_KEY'),
        host: configGet(config, 'SMTP_HOST', 'localhost'),
        port: parseInt(configGet(config, 'SMTP_PORT', '587'), 10),
        secure: configGet(config, 'SMTP_SECURE', 'false') === 'true',
      };

      return new EmailService(eventBus, logger, emailConfig, cache) as unknown as IEmailService;
    });

    // ===========================
    // NotificationService - TRANSIENT
    // ===========================
    registry.registerTransient(TYPES.NotificationService, (container) => {
      const eventBus = container.resolve(TYPES.EventBusService);
      const logger = container.resolve(TYPES.Logger);
      const cache = container.resolveOptional(TYPES.CacheService) ?? undefined;
      const emailService = container.resolveOptional(TYPES.EmailService) as IEmailService | undefined;
      const queueService = container.resolveOptional(TYPES.QueueService) as IQueueService | undefined;

      return new NotificationService(
        eventBus,
        logger,
        cache,
        emailService,
        queueService
      ) as unknown as INotificationService;
    });

    // ===========================
    // AuditLogService - TRANSIENT
    // ===========================
    registry.registerTransient(TYPES.AuditLogService, (container) => {
      const eventBus = container.resolve(TYPES.EventBusService);
      const logger = container.resolve(TYPES.Logger);

      return new AuditLogService(eventBus, logger) as unknown as IAuditLogService;
    });
  }

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
 */
export async function registerSharedServiceHealthChecks(container: IServiceContainer): Promise<void> {
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
        return (cache as any).healthCheck ? await (cache as any).healthCheck() : true;
      },
    },
  ];

  void healthChecks;
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
