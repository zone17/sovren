import { Request, Response, Router } from 'express';
import WebSocket from 'ws';
import os from 'os';
import { getRedisClient, isRedisAvailable } from '../lib/redis';
import { container } from '../container';
import { TYPES } from '../container/types';
import { authenticate, authorize } from '../middleware/auth';
import { supabase } from '../config/supabase';
import { isShuttingDown } from '../server';

const router = Router();

interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  services: {
    database: ServiceHealth;
    redis: ServiceHealth;
    lightning: ServiceHealth;
    nostr: ServiceHealth;
    queues: ServiceHealth;
  };
  metrics: {
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    cpu: {
      loadAverage: number[];
    };
    process: {
      pid: number;
      uptime: number;
    };
  };
  dependencies: {
    node: string;
    npm: string;
  };
}

interface ServiceHealth {
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime: number;
  lastChecked: string;
  error?: string;
  details?: Record<string, unknown>;
}

// Simple health check endpoint for load balancers
router.get('/health', (req: Request, res: Response) => {
  const memUsage = process.memoryUsage();
  const memPercentage = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100);

  res.status(200).json({
    status: 'healthy',
    service: 'sovren-api',
    version: process.env.npm_package_version || '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    memory: {
      heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
      percentage: memPercentage,
    },
  });
});

// Readiness probe shortcut (inline check instead of redirect)
// Returns 200 ready/degraded when DB is healthy. Only returns 503 when DB is down.
// Redis is non-critical: app degrades gracefully without it (in-memory fallback).
router.get('/ready', async (req: Request, res: Response) => {
  // During graceful shutdown, signal to load balancers that this instance should
  // stop receiving new traffic immediately.
  if (isShuttingDown) {
    return res.status(503).json({
      status: 'shutting-down',
      timestamp: new Date().toISOString(),
    });
  }

  try {
    const dbHealth = await checkDatabase();
    const redisHealth = await checkRedis();

    const dbOk = dbHealth.status === 'healthy';
    const redisOk = redisHealth.status === 'healthy';

    if (dbOk && redisOk) {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString(),
      });
    } else if (dbOk && !redisOk) {
      // DB is up, Redis is down — app can function in degraded mode
      res.status(200).json({
        status: 'degraded',
        timestamp: new Date().toISOString(),
        issues: {
          redis:
            redisHealth.error || 'Redis unavailable — features requiring cache/queues degraded',
        },
      });
    } else {
      // DB is down — app cannot function
      res.status(503).json({
        status: 'not-ready',
        timestamp: new Date().toISOString(),
        issues: {
          database: dbHealth.status !== 'healthy' ? dbHealth.error : null,
          redis: redisHealth.status !== 'healthy' ? redisHealth.error : null,
        },
      });
    }
  } catch (error) {
    res.status(503).json({
      status: 'not-ready',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Liveness probe shortcut (inline check instead of redirect)
router.get('/live', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    pid: process.pid,
    uptime: process.uptime(),
  });
});

// Comprehensive health check with detailed diagnostics — admin only
router.get(
  '/health/detailed',
  authenticate,
  authorize(['admin']),
  async (req: Request, res: Response) => {
    try {
      const healthResult: HealthCheckResult = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'unknown',
        services: {
          database: await checkDatabase(),
          redis: await checkRedis(),
          lightning: await checkLightning(),
          nostr: await checkNostr(),
          queues: await checkQueues(),
        },
        metrics: getSystemMetrics(),
        dependencies: {
          node: process.version,
          npm: process.env.npm_config_user_agent || 'unknown',
        },
      };

      // Determine overall health status
      const serviceStatuses = Object.values(healthResult.services).map((s) => s.status);

      if (serviceStatuses.includes('unhealthy')) {
        healthResult.status = 'unhealthy';
      } else if (serviceStatuses.includes('degraded')) {
        healthResult.status = 'degraded';
      }

      const statusCode =
        healthResult.status === 'healthy' ? 200 : healthResult.status === 'degraded' ? 200 : 503;

      res.status(statusCode).json(healthResult);
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
        uptime: process.uptime(),
      });
    }
  }
);

// Readiness probe for Kubernetes
// Same degradation logic: Redis down = degraded (200), DB down = not-ready (503)
router.get('/health/ready', async (req: Request, res: Response) => {
  if (isShuttingDown) {
    return res.status(503).json({
      status: 'shutting-down',
      timestamp: new Date().toISOString(),
    });
  }

  try {
    const dbHealth = await checkDatabase();
    const redisHealth = await checkRedis();

    const dbOk = dbHealth.status === 'healthy';
    const redisOk = redisHealth.status === 'healthy';

    if (dbOk && redisOk) {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString(),
      });
    } else if (dbOk && !redisOk) {
      res.status(200).json({
        status: 'degraded',
        timestamp: new Date().toISOString(),
        issues: {
          redis:
            redisHealth.error || 'Redis unavailable — features requiring cache/queues degraded',
        },
      });
    } else {
      res.status(503).json({
        status: 'not-ready',
        timestamp: new Date().toISOString(),
        issues: {
          database: dbHealth.status !== 'healthy' ? dbHealth.error : null,
          redis: redisHealth.status !== 'healthy' ? redisHealth.error : null,
        },
      });
    }
  } catch (error) {
    res.status(503).json({
      status: 'not-ready',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Liveness probe for Kubernetes
router.get('/health/live', (req: Request, res: Response) => {
  // Simple check that the process is alive and responsive
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    pid: process.pid,
    uptime: process.uptime(),
  });
});

async function checkDatabase(): Promise<ServiceHealth> {
  const startTime = Date.now();
  const TIMEOUT_MS = 5000;

  try {
    const queryPromise = supabase.from('health_check').select('id').limit(1);
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Database health check timed out')), TIMEOUT_MS)
    );

    const { error } = await Promise.race([queryPromise, timeoutPromise]);

    const responseTime = Date.now() - startTime;

    if (error) {
      return {
        status: 'unhealthy',
        responseTime,
        lastChecked: new Date().toISOString(),
        error: error.message,
      };
    }

    return {
      status: responseTime < 1000 ? 'healthy' : 'degraded',
      responseTime,
      lastChecked: new Date().toISOString(),
      details: {
        connectionCount: 1,
        responseTime: `${responseTime}ms`,
      },
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      lastChecked: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Database connection failed',
    };
  }
}

