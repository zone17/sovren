/**
 * Test Container Setup
 * DI Container configuration for integration tests
 * Part of US-E5-034: Integration Test Suite
 */

import { ServiceRegistry, ServiceContainer } from '../../container/ServiceContainer';
import type { IServiceContainer } from '../../interfaces/shared/IServiceRegistry';
import { createMockLogger } from './mock-services';
import { createMockDatabase } from './mock-database';
import { createMockCache } from './mock-cache';
import { createMockEventBus } from './mock-event-bus';

/**
 * Create a test service container with all dependencies
 */
export async function createTestContainer(config?: {
  useRealDatabase?: boolean;
  useRealCache?: boolean;
  useRealEventBus?: boolean;
}): Promise<IServiceContainer> {
  const registry = new ServiceRegistry();

  // Register core infrastructure
  registry.registerSingleton({ name: 'ILogger' }, createMockLogger());

  if (config?.useRealDatabase) {
    // Use testcontainers PostgreSQL
    const db = await createMockDatabase({ real: true });
    registry.registerSingleton({ name: 'IDatabase' }, db);
  } else {
    // Use mock database
    registry.registerSingleton({ name: 'IDatabase' }, createMockDatabase());
  }

  if (config?.useRealCache) {
    // Use testcontainers Redis
    const cache = await createMockCache({ real: true });
    registry.registerSingleton({ name: 'ICacheService' }, cache);
  } else {
    // Use in-memory cache
    registry.registerSingleton({ name: 'ICacheService' }, createMockCache());
  }

  if (config?.useRealEventBus) {
    const eventBus = createMockEventBus({ real: true });
    registry.registerSingleton({ name: 'IEventBusService' }, eventBus);
  } else {
    registry.registerSingleton({ name: 'IEventBusService' }, createMockEventBus());
  }

  // Register repository layer (using factories)
  // These would be imported from actual service modules

  // Register service layer
  // These would be imported from actual service modules

  return registry.createContainer();
}

/**
 * Create a scoped test container for isolated tests
 */
export async function createScopedTestContainer(
  parent?: IServiceContainer
): Promise<IServiceContainer> {
  if (!parent) {
    parent = await createTestContainer();
  }
  return parent.createScope();
}

/**
 * Cleanup test container and dispose resources
 */
export async function cleanupTestContainer(container: IServiceContainer): Promise<void> {
  await container.dispose();
}

/**
 * Test container builder for specific scenarios
 */
export class TestContainerBuilder {
  private registry = new ServiceRegistry();
  private config: Record<string, any> = {};

  withRealDatabase(): this {
    this.config.useRealDatabase = true;
    return this;
  }

  withRealCache(): this {
    this.config.useRealCache = true;
    return this;
  }

  withRealEventBus(): this {
    this.config.useRealEventBus = true;
    return this;
  }

  withMockService<T>(token: { name: string }, implementation: T): this {
    this.registry.registerSingleton(token, implementation);
    return this;
  }

  async build(): Promise<IServiceContainer> {
    return createTestContainer(this.config);
  }
}

/**
 * Helper to create test container builder
 */
export function testContainer(): TestContainerBuilder {
  return new TestContainerBuilder();
}
