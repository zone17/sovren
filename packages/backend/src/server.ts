// Side-effect import: loads .env BEFORE any other module is evaluated.
// Module-level singletons (e.g. NostrAuthService) read process.env at import time,
// so dotenv must run first.
import 'dotenv/config';

import { AppConfig, createApp, mountBullBoard } from './app';
import { lightningService } from './services/lightning-service';
import { lightningReceiptService } from './services/lightning/receipt-service';
import { connectRedis, disconnectRedis } from './lib/redis';
import { initializeContainer, container } from './container';
import { TYPES } from './container/types';
import type { QueueService } from './services/queue/QueueService';
import logger from './lib/logger';
import { Sentry } from './lib/sentry';

/**
 * 🚀 Sovren API Server
 *
 * Production-ready server with:
 * - **Graceful Shutdown**: Handles SIGTERM/SIGINT properly
 * - **Error Recovery**: Process error handling and logging
 * - **Health Monitoring**: Startup validation and health checks
 * - **Performance**: Optimized for high concurrency
 *
 * WHY: Following Node.js best practices for production deployment
 * Ensures the server can handle load balancer health checks,
 * container orchestration signals, and unexpected errors gracefully.
 */

// Process listener limit: set above known listener count (~15)
// to detect genuine leaks without false positives during normal operation.
process.setMaxListeners(25);

// 📊 Application State
let server: any = null;
let isShuttingDown = false;

/**
 * Validate environment variables at startup and log actionable warnings.
 * Catches the most common .env misconfigurations before they surface as
 * cryptic runtime errors.
 */
function validateStartupEnvironment(): void {
  const jwtSecret = process.env.JWT_SECRET;
  if (jwtSecret) {
    if (jwtSecret.includes('<') || jwtSecret.includes('>')) {
      logger.error(
        'JWT_SECRET appears malformed (contains angle brackets). ' +
          'This looks like an unedited placeholder. ' +
          'Fix: openssl rand -base64 48 and set the result in packages/backend/.env'
      );
    }
    const UUID_RE = /^<?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}>?$/i;
    if (UUID_RE.test(jwtSecret)) {
      logger.error(
        'JWT_SECRET is a UUID, which has insufficient entropy for signing tokens. ' +
          'Fix: openssl rand -base64 48 and set the result in packages/backend/.env'
      );
    }
  }

  // Detect SUPABASE_SERVICE_KEY vs SUPABASE_SERVICE_ROLE_KEY mismatch.
  // The codebase uses SUPABASE_SERVICE_ROLE_KEY (Supabase standard).
  // If only the old name is set, warn the developer.
  if (process.env.SUPABASE_SERVICE_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    logger.warn(
      'SUPABASE_SERVICE_KEY is set but SUPABASE_SERVICE_ROLE_KEY is not. ' +
        'The codebase reads SUPABASE_SERVICE_ROLE_KEY (Supabase standard). ' +
        'Rename the variable in packages/backend/.env.'
    );
  }

  // Warn if critical DB env vars are missing
  if (!process.env.SUPABASE_URL) {
    logger.warn('SUPABASE_URL is not set — database features will not work');
  }
}

/**
 * Start Server
 * WHY: Centralized startup logic with validation and error handling
 */
async function startServer(): Promise<void> {
  try {
    logger.info('Starting Sovren API Server');

    // TODO(SOV-INFRA-001): Wire SecretsService.loadAll() at startup to replace .env-based secrets with AWS Secrets Manager
    // Validate environment configuration
    if (AppConfig.isProduction && !process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET environment variable is required in production');
    }

    // Startup validation: detect common .env misconfigurations early
    validateStartupEnvironment();

    // Connect Redis eagerly (fail-fast if unavailable)
    try {
      await connectRedis();
    } catch (err) {
      logger.warn('Redis connection failed — continuing without Redis', {
        error: (err as Error).message,
      });
    }

    // Initialize DI container before routes are registered
    try {
      await initializeContainer();
    } catch (err) {
      logger.warn('DI container initialization failed — continuing without DI', {
        error: (err as Error).message,
      });
    }

    // Initialize Lightning Network Service
    await initializeLightningService();

    // Initialize Lightning Receipt Service
    await initializeReceiptService();

    // Create Express application
    const app = createApp();

    // Mount Bull Board admin UI if QueueService is available in the DI container.
    // Guard: container proxy returns undefined for resolveOptional when DI init failed.
    const queueService =
      typeof container.resolveOptional === 'function'
        ? (container.resolveOptional(TYPES.QueueService) as QueueService | null)
        : null;
    if (queueService) {
      mountBullBoard(app, queueService);
    }

    // Start HTTP server
    server = app.listen(AppConfig.port, AppConfig.host, () => {
      logger.info('Sovren API Server running', {
        url: `http://${AppConfig.host}:${AppConfig.port}`,
        environment: process.env.NODE_ENV || 'development',
        mode: AppConfig.isProduction ? 'production' : 'development',
      });
    });

    // Configure server settings
    server.setTimeout(AppConfig.responseTimeout);
    server.keepAliveTimeout = AppConfig.keepAliveTimeout;
    server.headersTimeout = AppConfig.keepAliveTimeout + 1000;

    // Handle server errors
    server.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        logger.error('Port already in use', { port: AppConfig.port });
        process.exit(1);
      } else {
        logger.error('Server error', { error });
        throw error;
      }
    });

    server.on('clientError', (error: any, socket: any) => {
      logger.warn('Client connection error', { error: error.message });
      socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
    });
  } catch (error) {
    logger.error('Failed to start server', {
      error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
    });
    process.exit(1);
  }
}

