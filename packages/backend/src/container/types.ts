// @ts-nocheck
/**
 * Service Type Identifiers
 * Central registry of all service tokens for dependency injection
 * User Story: US-E5-032 - Wire Services Through DI Container
 * Part of Epic 005 - Backend Service Refactoring - Phase 6
 *
 * Total Services: 39 (Phases 1-5 complete + SecretsService + Phase 7)
 */

import { ServiceToken } from '../interfaces/shared/IServiceRegistry';
import type { IServiceContainer } from '../interfaces/shared/IServiceRegistry';

// Type-only imports for service interfaces (no runtime dependency)
import type { ILogger } from '../interfaces/shared/ILogger';
import type { IEventBus } from '../interfaces/shared/IEventBus';
import type { ICacheService } from '../interfaces/shared/ICacheService';
import type {
  IContentCreationService,
  IContentPublishingService,
  IContentSearchService,
  IContentRecommendationService,
  IContentAnalyticsService,
  IContentVersioningService,
} from '../interfaces/content';
import type { IContentModerationService } from '../interfaces/content/IContentModerationService';
import type {
  IUserProfileService,
  IUserPreferencesService,
  IUserActivityService,
  IUserRelationshipService,
  IUserAnalyticsService,
} from '../interfaces/user';
import type { IPaymentProcessingService } from '../interfaces/payment/IPaymentProcessingService';
import type { ICurrencyService } from '../interfaces/payment/ICurrencyService';
import type { ISubscriptionService } from '../interfaces/payment/ISubscriptionService';
import type { IRefundService } from '../interfaces/payment/IRefundService';
import type { IPaymentAnalyticsService } from '../interfaces/payment/IPaymentAnalyticsService';
import type { IWebhookService } from '../interfaces/payment/IWebhookService';
import type { IInvoiceService } from '../factories/payment/PaymentServiceFactory';
import type {
  IEmailService,
  INotificationService,
  IAuditLogService,
} from '../factories/shared/SharedServiceFactory';
import type { IUserAuthenticationService } from '../factories/user/UserServiceFactory';
import type { ContentController } from '../controllers/content/ContentController';
import type { UserController } from '../controllers/user/UserController';
import type { PaymentController } from '../controllers/payment/PaymentController';
import type { SecretsService } from '../services/SecretsService';

// Phase 7: Creator Safety Net interfaces
import type { IWellnessService } from '../interfaces/wellness/IWellnessService';
import type { IBurnoutScoringService } from '../interfaces/wellness/IBurnoutScoringService';
import type { IScheduleService } from '../interfaces/wellness/IScheduleService';
import type { IBoundaryService } from '../interfaces/wellness/IBoundaryService';
import type { IProvenanceService } from '../interfaces/provenance/IProvenanceService';
import type { IFingerprintService } from '../interfaces/provenance/IFingerprintService';
import type { IAlertService } from '../interfaces/provenance/IAlertService';
import type { IDmcaService } from '../interfaces/provenance/IDmcaService';

// Queue infrastructure
import type { IQueueService } from '../interfaces/queue/IQueueService';

// Phase 8: Multi-Platform Hub interfaces (EPIC-009)
import type { IPlatformConnectionService } from '../interfaces/distribution/IPlatformConnectionService';
import type { ICrossPostService } from '../interfaces/distribution/ICrossPostService';
import type { IRepurposingService } from '../interfaces/distribution/IRepurposingService';
import type { IUnifiedInboxService } from '../interfaces/distribution/IUnifiedInboxService';
import type { ICrossPlatformAnalyticsService } from '../interfaces/distribution/ICrossPlatformAnalyticsService';

// EPIC-009B: Unified Inbox Polling + NOSTR Reply
import type { IInboxPollingService } from '../interfaces/distribution/IInboxPollingService';
import type { INostrReplyAdapter } from '../interfaces/distribution/INostrReplyAdapter';

