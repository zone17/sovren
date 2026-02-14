import dotenv from 'dotenv';
import { AppConfig, createApp } from './app';
import { lightningService } from './services/lightning-service';

// Load environment variables
dotenv.config();

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
 * 🏁 Start Server
 * WHY: Centralized startup logic with validation and error handling
 */
async function startServer(): Promise<void> {
  try {
    console.log('🚀 Starting Sovren API Server...');

    // Validate environment configuration
    if (AppConfig.isProduction && !process.env.JWT_SECRET) {
      throw new Error('❌ JWT_SECRET environment variable is required in production');
    }

    // 🌩️ Initialize Lightning Network Service
    await initializeLightningService();

    // 🧾 Initialize Lightning Receipt Service
    await initializeReceiptService();

    // Create Express application
    const app = createApp();

    // Start HTTP server
    server = app.listen(AppConfig.port, AppConfig.host, () => {
      console.log(`✅ Sovren API Server running successfully`);
      console.log(`📍 Server URL: http://${AppConfig.host}:${AppConfig.port}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔒 Security: ${AppConfig.isProduction ? 'Production' : 'Development'} mode`);
      console.log(`⚡ Features: NOSTR authentication, Lightning payments, rate limiting`);
      console.log(`📊 Health Check: http://${AppConfig.host}:${AppConfig.port}/health`);
      console.log(`📚 API Documentation: http://${AppConfig.host}:${AppConfig.port}/api`);
    });

    // Configure server settings
    server.keepAliveTimeout = AppConfig.keepAliveTimeout;
    server.headersTimeout = AppConfig.keepAliveTimeout + 1000;

    // Handle server errors
    server.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${AppConfig.port} is already in use`);
        console.error('💡 Try a different port or stop the existing server');
        process.exit(1);
      } else {
        console.error('❌ Server error:', error);
        throw error;
      }
    });

    server.on('clientError', (error: any, socket: any) => {
      console.warn('⚠️ Client connection error:', error.message);
      socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
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
      console.warn('⚠️ Lightning Network configuration incomplete - skipping initialization');
      console.warn(
        '💡 To enable Lightning payments, set: LNBITS_URL, LNBITS_API_KEY, LNBITS_WALLET_ID, LIGHTNING_WEBHOOK_SECRET'
      );
      return;
    }

    console.log('⚡ Initializing Lightning Network service...');

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

    console.log('✅ Lightning Network service initialized successfully');

    // Log configuration summary
    const healthCheck = await lightningService.healthCheck();
    console.log(`📊 Lightning Status: ${healthCheck.status}`);
    console.log(`🔗 LNbits URL: ${lnbitsUrl}`);
    console.log(`💳 Wallet ID: ${lnbitsWalletId}`);
    console.log(
      `🔔 Webhooks: ${process.env.ENABLE_LIGHTNING_WEBHOOKS !== 'false' ? 'Enabled' : 'Disabled'}`
    );
    console.log(
      `🔗 LNURL-pay: ${process.env.ENABLE_LNURL_PAY !== 'false' ? 'Enabled' : 'Disabled'}`
    );
    console.log(
      `📧 Lightning Addresses: ${process.env.ENABLE_LIGHTNING_ADDRESSES !== 'false' ? 'Enabled' : 'Disabled'}`
    );
  } catch (error) {
    console.error('❌ Failed to initialize Lightning Network service:', error);
    console.warn('⚠️ Server will continue without Lightning Network functionality');
    console.warn('💡 Check your LNbits configuration and network connectivity');
  }
}

/**
 * 🧾 Initialize Lightning Receipt Service
 * WHY: Setup receipt generation and management for Lightning payments
 */
async function initializeReceiptService(): Promise<void> {
  try {
    console.log('🧾 Initializing Lightning Receipt service...');

    // Check if receipt service configuration is provided
    const receiptFromEmail = process.env.RECEIPT_FROM_EMAIL;
    const smtpHost = process.env.SMTP_HOST;
    const receiptSignatureSecret = process.env.RECEIPT_SIGNATURE_SECRET;

    if (!receiptFromEmail || !smtpHost || !receiptSignatureSecret) {
      console.warn('⚠️ Receipt service configuration incomplete - using defaults');
      console.warn(
        '💡 To enable email receipts, set: RECEIPT_FROM_EMAIL, SMTP_HOST, RECEIPT_SIGNATURE_SECRET'
      );
    }

    // Initialize receipt service event handlers
    setupReceiptEventHandlers();

    console.log('✅ Lightning Receipt service initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize Lightning Receipt service:', error);
    console.warn('⚠️ Server will continue without receipt functionality');
  }
}

/**
 * 🧾 Setup Receipt Service Event Handlers
 * WHY: Real-time receipt processing and notifications
 */
function setupReceiptEventHandlers(): void {
  // Handle receipt generation events
  lightningReceiptService.on('receipt:generated', (receipt) => {
    console.log(`🧾 Payment receipt generated: ${receipt.receiptNumber}`);
  });

  // Handle receipt email delivery
  lightningReceiptService.on('receipt:email:sent', (data) => {
    console.log(`📧 Receipt emailed to: ${data.email}`);
  });

  // Handle receipt errors
  lightningReceiptService.on('error', (error) => {
    console.error('❌ Receipt service error:', error.message);
  });
}

/**
 * 🔔 Setup Lightning Network Event Handlers
 * WHY: Real-time payment processing and notifications
 */
function setupLightningEventHandlers(): void {
  // Handle successful payments
  lightningService.on('payment:completed', async (payment) => {
    console.log(
      `🎉 Lightning payment completed: ${payment.amount} sats to creator ${payment.creator_id}`
    );

    // ✅ Generate payment receipt automatically
    try {
      const receipt = await lightningReceiptService.generateReceipt({
        paymentId: payment.id,
        includeDetailedVerification: true,
        emailReceipt: false, // Will be sent separately if email is provided
      });
      console.log(`🧾 Receipt generated: ${receipt.receiptNumber}`);
    } catch (error) {
      console.error('❌ Failed to generate receipt:', error);
    }

    // TODO: Add real-time notifications
    // TODO: Update creator balance
    // TODO: Trigger NOSTR event publication
    // TODO: Send email/push notifications
  });

  // Handle expired invoices
  lightningService.on('invoice:expired', (invoice) => {
    console.log(`⏰ Lightning invoice expired: ${invoice.id}`);

    // TODO: Clean up expired invoices
    // TODO: Notify user of expiration
  });

  // Handle invoice creation
  lightningService.on('invoice:created', (invoice) => {
    console.log(`⚡ Lightning invoice created: ${invoice.amount} sats for ${invoice.description}`);
  });

  // Handle webhook events
  lightningService.on('webhook:received', (data) => {
    console.log('🔔 Lightning webhook received:', data.type);
  });

  // Handle service errors
  lightningService.on('error', (error) => {
    console.error('❌ Lightning service error:', error.message);
  });
}

/**
 * 🛑 Graceful Shutdown
 * WHY: Properly close connections and cleanup resources
 * Prevents data corruption and ensures clean container shutdown
 */
async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    console.log('⏳ Shutdown already in progress...');
    return;
  }

  isShuttingDown = true;
  console.log(`\n🛑 Received ${signal}, starting graceful shutdown...`);

  const shutdownTimeout = setTimeout(() => {
    console.error('💥 Forced shutdown due to timeout');
    process.exit(1);
  }, 10000); // 10 second timeout

  try {
    // Stop accepting new connections
    if (server) {
      console.log('🔌 Closing HTTP server...');

      await new Promise<void>((resolve, reject) => {
        server.close((error: any) => {
          if (error) {
            console.error('❌ Error closing server:', error);
            reject(error);
          } else {
            console.log('✅ HTTP server closed successfully');
            resolve();
          }
        });
      });
    }

    // TODO: Close database connections when implemented
    // TODO: Finish processing existing requests
    // TODO: Clear any timers or intervals

    clearTimeout(shutdownTimeout);
    console.log('✅ Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    clearTimeout(shutdownTimeout);
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
}

/**
 * 🔥 Error Handlers
 * WHY: Prevent the process from crashing and log critical errors
 */
process.on('uncaughtException', (error: Error) => {
  console.error('💥 Uncaught Exception:', error);
  console.error('Stack:', error.stack);
  console.error('🚨 Process will exit to prevent undefined behavior');
  process.exit(1);
});

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  console.error('💥 Unhandled Promise Rejection:', reason);
  console.error('Promise:', promise);
  console.error('🚨 This should be handled properly in application code');

  // In production, we might want to exit the process
  if (AppConfig.isProduction) {
    console.error('🚨 Exiting due to unhandled rejection in production');
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
  startServer().catch((error) => {
    console.error('💥 Failed to start application:', error);
    process.exit(1);
  });
}

// Export for testing
export { gracefulShutdown, startServer };