async function checkRedis(): Promise<ServiceHealth> {
  const startTime = Date.now();

  try {
    // If Redis was never connected (e.g., startup failed gracefully), report degraded
    if (!isRedisAvailable()) {
      return {
        status: 'unhealthy',
        responseTime: 0,
        lastChecked: new Date().toISOString(),
        error: 'Redis not connected — app running in degraded mode without cache/queues',
      };
    }

    const redis = getRedisClient();

    await redis.ping();
    const responseTime = Date.now() - startTime;

    return {
      status: responseTime < 500 ? 'healthy' : 'degraded',
      responseTime,
      lastChecked: new Date().toISOString(),
      details: {
        responseTime: `${responseTime}ms`,
      },
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      lastChecked: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Redis connection failed',
    };
  }
}

async function checkLightning(): Promise<ServiceHealth> {
  const startTime = Date.now();

  try {
    const lnbitsUrl = process.env.LNBITS_API_URL;
    if (!lnbitsUrl) {
      return {
        status: 'degraded',
        responseTime: 0,
        lastChecked: new Date().toISOString(),
        error: 'LNbits URL not configured',
      };
    }

    const response = await fetch(`${lnbitsUrl}/api/v1/wallet`, {
      headers: {
        'X-Api-Key': process.env.LNBITS_ADMIN_KEY || '',
      },
    });

    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      return {
        status: 'unhealthy',
        responseTime,
        lastChecked: new Date().toISOString(),
        error: `LNbits API returned ${response.status}`,
      };
    }

    return {
      status: responseTime < 2000 ? 'healthy' : 'degraded',
      responseTime,
      lastChecked: new Date().toISOString(),
      details: {
        responseTime: `${responseTime}ms`,
      },
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      lastChecked: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Lightning network connection failed',
    };
  }
}

async function checkNostr(): Promise<ServiceHealth> {
  const startTime = Date.now();

  try {
    const relays = (process.env.NOSTR_RELAYS || '').split(',').filter(Boolean);

    if (relays.length === 0) {
      return {
        status: 'degraded',
        responseTime: 0,
        lastChecked: new Date().toISOString(),
        error: 'No NOSTR relays configured',
      };
    }

    const relay = relays[0];
    const ws = new WebSocket(relay);

    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 5000);

        ws.onopen = () => {
          clearTimeout(timeout);
          resolve();
        };

        ws.onerror = (error) => {
          clearTimeout(timeout);
          reject(error);
        };
      });
    } finally {
      ws.onopen = null;
      ws.onerror = null;
      ws.onclose = null;
      ws.onmessage = null;
      ws.close();
    }

    const responseTime = Date.now() - startTime;

    return {
      status: responseTime < 3000 ? 'healthy' : 'degraded',
      responseTime,
      lastChecked: new Date().toISOString(),
      details: {
        relaysConfigured: relays.length,
        responseTime: `${responseTime}ms`,
      },
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      lastChecked: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'NOSTR relay connection failed',
    };
  }
}

async function checkQueues(): Promise<ServiceHealth> {
  const startTime = Date.now();

  try {
    // Resolve from DI container — returns null if container is not yet initialized
    const queueService = container.resolveOptional(TYPES.QueueService);

    if (!queueService) {
      return {
        status: 'degraded',
        responseTime: 0,
        lastChecked: new Date().toISOString(),
        error: 'QueueService not initialized yet',
      };
    }

    const healthy = await queueService.isHealthy();
    const responseTime = Date.now() - startTime;

    return {
      status: healthy ? (responseTime < 1000 ? 'healthy' : 'degraded') : 'unhealthy',
      responseTime,
      lastChecked: new Date().toISOString(),
      details: {
        queueCount: queueService.getQueueNames().length,
        queues: queueService.getQueueNames(),
        responseTime: `${responseTime}ms`,
      },
    };
  } catch (error) {
    return {
      status: 'degraded',
      responseTime: Date.now() - startTime,
      lastChecked: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Queue health check failed',
    };
  }
}

function getSystemMetrics() {
  const memUsage = process.memoryUsage();

  return {
    memory: {
      used: memUsage.heapUsed,
      total: memUsage.heapTotal,
      percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
    },
    cpu: {
      loadAverage: process.platform !== 'win32' ? os.loadavg() : [0, 0, 0],
    },
    process: {
      pid: process.pid,
      uptime: process.uptime(),
    },
  };
}

export default router;
