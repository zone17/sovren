import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Express, NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { z } from 'zod';

// Import our services and middleware
import authRouter from './routes/auth';
import lightningRoutes from './routes/lightning';
import lightningReceiptRoutes from './routes/lightning-receipts';
import userRouter from './routes/users';
import healthRouter from './routes/health';
import v1Routes from './routes/v1';
import { csrfProtection } from './middleware/csrf';
import { deploymentMonitoring, getPrometheusMetrics } from './middleware/deployment-monitoring';
import { correlationIdMiddleware, getCorrelationId } from './middleware/correlation-id';
import logger from './lib/logger';
import { initSentry, Sentry } from './lib/sentry';

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
      origin:
        process.env.NODE_ENV === 'production'
          ? ['https://sovren.app', 'https://www.sovren.app']
          : ['http://localhost:3000', 'http://localhost:5173'],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
      exposedHeaders: ['X-CSRF-Token'],
      credentials: true,
      maxAge: 86400, // 24 hours preflight cache
    })
  );

  // ⚡ Rate Limiting
  // WHY: Prevent abuse and ensure fair resource allocation
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Generous limit for authenticated users
    message: {
      success: false,
      error: 'Too many requests from this IP, please try again later',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: 900, // 15 minutes in seconds
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use(limiter);

  // Correlation ID middleware (must be early - before logging and metrics)
  app.use(correlationIdMiddleware);

  // Request Processing Middleware
  app.use(
    express.json({
      limit: '10mb', // Allow for image uploads
      verify: (req, res, buf) => {
        // Store raw body for signature verification
        (req as any).rawBody = buf;
      },
    })
  );
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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

  // Prometheus metrics endpoint (scraped by Prometheus) - async handler for prom-client
  app.get('/metrics', (req, res) => {
    getPrometheusMetrics(req, res);
  });

  // Comprehensive health check routes (checks DB, Redis, Lightning, NOSTR)
  app.use('/', healthRouter);

  // 🎯 API Routes
  // WHY: Organized route structure following RESTful principles
  app.use('/api/auth', authRouter);
  app.use('/api/users', userRouter);
  app.use('/api/lightning', lightningRoutes);
  app.use('/api/lightning/receipt', lightningReceiptRoutes);

  // API v1 Routes (DI-based controllers for content, users, payments)
  app.use('/api/v1', v1Routes);

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
          health: '/health',
        },
        documentation: 'https://docs.sovren.app/api',
        timestamp: Date.now(),
      },
    });
  });

  // 🚫 404 Handler
  // WHY: Provide consistent error response for unknown endpoints
  app.use('*', (req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: 'Endpoint not found',
      code: 'NOT_FOUND',
      path: req.originalUrl,
      method: req.method,
      suggestion: 'Check the API documentation for available endpoints',
    });
  });

  // Global Error Handler
  app.use((error: any, req: Request, res: Response, _next: NextFunction) => {
    // Capture to Sentry with correlation context
    Sentry.withScope((scope) => {
      scope.setTag('correlationId', getCorrelationId());
      scope.setExtra('url', req.url);
      scope.setExtra('method', req.method);
      Sentry.captureException(error);
    });

    logger.error('Unhandled API error', {
      error: error.message,
      stack: error.stack,
      url: req.url,
      method: req.method,
      correlationId: getCorrelationId(),
    });

    // Validation errors from Zod
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        })),
      });
    }

    // JWT errors
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid authentication token',
        code: 'AUTHENTICATION_ERROR',
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Authentication token expired',
        code: 'TOKEN_EXPIRED',
      });
    }

    // Default server error
    // WHY: Never expose internal error details in production
    const isDevelopment = process.env.NODE_ENV === 'development';

    return res.status(error.status || 500).json({
      success: false,
      error: isDevelopment ? error.message : 'Internal server error',
      code: 'INTERNAL_ERROR',
      ...(isDevelopment && { stack: error.stack }),
    });
  });

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
  jwtSecret:
    process.env.JWT_SECRET ||
    (() => {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('JWT_SECRET environment variable is required in production');
      }
      console.warn('⚠️ Using default JWT_SECRET - not suitable for production');
      return 'development-only-secret-key';
    })(),

  // API limits
  rateLimitWindow: 15 * 60 * 1000, // 15 minutes
  rateLimitMax: 1000,
  maxRequestSize: '10mb',

  // Performance
  responseTimeout: 30000, // 30 seconds
  keepAliveTimeout: 65000, // 65 seconds (higher than ALB idle timeout)
} as const;
