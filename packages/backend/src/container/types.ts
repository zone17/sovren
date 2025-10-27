/**
 * Service Type Identifiers
 * Central registry of all service tokens for dependency injection
 * User Story: US-E5-032 - Wire Services Through DI Container
 * Part of Epic 005 - Backend Service Refactoring - Phase 6
 *
 * Total Services: 29 (Phases 1-5 complete)
 */

import { ServiceToken } from '../interfaces/shared/IServiceRegistry';

/**
 * Service type identifiers organized by domain
 */
export const TYPES = {
  // ======================
  // PHASE 1: Design & Interface (6 services)
  // ======================

  /**
   * Core DI Infrastructure
   */
  ServiceContainer: new ServiceToken<any>('ServiceContainer', 'Main DI container'),
  ServiceFactory: new ServiceToken<any>('ServiceFactory', 'Service factory orchestrator'),
  EventBusService: new ServiceToken<any>('EventBusService', 'Central event bus'),
  RepositoryFactory: new ServiceToken<any>('RepositoryFactory', 'Repository factory'),
  MigrationService: new ServiceToken<any>('MigrationService', 'Database migration service'),
  DependencyAnalyzer: new ServiceToken<any>('DependencyAnalyzer', 'Dependency graph analyzer'),

  // ======================
  // PHASE 2: Shared Services (4 services)
  // ======================

  /**
   * Communication & Infrastructure
   */
  EmailService: new ServiceToken<any>('EmailService', 'Email sending and templates'),
  NotificationService: new ServiceToken<any>('NotificationService', 'Multi-channel notifications'),
  AuditLogService: new ServiceToken<any>('AuditLogService', 'Audit trail and compliance'),
  CacheService: new ServiceToken<any>('CacheService', 'Redis-based caching layer'),

  // ======================
  // PHASE 3: Content Services (7 services)
  // ======================

  /**
   * Content Management & Analytics
   */
  ContentPublishingService: new ServiceToken<any>('ContentPublishingService', 'Content publishing workflow'),
  ContentModerationService: new ServiceToken<any>('ContentModerationService', 'Content moderation and filtering'),
  ContentSearchService: new ServiceToken<any>('ContentSearchService', 'Full-text content search'),
  ContentRecommendationService: new ServiceToken<any>('ContentRecommendationService', 'AI-powered recommendations'),
  ContentAnalyticsService: new ServiceToken<any>('ContentAnalyticsService', 'Content analytics and metrics'),
  ContentVersioningService: new ServiceToken<any>('ContentVersioningService', 'Content version control'),
  ContentCreationService: new ServiceToken<any>('ContentCreationService', 'Content creation and editing'),

  // ======================
  // PHASE 4: User Services (5 services)
  // ======================

  /**
   * User Management & Analytics
   */
  UserProfileService: new ServiceToken<any>('UserProfileService', 'User profile management'),
  UserPreferencesService: new ServiceToken<any>('UserPreferencesService', 'User preferences and settings'),
  UserActivityService: new ServiceToken<any>('UserActivityService', 'User activity tracking'),
  UserRelationshipService: new ServiceToken<any>('UserRelationshipService', 'User relationships and follows'),
  UserAnalyticsService: new ServiceToken<any>('UserAnalyticsService', 'User behavior analytics'),

  // ======================
  // PHASE 5: Payment Services (7 services)
  // ======================

  /**
   * Payment Processing & Analytics
   */
  PaymentProcessingService: new ServiceToken<any>('PaymentProcessingService', 'Core payment processing'),
  CurrencyService: new ServiceToken<any>('CurrencyService', 'Multi-currency support'),
  SubscriptionService: new ServiceToken<any>('SubscriptionService', 'Subscription management'),
  RefundService: new ServiceToken<any>('RefundService', 'Refund processing and tracking'),
  PaymentAnalyticsService: new ServiceToken<any>('PaymentAnalyticsService', 'Payment analytics and reporting'),
  WebhookService: new ServiceToken<any>('WebhookService', 'Webhook management and delivery'),
  InvoiceService: new ServiceToken<any>('InvoiceService', 'Invoice generation and management'),

  // ======================
  // Supporting Infrastructure
  // ======================

  /**
   * Common Dependencies
   */
  Logger: new ServiceToken<any>('Logger', 'Application logger'),
  Config: new ServiceToken<any>('Config', 'Configuration service'),
  Database: new ServiceToken<any>('Database', 'Database connection pool'),
  Redis: new ServiceToken<any>('Redis', 'Redis client'),

  /**
   * Repositories (Data Access Layer)
   */
  UserRepository: new ServiceToken<any>('UserRepository', 'User data access'),
  ContentRepository: new ServiceToken<any>('ContentRepository', 'Content data access'),
  PaymentRepository: new ServiceToken<any>('PaymentRepository', 'Payment data access'),
  SubscriptionRepository: new ServiceToken<any>('SubscriptionRepository', 'Subscription data access'),
  UserPreferencesRepository: new ServiceToken<any>('UserPreferencesRepository', 'User preferences data access'),

  /**
   * External Service Integrations
   */
  LightningService: new ServiceToken<any>('LightningService', 'Bitcoin Lightning Network integration'),
  NostrService: new ServiceToken<any>('NostrService', 'NOSTR protocol integration'),
  ElasticsearchService: new ServiceToken<any>('ElasticsearchService', 'Elasticsearch client'),

  /**
   * Middleware & Utilities
   */
  ValidationService: new ServiceToken<any>('ValidationService', 'Input validation'),
  AuthenticationService: new ServiceToken<any>('AuthenticationService', 'Authentication and authorization'),
  RateLimitService: new ServiceToken<any>('RateLimitService', 'API rate limiting'),

} as const;