// EPIC-010: Creator Network (Community)
import type { ICreatorCircleService } from '../interfaces/community/ICreatorCircleService';
import type { IMentorshipService } from '../interfaces/community/IMentorshipService';
import type { ICollaborativeContentService } from '../interfaces/community/ICollaborativeContentService';
import type { IMarketplaceService } from '../interfaces/community/IMarketplaceService';

// EPIC-011: Business Manager (Finance)
import type { IContractService } from '../interfaces/finance/IContractService';
import type { IBusinessInvoiceService } from '../interfaces/finance/IBusinessInvoiceService';
import type { IRevenueService } from '../interfaces/finance/IRevenueService';
import type { ITaxService } from '../interfaces/finance/ITaxService';
import type { ILightningService } from '../interfaces/finance/ILightningService';

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
  ServiceContainer: new ServiceToken<IServiceContainer>('ServiceContainer', 'Main DI container'),
  ServiceFactory: new ServiceToken<Record<string, unknown>>(
    'ServiceFactory',
    'Service factory orchestrator'
  ),
  EventBusService: new ServiceToken<IEventBus>('EventBusService', 'Central event bus'),
  RepositoryFactory: new ServiceToken<Record<string, unknown>>(
    'RepositoryFactory',
    'Repository factory'
  ),
  MigrationService: new ServiceToken<Record<string, unknown>>(
    'MigrationService',
    'Database migration service'
  ),
  DependencyAnalyzer: new ServiceToken<Record<string, unknown>>(
    'DependencyAnalyzer',
    'Dependency graph analyzer'
  ),

  // ======================
  // PHASE 2: Shared Services (4 services)
  // ======================

  /**
   * Communication & Infrastructure
   */
  EmailService: new ServiceToken<IEmailService>('EmailService', 'Email sending and templates'),
  NotificationService: new ServiceToken<INotificationService>(
    'NotificationService',
    'Multi-channel notifications'
  ),
  AuditLogService: new ServiceToken<IAuditLogService>(
    'AuditLogService',
    'Audit trail and compliance'
  ),
  CacheService: new ServiceToken<ICacheService>('CacheService', 'Redis-based caching layer'),

  // ======================
  // PHASE 3: Content Services (7 services)
  // ======================

  /**
   * Content Management & Analytics
   */
  ContentPublishingService: new ServiceToken<IContentPublishingService>(
    'ContentPublishingService',
    'Content publishing workflow'
  ),
  ContentModerationService: new ServiceToken<IContentModerationService>(
    'ContentModerationService',
    'Content moderation and filtering'
  ),
  ContentSearchService: new ServiceToken<IContentSearchService>(
    'ContentSearchService',
    'Full-text content search'
  ),
  ContentRecommendationService: new ServiceToken<IContentRecommendationService>(
    'ContentRecommendationService',
    'AI-powered recommendations'
  ),
  ContentAnalyticsService: new ServiceToken<IContentAnalyticsService>(
    'ContentAnalyticsService',
    'Content analytics and metrics'
  ),
  ContentVersioningService: new ServiceToken<IContentVersioningService>(
    'ContentVersioningService',
    'Content version control'
  ),
  ContentCreationService: new ServiceToken<IContentCreationService>(
    'ContentCreationService',
    'Content creation and editing'
  ),

  // ======================
  // PHASE 4: User Services (5 services)
  // ======================

  /**
   * User Management & Analytics
   */
  UserProfileService: new ServiceToken<IUserProfileService>(
    'UserProfileService',
    'User profile management'
  ),
  UserPreferencesService: new ServiceToken<IUserPreferencesService>(
    'UserPreferencesService',
    'User preferences and settings'
  ),
  UserActivityService: new ServiceToken<IUserActivityService>(
    'UserActivityService',
    'User activity tracking'
  ),
  UserRelationshipService: new ServiceToken<IUserRelationshipService>(
    'UserRelationshipService',
    'User relationships and follows'
  ),
  UserAnalyticsService: new ServiceToken<IUserAnalyticsService>(
    'UserAnalyticsService',
    'User behavior analytics'
  ),

  // ======================
  // PHASE 5: Payment Services (7 services)
  // ======================

  /**
   * Payment Processing & Analytics
   */
  PaymentProcessingService: new ServiceToken<IPaymentProcessingService>(
    'PaymentProcessingService',
    'Core payment processing'
  ),
  CurrencyService: new ServiceToken<ICurrencyService>('CurrencyService', 'Multi-currency support'),
  SubscriptionService: new ServiceToken<ISubscriptionService>(
    'SubscriptionService',
    'Subscription management'
  ),
  RefundService: new ServiceToken<IRefundService>(
    'RefundService',
    'Refund processing and tracking'
  ),
  PaymentAnalyticsService: new ServiceToken<IPaymentAnalyticsService>(
    'PaymentAnalyticsService',
    'Payment analytics and reporting'
  ),
  WebhookService: new ServiceToken<IWebhookService>(
    'WebhookService',
    'Webhook management and delivery'
  ),
  InvoiceService: new ServiceToken<IInvoiceService>(
    'InvoiceService',
    'Invoice generation and management'
  ),

  // ======================
  // PHASE 7: Creator Safety Net (9 services)
  // ======================

  /**
   * Wellness Services (EPIC-007)
   */
  WellnessService: new ServiceToken<IWellnessService>(
    'WellnessService',
    'Work pattern CRUD and pulse check-ins'
  ),
  BurnoutScoringService: new ServiceToken<IBurnoutScoringService>(
    'BurnoutScoringService',
    'Weighted 5-factor burnout scoring per ADR-019'
  ),
  ScheduleService: new ServiceToken<IScheduleService>(
    'ScheduleService',
    'Sustainable cadence recommendations'
  ),
  BoundaryService: new ServiceToken<IBoundaryService>(
    'BoundaryService',
    'Focus hours, DND, auto-responses'
  ),

  /**
   * Provenance / Content Shield Services (EPIC-008)
   */
  ProvenanceService: new ServiceToken<IProvenanceService>(
    'ProvenanceService',
    'Content signing with NOSTR keys, chain retrieval'
  ),
  FingerprintService: new ServiceToken<IFingerprintService>(
    'FingerprintService',
    'SimHash text + pHash image hashing per ADR-020'
  ),
  AlertService: new ServiceToken<IAlertService>(
    'AlertService',
    'Copy detection alert CRUD and status transitions'
  ),
  DmcaService: new ServiceToken<IDmcaService>('DmcaService', 'DMCA report generation (JSON + PDF)'),

  // ======================
  // PHASE 8: Multi-Platform Hub (5 services, EPIC-009)
  // ======================

  /**
   * Distribution Services (EPIC-009)
   */
  PlatformConnectionService: new ServiceToken<IPlatformConnectionService>(
    'PlatformConnectionService',
    'OAuth connections, token encryption, token refresh'
  ),
  CrossPostService: new ServiceToken<ICrossPostService>(
    'CrossPostService',
    'Cross-platform publishing queue via BullMQ'
  ),
  RepurposingService: new ServiceToken<IRepurposingService>(
    'RepurposingService',
    'Content format conversion for different platforms'
  ),
  UnifiedInboxService: new ServiceToken<IUnifiedInboxService>(
    'UnifiedInboxService',
    'Multi-platform message aggregation and routing'
  ),
  CrossPlatformAnalyticsService: new ServiceToken<ICrossPlatformAnalyticsService>(
    'CrossPlatformAnalyticsService',
    'Aggregate cross-platform metrics'
  ),

  // ======================
  // Queue Infrastructure
  // ======================

  /**
   * BullMQ Queue Service (ADR-022)
   */
  QueueService: new ServiceToken<IQueueService>('QueueService', 'BullMQ job queue management'),

  // ======================
  // Supporting Infrastructure
  // ======================

  /**
   * Common Dependencies
   */
  Logger: new ServiceToken<ILogger>('Logger', 'Application logger'),
  Config: new ServiceToken<Record<string, unknown>>('Config', 'Configuration service'),
  Database: new ServiceToken<Record<string, unknown>>('Database', 'Database connection pool'),
  Redis: new ServiceToken<Record<string, unknown>>('Redis', 'Redis client'),

  /**
   * Repositories (Data Access Layer)
   */
  UserRepository: new ServiceToken<Record<string, unknown>>('UserRepository', 'User data access'),
  ContentRepository: new ServiceToken<Record<string, unknown>>(
    'ContentRepository',
    'Content data access'
  ),
  PaymentRepository: new ServiceToken<Record<string, unknown>>(
    'PaymentRepository',
    'Payment data access'
  ),
  SubscriptionRepository: new ServiceToken<Record<string, unknown>>(
    'SubscriptionRepository',
    'Subscription data access'
  ),
  UserPreferencesRepository: new ServiceToken<Record<string, unknown>>(
    'UserPreferencesRepository',
    'User preferences data access'
  ),

  /**
   * External Service Integrations
   */
  LightningService: new ServiceToken<ILightningService>(
    'LightningService',
    'Bitcoin Lightning Network integration'
  ),
  NostrService: new ServiceToken<Record<string, unknown>>(
    'NostrService',
    'NOSTR protocol integration'
  ),
  ElasticsearchService: new ServiceToken<Record<string, unknown>>(
    'ElasticsearchService',
    'Elasticsearch client'
  ),

  /**
   * Middleware & Utilities
   */
  ValidationService: new ServiceToken<Record<string, unknown>>(
    'ValidationService',
    'Input validation'
  ),
  AuthenticationService: new ServiceToken<IUserAuthenticationService>(
    'AuthenticationService',
    'Authentication and authorization'
  ),
  RateLimitService: new ServiceToken<Record<string, unknown>>(
    'RateLimitService',
    'API rate limiting'
  ),

  // ======================
  // CONTROLLERS (API Layer)
  // ======================

  /**
   * Secrets Management
   */
  SecretsService: new ServiceToken<SecretsService>(
    'SecretsService',
    'AWS Secrets Manager integration'
  ),

  ContentController: new ServiceToken<ContentController>(
    'ContentController',
    'Content API controller'
  ),
  UserController: new ServiceToken<UserController>('UserController', 'User API controller'),
  PaymentController: new ServiceToken<PaymentController>(
    'PaymentController',
    'Payment API controller'
  ),

  // ======================
  // WAVE 2: EPIC-009B (Unified Inbox Polling)
  // ======================
  InboxPollingService: new ServiceToken<IInboxPollingService>(
    'InboxPollingService',
    'BullMQ batch polling for unified inbox'
  ),
  NostrReplyAdapter: new ServiceToken<INostrReplyAdapter>(
    'NostrReplyAdapter',
    'NOSTR kind:1 reply with NIP-10 threading'
  ),

  // ======================
  // WAVE 2: EPIC-010 (Creator Network)
  // ======================
  CreatorCircleService: new ServiceToken<ICreatorCircleService>(
    'CreatorCircleService',
    'Creator circles and community management'
  ),
  MentorshipService: new ServiceToken<IMentorshipService>(
    'MentorshipService',
    'Mentorship matching and tracking'
  ),
  CollaborativeContentService: new ServiceToken<ICollaborativeContentService>(
    'CollaborativeContentService',
    'Co-authoring with revenue splits'
  ),
  MarketplaceService: new ServiceToken<IMarketplaceService>(
    'MarketplaceService',
    'Creator marketplace with Lightning escrow'
  ),

  // ======================
  // WAVE 2: EPIC-011 (Business Manager)
  // ======================
  ContractService: new ServiceToken<IContractService>(
    'ContractService',
    'Contract templates and red flag analysis'
  ),
  BusinessInvoiceService: new ServiceToken<IBusinessInvoiceService>(
    'BusinessInvoiceService',
    'Business invoicing with LNURL-pay'
  ),
  RevenueService: new ServiceToken<IRevenueService>(
    'RevenueService',
    'Revenue tracking and diversification'
  ),
  TaxService: new ServiceToken<ITaxService>(
    'TaxService',
    'Tax preparation and expense categorization'
  ),
} as const;

