/**
 * Service Container Implementation
 * Dependency Injection Container with lifecycle management
 * Part of Epic 005 - Backend Service Refactoring
 */

import type {
  IServiceContainer,
  IServiceRegistry,
  ServiceToken,
  ServiceDescriptor,
  ServiceFactory,
  ServiceLifetime,
  ValidationResult,
  DependencyGraph,
  IServiceModule,
} from '../interfaces/shared/IServiceRegistry';

/**
 * Service instance storage
 */
interface ServiceInstance {
  instance: any;
  lifetime: ServiceLifetime;
  factory: ServiceFactory<any>;
  created: Date;
  disposed: boolean;
}

/**
 * Concrete implementation of the service container
 */
export class ServiceContainer implements IServiceContainer {
  private singletons: Map<string, any> = new Map();
  private scopedInstances: Map<string, any> = new Map();
  private registry: ServiceRegistry;
  private parent?: ServiceContainer;
  private isDisposed = false;

  constructor(registry: ServiceRegistry, parent?: ServiceContainer) {
    this.registry = registry;
    this.parent = parent;
  }

  resolve<T>(token: ServiceToken<T>): T {
    this.ensureNotDisposed();

    const tokenName = token.name;

    // Check if already resolved in current scope
    if (this.scopedInstances.has(tokenName)) {
      return this.scopedInstances.get(tokenName);
    }

    // Check singletons (including parent)
    if (this.singletons.has(tokenName)) {
      return this.singletons.get(tokenName);
    }
    if (this.parent?.singletons.has(tokenName)) {
      return this.parent.singletons.get(tokenName);
    }

    // Get descriptor and create instance
    const descriptor = this.registry.getDescriptor(token);
    if (!descriptor) {
      throw new Error(`Service '${tokenName}' is not registered`);
    }

    const instance = this.createInstance(descriptor);

    // Store based on lifetime
    switch (descriptor.lifetime) {
      case 'singleton':
        this.singletons.set(tokenName, instance);
        break;
      case 'scoped':
        this.scopedInstances.set(tokenName, instance);
        break;
      case 'transient':
        // Don't store transient instances
        break;
    }

    return instance;
  }

  async resolveAsync<T>(token: ServiceToken<T>): Promise<T> {
    this.ensureNotDisposed();

    const tokenName = token.name;

    // Check caches first
    if (this.scopedInstances.has(tokenName)) {
      return this.scopedInstances.get(tokenName);
    }
    if (this.singletons.has(tokenName)) {
      return this.singletons.get(tokenName);
    }
    if (this.parent?.singletons.has(tokenName)) {
      return this.parent.singletons.get(tokenName);
    }

    // Get descriptor and create instance
    const descriptor = this.registry.getDescriptor(token);
    if (!descriptor) {
      throw new Error(`Service '${tokenName}' is not registered`);
    }

    const instance = await this.createInstanceAsync(descriptor);

    // Store based on lifetime
    switch (descriptor.lifetime) {
      case 'singleton':
        this.singletons.set(tokenName, instance);
        break;
      case 'scoped':
        this.scopedInstances.set(tokenName, instance);
        break;
    }

    return instance;
  }

  resolveOptional<T>(token: ServiceToken<T>): T | null {
    try {
      return this.resolve(token);
    } catch {
      return null;
    }
  }

  resolveMany<T>(token: ServiceToken<T>): T[] {
    // Implementation for multiple registrations of same token
    // Used for plugin systems
    return [this.resolve(token)];
  }

  createScope(): IServiceContainer {
    return new ServiceContainer(this.registry, this);
  }

  async dispose(): Promise<void> {
    if (this.isDisposed) return;

    // Dispose scoped instances
    for (const [key, instance] of this.scopedInstances) {
      if (instance && typeof instance.dispose === 'function') {
        await instance.dispose();
      }
    }
    this.scopedInstances.clear();

    // Dispose singletons (only if root container)
    if (!this.parent) {
      for (const [key, instance] of this.singletons) {
        if (instance && typeof instance.dispose === 'function') {
          await instance.dispose();
        }
      }
      this.singletons.clear();
    }

    this.isDisposed = true;
  }

  private createInstance<T>(descriptor: ServiceDescriptor<T>): T {
    const result = descriptor.factory(this);
    if (result instanceof Promise) {
      throw new Error(
        `Service '${descriptor.token.name}' returns a Promise. Use resolveAsync() instead.`
      );
    }
    return result;
  }

  private async createInstanceAsync<T>(descriptor: ServiceDescriptor<T>): Promise<T> {
    return await descriptor.factory(this);
  }

  private ensureNotDisposed(): void {
    if (this.isDisposed) {
      throw new Error('Container has been disposed');
    }
  }
}

/**
 * Service Registry Implementation
 */
