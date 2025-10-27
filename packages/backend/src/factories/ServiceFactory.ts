/**
 * Service Factory Base Class
 * Abstract factory pattern for service creation
 * Part of Epic 005 - Backend Service Refactoring - Story E5-004
 */

import { IServiceContainer, ServiceToken } from '../interfaces/shared/IServiceRegistry';

/**
 * Base factory for creating services with proper dependency injection
 */
export abstract class ServiceFactory<T> {
  protected container: IServiceContainer;

  constructor(container: IServiceContainer) {
    this.container = container;
  }

  /**
   * Create a new instance of the service
   */
  abstract create(): T | Promise<T>;

  /**
   * Create a singleton instance
   */
  async createSingleton(): Promise<T> {
    return this.create();
  }

  /**
   * Create a scoped instance
   */
  async createScoped(): Promise<T> {
    return this.create();
  }

  /**
   * Resolve a dependency from the container
   */
  protected resolve<D>(token: ServiceToken<D>): D {
    return this.container.resolve(token);
  }

  /**
   * Resolve an async dependency from the container
   */
  protected async resolveAsync<D>(token: ServiceToken<D>): Promise<D> {
    return this.container.resolveAsync(token);
  }

  /**
   * Resolve optional dependency
   */
  protected resolveOptional<D>(token: ServiceToken<D>): D | null {
    return this.container.resolveOptional(token);
  }
}

/**
 * Factory result type for error handling
 */
export type FactoryResult<T> = {
  success: true;
  instance: T;
} | {
  success: false;
  error: Error;
};

/**
 * Enhanced factory with error handling
 */
export abstract class SafeServiceFactory<T> extends ServiceFactory<T> {
  /**
   * Create service with error handling
   */
  async createSafe(): Promise<FactoryResult<T>> {
    try {
      const instance = await this.create();
      return { success: true, instance };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  /**
   * Validate service dependencies before creation
   */
  protected abstract validateDependencies(): boolean;

  /**
   * Get required dependency tokens
   */
  protected abstract getRequiredDependencies(): ServiceToken<any>[];

  /**
   * Check if all dependencies are available
   */
  canCreate(): boolean {
    const deps = this.getRequiredDependencies();
    for (const dep of deps) {
      if (!this.container.resolveOptional(dep)) {
        return false;
      }
    }
    return this.validateDependencies();
  }
}

/**
 * Composite factory for creating related services
 */
export class CompositeServiceFactory<T extends Record<string, any>> {
  private factories: Map<keyof T, ServiceFactory<any>> = new Map();

  register<K extends keyof T>(key: K, factory: ServiceFactory<T[K]>): void {
    this.factories.set(key, factory);
  }

  async createAll(): Promise<T> {
    const result = {} as T;

    for (const [key, factory] of this.factories) {
      result[key as keyof T] = await factory.create();
    }

    return result;
  }

  async createSelected(keys: (keyof T)[]): Promise<Partial<T>> {
    const result: Partial<T> = {};

    for (const key of keys) {
      const factory = this.factories.get(key);
      if (factory) {
        result[key] = await factory.create();
      }
    }

    return result;
  }
}

/**
 * Factory registry for managing all service factories
 */
export class ServiceFactoryRegistry {
  private factories: Map<string, ServiceFactory<any>> = new Map();

  /**
   * Register a factory for a service token
   */
  register<T>(token: ServiceToken<T>, factory: ServiceFactory<T>): void {
    this.factories.set(token.name, factory);
  }

  /**
   * Get a factory for a service token
   */
  get<T>(token: ServiceToken<T>): ServiceFactory<T> | null {
    return this.factories.get(token.name) || null;
  }

  /**
   * Check if a factory is registered
   */
  has<T>(token: ServiceToken<T>): boolean {
    return this.factories.has(token.name);
  }

  /**
   * Create all services
   */
  async createAll(container: IServiceContainer): Promise<Map<string, any>> {
    const instances = new Map<string, any>();

    for (const [tokenName, factory] of this.factories) {
      const instance = await factory.create();
      instances.set(tokenName, instance);
    }

    return instances;
  }

  /**
   * Get all registered factory names
   */
  getFactoryNames(): string[] {
    return Array.from(this.factories.keys());
  }

  /**
   * Clear all factories
   */
  clear(): void {
    this.factories.clear();
  }
}