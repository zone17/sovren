/**
 * Idempotency System Integration Example
 *
 * Complete example demonstrating how to integrate the idempotency system
 * into an Express application for payment endpoints.
 *
 * @story PAY-010
 */

import express, { Express } from 'express';
import { Pool } from 'pg';
import { IdempotencyRepository } from './repositories/IdempotencyRepository';
import { IdempotencyMiddleware } from './middleware/idempotency';
import { IdempotencyCleanupService } from './services/IdempotencyCleanupService';
import { createPaymentRouter } from './routes/payment';

/**
 * Setup idempotency system for Express app
 */
export function setupIdempotencySystem(app: Express, dbPool: Pool): {
  middleware: IdempotencyMiddleware;
  cleanupService: IdempotencyCleanupService;
  repository: IdempotencyRepository;
} {
  // Initialize repository with database connection
  const repository = new IdempotencyRepository(dbPool);

  // Create middleware with configuration
  const middleware = new IdempotencyMiddleware(repository, {
    ttl_ms: 24 * 60 * 60 * 1000, // 24 hours
    header_name: 'Idempotency-Key',
    required: true,
    endpoints: ['/api/lightning', '/api/payments'],
    enable_cleanup: true,
    cleanup_interval_ms: 60 * 60 * 1000, // 1 hour
  });

  // Create cleanup service
  const cleanupService = new IdempotencyCleanupService(repository, {
    interval_ms: 60 * 60 * 1000, // 1 hour
    auto_start: true,
    enable_logging: true,
  });

  // Apply middleware to payment routes
  const paymentRouter = createPaymentRouter(dbPool);
  app.use(paymentRouter);

  // Add monitoring endpoint for idempotency system
  app.get('/api/idempotency/stats', async (req, res) => {
    try {
      const cleanupStats = cleanupService.getStats();
      const repoStats = await repository.getStats();

      res.json({
        success: true,
        cleanup: cleanupStats,
        cache: repoStats,
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to fetch idempotency stats',
      });
    }
  });

  // Manual cleanup trigger endpoint
  app.post('/api/idempotency/cleanup', async (req, res) => {
    try {
      const result = await cleanupService.runCleanup();
      res.json({
        success: true,
        stats: result.stats,
      });
    } catch (error) {
      res.status(500).json({
        error: 'Cleanup failed',
      });
    }
  });

  return { middleware, cleanupService, repository };
}

/**
 * Example: Complete Express application with idempotency
 */
export async function createIdempotentPaymentAPI(): Promise<Express> {
  const app = express();

  // Middleware
  app.use(express.json());

  // Database connection
  const dbPool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://localhost/sovren',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  // Test database connection
  try {
    await dbPool.query('SELECT NOW()');
    console.log('Database connected successfully');
  } catch (error) {
    console.error('Database connection failed:', error);
    throw error;
  }

  // Setup idempotency system
  const { middleware, cleanupService, repository } = setupIdempotencySystem(
    app,
    dbPool
  );

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
    });
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');

    cleanupService.stop();
    middleware.stopCleanup();

    dbPool.end(() => {
      console.log('Database pool closed');
      process.exit(0);
    });
  });

  return app;
}

/**
 * Example: Start server
 */
if (require.main === module) {
  const PORT = process.env.PORT || 3000;

  createIdempotentPaymentAPI()
    .then((app) => {
      app.listen(PORT, () => {
        console.log(`Payment API server running on port ${PORT}`);
        console.log(`Idempotency enabled for payment endpoints`);
        console.log(`Automatic cleanup every 1 hour`);
      });
    })
    .catch((error) => {
      console.error('Failed to start server:', error);
      process.exit(1);
    });
}

/**
 * Example: Client usage with idempotency
 */
export const clientExample = {
  // Generate UUID v4 idempotency key
  generateIdempotencyKey(): string {
    const crypto = require('crypto');
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (crypto.randomBytes(1)[0] & 0x0f) >> (c === 'x' ? 0 : 0);
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  },

  // Example: Create invoice with idempotency
  async createInvoice(amountSats: number): Promise<any> {
    const idempotencyKey = this.generateIdempotencyKey();

    const response = await fetch('http://localhost:3000/api/lightning/invoice', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        amount_sats: amountSats,
        memo: 'Test payment',
      }),
    });

    return response.json();
  },

  // Example: Retry with same idempotency key (will return cached response)
  async retryCreateInvoice(idempotencyKey: string, amountSats: number): Promise<any> {
    const response = await fetch('http://localhost:3000/api/lightning/invoice', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        amount_sats: amountSats,
        memo: 'Test payment',
      }),
    });

    const isCached = response.headers.get('X-Idempotency-Cached') === 'true';
    console.log('Response from cache:', isCached);

    return response.json();
  },
};