export class ServiceRegistry implements IServiceRegistry {
  private descriptors: Map<string, ServiceDescriptor<any>> = new Map();
  private modules: IServiceModule[] = [];

  register<T>(descriptor: ServiceDescriptor<T>): void {
    const tokenName = descriptor.token.name;

    if (this.descriptors.has(tokenName)) {
      console.warn(`Service '${tokenName}' is already registered. Overwriting.`);
    }

    this.descriptors.set(tokenName, descriptor);
  }

  registerSingleton<T>(token: ServiceToken<T>, implementation: T): void {
    this.register({
      token,
      factory: () => implementation,
      lifetime: 'singleton',
      dependencies: [],
    });
  }

  registerSingletonFactory<T>(token: ServiceToken<T>, factory: ServiceFactory<T>): void {
    this.register({
      token,
      factory,
      lifetime: 'singleton',
      dependencies: [],
    });
  }

  registerScoped<T>(token: ServiceToken<T>, factory: ServiceFactory<T>): void {
    this.register({
      token,
      factory,
      lifetime: 'scoped',
      dependencies: [],
    });
  }

  registerTransient<T>(token: ServiceToken<T>, factory: ServiceFactory<T>): void {
    this.register({
      token,
      factory,
      lifetime: 'transient',
      dependencies: [],
    });
  }

  registerModule(module: IServiceModule): void {
    // Register dependencies first
    if (module.dependencies) {
      for (const dep of module.dependencies) {
        if (!this.modules.includes(dep)) {
          this.registerModule(dep);
        }
      }
    }

    // Register module
    module.register(this);
    this.modules.push(module);
  }

  registerMany(descriptors: ServiceDescriptor<any>[]): void {
    for (const descriptor of descriptors) {
      this.register(descriptor);
    }
  }

  validate(): ValidationResult {
    const errors: any[] = [];
    const warnings: any[] = [];

    // Check for circular dependencies
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const checkCircular = (tokenName: string): boolean => {
      if (recursionStack.has(tokenName)) {
        errors.push({
          type: 'circular_dependency',
          message: `Circular dependency detected for '${tokenName}'`,
          token: tokenName,
        });
        return true;
      }

      if (visited.has(tokenName)) {
        return false;
      }

      visited.add(tokenName);
      recursionStack.add(tokenName);

      const descriptor = this.descriptors.get(tokenName);
      if (descriptor?.dependencies) {
        for (const dep of descriptor.dependencies) {
          checkCircular(dep.name);
        }
      }

      recursionStack.delete(tokenName);
      return false;
    };

    // Validate all registered services
    for (const [tokenName, descriptor] of this.descriptors) {
      checkCircular(tokenName);

      // Check for missing dependencies
      if (descriptor.dependencies) {
        for (const dep of descriptor.dependencies) {
          if (!this.descriptors.has(dep.name)) {
            errors.push({
              type: 'missing_dependency',
              message: `Missing dependency '${dep.name}' for service '${tokenName}'`,
              token: tokenName,
            });
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  canResolve<T>(token: ServiceToken<T>): boolean {
    return this.descriptors.has(token.name);
  }

  getDependencyGraph(): DependencyGraph {
    const nodes: any[] = [];
    const edges: any[] = [];

    for (const [tokenName, descriptor] of this.descriptors) {
      nodes.push({
        id: tokenName,
        token: tokenName,
        lifetime: descriptor.lifetime,
        metadata: descriptor.metadata,
      });

      if (descriptor.dependencies) {
        for (const dep of descriptor.dependencies) {
          edges.push({
            from: tokenName,
            to: dep.name,
            optional: false,
          });
        }
      }
    }

    return { nodes, edges };
  }

  createContainer(): IServiceContainer {
    const validation = this.validate();
    if (!validation.valid) {
      throw new Error(
        `Registry validation failed: ${validation.errors.map((e) => e.message).join(', ')}`
      );
    }
    return new ServiceContainer(this);
  }

  getDescriptor<T>(token: ServiceToken<T>): ServiceDescriptor<T> | null {
    return this.descriptors.get(token.name) || null;
  }

  getRegisteredTokens(): ServiceToken<any>[] {
    return Array.from(this.descriptors.values()).map((d) => d.token);
  }
}

/**
 * Helper to create a configured service registry
 */
export function createServiceRegistry(): ServiceRegistry {
  return new ServiceRegistry();
}

/**
 * Helper to bootstrap the DI container
 */
export async function bootstrapContainer(
  configure: (registry: IServiceRegistry) => void
): Promise<IServiceContainer> {
  const registry = createServiceRegistry();
  configure(registry);

  const validation = registry.validate();
  if (!validation.valid) {
    console.error('Registry validation failed:', validation.errors);
    throw new Error('Failed to bootstrap container due to validation errors');
  }

  return registry.createContainer();
}
