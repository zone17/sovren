import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Express, NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import { z } from 'zod';

// Import our services and middleware
import authRouter from './routes/auth';
import lightningRoutes from './routes/lightning';
import lightningReceiptRoutes from './routes/lightning-receipts';
import userRouter from './routes/users';
import healthRouter from './routes/health';
import v1Routes from './routes/v1';
import v2Routes from './routes/v2';
import contentDiscoveryRoutes from './routes/content-discovery';
import subscriptionTiersRoutes from './routes/subscription-tiers';
import analyticsRoutes from './routes/analytics';
import { csrfProtection } from './middleware/csrf';
import { deploymentMonitoring, getPrometheusMetrics } from './middleware/deployment-monitoring';
import { correlationIdMiddleware, getCorrelationId } from './middleware/correlation-id';
import { createRateLimiter } from './middleware/rate-limit-middleware';
import { errorHandler, notFoundHandler } from './middleware/error-handler-middleware';
import { authenticate, authorize } from './middleware/auth';
import logger from './lib/logger';
import { initSentry } from './lib/sentry';
import type { QueueService } from './services/queue/QueueService';
import { createBullBoardRouter } from './routes/admin/bull-board';

/**
 * 🚀 Elite Express.js Application Factory
 *
 * Creates a production-ready Express application with:
 * - **Security-First**: Helmet, CORS, rate limiting, input validation
 * - **Performance**: Optimized middleware stack, response compression
 * - **Scalability**: Stateless design, middleware separation
 * - **Observability**: Structured logging, error tracking
 * - **Standards**: RESTful API design, consistent error handling
 *
 * @example
 * ```typescript
 * const app = createApp();
 * app.listen(3000, () => {
 *   console.log('🚀 Sovren API server running on port 3000');
 * });
 * ```
 */
