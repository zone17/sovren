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

