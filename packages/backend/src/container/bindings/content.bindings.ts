/**
 * Content Services Binding Module
 * Registers all Phase 3 content services in the DI container
 * User Story: US-E5-032 - Wire Services Through DI Container
 * Part of Epic 005 - Backend Service Refactoring - Phase 6
 */

import type { IServiceRegistry, IServiceModule } from '../../interfaces/shared/IServiceRegistry';
import type {
  IContentPublishingService,
  IContentSearchService,
  IContentRecommendationService,
  IContentAnalyticsService,
  IContentVersioningService,
  IContentCreationService,
} from '../../interfaces/content';
import type { IContentModerationService } from '../../interfaces/content/IContentModerationService';
import { TYPES } from '../types';

// Import service implementations
import { ContentPublishingService } from '../../services/content/ContentPublishingService';
import { ContentModerationService } from '../../services/content/ContentModerationService';
import { ContentSearchService } from '../../services/content/ContentSearchService';
import { ContentRecommendationService } from '../../services/content/ContentRecommendationService';
import { ContentAnalyticsService } from '../../services/content/ContentAnalyticsService';
import { ContentVersioningService } from '../../services/content/ContentVersioningService';
import { ContentCreationService } from '../../services/content/ContentCreationService';

/**
 * Content Services Module
 * Phase 3: Content Management, Publishing, Search, Analytics
 * Total Services: 7
 *
 * Note: Service constructors have complex signatures with dependencies not fully
 * represented in TYPES tokens (typed as Record<string, unknown>). We cast through
 * `unknown` to bridge concrete implementations to their DI token interfaces.
 */
export class ContentServicesModule implements IServiceModule {
  name = 'ContentServicesModule';

  register(registry: IServiceRegistry): void {
    // ContentPublishingService - SINGLETON
    registry.registerSingletonFactory(TYPES.ContentPublishingService, (container) => {
      const db = container.resolve(TYPES.Database);
      const cache = container.resolve(TYPES.CacheService);
      const eventBus = container.resolve(TYPES.EventBusService);
      const notification = container.resolveOptional(TYPES.NotificationService);
      return new ContentPublishingService(
        db as any, cache as any, eventBus as any, notification as any,
      ) as unknown as IContentPublishingService;
    });

    // ContentModerationService - SINGLETON
    registry.registerSingletonFactory(TYPES.ContentModerationService, (container) => {
      const auditLog = container.resolve(TYPES.AuditLogService);
      const eventBus = container.resolve(TYPES.EventBusService);
      const logger = container.resolve(TYPES.Logger);
      const cache = container.resolve(TYPES.CacheService);
      const contentRepo = container.resolveOptional(TYPES.ContentRepository);
      return new ContentModerationService(
        auditLog as any, eventBus as any, logger as any, cache as any,
        undefined as any, contentRepo as any, undefined as any,
      ) as unknown as IContentModerationService;
    });

    // ContentSearchService - SINGLETON
    registry.registerSingletonFactory(TYPES.ContentSearchService, (container) => {
      const cache = container.resolve(TYPES.CacheService);
      const logger = container.resolve(TYPES.Logger);
      const config = container.resolve(TYPES.Config) as Record<string, any>;
      return new ContentSearchService(
        cache as any, logger as any, config as any,
      ) as unknown as IContentSearchService;
    });

    // ContentRecommendationService - SINGLETON
    registry.registerSingletonFactory(TYPES.ContentRecommendationService, (container) => {
      const logger = container.resolve(TYPES.Logger);
      const cache = container.resolve(TYPES.CacheService);
      const contentRepo = container.resolveOptional(TYPES.ContentRepository);
      const userActivity = container.resolveOptional(TYPES.UserActivityService);
      return new ContentRecommendationService(
        logger as any, cache as any, contentRepo as any,
        undefined as any, userActivity as any,
      ) as unknown as IContentRecommendationService;
    });

    // ContentAnalyticsService - SINGLETON
    registry.registerSingletonFactory(TYPES.ContentAnalyticsService, (container) => {
      const logger = container.resolve(TYPES.Logger);
      const cache = container.resolve(TYPES.CacheService);
      return new ContentAnalyticsService(
        logger as any, cache as any, undefined as any,
      ) as unknown as IContentAnalyticsService;
    });

    // ContentVersioningService - SINGLETON
    registry.registerSingletonFactory(TYPES.ContentVersioningService, (container) => {
      const db = container.resolve(TYPES.Database);
      const cache = container.resolve(TYPES.CacheService);
      const eventBus = container.resolve(TYPES.EventBusService);
      const auditLog = container.resolve(TYPES.AuditLogService);
      return new ContentVersioningService(
        db as any, cache as any, eventBus as any, auditLog as any,
      ) as unknown as IContentVersioningService;
    });

    // ContentCreationService - SINGLETON
    registry.registerSingletonFactory(TYPES.ContentCreationService, (container) => {
      const db = container.resolve(TYPES.Database);
      const cache = container.resolve(TYPES.CacheService);
      const eventBus = container.resolve(TYPES.EventBusService);
      const auditLog = container.resolve(TYPES.AuditLogService);
      const notification = container.resolveOptional(TYPES.NotificationService);
      return new ContentCreationService(
        db as any, cache as any, eventBus as any,
        auditLog as any, notification as any,
      ) as unknown as IContentCreationService;
    });
  }

  dependencies = [];
}

/**
 * Helper function to register all content services
 */
export function registerContentServices(registry: IServiceRegistry): void {
  const module = new ContentServicesModule();
  registry.registerModule(module);
}

/**
 * Service metadata for content services
 */
export const CONTENT_SERVICE_METADATA = {
  ContentPublishingService: {
    version: '1.0.0',
    description: 'Content publishing workflow management',
    tags: ['content', 'publishing'],
    metrics: ['published_count', 'draft_count', 'publish_time'],
  },
  ContentModerationService: {
    version: '1.0.0',
    description: 'Content moderation and filtering',
    tags: ['content', 'moderation', 'safety'],
    metrics: ['moderated_count', 'flagged_count', 'moderation_time'],
  },
  ContentSearchService: {
    version: '1.0.0',
    description: 'Full-text content search capabilities',
    tags: ['content', 'search'],
    metrics: ['search_count', 'search_time', 'result_count'],
  },
  ContentRecommendationService: {
    version: '1.0.0',
    description: 'AI-powered content recommendations',
    tags: ['content', 'ai', 'personalization'],
    metrics: ['recommendation_count', 'recommendation_time', 'accuracy'],
  },
  ContentAnalyticsService: {
    version: '1.0.0',
    description: 'Content analytics and metrics tracking',
    tags: ['content', 'analytics'],
    metrics: ['views_count', 'engagement_rate', 'analytics_time'],
  },
  ContentVersioningService: {
    version: '1.0.0',
    description: 'Content version control and history',
    tags: ['content', 'versioning'],
    metrics: ['version_count', 'rollback_count', 'version_time'],
  },
  ContentCreationService: {
    version: '1.0.0',
    description: 'Content creation and editing tools',
    tags: ['content', 'creation'],
    metrics: ['created_count', 'updated_count', 'creation_time'],
  },
} as const;
