// @ts-nocheck
/**
 * User Services Binding Module
 * Registers all Phase 4 user services in the DI container
 * User Story: US-E5-032 - Wire Services Through DI Container
 * Part of Epic 005 - Backend Service Refactoring - Phase 6
 */

import type { IServiceRegistry, IServiceModule } from '../../interfaces/shared/IServiceRegistry';
import { TYPES } from '../types';

// Import service implementations
import { UserProfileService } from '../../services/user/UserProfileService';
import { UserPreferencesService } from '../../services/user/UserPreferencesService';
import { UserActivityService } from '../../services/user/UserActivityService';
import { UserRelationshipService } from '../../services/user/UserRelationshipService';
import { UserAnalyticsService } from '../../services/user/UserAnalyticsService';

/**
 * User Services Module
 * Phase 4: User Management, Profiles, Preferences, Analytics
 * Total Services: 5
 */
export class UserServicesModule implements IServiceModule {
  name = 'UserServicesModule';

  register(registry: IServiceRegistry): void {
    // ===========================
    // UserProfileService - SINGLETON
    // ===========================
    // User profile management (singleton)
    registry.registerSingleton(
      TYPES.UserProfileService,
      (container) => {
        const userRepo = container.resolve(TYPES.UserRepository);
        const cache = container.resolve(TYPES.CacheService);
        const eventBus = container.resolve(TYPES.EventBusService);
        const logger = container.resolve(TYPES.Logger);

        return new UserProfileService(userRepo, cache, eventBus, logger);
      }
    );

    // ===========================
    // UserPreferencesService - SINGLETON
    // ===========================
    // User preferences and settings (singleton)
    registry.registerSingleton(
      TYPES.UserPreferencesService,
      (container) => {
        const preferencesRepo = container.resolve(TYPES.UserPreferencesRepository);
        const cache = container.resolve(TYPES.CacheService);
        const logger = container.resolve(TYPES.Logger);

        return new UserPreferencesService(preferencesRepo, cache, logger);
      }
    );

    // ===========================
    // UserActivityService - SINGLETON
    // ===========================
    // User activity tracking (singleton)
    registry.registerSingleton(
      TYPES.UserActivityService,
      (container) => {
        const database = container.resolve(TYPES.Database);
        const eventBus = container.resolve(TYPES.EventBusService);
        const logger = container.resolve(TYPES.Logger);

        return new UserActivityService(database, eventBus, logger);
      }
    );

    // ===========================
    // UserRelationshipService - SINGLETON
    // ===========================
    // User relationships and follows (singleton)
    registry.registerSingleton(
      TYPES.UserRelationshipService,
      (container) => {
        const userRepo = container.resolve(TYPES.UserRepository);
        const cache = container.resolve(TYPES.CacheService);
        const eventBus = container.resolve(TYPES.EventBusService);
        const logger = container.resolve(TYPES.Logger);

        return new UserRelationshipService(userRepo, cache, eventBus, logger);
      }
    );

    // ===========================
    // UserAnalyticsService - SINGLETON
    // ===========================
    // User behavior analytics (singleton)
    registry.registerSingleton(
      TYPES.UserAnalyticsService,
      (container) => {
        const database = container.resolve(TYPES.Database);
        const eventBus = container.resolve(TYPES.EventBusService);
        const logger = container.resolve(TYPES.Logger);

        return new UserAnalyticsService(database, eventBus, logger);
      }
    );
  }

  dependencies = [];
}

/**
 * Helper function to register all user services
 */
export function registerUserServices(registry: IServiceRegistry): void {
  const module = new UserServicesModule();
  registry.registerModule(module);
}

/**
 * Service metadata for user services
 */
export const USER_SERVICE_METADATA = {
  UserProfileService: {
    version: '1.0.0',
    description: 'User profile management and updates',
    tags: ['user', 'profile'],
    metrics: ['profile_views', 'profile_updates', 'operation_time'],
  },
  UserPreferencesService: {
    version: '1.0.0',
    description: 'User preferences and settings management',
    tags: ['user', 'preferences'],
    metrics: ['preference_updates', 'preference_reads', 'operation_time'],
  },
  UserActivityService: {
    version: '1.0.0',
    description: 'User activity tracking and history',
    tags: ['user', 'activity', 'analytics'],
    metrics: ['activity_count', 'active_users', 'activity_time'],
  },
  UserRelationshipService: {
    version: '1.0.0',
    description: 'User relationships and social connections',
    tags: ['user', 'relationships', 'social'],
    metrics: ['follow_count', 'relationship_count', 'operation_time'],
  },
  UserAnalyticsService: {
    version: '1.0.0',
    description: 'User behavior analytics and insights',
    tags: ['user', 'analytics', 'insights'],
    metrics: ['analytics_queries', 'user_metrics', 'analytics_time'],
  },
} as const;