export function createApp(): Express {
  // Initialize Sentry before Express (required for @sentry/node to hook into HTTP)
  initSentry();

  const app = express();

  // Correlation ID middleware (must be first - before all other middleware)
  app.use(correlationIdMiddleware);

  // Response compression — gzip/brotli for all API responses >1KB
  app.use(compression({ threshold: 1024 }));

  // 🔒 Security Middleware Stack
  // WHY: Defense in depth - multiple layers protect against common attacks
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'", 'wss:', 'https:'],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false, // Allow NOSTR relay connections
      frameguard: { action: 'deny' }, // Explicitly set X-Frame-Options to DENY
    })
  );

  // Add XSS protection manually since helmet v7 disabled it by default
  app.use((req, res, next) => {
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });

  //  CORS Configuration
  // WHY: Enable secure cross-origin requests for our frontend applications
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no Origin header (non-browser clients, agents, curl).
        // NOTE: JWT is now stored in HttpOnly cookies (sovren_token). The CSRF double-submit
        // pattern in csrf.ts protects state-changing requests from cross-origin attacks.
        // Originless requests are still allowed for API clients using Bearer token auth.
        if (!origin) return callback(null, true);

        const allowedOrigins =
          process.env.NODE_ENV === 'production'
            ? ['https://sovren.app', 'https://www.sovren.app']
            : ['http://localhost:3000', 'http://localhost:5173'];

        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      },
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
      exposedHeaders: [
        'X-CSRF-Token',
        'X-Correlation-ID',
        'RateLimit-Limit',
        'RateLimit-Remaining',
        'RateLimit-Reset',
        'RateLimit-Policy',
        'Retry-After',
      ],
      credentials: true,
      maxAge: 86400, // 24 hours preflight cache
    })
  );

  // ⚡ Rate Limiting (via rate-limit-middleware)
  app.use(createRateLimiter({ windowMs: 15 * 60 * 1000, max: 300 }));

  // Request Processing Middleware
  app.use(
    express.json({
      limit: '1mb',
      verify: (req, res, buf) => {
        // Store raw body for signature verification
        (req as Request).rawBody = buf;
      },
    })
  );
  app.use(express.urlencoded({ extended: true, limit: '100kb' }));

  // Cookie parser (required for CSRF double-submit cookie pattern)
  app.use(cookieParser());

  // CSRF protection (double-submit cookie pattern)
  app.use(csrfProtection());

  // Structured Request Logging Middleware with correlation IDs
  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;
      const logData = {
        method: req.method,
        url: req.url,
        status: res.statusCode,
        durationMs: duration,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        correlationId: getCorrelationId(),
      };

      if (res.statusCode >= 500) {
        logger.error('Request completed with server error', logData);
      } else if (res.statusCode >= 400) {
        logger.warn('Request completed with client error', logData);
      } else if (duration > 1000) {
        logger.warn('Slow request detected', logData);
      } else {
        logger.info('Request completed', logData);
      }
    });

    next();
  });

  // Deployment monitoring middleware (tracks request metrics for Prometheus)
  app.use(deploymentMonitoring);

  // Prometheus metrics endpoint (scraped by Prometheus) — protected by token or IP allowlist
  app.get('/metrics', (req, res) => {
    // Allow requests with a valid metrics token
    const metricsToken = process.env.METRICS_AUTH_TOKEN;
    const authHeader = req.headers.authorization;
    if (metricsToken && authHeader === `Bearer ${metricsToken}`) {
      getPrometheusMetrics(req, res);
      return;
    }

    // Allow requests from trusted internal IPs (Prometheus scraper)
    const allowedIPs = (process.env.METRICS_ALLOWED_IPS || '127.0.0.1,::1,::ffff:127.0.0.1').split(
      ','
    );
    const clientIP = req.ip || req.socket.remoteAddress || '';
    if (allowedIPs.includes(clientIP)) {
      getPrometheusMetrics(req, res);
      return;
    }

    // In development/test, allow all (no token configured)
    if (!metricsToken && process.env.NODE_ENV !== 'production') {
      getPrometheusMetrics(req, res);
      return;
    }

    res.status(403).json({
      success: false,
      error: 'Forbidden',
      code: 'METRICS_AUTH_REQUIRED',
    });
  });

  // Comprehensive health check routes (checks DB, Redis, Lightning, NOSTR, Queues)
  app.use('/', healthRouter);

  // 🎯 API Routes
  // WHY: Organized route structure following RESTful principles
  app.use('/api/auth', authRouter);
  app.use('/api/users', userRouter);
  app.use('/api/lightning', lightningRoutes);
  app.use('/api/lightning/receipt', lightningReceiptRoutes);

  // API v1 Routes (DI-based controllers for content, users, payments)
  app.use('/api/v1', v1Routes);

  // API v2 Routes (Phase 7: Creator Safety Net — wellness & content shield)
  app.use('/api/v2', v2Routes);

  // Content discovery and subscription tier routes
  app.use('/api/discovery', contentDiscoveryRoutes);
  app.use('/api/subscription-tiers', subscriptionTiersRoutes);

  // Analytics routes (creator dashboard)
  app.use('/api/analytics', analyticsRoutes);

  // OpenAPI / Swagger UI — available at /api/docs
  // Helmet's strict CSP blocks Swagger UI inline styles/scripts, so we disable
  // contentSecurityPolicy only for this path by applying a permissive override
  // before the swagger middleware and restoring the default after.
  const swaggerSpec = swaggerJsdoc({
    definition: {
      openapi: '3.0.0',
      info: {
        title: 'Sovren API',
        version: '2.0.0',
        description:
          'Decentralized creator monetization platform built on NOSTR and Bitcoin Lightning Network.',
        contact: { name: 'Sovren Engineering', url: 'https://docs.sovren.app' },
        license: { name: 'MIT' },
      },
      servers: [
        {
          url: '/api/v2',
          description: 'V2 (current) — Creator Safety Net, wellness & content shield',
        },
        { url: '/api/v1', description: 'V1 (deprecated) — content, users, payments' },
      ],
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
      security: [{ bearerAuth: [] }],
    },
    apis: ['./packages/backend/src/routes/**/*.ts', './packages/backend/src/routes/*.ts'],
  });

  app.use(
    '/api/docs',
    (_req: Request, res: Response, next: NextFunction) => {
      // Relax CSP for Swagger UI — it requires inline scripts and styles
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src 'self' data: https:;"
      );
      next();
    },
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customSiteTitle: 'Sovren API Docs',
      swaggerOptions: { persistAuthorization: true },
    })
  );

  // Expose raw OpenAPI JSON spec for tooling integrations
  app.get('/api/docs.json', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  // 🎯 API Root Endpoint
  // WHY: Provide API information and available endpoints
  app.get('/api', (req: Request, res: Response) => {
    res.json({
      success: true,
      data: {
        name: 'Sovren API',
        version: process.env.npm_package_version || '1.0.0',
        description: 'NOSTR-native creator monetization platform',
        endpoints: {
          authentication: '/api/auth',
          users: '/api/users',
          content: '/api/v1/content',
          payments: '/api/v1/payments',
          lightning: '/api/lightning',
          analytics: '/api/analytics',
          health: '/health',
          ready: '/ready',
          live: '/live',
          healthDetailed: '/health/detailed',
          metrics: '/metrics',
          metricsJson: '/api/v1/metrics',
          docs: '/api/docs',
          openApiSpec: '/api/docs.json',
        },
        documentation: 'https://docs.sovren.app/api',
        timestamp: Date.now(),
      },
    });
  });

  // 404 Handler — catch-all for unmatched routes.
  // Uses notFoundHandler which creates an AppError and passes to error middleware via next().
  app.use(notFoundHandler);

  // Global Error Handler (Sentry + structured logging in error-handler-middleware)
  // MUST be registered AFTER all routes and the 404 handler so it catches all errors.
  app.use(errorHandler);

  return app;
}

