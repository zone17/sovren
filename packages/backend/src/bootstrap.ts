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
    console.log('🚀 Bootstrapping Sovren Backend Services...');
    console.log(`   Environment: ${fullConfig.environment}`);
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
    console.log(`✅ Service registration complete (${registrationTime.toFixed(2)}ms)`);
    console.log(`   Services registered: ${registry.getRegisteredTokens().length}`);
  }

  // ======================
  // PHASE 2: Validate Dependencies
  // ======================
  const validationStart = performance.now();

  if (fullConfig.validateDependencies) {
    const validation = registry.validate();

    if (!validation.valid) {
      console.error('❌ Container validation failed:');
      validation.errors.forEach(error => {
        console.error(`   - ${error.message}`);
        errors.push(new Error(error.message));
      });

      if (validation.errors.some(e => e.type === 'circular_dependency')) {
        throw new Error('Circular dependencies detected. Cannot start application.');
      }
    }

    if (validation.warnings.length > 0 && fullConfig.logStartup) {
      console.warn('⚠️  Container warnings:');
      validation.warnings.forEach(warning => {
        console.warn(`   - ${warning.message}`);
      });
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
    console.log(`✅ Container initialized (${initTime.toFixed(2)}ms)`);
  }

  // ======================
  // PHASE 4: Health Checks
  // ======================
  let healthCheckResults: Map<string, boolean> | undefined;

  if (fullConfig.enableHealthChecks) {
    healthCheckResults = await performHealthChecks(container);

    if (fullConfig.logStartup) {
      console.log('🏥 Health Check Results:');
      for (const [service, healthy] of healthCheckResults) {
        const status = healthy ? '✅' : '❌';
        console.log(`   ${status} ${service}`);
      }
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
    console.log(`\n✨ Bootstrap complete (${totalTime.toFixed(2)}ms)`);
    console.log('   Ready to serve requests\n');
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
  // Logger (Winston) - structured JSON output for Promtail/Loki ingestion
  registry.registerSingletonFactory(TYPES.Logger, () => {
    const winston = require('winston');
    const isProduction = process.env.NODE_ENV === 'production';

    return winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      defaultMeta: { service: 'sovren-api' },
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console({
          format: isProduction
            ? winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
              )
            : winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
              ),
        }),
      ],
    });
  });

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

  // Database (Supabase client - placeholder)
  registry.registerSingletonFactory(TYPES.Database, (container) => {
    const config = container.resolve(TYPES.Config);
    // Return mock database for now
    return {
      query: async (sql: string, params: any[]) => ({ rows: [], rowCount: 0 }),
      transaction: async (callback: any) => callback(),
    };
  });

  // Redis (ioredis client)
  registry.registerSingletonFactory(TYPES.Redis, (container) => {
    const config = container.resolve(TYPES.Config);
    const Redis = require('ioredis');

    return new Redis({
      host: config.get('REDIS_HOST', 'localhost'),
      port: config.getInt('REDIS_PORT', 6379),
      password: config.get('REDIS_PASSWORD'),
      db: config.getInt('REDIS_DB', 0),
      retryStrategy: (times: number) => {
        return Math.min(times * 50, 2000);
      },
    });
  });

  // Elasticsearch client (placeholder)
  registry.registerSingletonFactory(TYPES.ElasticsearchService, (container) => {
    const config = container.resolve(TYPES.Config);
    // Return mock for now
    return {
      search: async () => ({ hits: { hits: [] } }),
      index: async () => ({ result: 'created' }),
    };
  });

  // Lightning Service (placeholder)
  registry.registerSingletonFactory(TYPES.LightningService, (container) => {
    const logger = container.resolve(TYPES.Logger);
    // Return mock for now
    return {
      createInvoice: async () => ({ payment_request: 'lnbc...' }),
      checkInvoice: async () => ({ settled: false }),
    };
  });

  // NOSTR Service (placeholder)
  registry.registerSingletonFactory(TYPES.NostrService, (container) => {
    const logger = container.resolve(TYPES.Logger);
    // Return mock for now
    return {
      publishEvent: async () => ({ success: true }),
      subscribeToEvents: async () => {},
    };
  });

  // Validation Service (placeholder)
  registry.registerTransient(TYPES.ValidationService, () => {
    return {
      validate: (schema: any, data: any) => ({ valid: true, errors: [] }),
    };
  });

  // Repositories (placeholders)
  registry.registerSingletonFactory(TYPES.ContentRepository, (container) => {
    const db = container.resolve(TYPES.Database);
    return {
      findById: async (id: string) => null,
      save: async (entity: any) => entity,
    };
  });

  registry.registerSingletonFactory(TYPES.UserRepository, (container) => {
    const db = container.resolve(TYPES.Database);
    return {
      findById: async (id: string) => null,
      save: async (entity: any) => entity,
    };
  });

  registry.registerSingletonFactory(TYPES.PaymentRepository, (container) => {
    const db = container.resolve(TYPES.Database);
    return {
      findById: async (id: string) => null,
      save: async (entity: any) => entity,
    };
  });

  registry.registerSingletonFactory(TYPES.SubscriptionRepository, (container) => {
    const db = container.resolve(TYPES.Database);
    return {
      findById: async (id: string) => null,
      save: async (entity: any) => entity,
    };
  });

  registry.registerSingletonFactory(TYPES.UserPreferencesRepository, (container) => {
    const db = container.resolve(TYPES.Database);
    return {
      findByUserId: async (userId: string) => null,
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
          const db = container.resolve(TYPES.Database);
          return true; // Placeholder
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
    console.log(`\n📴 Received ${signal}. Starting graceful shutdown...`);

    try {
      await container.dispose();
      console.log('✅ All services disposed successfully');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
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
    const shape = node.lifetime === 'singleton' ? '[[' + node.token + ']]' :
                  node.lifetime === 'scoped' ? '[' + node.token + ']' :
                  '(' + node.token + ')';
    mermaid += `  ${node.id}${shape}\n`;
  }

  for (const edge of graph.edges) {
    const style = edge.optional ? '-..->' : '-->';
    mermaid += `  ${edge.from} ${style} ${edge.to}\n`;
  }

  return mermaid;
}
