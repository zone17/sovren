// @ts-nocheck
/**
 * Content Services Binding Module
 * Registers all Phase 3 content services in the DI container
 * User Story: US-E5-032 - Wire Services Through DI Container
 * Part of Epic 005 - Backend Service Refactoring - Phase 6
 */

import type { IServiceRegistry, IServiceModule } from '../../interfaces/shared/IServiceRegistry';
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
 */
export class ContentServicesModule implements IServiceModule {
  name = 'ContentServicesModule';

  register(registry: IServiceRegistry): void {
    // ===========================
    // ContentPublishingService - SCOPED
    // ===========================
    // Content publishing workflow (per request)
    registry.registerSingleton(TYPES.ContentPublishingService, (container) => {
      const contentRepo = container.resolve(TYPES.ContentRepository);
      const eventBus = container.resolve(TYPES.EventBusService);
      const cache = container.resolve(TYPES.CacheService);
      const logger = container.resolve(TYPES.Logger);

      return new ContentPublishingService(contentRepo, eventBus, cache, logger);
    });

    // ===========================
    // ContentModerationService - SCOPED
    // ===========================
    // Content moderation and filtering (per request)
    registry.registerSingleton(TYPES.ContentModerationService, (container) => {
      const contentRepo = container.resolve(TYPES.ContentRepository);
      const auditLog = container.resolve(TYPES.AuditLogService);
      const logger = container.resolve(TYPES.Logger);

      return new ContentModerationService(contentRepo, auditLog, logger);
    });

    // ===========================
    // ContentSearchService - SCOPED
    // ===========================
    // Full-text content search (per request)
    registry.registerSingleton(TYPES.ContentSearchService, (container) => {
      const elasticsearch = container.resolve(TYPES.ElasticsearchService);
      const cache = container.resolve(TYPES.CacheService);
      const logger = container.resolve(TYPES.Logger);

      return new ContentSearchService(elasticsearch, cache, logger);
    });

    // ===========================
    // ContentRecommendationService - SCOPED
    // ===========================
    // AI-powered content recommendations (per request)
    registry.registerSingleton(TYPES.ContentRecommendationService, (container) => {
      const contentRepo = container.resolve(TYPES.ContentRepository);
      const userActivity = container.resolve(TYPES.UserActivityService);
      const cache = container.resolve(TYPES.CacheService);
      const logger = container.resolve(TYPES.Logger);

      return new ContentRecommendationService(contentRepo, userActivity, cache, logger);
    });

    // ===========================
    // ContentAnalyticsService - SCOPED
    // ===========================
    // Content analytics and metrics (per request)
    registry.registerSingleton(TYPES.ContentAnalyticsService, (container) => {
      const contentRepo = container.resolve(TYPES.ContentRepository);
      const eventBus = container.resolve(TYPES.EventBusService);
      const logger = container.resolve(TYPES.Logger);

      return new ContentAnalyticsService(contentRepo, eventBus, logger);
    });

    // ===========================
    // ContentVersioningService - SCOPED
    // ===========================
    // Content version control (per request)
    registry.registerSingleton(TYPES.ContentVersioningService, (container) => {
      const contentRepo = container.resolve(TYPES.ContentRepository);
      const logger = container.resolve(TYPES.Logger);

      return new ContentVersioningService(contentRepo, logger);
    });

    // ===========================
    // ContentCreationService - SCOPED
    // ===========================
    // Content creation and editing (per request)
    registry.registerSingleton(TYPES.ContentCreationService, (container) => {
      const contentRepo = container.resolve(TYPES.ContentRepository);
      const validation = container.resolve(TYPES.ValidationService);
      const logger = container.resolve(TYPES.Logger);

      return new ContentCreationService(contentRepo, validation, logger);
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
