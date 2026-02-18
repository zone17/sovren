/**
 * Metrics API Routes (v1)
 *
 * Agent-friendly JSON metrics and service health endpoints.
 * Provides structured data that agents can consume without
 * parsing Prometheus text format.
 *
 * All routes use /api/v1/metrics prefix
 */

import { NextFunction, Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { rateLimiters } from '../../middleware/rate-limit-middleware';
import { getJsonMetrics } from '../../middleware/deployment-monitoring';
import { createApiResponse } from '../../utils/api-response';
import { getDatabase } from '../../config/database';
import { getRedisClient, isRedisAvailable } from '../../lib/redis';

const router = Router();

/**
 * @openapi
 * /api/v1/metrics:
 *   get:
 *     summary: Get service metrics in JSON format
 *     description: Returns Prometheus metrics as structured JSON for agent consumption
 *     tags: [Metrics]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: JSON metrics data
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/',
  authenticate,
  rateLimiters.content.read,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const startTime = Date.now();
      const metrics = await getJsonMetrics();
      res.json(createApiResponse(req, metrics, startTime));
    } catch (err) {
      next(err);
    }
  }
);

/**
 * @openapi
 * /api/v1/metrics/health:
 *   get:
 *     summary: Get service health status
 *     description: Returns comprehensive health data including all service checks
 *     tags: [Metrics]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Service health data
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/health',
  authenticate,
  rateLimiters.content.read,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const startTime = Date.now();

      const memUsage = process.memoryUsage();

      // Database health check
      const dbCheckStart = Date.now();
      let databaseStatus: { status: 'up' | 'down'; latencyMs: number };
      try {
        const db = getDatabase();
        const healthy = await db.isHealthy();
        databaseStatus = { status: healthy ? 'up' : 'down', latencyMs: Date.now() - dbCheckStart };
      } catch {
        databaseStatus = { status: 'down', latencyMs: Date.now() - dbCheckStart };
      }

      // Queue/Redis health check
      const redisCheckStart = Date.now();
      let queueStatus: { status: 'up' | 'down'; latencyMs: number };
      try {
        if (isRedisAvailable()) {
          const client = getRedisClient();
          await client.ping();
          queueStatus = { status: 'up', latencyMs: Date.now() - redisCheckStart };
        } else {
          queueStatus = { status: 'down', latencyMs: Date.now() - redisCheckStart };
        }
      } catch {
        queueStatus = { status: 'down', latencyMs: Date.now() - redisCheckStart };
      }

      const checks = {
        database: databaseStatus,
        queue: queueStatus,
      };

      const overallStatus = Object.values(checks).every((c) => c.status === 'up')
        ? ('healthy' as const)
        : ('degraded' as const);

      const health = {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        memory: {
          heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
          heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
          percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
        },
        process: {
          nodeVersion: process.version,
        },
        checks,
      };

      res.json(createApiResponse(req, health, startTime));
    } catch (err) {
      next(err);
    }
  }
);

export default router;
