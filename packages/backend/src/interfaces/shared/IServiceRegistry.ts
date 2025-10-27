/**
 * Service Registry and Dependency Injection Container Interface
 * Central service management and dependency resolution
 * Part of Epic 005 - Backend Service Refactoring
 */

export type ServiceFactory<T> = (container: IServiceContainer) => T | Promise<T>;
export type ServiceLifetime = 'singleton' | 'scoped' | 'transient';

/**
 * Service token for type-safe dependency injection
 */
export class ServiceToken<T> {
  constructor(
    public readonly name: string,
    public readonly description?: string
  ) {}

  toString(): string {
    return `ServiceToken(${this.name})`;
  }
}

/**
 * Service descriptor containing registration information
 */
export interface ServiceDescriptor<T> {
  token: ServiceToken<T>;
  factory: ServiceFactory<T>;
  lifetime: ServiceLifetime;
  dependencies?: ServiceToken<any>[];
  metadata?: Record<string, any>;
}

/**
 * Service container for scoped dependency resolution
 */
export interface IServiceContainer {
  // Resolution
  resolve<T>(token: ServiceToken<T>): T;
  resolveAsync<T>(token: ServiceToken<T>): Promise<T>;
  resolveOptional<T>(token: ServiceToken<T>): T | null;
  resolveMany<T>(token: ServiceToken<T>): T[];

  // Scoped container
  createScope(): IServiceContainer;

  // Lifecycle
  dispose(): Promise<void>;
}

/**
 * Service registry for dependency registration and management
 */
export interface IServiceRegistry {
  // Registration
  register<T>(descriptor: ServiceDescriptor<T>): void;
  registerSingleton<T>(token: ServiceToken<T>, implementation: T): void;
  registerSingletonFactory<T>(token: ServiceToken<T>, factory: ServiceFactory<T>): void;
  registerScoped<T>(token: ServiceToken<T>, factory: ServiceFactory<T>): void;
  registerTransient<T>(token: ServiceToken<T>, factory: ServiceFactory<T>): void;

  // Bulk Registration
  registerModule(module: IServiceModule): void;
  registerMany(descriptors: ServiceDescriptor<any>[]): void;

  // Validation
  validate(): ValidationResult;
  canResolve<T>(token: ServiceToken<T>): boolean;
  getDependencyGraph(): DependencyGraph;

  // Container Creation
  createContainer(): IServiceContainer;

  // Metadata
  getDescriptor<T>(token: ServiceToken<T>): ServiceDescriptor<T> | null;
  getRegisteredTokens(): ServiceToken<any>[];
}

/**
 * Service module for grouping related service registrations
 */
export interface IServiceModule {
  name: string;
  register(registry: IServiceRegistry): void;
  dependencies?: IServiceModule[];
}

/**
 * Validation result for service registration
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  type: 'circular_dependency' | 'missing_dependency' | 'duplicate_registration';
  message: string;
  token?: string;
  details?: any;
}

export interface ValidationWarning {
  type: 'unused_service' | 'multiple_implementations';
  message: string;
  token?: string;
}

/**
 * Dependency graph for visualization and analysis
 */
export interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
}

export interface DependencyNode {
  id: string;
  token: string;
  lifetime: ServiceLifetime;
  metadata?: Record<string, any>;
}

export interface DependencyEdge {
  from: string;
  to: string;
  optional: boolean;
}

/**
 * Service decorator metadata
 */
export interface ServiceMetadata {
  version?: string;
  description?: string;
  tags?: string[];
  healthCheck?: () => Promise<boolean>;
  metrics?: string[];
}

/**
 * Predefined service tokens for core services
 */
export class ServiceTokens {
  // Payment Context
  static readonly PaymentService = new ServiceToken<any>('IPaymentService', 'Core payment processing');
  static readonly SubscriptionService = new ServiceToken<any>('ISubscriptionService', 'Subscription management');
  static readonly InvoiceService = new ServiceToken<any>('IInvoiceService', 'Invoice generation');
  static readonly RefundService = new ServiceToken<any>('IRefundService', 'Refund processing');

  // Content Context
  static readonly ContentService = new ServiceToken<any>('IContentService', 'Content management');
  static readonly RecommendationService = new ServiceToken<any>('IRecommendationService', 'Content recommendations');
  static readonly ModerationService = new ServiceToken<any>('IModerationService', 'Content moderation');
  static readonly SearchService = new ServiceToken<any>('ISearchService', 'Content search');

  // User Context
  static readonly UserService = new ServiceToken<any>('IUserService', 'User management');
  static readonly AuthService = new ServiceToken<any>('IAuthService', 'Authentication service');
  static readonly ProfileService = new ServiceToken<any>('IProfileService', 'User profiles');
  static readonly PreferencesService = new ServiceToken<any>('IPreferencesService', 'User preferences');

  // Analytics Context
  static readonly AnalyticsService = new ServiceToken<any>('IAnalyticsService', 'Analytics tracking');
  static readonly MetricsService = new ServiceToken<any>('IMetricsService', 'Metrics collection');
  static readonly ReportingService = new ServiceToken<any>('IReportingService', 'Report generation');

  // Communication Context
  static readonly NotificationService = new ServiceToken<any>('INotificationService', 'Notifications');
  static readonly EmailService = new ServiceToken<any>('IEmailService', 'Email sending');
  static readonly WebSocketService = new ServiceToken<any>('IWebSocketService', 'WebSocket connections');

  // Infrastructure
  static readonly EventBus = new ServiceToken<any>('IEventBus', 'Event bus');
  static readonly CacheService = new ServiceToken<any>('ICacheService', 'Caching layer');
  static readonly LoggerService = new ServiceToken<any>('ILoggerService', 'Logging service');
  static readonly ConfigService = new ServiceToken<any>('IConfigService', 'Configuration management');
  static readonly DatabaseService = new ServiceToken<any>('IDatabaseService', 'Database access');
}

/**
 * Service collection builder for fluent registration
 */
export class ServiceCollectionBuilder {
  private descriptors: ServiceDescriptor<any>[] = [];

  addSingleton<T>(token: ServiceToken<T>, factory: ServiceFactory<T>): this {
    this.descriptors.push({
      token,
      factory,
      lifetime: 'singleton',
      dependencies: []
    });
    return this;
  }

  addScoped<T>(token: ServiceToken<T>, factory: ServiceFactory<T>): this {
    this.descriptors.push({
      token,
      factory,
      lifetime: 'scoped',
      dependencies: []
    });
    return this;
  }

  addTransient<T>(token: ServiceToken<T>, factory: ServiceFactory<T>): this {
    this.descriptors.push({
      token,
      factory,
      lifetime: 'transient',
      dependencies: []
    });
    return this;
  }

  build(): ServiceDescriptor<any>[] {
    return this.descriptors;
  }
}