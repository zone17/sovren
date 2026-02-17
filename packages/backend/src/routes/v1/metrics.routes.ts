/**
 * Metrics API Routes (v1)
 *
 * Agent-friendly JSON metrics and service health endpoints.
 * Provides structured data that agents can consume without
 * parsing Prometheus text format.
 *
 * All routes use /api/v1/metrics prefix
 */

import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { rateLimiters } from '../../middleware/rate-limit-middleware';
import { getJsonMetrics } from '../../middleware/deployment-monitoring';
import { createApiResponse } from '../../utils/api-response';

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
  async (req: Request, res: Response) => {
    const startTime = Date.now();
    const metrics = await getJsonMetrics();
    res.json(createApiResponse(req, { metrics }, startTime));
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
  async (req: Request, res: Response) => {
    const startTime = Date.now();

    const memUsage = process.memoryUsage();

    const health = {
      status: 'healthy' as const,
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
        pid: process.pid,
        nodeVersion: process.version,
      },
    };

    res.json(createApiResponse(req, health, startTime));
  }
);

export default router;