/**
 * ⚡ Initialize Lightning Network Service
 * WHY: Setup Bitcoin Lightning integration for creator monetization
 */
async function initializeLightningService(): Promise<void> {
  try {
    // Check if Lightning Network configuration is provided
    const lnbitsUrl = process.env.LNBITS_URL;
    const lnbitsApiKey = process.env.LNBITS_API_KEY;
    const lnbitsWalletId = process.env.LNBITS_WALLET_ID;
    const webhookSecret = process.env.LIGHTNING_WEBHOOK_SECRET;

    if (!lnbitsUrl || !lnbitsApiKey || !lnbitsWalletId || !webhookSecret) {
      logger.warn('Lightning Network configuration incomplete - skipping initialization', {
        hint: 'Set LNBITS_URL, LNBITS_API_KEY, LNBITS_WALLET_ID, LIGHTNING_WEBHOOK_SECRET',
      });
      return;
    }

    logger.info('Initializing Lightning Network service');

    // Initialize Lightning service with configuration
    await lightningService.initialize({
      lnbitsUrl,
      lnbitsApiKey,
      lnbitsWalletId,
      webhookSecret,
      defaultMemo: 'Sovren Creator Support',
      invoiceExpiryMinutes: 60,
      maxInvoiceAmount: 1000000, // 1M satoshis
      minInvoiceAmount: 1, // 1 satoshi
      enableWebhooks: process.env.ENABLE_LIGHTNING_WEBHOOKS !== 'false',
      enableLnurlPay: process.env.ENABLE_LNURL_PAY !== 'false',
      enableLightningAddress: process.env.ENABLE_LIGHTNING_ADDRESSES !== 'false',
      retryAttempts: 3,
      requestTimeout: 30000,
    });

    // Set up real-time payment event handlers
    setupLightningEventHandlers();

    logger.info('Lightning Network service initialized', {
      status: (await lightningService.healthCheck()).status,
      lnbitsUrl,
      walletId: lnbitsWalletId,
      webhooks: process.env.ENABLE_LIGHTNING_WEBHOOKS !== 'false',
      lnurlPay: process.env.ENABLE_LNURL_PAY !== 'false',
      lightningAddresses: process.env.ENABLE_LIGHTNING_ADDRESSES !== 'false',
    });
  } catch (error) {
    logger.error('Failed to initialize Lightning Network service', { error });
    logger.warn('Server will continue without Lightning Network functionality');
  }
}

/**
 * 🧾 Initialize Lightning Receipt Service
 * WHY: Setup receipt generation and management for Lightning payments
 */
async function initializeReceiptService(): Promise<void> {
  try {
    logger.info('Initializing Lightning Receipt service');

    // Check if receipt service configuration is provided
    const receiptFromEmail = process.env.RECEIPT_FROM_EMAIL;
    const smtpHost = process.env.SMTP_HOST;
    const receiptSignatureSecret = process.env.RECEIPT_SIGNATURE_SECRET;

    if (!receiptFromEmail || !smtpHost || !receiptSignatureSecret) {
      logger.warn('Receipt service configuration incomplete - using defaults', {
        hint: 'Set RECEIPT_FROM_EMAIL, SMTP_HOST, RECEIPT_SIGNATURE_SECRET',
      });
    }

    // Initialize receipt service event handlers
    setupReceiptEventHandlers();

    logger.info('Lightning Receipt service initialized');
  } catch (error) {
    logger.error('Failed to initialize Lightning Receipt service', { error });
    logger.warn('Server will continue without receipt functionality');
  }
}

/**
 * 🧾 Setup Receipt Service Event Handlers
 * WHY: Real-time receipt processing and notifications
 */