/**
 * 📊 Request Validation Schema
 * WHY: Type-safe request validation with clear error messages
 */
export const RequestValidation = {
  // Common pagination schema
  pagination: z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
    sort: z.string().optional(),
    order: z.enum(['asc', 'desc']).default('desc'),
  }),

  // NOSTR public key validation
  nostrPubkey: z.string().regex(/^[0-9a-fA-F]{64}$/, 'Invalid NOSTR public key format'),

  // ID parameter validation
  id: z.string().min(1, 'ID is required'),
};

/**
 * 🏭 Application Configuration
 * WHY: Centralized configuration with validation and defaults
 */
export const AppConfig = {
  // Server configuration
  port: process.env.PORT ? parseInt(process.env.PORT) : 3001,
  host: process.env.HOST || '0.0.0.0',

  // Environment
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',

  // Security
  jwtSecret: (() => {
    const secret = process.env.JWT_SECRET;
    const isProduction =
      process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging';

    if (!secret) {
      if (isProduction) {
        throw new Error('JWT_SECRET environment variable is required in production/staging');
      }
      logger.warn('JWT_SECRET not set — using insecure default for local development only');
      return 'development-only-secret-key-not-for-production';
    }

    // Malformation check: angle brackets indicate an unedited placeholder
    if (secret.includes('<') || secret.includes('>')) {
      const msg =
        'JWT_SECRET contains angle brackets — looks like an unedited placeholder. ' +
        'Run: openssl rand -base64 48 and set the result in packages/backend/.env';
      if (isProduction) {
        throw new Error(msg);
      }
      logger.error(msg);
    }

    // Strength validation: must be >= 32 chars and not a UUID (too weak / low entropy)
    const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    // Strip angle brackets before UUID check so <uuid> is also caught
    const strippedSecret = secret.replace(/^<|>$/g, '');
    if (secret.length < 32) {
      if (isProduction) {
        throw new Error('JWT_SECRET must be at least 32 characters in production/staging');
      }
      logger.warn('JWT_SECRET is shorter than 32 characters — weak secret for development only');
    }
    if (UUID_PATTERN.test(secret) || UUID_PATTERN.test(strippedSecret)) {
      if (isProduction) {
        throw new Error(
          'JWT_SECRET must not be a UUID — use a high-entropy random string (>=32 chars)'
        );
      }
      logger.warn(
        'JWT_SECRET appears to be a UUID — use a stronger secret. ' +
          'Run: openssl rand -base64 48'
      );
    }

    return secret;
  })(),

  // API limits
  rateLimitWindow: 15 * 60 * 1000, // 15 minutes
  rateLimitMax: 300,
  maxRequestSize: '1mb',

  // Performance
  responseTimeout: 30000, // 30 seconds
  keepAliveTimeout: 65000, // 65 seconds (higher than ALB idle timeout)
} as const;

/**
 * Mount Bull Board admin UI on an existing Express app.
 * Call after bootstrap when QueueService is available and queues have been created.
 */
export function mountBullBoard(app: Express, queueService: QueueService): void {
  const adminRouter = createBullBoardRouter(queueService);
  app.use('/admin/queues', authenticate, authorize(['admin']), adminRouter);
  logger.info('[BullBoard] Admin UI mounted at /admin/queues (admin-only)');
}
