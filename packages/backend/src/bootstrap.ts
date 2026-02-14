/**
 * Application Bootstrap Module
 * Initializes DI container and all services with health checks
 * User Story: US-E5-032 - Wire Services Through DI Container
 * Part of Epic 005 - Backend Service Refactoring - Phase 6
 */

import { performance } from 'perf_hooks';
import { createServiceRegistry, ServiceRegistry } from './container/ServiceContainer';
import type { IServiceContainer } from './interfaces/shared/IServiceRegistry';
import { TYPES } from './container/types';
import { getRedisClient } from './lib/redis';
import logger from './lib/logger';
import { SecretsService } from './services/SecretsService';

// Import binding modules
import { registerSharedServices } from './container/bindings/shared.bindings';
import { registerContentServices } from './container/bindings/content.bindings';
import { registerUserServices } from './container/bindings/user.bindings';
import { registerPaymentServices } from './container/bindings/payment.bindings';
import { registerControllers } from './container/bindings/controller.bindings';

/**
 * Bootstrap configuration
 */
export interface BootstrapConfig {
  environment: 'development' | 'test' | 'production';
  enableHealthChecks: boolean;
  validateDependencies: boolean;
  logStartup: boolean;
  gracefulShutdown: boolean;
}

/**
 * Bootstrap result with timing and status
 */
export interface BootstrapResult {
  success: boolean;
  container: IServiceContainer;
  registry: ServiceRegistry;
  timing: {
    registrationMs: number;
    validationMs: number;
    initializationMs: number;
    totalMs: number;
  };
  servicesRegistered: number;
  healthCheckResults?: Map<string, boolean>;
  errors?: Error[];
}

/**
 * Default bootstrap configuration
 */
const DEFAULT_CONFIG: BootstrapConfig = {
  environment: (process.env.NODE_ENV as any) || 'development',
  enableHealthChecks: true,
  validateDependencies: true,
  logStartup: true,
  gracefulShutdown: true,
};

/**
 * Bootstrap the application DI container
 * Registers all 29 services from Phases 1-5
 */