/**
 * Service lifetime configuration
 * Defines the lifecycle scope for each service
 */
export const SERVICE_LIFETIMES = {
  // Singleton: Single instance shared across entire application
  // Note: All services formerly registered as "scoped" have been reclassified as
  // singletons because no per-request scoping middleware exists. Services resolve
  // from the root container, making scoped registrations behave as singletons.
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
    'SecretsService',
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
    // Queue Infrastructure
    'QueueService',
    // Phase 7: Creator Safety Net
    'WellnessService',
    'BurnoutScoringService',
    'ScheduleService',
    'BoundaryService',
    'ProvenanceService',
    'FingerprintService',
    'AlertService',
    'DmcaService',
    // Phase 8: Multi-Platform Hub
    'PlatformConnectionService',
    'CrossPostService',
    'RepurposingService',
    'UnifiedInboxService',
    'CrossPlatformAnalyticsService',
    // Wave 2: EPIC-009B
    'InboxPollingService',
    'NostrReplyAdapter',
    // Wave 2: EPIC-010
    'CreatorCircleService',
    'MentorshipService',
    'CollaborativeContentService',
    'MarketplaceService',
    // Wave 2: EPIC-011
    'ContractService',
    'BusinessInvoiceService',
    'RevenueService',
    'TaxService',
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
 * Documents explicit dependencies for each service.
 * Used by getServiceDependencies() and integration tests.
 */
export const SERVICE_DEPENDENCIES = {
  // Shared Services
  EmailService: ['Config', 'Logger'],
  NotificationService: ['EmailService', 'EventBusService', 'Logger', 'QueueService'],
  AuditLogService: ['Database', 'Logger'],
  CacheService: ['Redis', 'EventBusService', 'Logger'],

  // Content Services
  ContentPublishingService: ['ContentRepository', 'EventBusService', 'CacheService', 'Logger'],
  ContentModerationService: ['ContentRepository', 'AuditLogService', 'Logger'],
  ContentSearchService: ['ElasticsearchService', 'CacheService', 'Logger'],
  ContentRecommendationService: [
    'ContentRepository',
    'UserActivityService',
    'CacheService',
    'Logger',
  ],
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
  SubscriptionService: [
    'SubscriptionRepository',
    'PaymentProcessingService',
    'EventBusService',
    'Logger',
  ],
  RefundService: ['PaymentRepository', 'PaymentProcessingService', 'EventBusService', 'Logger'],
  PaymentAnalyticsService: ['PaymentRepository', 'EventBusService', 'Logger'],
  WebhookService: ['Database', 'EventBusService', 'Logger'],
  InvoiceService: ['PaymentRepository', 'Logger'],

  // Authentication
  AuthenticationService: ['UserRepository', 'CacheService', 'Logger'],

  // Secrets
  SecretsService: ['Config', 'Logger'],

  // Queue Infrastructure
  QueueService: ['Redis', 'Logger'],

  // Phase 7: Wellness Services
  WellnessService: ['Database', 'EventBusService', 'Logger'],
  BurnoutScoringService: ['WellnessService', 'Logger'],
  ScheduleService: ['WellnessService', 'Logger'],
  BoundaryService: ['Database', 'Logger'],

  // Phase 7: Provenance Services
  ProvenanceService: ['Database', 'NostrService', 'Logger'],
  FingerprintService: ['Database', 'Logger'],
  AlertService: ['Database', 'Logger'],
  DmcaService: ['AlertService', 'ProvenanceService', 'Logger'],

  // Phase 8: Distribution Services (EPIC-009)
  PlatformConnectionService: ['Database', 'Logger'],
  CrossPostService: ['Database', 'PlatformConnectionService', 'QueueService', 'Logger'],
  RepurposingService: ['Database', 'Logger'],
  UnifiedInboxService: ['PlatformConnectionService', 'QueueService', 'Database', 'Logger'],
  CrossPlatformAnalyticsService: ['PlatformConnectionService', 'Database', 'Logger'],

  // Wave 2: EPIC-009B
  InboxPollingService: ['PlatformConnectionService', 'QueueService', 'Database', 'Logger'],
  NostrReplyAdapter: ['Database', 'Logger'],

  // Wave 2: EPIC-010
  CreatorCircleService: ['Database', 'Logger'],
  MentorshipService: ['Database', 'Logger'],
  CollaborativeContentService: ['Database', 'Logger'],
  MarketplaceService: ['Database', 'LightningService', 'QueueService', 'Logger'],

  // Wave 2: EPIC-011
  ContractService: ['Database', 'Logger'],
  BusinessInvoiceService: ['Database', 'QueueService', 'Logger'],
  RevenueService: ['Database', 'CacheService', 'Logger'],
  TaxService: ['Database', 'CacheService', 'Logger'],
} as const;

/**
 * Get dependencies for a given service name
 */
export function getServiceDependencies(serviceName: string): string[] {
  return SERVICE_DEPENDENCIES[serviceName as keyof typeof SERVICE_DEPENDENCIES] || [];
}

/**
 * Service tags for grouping and discovery
 */
export const SERVICE_TAGS = {
  infrastructure: [
    'ServiceContainer',
    'EventBusService',
    'CacheService',
    'Logger',
    'Config',
    'SecretsService',
    'QueueService',
  ],
  communication: ['EmailService', 'NotificationService', 'WebhookService'],
  content: [
    'ContentPublishingService',
    'ContentModerationService',
    'ContentSearchService',
    'ContentRecommendationService',
    'ContentAnalyticsService',
    'ContentVersioningService',
    'ContentCreationService',
  ],
  user: [
    'UserProfileService',
    'UserPreferencesService',
    'UserActivityService',
    'UserRelationshipService',
    'UserAnalyticsService',
  ],
  payment: [
    'PaymentProcessingService',
    'CurrencyService',
    'SubscriptionService',
    'RefundService',
    'PaymentAnalyticsService',
    'InvoiceService',
  ],
  analytics: ['ContentAnalyticsService', 'UserAnalyticsService', 'PaymentAnalyticsService'],
  blockchain: ['LightningService', 'NostrService'],
  wellness: ['WellnessService', 'BurnoutScoringService', 'ScheduleService', 'BoundaryService'],
  provenance: ['ProvenanceService', 'FingerprintService', 'AlertService', 'DmcaService'],
  distribution: [
    'PlatformConnectionService',
    'CrossPostService',
    'RepurposingService',
    'UnifiedInboxService',
    'CrossPlatformAnalyticsService',
    'InboxPollingService',
    'NostrReplyAdapter',
  ],
  community: [
    'CreatorCircleService',
    'MentorshipService',
    'CollaborativeContentService',
    'MarketplaceService',
  ],
  finance: ['ContractService', 'BusinessInvoiceService', 'RevenueService', 'TaxService'],
} as const;

/**
 * Get service lifetime for a given service name
 */
export function getServiceLifetime(serviceName: string): 'singleton' | 'transient' {
  if (SERVICE_LIFETIMES.singleton.includes(serviceName)) {
    return 'singleton';
  }
  return 'transient';
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