function setupReceiptEventHandlers(): void {
  lightningReceiptService.on('receipt:generated', receipt => {
    logger.info('Payment receipt generated', { receiptNumber: receipt.receiptNumber });
  });

  lightningReceiptService.on('receipt:email:sent', data => {
    logger.info('Receipt emailed', { email: data.email });
  });

  lightningReceiptService.on('error', error => {
    logger.error('Receipt service error', { error: error.message });
  });
}

/**
 * 🔔 Setup Lightning Network Event Handlers
 * WHY: Real-time payment processing and notifications
 */
function setupLightningEventHandlers(): void {
  lightningService.on('payment:completed', async payment => {
    logger.info('Lightning payment completed', {
      amount: payment.amount,
      creatorId: payment.creator_id,
    });

    try {
      const receipt = await lightningReceiptService.generateReceipt({
        paymentId: payment.id,
        includeDetailedVerification: true,
        emailReceipt: false,
      });
      logger.info('Receipt generated', { receiptNumber: receipt.receiptNumber });
    } catch (error) {
      logger.error('Failed to generate receipt', { error });
    }
  });

  lightningService.on('invoice:expired', invoice => {
    logger.info('Lightning invoice expired', { invoiceId: invoice.id });
  });

  lightningService.on('invoice:created', invoice => {
    logger.info('Lightning invoice created', {
      amount: invoice.amount,
      description: invoice.description,
    });
  });

  lightningService.on('webhook:received', data => {
    logger.info('Lightning webhook received', { type: data.type });
  });

  lightningService.on('error', error => {
    logger.error('Lightning service error', { error: error.message });
  });
}

/**
 * 🛑 Graceful Shutdown
 * WHY: Properly close connections and cleanup resources
 * Prevents data corruption and ensures clean container shutdown
 */
async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    logger.info('Shutdown already in progress');
    return;
  }

  isShuttingDown = true;
  logger.info('Graceful shutdown starting', { signal });

  const shutdownTimeout = setTimeout(() => {
    logger.error('Forced shutdown due to timeout');
    process.exit(1);
  }, 10000);

  try {
    if (server) {
      logger.info('Closing HTTP server');

      await new Promise<void>((resolve, reject) => {
        server.close((error: any) => {
          if (error) {
            logger.error('Error closing server', { error });
            reject(error);
          } else {
            logger.info('HTTP server closed');
            resolve();
          }
        });
      });
    }

    // Close BullMQ queues and workers via the DI-managed instance
    const qs =
      typeof container.resolveOptional === 'function'
        ? container.resolveOptional(TYPES.QueueService)
        : null;
    if (qs) {
      try {
        await qs.closeAll();
        logger.info('BullMQ queues and workers closed');
      } catch (err) {
        logger.warn('BullMQ shutdown failed', { error: (err as Error).message });
      }
    }

    // Dispose DI container (cleanup all registered services)
    try {
      if (typeof container.dispose === 'function') await container.dispose();
      logger.info('DI container disposed');
    } catch (err) {
      logger.warn('DI container disposal failed', { error: (err as Error).message });
    }

    // Disconnect Redis gracefully
    await disconnectRedis();

    clearTimeout(shutdownTimeout);
    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    clearTimeout(shutdownTimeout);
    logger.error('Error during shutdown', { error });
    process.exit(1);
  }
}

/**
 * 🔥 Error Handlers
 * WHY: Prevent the process from crashing and log critical errors
 */
process.on('uncaughtException', async (error: Error) => {
  logger.error('Uncaught exception — process will exit', {
    error: error.message,
    stack: error.stack,
  });
  Sentry.captureException(error);
  await Sentry.flush(2000);
  process.exit(1);
});

process.on('unhandledRejection', async (reason: any) => {
  logger.error('Unhandled promise rejection', { reason });
  Sentry.captureException(reason instanceof Error ? reason : new Error(String(reason)));

  if (AppConfig.isProduction) {
    logger.error('Exiting due to unhandled rejection in production');
    await Sentry.flush(2000);
    process.exit(1);
  }
});

/**
 * 📡 Signal Handlers
 * WHY: Handle container orchestration and process management signals
 */
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle Windows-specific signals
if (process.platform === 'win32') {
  process.on('SIGBREAK', () => gracefulShutdown('SIGBREAK'));
}

/**
 * 🎬 Start the Application
 * WHY: Entry point for the server process
 */
if (require.main === module) {
  startServer().catch(error => {
    logger.error('Failed to start application', { error });
    process.exit(1);
  });
}

// Export for testing and health endpoint shutdown check
export { gracefulShutdown, startServer, isShuttingDown };
