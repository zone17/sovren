import { createClient } from '@supabase/supabase-js';
import { Request, Response, Router } from 'express';
import Redis from 'ioredis';

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
  details?: any;
}

// Simple health check endpoint for load balancers
router.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});

// Comprehensive health check with detailed diagnostics
router.get('/health/detailed', async (req: Request, res: Response) => {
  const startTime = Date.now();

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
});

// Readiness probe for Kubernetes
router.get('/health/ready', async (req: Request, res: Response) => {
  try {
    // Check critical services required for the app to function
    const dbHealth = await checkDatabase();
    const redisHealth = await checkRedis();

    if (dbHealth.status === 'healthy' && redisHealth.status === 'healthy') {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString(),
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

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_ANON_KEY || ''
    );

    const { data, error } = await supabase.from('health_check').select('*').limit(1);

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
    const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

    await redis.ping();
    const responseTime = Date.now() - startTime;

    await redis.disconnect();

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

    // Check first relay as a representative
    const relay = relays[0];
    const ws = new WebSocket(relay);

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('Connection timeout'));
      }, 5000);

      ws.onopen = () => {
        clearTimeout(timeout);
        ws.close();
        resolve(void 0);
      };

      ws.onerror = (error) => {
        clearTimeout(timeout);
        reject(error);
      };
    });

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

function getSystemMetrics() {
  const memUsage = process.memoryUsage();

  return {
    memory: {
      used: memUsage.heapUsed,
      total: memUsage.heapTotal,
      percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
    },
    cpu: {
      loadAverage: process.platform !== 'win32' ? require('os').loadavg() : [0, 0, 0],
    },
    process: {
      pid: process.pid,
      uptime: process.uptime(),
    },
  };
}

export default router;
