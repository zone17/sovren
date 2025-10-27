/**
 * Graceful Shutdown Handler
 * Manages clean disposal of all services and resources
 * User Story: US-E5-032 - Wire Services Through DI Container
 * Part of Epic 005 - Backend Service Refactoring - Phase 6
 */

import type { IServiceContainer } from './interfaces/shared/IServiceRegistry';
import { TYPES } from './container/types';

/**
 * Shutdown configuration
 */
export interface ShutdownConfig {
  timeout: number; // Maximum time to wait for shutdown (ms)
  forceExit: boolean; // Force exit if timeout is exceeded
  logProgress: boolean; // Log shutdown progress
}

/**
 * Shutdown result
 */
export interface ShutdownResult {
  success: boolean;
  duration: number;
  servicesDisposed: string[];
  errors: Array<{ service: string; error: Error }>;
}

/**
 * Default shutdown configuration
 */
const DEFAULT_SHUTDOWN_CONFIG: ShutdownConfig = {
  timeout: 30000, // 30 seconds
  forceExit: true,
  logProgress: true,
};

/**
 * Graceful shutdown handler
 * Disposes all services in the correct order
 */
export async function gracefulShutdown(
  container: IServiceContainer,
  config: Partial<ShutdownConfig> = {}
): Promise<ShutdownResult> {
  const fullConfig = { ...DEFAULT_SHUTDOWN_CONFIG, ...config };
  const startTime = Date.now();
  const servicesDisposed: string[] = [];
  const errors: Array<{ service: string; error: Error }> = [];

  if (fullConfig.logProgress) {
    console.log('\n📴 Initiating graceful shutdown...');
  }

  // Create timeout promise
  const timeoutPromise = new Promise<void>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Shutdown timeout exceeded (${fullConfig.timeout}ms)`));
    }, fullConfig.timeout);
  });

  // Create shutdown promise
  const shutdownPromise = performShutdown(
    container,
    servicesDisposed,
    errors,
    fullConfig.logProgress
  );

  try {
    // Race between shutdown and timeout
    await Promise.race([shutdownPromise, timeoutPromise]);

    const duration = Date.now() - startTime;

    if (fullConfig.logProgress) {
      console.log(`\n✅ Graceful shutdown complete (${duration}ms)`);
      console.log(`   Services disposed: ${servicesDisposed.length}`);
      if (errors.length > 0) {
        console.log(`   ⚠️  Errors encountered: ${errors.length}`);
      }
    }

    return {
      success: errors.length === 0,
      duration,
      servicesDisposed,
      errors,
    };
  } catch (error) {
    const duration = Date.now() - startTime;

    if (fullConfig.logProgress) {
      console.error(`\n❌ Shutdown timeout or error (${duration}ms)`);
      console.error(`   Error: ${error instanceof Error ? error.message : String(error)}`);
    }

    if (fullConfig.forceExit) {
      if (fullConfig.logProgress) {
        console.log('   Forcing exit...');
      }
      process.exit(1);
    }

    return {
      success: false,
      duration,
      servicesDisposed,
      errors: [...errors, { service: 'shutdown', error: error as Error }],
    };
  }
}

/**
 * Perform the actual shutdown sequence
 */
async function performShutdown(
  container: IServiceContainer,
  servicesDisposed: string[],
  errors: Array<{ service: string; error: Error }>,
  logProgress: boolean
): Promise<void> {
  // Define shutdown order (reverse of initialization)
  const shutdownOrder = [
    // Business Services (dispose first)
    { name: 'PaymentServices', services: [
      'PaymentProcessingService',
      'SubscriptionService',
      'RefundService',
      'PaymentAnalyticsService',
      'WebhookService',
      'InvoiceService',
      'CurrencyService',
    ]},
    { name: 'UserServices', services: [
      'UserProfileService',
      'UserPreferencesService',
      'UserActivityService',
      'UserRelationshipService',
      'UserAnalyticsService',
    ]},
    { name: 'ContentServices', services: [
      'ContentPublishingService',
      'ContentModerationService',
      'ContentSearchService',
      'ContentRecommendationService',
      'ContentAnalyticsService',
      'ContentVersioningService',
      'ContentCreationService',
    ]},
    { name: 'SharedServices', services: [
      'NotificationService',
      'EmailService',
      'AuditLogService',
    ]},
    // Infrastructure Services (dispose last)
    { name: 'Infrastructure', services: [
      'CacheService',
      'EventBusService',
      'Redis',
      'Database',
      'ElasticsearchService',
      'LightningService',
      'NostrService',
    ]},
  ];

  // Dispose services in order
  for (const group of shutdownOrder) {
    if (logProgress) {
      console.log(`   Disposing ${group.name}...`);
    }

    for (const serviceName of group.services) {
      try {
        const token = (TYPES as any)[serviceName];
        if (!token) continue;

        const service = container.resolveOptional(token);
        if (service && typeof service.dispose === 'function') {
          await service.dispose();
          servicesDisposed.push(serviceName);
        }
      } catch (error) {
        errors.push({
          service: serviceName,
          error: error instanceof Error ? error : new Error(String(error)),
        });

        if (logProgress) {
          console.error(`      ⚠️  Error disposing ${serviceName}:`, error);
        }
      }
    }
  }

  // Finally dispose the container itself
  try {
    await container.dispose();
    servicesDisposed.push('ServiceContainer');
  } catch (error) {
    errors.push({
      service: 'ServiceContainer',
      error: error instanceof Error ? error : new Error(String(error)),
    });
  }
}

/**
 * Setup shutdown handlers for process signals
 */
export function setupShutdownHandlers(
  container: IServiceContainer,
  config: Partial<ShutdownConfig> = {}
): void {
  let shuttingDown = false;

  const handleShutdown = async (signal: string) => {
    if (shuttingDown) {
      console.log('   Already shutting down...');
      return;
    }

    shuttingDown = true;
    console.log(`\n📴 Received ${signal}`);

    const result = await gracefulShutdown(container, config);

    if (result.success) {
      process.exit(0);
    } else {
      console.error('   Shutdown completed with errors');
      process.exit(1);
    }
  };

  // Handle termination signals
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));

  // Handle uncaught errors
  process.on('uncaughtException', async (error) => {
    console.error('❌ Uncaught Exception:', error);
    await handleShutdown('UNCAUGHT_EXCEPTION');
  });

  process.on('unhandledRejection', async (reason, promise) => {
    console.error('❌ Unhandled Promise Rejection:', reason);
    await handleShutdown('UNHANDLED_REJECTION');
  });
}

/**
 * Health check before shutdown
 * Checks if critical operations are complete
 */
export async function preShutdownHealthCheck(
  container: IServiceContainer
): Promise<{ canShutdown: boolean; blockers: string[] }> {
  const blockers: string[] = [];

  try {
    // Check EventBus for pending events
    const eventBus = container.resolveOptional(TYPES.EventBusService);
    if (eventBus && eventBus.getActiveSubscriptions) {
      const subscriptions = eventBus.getActiveSubscriptions();
      if (subscriptions.length > 0) {
        blockers.push(`EventBus has ${subscriptions.length} active subscriptions`);
      }
    }

    // Check for in-flight payments
    const paymentService = container.resolveOptional(TYPES.PaymentProcessingService);
    if (paymentService && paymentService.getPendingPayments) {
      const pending = await paymentService.getPendingPayments();
      if (pending && pending.length > 0) {
        blockers.push(`PaymentService has ${pending.length} pending payments`);
      }
    }

    return {
      canShutdown: blockers.length === 0,
      blockers,
    };
  } catch (error) {
    console.error('Error during pre-shutdown health check:', error);
    return {
      canShutdown: false,
      blockers: ['Health check failed'],
    };
  }
}

/**
 * Emergency shutdown (immediate, no cleanup)
 */
export function emergencyShutdown(reason: string, exitCode = 1): never {
  console.error(`\n🚨 EMERGENCY SHUTDOWN: ${reason}`);
  console.error('   Exiting immediately without cleanup');
  process.exit(exitCode);
}
