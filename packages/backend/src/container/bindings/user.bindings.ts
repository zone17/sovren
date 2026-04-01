/**
 * User Services Binding Module
 * Registers all Phase 4 user services in the DI container
 * User Story: US-E5-032 - Wire Services Through DI Container
 * Part of Epic 005 - Backend Service Refactoring - Phase 6
 */

import type { IServiceRegistry, IServiceModule } from '../../interfaces/shared/IServiceRegistry';
import type {
  IUserProfileService,
  IUserPreferencesService,
  IUserActivityService,
  IUserRelationshipService,
  IUserAnalyticsService,
} from '../../interfaces/user';
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
 *
 * Note: Concrete service constructors have complex signatures. We cast through
 * `unknown` to bridge concrete implementations to their DI token interfaces.
 */
export class UserServicesModule implements IServiceModule {
  name = 'UserServicesModule';

  register(registry: IServiceRegistry): void {
    // UserProfileService - SINGLETON
    registry.registerSingletonFactory(TYPES.UserProfileService, container => {
      const eventBus = container.resolve(TYPES.EventBusService);
      const logger = container.resolve(TYPES.Logger);
      const cache = container.resolve(TYPES.CacheService);
      const auditLog = container.resolve(TYPES.AuditLogService);
      return new UserProfileService(
        eventBus as any,
        logger as any,
        cache as any,
        auditLog as any
      ) as unknown as IUserProfileService;
    });

    // UserPreferencesService - SINGLETON
    registry.registerSingletonFactory(TYPES.UserPreferencesService, container => {
      const preferencesRepo = container.resolve(TYPES.UserPreferencesRepository);
      const cache = container.resolve(TYPES.CacheService);
      const eventBus = container.resolve(TYPES.EventBusService);
      const logger = container.resolve(TYPES.Logger);
      return new UserPreferencesService(
        preferencesRepo as any,
        cache as any,
        eventBus as any,
        logger as any
      ) as unknown as IUserPreferencesService;
    });

    // UserActivityService - SINGLETON
    registry.registerSingletonFactory(TYPES.UserActivityService, container => {
      const db = container.resolve(TYPES.Database);
      const cache = container.resolve(TYPES.CacheService);
      const eventBus = container.resolve(TYPES.EventBusService);
      const auditLog = container.resolve(TYPES.AuditLogService);
      return new UserActivityService(
        db as any,
        cache as any,
        eventBus as any,
        auditLog as any
      ) as unknown as IUserActivityService;
    });

    // UserRelationshipService - SINGLETON
    registry.registerSingletonFactory(TYPES.UserRelationshipService, container => {
      const eventBus = container.resolve(TYPES.EventBusService);
      const logger = container.resolve(TYPES.Logger);
      const cache = container.resolveOptional(TYPES.CacheService);
      return new UserRelationshipService(
        eventBus as any,
        logger as any,
        cache as any
      ) as unknown as IUserRelationshipService;
    });

    // UserAnalyticsService - SINGLETON
    registry.registerSingletonFactory(TYPES.UserAnalyticsService, container => {
      const db = container.resolve(TYPES.Database);
      const cache = container.resolve(TYPES.CacheService);
      const eventBus = container.resolve(TYPES.EventBusService);
      const auditLog = container.resolve(TYPES.AuditLogService);
      const logger = container.resolve(TYPES.Logger);
      return new UserAnalyticsService(
        db as any,
        cache as any,
        eventBus as any,
        auditLog as any,
        logger as any
      ) as unknown as IUserAnalyticsService;
    });
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