export async function bootstrapApplication(
  config: Partial<BootstrapConfig> = {}
): Promise<BootstrapResult> {
  const startTime = performance.now();
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  const errors: Error[] = [];

  if (fullConfig.logStartup) {
    logger.info('Bootstrapping Sovren Backend Services', { environment: fullConfig.environment });
  }

  // ======================
  // PHASE 1: Create Registry
  // ======================
  const registrationStart = performance.now();
  const registry = createServiceRegistry();

  // Register infrastructure services first
  registerInfrastructureServices(registry);

  // Register business domain services
  registerSharedServices(registry);
  registerContentServices(registry);
  registerUserServices(registry);
  registerPaymentServices(registry);
  registerControllers(registry);

  const registrationTime = performance.now() - registrationStart;

  if (fullConfig.logStartup) {
    logger.info('Service registration complete', {
      durationMs: registrationTime.toFixed(2),
      count: registry.getRegisteredTokens().length,
    });
  }

  // ======================
  // PHASE 2: Validate Dependencies
  // ======================
  const validationStart = performance.now();

  if (fullConfig.validateDependencies) {
    const validation = registry.validate();

    if (!validation.valid) {
      logger.error('Container validation failed', {
        errors: validation.errors.map((e) => e.message),
      });
      validation.errors.forEach((error) => {
        errors.push(new Error(error.message));
      });

      if (validation.errors.some((e) => e.type === 'circular_dependency')) {
        throw new Error('Circular dependencies detected. Cannot start application.');
      }
    }

    if (validation.warnings.length > 0 && fullConfig.logStartup) {
      logger.warn('Container warnings', { warnings: validation.warnings.map((w) => w.message) });
    }
  }

  const validationTime = performance.now() - validationStart;

  // ======================
  // PHASE 3: Create Container
  // ======================
  const initStart = performance.now();
  const container = registry.createContainer();
  const initTime = performance.now() - initStart;

  if (fullConfig.logStartup) {
    logger.info('Container initialized', { durationMs: initTime.toFixed(2) });
  }

  // ======================
  // PHASE 4: Health Checks
  // ======================
  let healthCheckResults: Map<string, boolean> | undefined;

  if (fullConfig.enableHealthChecks) {
    healthCheckResults = await performHealthChecks(container);

    if (fullConfig.logStartup) {
      const results: Record<string, boolean> = {};
      for (const [service, healthy] of healthCheckResults) {
        results[service] = healthy;
      }
      logger.info('Health check results', results);
    }
  }

  // ======================
  // PHASE 5: Setup Graceful Shutdown
  // ======================
  if (fullConfig.gracefulShutdown) {
    setupGracefulShutdown(container);
  }

  const totalTime = performance.now() - startTime;

  if (fullConfig.logStartup) {
    logger.info('Bootstrap complete', { durationMs: totalTime.toFixed(2) });
  }

  return {
    success: errors.length === 0,
    container,
    registry,
    timing: {
      registrationMs: registrationTime,
      validationMs: validationTime,
      initializationMs: initTime,
      totalMs: totalTime,
    },
    servicesRegistered: registry.getRegisteredTokens().length,
    healthCheckResults,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Register infrastructure services (Logger, Config, Database, Redis, etc.)
 */
function registerInfrastructureServices(registry: ServiceRegistry): void {
  // Logger — reuse the shared structured logger from lib/logger
  registry.registerSingletonFactory(TYPES.Logger, () => logger);

  // Config (Environment variables)
  registry.registerSingletonFactory(TYPES.Config, () => {
    return {
      get: (key: string, defaultValue?: string) => {
        return process.env[key] || defaultValue;
      },
      getRequired: (key: string) => {
        const value = process.env[key];
        if (!value) {
          throw new Error(`Required configuration key '${key}' is missing`);
        }
        return value;
      },
      getInt: (key: string, defaultValue?: number) => {
        const value = process.env[key];
        return value ? parseInt(value, 10) : defaultValue;
      },
      getBoolean: (key: string, defaultValue?: boolean) => {
        const value = process.env[key];
        if (value === undefined) return defaultValue;
        return value.toLowerCase() === 'true';
      },
    };
  });

  // SecretsService — AWS Secrets Manager with env fallback
  registry.registerSingletonFactory(TYPES.SecretsService, () => {
    const secretsService = new SecretsService({
      environment: (process.env.NODE_ENV as any) || 'development',
      useAwsSecrets: process.env.USE_AWS_SECRETS === 'true',
      awsRegion: process.env.AWS_REGION || 'us-east-1',
    });
    return secretsService;
  });

  // Database (Supabase client - placeholder)
  registry.registerSingletonFactory(TYPES.Database, (_container) => {
    // Return mock database for now
    return {
      query: async (_sql: string, _params: any[]) => ({ rows: [], rowCount: 0 }),
      transaction: async (callback: any) => callback(),
    };
  });

  // Redis (ioredis client) - shared singleton from lib/redis
  registry.registerSingletonFactory(TYPES.Redis, () => getRedisClient());

  // Elasticsearch client (placeholder)
  registry.registerSingletonFactory(TYPES.ElasticsearchService, (_container) => {
    // Return mock for now
    return {
      search: async () => ({ hits: { hits: [] } }),
      index: async () => ({ result: 'created' }),
    };
  });

  // Lightning Service (placeholder)
  registry.registerSingletonFactory(TYPES.LightningService, (_container) => {
    // Return mock for now
    return {
      createInvoice: async () => ({ payment_request: 'lnbc...' }),
      checkInvoice: async () => ({ settled: false }),
    };
  });

  // NOSTR Service (placeholder)
  registry.registerSingletonFactory(TYPES.NostrService, (_container) => {
    // Return mock for now
    return {
      publishEvent: async () => ({ success: true }),
      subscribeToEvents: async () => {},
    };
  });

  // Validation Service (placeholder)
  registry.registerTransient(TYPES.ValidationService, () => {
    return {
      validate: (_schema: any, _data: any) => ({ valid: true, errors: [] }),
    };
  });

  // Repositories (placeholders)
  registry.registerSingletonFactory(TYPES.ContentRepository, (_container) => {
    return {
      findById: async (_id: string) => null,
      save: async (entity: any) => entity,
    };
  });

  registry.registerSingletonFactory(TYPES.UserRepository, (_container) => {
    return {
      findById: async (_id: string) => null,
      save: async (entity: any) => entity,
    };
  });

  registry.registerSingletonFactory(TYPES.PaymentRepository, (_container) => {
    return {
      findById: async (_id: string) => null,
      save: async (entity: any) => entity,
    };
  });

  registry.registerSingletonFactory(TYPES.SubscriptionRepository, (_container) => {
    return {
      findById: async (_id: string) => null,
      save: async (entity: any) => entity,
    };
  });

  registry.registerSingletonFactory(TYPES.UserPreferencesRepository, (_container) => {
    return {
      findByUserId: async (_userId: string) => null,
      save: async (entity: any) => entity,
    };
  });
}

/**
 * Perform health checks on critical services
 */
async function performHealthChecks(container: IServiceContainer): Promise<Map<string, boolean>> {
  const results = new Map<string, boolean>();

  const healthChecks = [
    {
      name: 'EventBusService',
      check: async () => {
        try {
          const eventBus = container.resolve(TYPES.EventBusService);
          return eventBus.isHealthy ? await eventBus.isHealthy() : true;
        } catch {
          return false;
        }
      },
    },
    {
      name: 'CacheService',
      check: async () => {
        try {
          const cache = container.resolve(TYPES.CacheService);
          return cache.healthCheck ? await cache.healthCheck() : true;
        } catch {
          return false;
        }
      },
    },
    {
      name: 'Database',
      check: async () => {
        try {
          container.resolve(TYPES.Database);
          return true; // Placeholder
        } catch {
          return false;
        }
      },
    },
    {
      name: 'SecretsService',
      check: async () => {
        try {
          const secrets = container.resolve(TYPES.SecretsService) as SecretsService;
          await secrets.initialize();
          return true;
        } catch {
          return false;
        }
      },
    },
  ];

  for (const { name, check } of healthChecks) {
    try {
      const healthy = await check();
      results.set(name, healthy);
    } catch (error) {
      results.set(name, false);
    }
  }

  return results;
}

/**
 * Setup graceful shutdown handlers
 */
function setupGracefulShutdown(container: IServiceContainer): void {
  const shutdownHandler = async (signal: string) => {
    logger.info('Graceful shutdown starting', { signal });

    try {
      await container.dispose();
      logger.info('All services disposed successfully');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', { error });
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdownHandler('SIGTERM'));
  process.on('SIGINT', () => shutdownHandler('SIGINT'));
}

/**
 * Get dependency graph visualization
 */
export function getDependencyGraph(registry: ServiceRegistry): string {
  const graph = registry.getDependencyGraph();

  let mermaid = 'graph TD\n';

  for (const node of graph.nodes) {
    const shape =
      node.lifetime === 'singleton'
        ? '[[' + node.token + ']]'
        : node.lifetime === 'scoped'
          ? '[' + node.token + ']'
          : '(' + node.token + ')';
    mermaid += `  ${node.id}${shape}\n`;
  }

  for (const edge of graph.edges) {
    const style = edge.optional ? '-..->' : '-->';
    mermaid += `  ${edge.from} ${style} ${edge.to}\n`;
  }

  return mermaid;
}
