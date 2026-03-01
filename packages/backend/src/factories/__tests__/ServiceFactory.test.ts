/**
 * Service Factory Tests
 * Test suite for factory pattern implementation
 * Part of Epic 005 - Backend Service Refactoring - Story E5-004
 */

import {
  ServiceFactory,
  SafeServiceFactory,
  CompositeServiceFactory,
  ServiceFactoryRegistry,
} from '../ServiceFactory';
import { ServiceContainer, ServiceRegistry } from '../../container/ServiceContainer';
import { ServiceToken } from '../../interfaces/shared/IServiceRegistry';
import { initializeFactories, SERVICE_TOKENS } from '../FactoryModule';

describe('ServiceFactory', () => {
  let container: ServiceContainer;
  let registry: ServiceRegistry;

  beforeEach(() => {
    registry = new ServiceRegistry();
    container = new ServiceContainer(registry);
  });

  describe('Base ServiceFactory', () => {
    it('should create service instances', async () => {
      class TestService {
        getValue() {
          return 'test';
        }
      }

      class TestServiceFactory extends ServiceFactory<TestService> {
        async create(): Promise<TestService> {
          return new TestService();
        }
      }

      const factory = new TestServiceFactory(container);
      const service = await factory.create();

      expect(service).toBeInstanceOf(TestService);
      expect(service.getValue()).toBe('test');
    });

    it('should resolve dependencies from container', () => {
      const token = new ServiceToken<string>('TestDependency');
      registry.registerSingleton(token, 'dependency-value');

      class DependentServiceFactory extends ServiceFactory<any> {
        create() {
          const dep = this.resolve(token);
          return { dependency: dep };
        }
      }

      const factory = new DependentServiceFactory(container);
      const service = factory.create();

      expect(service.dependency).toBe('dependency-value');
    });
  });

  describe('SafeServiceFactory', () => {
    class TestSafeFactory extends SafeServiceFactory<any> {
      protected validateDependencies(): boolean {
        return true;
      }

      protected getRequiredDependencies(): ServiceToken<any>[] {
        return [new ServiceToken('RequiredService')];
      }

      async create(): Promise<any> {
        return { success: true };
      }
    }

    it('should create service with error handling', async () => {
      const factory = new TestSafeFactory(container);

      // Register required dependency
      registry.registerSingleton(new ServiceToken('RequiredService'), {});

      const result = await factory.createSafe();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.instance).toEqual({ success: true });
      }
    });

    it('should handle creation errors gracefully', async () => {
      class ErrorFactory extends SafeServiceFactory<any> {
        protected validateDependencies(): boolean {
          return true;
        }

        protected getRequiredDependencies(): ServiceToken<any>[] {
          return [];
        }

        async create(): Promise<any> {
          throw new Error('Creation failed');
        }
      }

      const factory = new ErrorFactory(container);
      const result = await factory.createSafe();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('Creation failed');
      }
    });

    it('should check if factory can create service', () => {
      const factory = new TestSafeFactory(container);

      // Without required dependency
      expect(factory.canCreate()).toBe(false);

      // With required dependency
      registry.registerSingleton(new ServiceToken('RequiredService'), {});
      expect(factory.canCreate()).toBe(true);
    });
  });

  describe('CompositeServiceFactory', () => {
    it('should create multiple related services', async () => {
      const composite = new CompositeServiceFactory();

      class ServiceA {
        name = 'ServiceA';
      }

      class ServiceB {
        name = 'ServiceB';
      }

      class FactoryA extends ServiceFactory<ServiceA> {
        create() {
          return new ServiceA();
        }
      }

      class FactoryB extends ServiceFactory<ServiceB> {
        create() {
          return new ServiceB();
        }
      }

      composite.register('serviceA', new FactoryA(container));
      composite.register('serviceB', new FactoryB(container));

      const services = await composite.createAll();

      expect(services.serviceA.name).toBe('ServiceA');
      expect(services.serviceB.name).toBe('ServiceB');
    });

    it('should create selected services only', async () => {
      const composite = new CompositeServiceFactory();

      class FactoryA extends ServiceFactory<any> {
        create() {
          return { name: 'A' };
        }
      }

      class FactoryB extends ServiceFactory<any> {
        create() {
          return { name: 'B' };
        }
      }

      class FactoryC extends ServiceFactory<any> {
        create() {
          return { name: 'C' };
        }
      }

      composite.register('a', new FactoryA(container));
      composite.register('b', new FactoryB(container));
      composite.register('c', new FactoryC(container));

      const selected = await composite.createSelected(['a', 'c']);

      expect(selected.a).toEqual({ name: 'A' });
      expect(selected.b).toBeUndefined();
      expect(selected.c).toEqual({ name: 'C' });
    });
  });

  describe('ServiceFactoryRegistry', () => {
    it('should register and retrieve factories', () => {
      const registry = new ServiceFactoryRegistry();
      const token = new ServiceToken<any>('TestService');

      class TestFactory extends ServiceFactory<any> {
        create() {
          return { test: true };
        }
      }

      const factory = new TestFactory(container);
      registry.register(token, factory);

      expect(registry.has(token)).toBe(true);
      expect(registry.get(token)).toBe(factory);
    });

    it('should return null for unregistered factories', () => {
      const registry = new ServiceFactoryRegistry();
      const token = new ServiceToken<any>('UnregisteredService');

      expect(registry.has(token)).toBe(false);
      expect(registry.get(token)).toBeNull();
    });

    it('should list all factory names', () => {
      const registry = new ServiceFactoryRegistry();

      const token1 = new ServiceToken('Service1');
      const token2 = new ServiceToken('Service2');

      class DummyFactory extends ServiceFactory<any> {
        create() {
          return {};
        }
      }

      registry.register(token1, new DummyFactory(container));
      registry.register(token2, new DummyFactory(container));

      const names = registry.getFactoryNames();

      expect(names).toContain('Service1');
      expect(names).toContain('Service2');
      expect(names).toHaveLength(2);
    });

    it('should clear all factories', () => {
      const registry = new ServiceFactoryRegistry();
      const token = new ServiceToken('TestService');

      class DummyFactory extends ServiceFactory<any> {
        create() {
          return {};
        }
      }

      registry.register(token, new DummyFactory(container));
      expect(registry.has(token)).toBe(true);

      registry.clear();
      expect(registry.has(token)).toBe(false);
      expect(registry.getFactoryNames()).toHaveLength(0);
    });
  });

  describe('Factory Module Integration', () => {
    it('should initialize all service factories', () => {
      const serviceRegistry = new ServiceRegistry();
      initializeFactories(serviceRegistry);

      // Check that key services are registered
      expect(serviceRegistry.canResolve(SERVICE_TOKENS.Logger)).toBe(true);
      expect(serviceRegistry.canResolve(SERVICE_TOKENS.Database)).toBe(true);
    });

    it('should resolve services with dependencies', async () => {
      const serviceRegistry = new ServiceRegistry();
      initializeFactories(serviceRegistry);

      const container = serviceRegistry.createContainer();

      // Logger should be resolvable
      const logger = container.resolve(SERVICE_TOKENS.Logger);
      expect(logger).toBeDefined();
      expect(logger.info).toBeInstanceOf(Function);
    });
  });

  describe('Factory Error Handling', () => {
    it('should handle circular dependencies', () => {
      const tokenA = new ServiceToken<any>('ServiceA');
      const tokenB = new ServiceToken<any>('ServiceB');

      // ServiceA depends on ServiceB
      registry.register({
        token: tokenA,
        factory: (c) => ({ b: c.resolve(tokenB) }),
        lifetime: 'singleton',
        dependencies: [tokenB],
      });

      // ServiceB depends on ServiceA (circular)
      registry.register({
        token: tokenB,
        factory: (c) => ({ a: c.resolve(tokenA) }),
        lifetime: 'singleton',
        dependencies: [tokenA],
      });

      const validation = registry.validate();

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContainEqual(
        expect.objectContaining({
          type: 'circular_dependency',
        })
      );
    });

    it('should detect missing dependencies', () => {
      const tokenA = new ServiceToken<any>('ServiceA');
      const tokenB = new ServiceToken<any>('MissingService');

      registry.register({
        token: tokenA,
        factory: (c) => ({ b: c.resolve(tokenB) }),
        lifetime: 'singleton',
        dependencies: [tokenB],
      });

      const validation = registry.validate();

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContainEqual(
        expect.objectContaining({
          type: 'missing_dependency',
          message: expect.stringContaining('MissingService'),
        })
      );
    });
  });
});