/**
 * Service lifetime configuration
 * Defines the lifecycle scope for each service
 */
export const SERVICE_LIFETIMES = {
  // Singleton: Single instance shared across entire application
  singleton: [
    'ServiceContainer',
    'EventBusService',
    'CacheService',
    'Logger',
    'Config',
    'Database',
    'Redis',
    'LightningService',
    'NostrService',
    'ElasticsearchService',
  ],

  // Scoped: One instance per request/transaction
  scoped: [
    'UserProfileService',
    'UserPreferencesService',
    'UserActivityService',
    'UserRelationshipService',
    'UserAnalyticsService',
    'ContentPublishingService',
    'ContentModerationService',
    'ContentSearchService',
    'ContentRecommendationService',
    'ContentAnalyticsService',
    'ContentVersioningService',
    'ContentCreationService',
    'PaymentProcessingService',
    'SubscriptionService',
    'RefundService',
    'PaymentAnalyticsService',
    'WebhookService',
    'InvoiceService',
    'AuthenticationService',
  ],

  // Transient: New instance for each resolution
  transient: [
    'EmailService',
    'NotificationService',
    'AuditLogService',
    'ServiceFactory',
    'RepositoryFactory',
    'MigrationService',
    'DependencyAnalyzer',
    'CurrencyService',
    'ValidationService',
    'RateLimitService',
  ],
} as const;

/**
 * Service dependency map
 * Documents explicit dependencies for each service
 */
export const SERVICE_DEPENDENCIES = {
  // Shared Services
  EmailService: ['Config', 'Logger'],
  NotificationService: ['EmailService', 'EventBusService', 'Logger'],
  AuditLogService: ['Database', 'Logger'],
  CacheService: ['Redis', 'EventBusService', 'Logger'],

  // Content Services
  ContentPublishingService: ['ContentRepository', 'EventBusService', 'CacheService', 'Logger'],
  ContentModerationService: ['ContentRepository', 'AuditLogService', 'Logger'],
  ContentSearchService: ['ElasticsearchService', 'CacheService', 'Logger'],
  ContentRecommendationService: ['ContentRepository', 'UserActivityService', 'CacheService', 'Logger'],
  ContentAnalyticsService: ['ContentRepository', 'EventBusService', 'Logger'],
  ContentVersioningService: ['ContentRepository', 'Logger'],
  ContentCreationService: ['ContentRepository', 'ValidationService', 'Logger'],

  // User Services
  UserProfileService: ['UserRepository', 'CacheService', 'EventBusService', 'Logger'],
  UserPreferencesService: ['UserPreferencesRepository', 'CacheService', 'Logger'],
  UserActivityService: ['Database', 'EventBusService', 'Logger'],
  UserRelationshipService: ['UserRepository', 'CacheService', 'EventBusService', 'Logger'],
  UserAnalyticsService: ['Database', 'EventBusService', 'Logger'],

  // Payment Services
  PaymentProcessingService: ['PaymentRepository', 'LightningService', 'EventBusService', 'Logger'],
  CurrencyService: ['Config', 'CacheService'],
  SubscriptionService: ['SubscriptionRepository', 'PaymentProcessingService', 'EventBusService', 'Logger'],
  RefundService: ['PaymentRepository', 'PaymentProcessingService', 'EventBusService', 'Logger'],
  PaymentAnalyticsService: ['PaymentRepository', 'EventBusService', 'Logger'],
  WebhookService: ['Database', 'EventBusService', 'Logger'],
  InvoiceService: ['PaymentRepository', 'Logger'],

  // Authentication
  AuthenticationService: ['UserRepository', 'CacheService', 'Logger'],
} as const;

/**
 * Service tags for grouping and discovery
 */
export const SERVICE_TAGS = {
  infrastructure: ['ServiceContainer', 'EventBusService', 'CacheService', 'Logger', 'Config'],
  communication: ['EmailService', 'NotificationService', 'WebhookService'],
  content: ['ContentPublishingService', 'ContentModerationService', 'ContentSearchService', 'ContentRecommendationService', 'ContentAnalyticsService', 'ContentVersioningService', 'ContentCreationService'],
  user: ['UserProfileService', 'UserPreferencesService', 'UserActivityService', 'UserRelationshipService', 'UserAnalyticsService'],
  payment: ['PaymentProcessingService', 'CurrencyService', 'SubscriptionService', 'RefundService', 'PaymentAnalyticsService', 'InvoiceService'],
  analytics: ['ContentAnalyticsService', 'UserAnalyticsService', 'PaymentAnalyticsService'],
  blockchain: ['LightningService', 'NostrService'],
} as const;

/**
 * Get service lifetime for a given service name
 */
export function getServiceLifetime(serviceName: string): 'singleton' | 'scoped' | 'transient' {
  if (SERVICE_LIFETIMES.singleton.includes(serviceName)) {
    return 'singleton';
  }
  if (SERVICE_LIFETIMES.scoped.includes(serviceName)) {
    return 'scoped';
  }
  return 'transient';
}

/**
 * Get dependencies for a given service name
 */
export function getServiceDependencies(serviceName: string): string[] {
  return (SERVICE_DEPENDENCIES as any)[serviceName] || [];
}

/**
 * Get all services with a specific tag
 */
export function getServicesByTag(tag: keyof typeof SERVICE_TAGS): string[] {
  return SERVICE_TAGS[tag] || [];
}

/**
 * Type-safe service token accessor
 */
export function getServiceToken<T>(serviceName: keyof typeof TYPES): ServiceToken<T> {
  return TYPES[serviceName] as ServiceToken<T>;
}
