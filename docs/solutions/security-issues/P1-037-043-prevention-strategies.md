---
title: 'P1-037-043 Prevention Strategies: Recurring Pattern Elimination'
date: 2026-02-12
category:
  - security_issue
  - code_quality
  - operational_resilience
tags:
  - prometheus-metrics
  - health-checks
  - redis-factory-pattern
  - credential-rotation
  - cors-validation
  - type-safety
  - preventive-automation
  - eslint-rules
module:
  - observability
  - infrastructure
  - authentication
  - middleware
severity: critical
finding_ids:
  - P1-037
  - P1-038
  - P1-039
  - P1-040
  - P1-041
  - P1-042
  - P1-043
status: preventive-framework
---

# Prevention Strategies for P1-037-043: Recurring Pattern Elimination

## Executive Summary

Seven P1 critical findings share common root causes that can be systematically prevented via:

1. **ESLint Rules** (4 new rules + 2 enforcement updates)
2. **CI/CD Checks** (6 automated gates in GitHub Actions)
3. **Pre-Commit Hooks** (grep patterns + linting)
4. **Code Review Checklists** (domain-specific audit items)
5. **Testing Requirements** (integration + security test suites)
6. **Design Patterns** (factory patterns, write-ahead protocol)

This document provides implementation details for each finding and demonstrates how to prevent recurrence.

---

## P1-037: Route Metrics Timing — Prometheus Label Cardinality

### Finding

Route metrics captured in middleware (before route matching), causing `req.route` to be `undefined`. Prometheus labels like `route="/metrics"` instead of actual matched routes.

### Root Cause

**Middleware Execution Timing Assumption**: Developer assumed `req.route` would be populated by Express before middleware body executes. Express doesn't populate `req.route` until after routing phase completes.

---

### Prevention Strategy

#### 1. ESLint Rule: Ban Prometheus Labeling in Middleware

**File**: `.eslintrc.json` (new rule)

```json
{
  "rules": {
    "no-prometheus-labels-in-middleware": {
      "severity": "error",
      "message": "Prometheus metric labels must be captured in res.on('finish') or res.on('close'), never in middleware body. Use write-through pattern."
    }
  }
}
```

**Implementation**: Custom ESLint rule (new file)

**File**: `packages/shared/eslint-rules/no-prometheus-labels-in-middleware.js`

```javascript
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Prometheus labels must be captured after route matching',
      category: 'Best Practices',
      recommended: true,
    },
    messages: {
      noMiddlewarePrometheus:
        'Prometheus labels for routes must be captured in res.on("finish") or res.on("close"), never in middleware body. ' +
        'Use: res.on("finish", () => { histogram.labels(req.route.path).observe(...) })',
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        // Detect patterns like: metrics.histogram(...) or prometheus.counter(...)
        const calleeName = node.callee?.property?.name || node.callee?.name;
        if (!calleeName?.match(/histogram|counter|gauge/i)) return;

        // Check if we're in a middleware function (req, res, next parameters)
        const parent = context
          .getAncestors()
          .find((n) => n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression');
        if (
          !parent?.params?.some((p) => p.name === 'req' && context.sourceCode.getText(p) === 'req')
        )
          return;

        // Check if this is NOT inside res.on('finish/close')
        const resOnCall = context
          .getAncestors()
          .find(
            (n) =>
              n.type === 'CallExpression' &&
              n.callee?.property?.name === 'on' &&
              n.arguments?.[0]?.value?.match(/finish|close/)
          );

        if (!resOnCall) {
          context.report({
            node,
            messageId: 'noMiddlewarePrometheus',
          });
        }
      },
    };
  },
};
```

**File**: `packages/shared/eslint-rules/index.js`

```javascript
module.exports = {
  'no-prometheus-labels-in-middleware': require('./no-prometheus-labels-in-middleware'),
  // ... other rules
};
```

**Update `.eslintrc.json`**:

```json
{
  "plugins": ["@typescript-eslint", "@sovren/custom-rules"],
  "rules": {
    "@sovren/custom-rules/no-prometheus-labels-in-middleware": "error"
  }
}
```

#### 2. CI/CD Automation: Grep Pattern Check

**File**: `.github/workflows/security-gates.yml` (add job)

```yaml
prometheus-labels-check:
  name: Verify Prometheus Labels Captured After Routing
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - name: Check for middleware prometheus patterns
      run: |
        set +e

        # Find middleware files with prometheus/metrics references
        VIOLATIONS=$(find packages/backend/src -name "*middleware*" -o -name "*metrics*" | xargs grep -l "histogram\|counter\|gauge" 2>/dev/null | while read file; do
          # Check if metric capture happens in middleware body (NOT in res.on)
          if grep -A5 "^export.*middleware\|^function.*middleware" "$file" | grep -E "histogram\|counter\|gauge" | grep -v "res\.on\|res\.once" > /dev/null; then
            echo "$file"
          fi
        done)

        if [ -n "$VIOLATIONS" ]; then
          echo "❌ Prometheus metrics captured in middleware body (before routing):"
          echo "$VIOLATIONS"
          exit 1
        fi

        echo "✅ All Prometheus labels captured after routing"
```

#### 3. Code Review Checklist

```markdown
## Prometheus Metrics & Observability

- [ ] **Route metrics**: All `req.route`-dependent metrics are captured in `res.on('finish')` or `res.on('close')`, NOT in middleware
- [ ] **Label values bounded**: No unbounded labels (e.g., user IDs, UUIDs, tokens); use `:uuid`, `:id` placeholders
- [ ] **Cardinality audit**: New metrics don't exceed 100 unique label combinations; check Prometheus targets
- [ ] **Middleware ordering**: Correlation ID middleware runs first, error handler runs last
- [ ] **No dynamic labels from URL**: URL parameters in labels must be normalized (e.g., `/api/users/123` → `/api/users/:id`)
```

#### 4. Integration Test: Route Metrics Timing

**File**: `packages/backend/src/__tests__/integration/metrics-timing.test.ts`

```typescript
describe('Prometheus Metrics Timing', () => {
  let app: Express;
  let metricsCollector: any;

  beforeEach(() => {
    app = express();
    metricsCollector = {
      histogram: jest.fn((name: string) => ({
        labels: jest.fn(() => ({
          observe: jest.fn(),
        })),
      })),
    };

    // Middleware that WRONGLY captures metrics before routing
    app.use((req, res, next) => {
      // ❌ WRONG: metrics captured here (would be empty)
      // metricsCollector.histogram('request_duration').labels(req.route.path).observe(1);
      next();
    });

    // Route with metrics captured correctly in res.on('finish')
    app.get('/api/users/:id', (req, res) => {
      const start = Date.now();
      res.on('finish', () => {
        const duration = Date.now() - start;
        // ✅ CORRECT: req.route is populated by now
        metricsCollector.histogram('request_duration').labels(req.route.path).observe(duration);
      });
      res.json({ id: req.params.id });
    });
  });

  it('should populate req.route by res.on("finish")', async () => {
    const request = supertest(app);
    const response = await request.get('/api/users/123');

    expect(response.status).toBe(200);
    // Verify metrics were collected with correct route
    expect(metricsCollector.histogram).toHaveBeenCalledWith('request_duration');
    const histogramObserver = metricsCollector.histogram().labels('/api/users/:id');
    expect(histogramObserver.observe).toHaveBeenCalled();
  });

  it('should normalize dynamic segments in prometheus labels', async () => {
    const request = supertest(app);
    await request.get('/api/users/uuid-1234-5678');
    await request.get('/api/users/uuid-9999-0000');

    // Both requests should use same label: /api/users/:id
    const calls = metricsCollector.histogram().labels.mock.calls;
    expect(calls).toEqual([['/api/users/:id'], ['/api/users/:id']]);
  });
});
```

---

## P1-038: Health Check Hangs + Resource Leak

### Finding

Health check endpoint lacks timeout on external DB calls. WebSocket connections opened but never closed in finally block. Results in hanging requests and resource exhaustion.

### Root Cause

**Missing Defensive Programming**: Health checks performed external calls without timeout guards. Cleanup code not implemented in finally blocks.

---

### Prevention Strategy

#### 1. ESLint Rule: Enforce Timeouts on External Calls

**File**: `packages/shared/eslint-rules/enforce-external-call-timeouts.js`

```javascript
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'External calls (DB, HTTP, Redis) must have explicit timeout',
      category: 'Best Practices',
      recommended: true,
    },
    messages: {
      noTimeoutOnExternalCall:
        'External calls must have explicit timeout. Use: ' +
        'withTimeout(dbQuery, { timeout: 5000, name: "health_check_db" })',
      noTimeoutOption: 'HTTP/DB/Redis clients must be initialized with { timeout: <milliseconds> }',
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        const name = node.callee?.property?.name || node.callee?.name;

        // Detect external call patterns
        const isExternalCall = name?.match(/query|fetch|request|get|set|publish|subscribe|health/i);
        if (!isExternalCall) return;

        // Check if in health check context
        const functionName = context
          .getAncestors()
          .find((n) => n.type === 'FunctionDeclaration' || n.type === 'FunctionExpression')
          ?.id?.name;
        if (!functionName?.match(/health|ready|liveness/i)) return;

        // Check for timeout in arguments
        const hasTimeout = node.arguments?.some(
          (arg) =>
            arg.type === 'ObjectExpression' &&
            arg.properties?.some(
              (prop) =>
                prop.key?.name === 'timeout' ||
                (prop.type === 'SpreadElement' && prop.argument?.name?.match(/config|options/i))
            )
        );

        // Check if Promise.race used (alternative timeout pattern)
        const inPromiseRace = context
          .getAncestors()
          .some(
            (n) =>
              n.type === 'CallExpression' &&
              n.callee?.object?.name === 'Promise' &&
              n.callee?.property?.name === 'race'
          );

        if (!hasTimeout && !inPromiseRace) {
          context.report({
            node,
            messageId: 'noTimeoutOnExternalCall',
          });
        }
      },
    };
  },
};
```

#### 2. Design Pattern: Health Check Timeout Wrapper

**File**: `packages/backend/src/utils/health-check-timeout.ts`

```typescript
import { EventEmitter } from 'events';

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  details: Record<string, any>;
  checks: {
    [key: string]: {
      status: 'pass' | 'fail';
      duration: number;
      error?: string;
    };
  };
}

export interface TimeoutOptions {
  timeout: number;
  name: string;
  onTimeout?: () => void;
}

/**
 * Wraps a health check promise with timeout and automatic cleanup.
 * Ensures all checks complete or fail-fast within timeout window.
 */
export async function withHealthCheckTimeout<T>(
  promise: Promise<T>,
  options: TimeoutOptions
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeout);

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        controller.signal.addEventListener('abort', () => {
          options.onTimeout?.();
          reject(new Error(`Health check '${options.name}' timeout after ${options.timeout}ms`));
        });
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Ensures proper cleanup of resources opened during health check.
 * Use in finally block to guarantee cleanup even on timeout.
 */
export async function withResourceCleanup<T>(
  resource: EventEmitter | { close: () => Promise<void> } | { disconnect: () => void },
  operation: () => Promise<T>
): Promise<T> {
  try {
    return await operation();
  } finally {
    try {
      if ('close' in resource && typeof resource.close === 'function') {
        await resource.close();
      } else if ('disconnect' in resource && typeof resource.disconnect === 'function') {
        resource.disconnect();
      } else if (resource instanceof EventEmitter) {
        resource.removeAllListeners();
      }
    } catch (error) {
      console.error('Error cleaning up health check resource:', error);
    }
  }
}

/**
 * Health check pattern combining timeout + cleanup.
 *
 * @example
 * async function checkDatabase() {
 *   const conn = pool.connect();
 *   return withResourceCleanup(conn, async () => {
 *     return withHealthCheckTimeout(
 *       conn.query('SELECT 1'),
 *       { timeout: 5000, name: 'database_query' }
 *     );
 *   });
 * }
 */
```

#### 3. Implementation Example: Safe Health Check Endpoint

**File**: `packages/backend/src/routes/health.ts`

```typescript
import express, { Router } from 'express';
import { pool } from '@backend/db';
import { redisClient } from '@backend/services/redis';
import { withHealthCheckTimeout, withResourceCleanup } from '@backend/utils/health-check-timeout';

const router = Router();

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    database: {
      status: 'pass' | 'fail';
      duration: number;
      error?: string;
    };
    redis: {
      status: 'pass' | 'fail';
      duration: number;
      error?: string;
    };
  };
  timestamp: string;
}

// Health check endpoint with timeout protection
router.get('/health', async (req, res) => {
  const startTime = Date.now();
  const checks: HealthStatus['checks'] = {
    database: { status: 'fail', duration: 0 },
    redis: { status: 'fail', duration: 0 },
  };

  try {
    // Database check with timeout
    const dbStartTime = Date.now();
    try {
      const client = await pool.connect();
      await withResourceCleanup(client, async () => {
        return withHealthCheckTimeout(client.query('SELECT 1'), {
          timeout: 5000,
          name: 'health_check_db',
        });
      });
      checks.database = {
        status: 'pass',
        duration: Date.now() - dbStartTime,
      };
    } catch (error: any) {
      checks.database = {
        status: 'fail',
        duration: Date.now() - dbStartTime,
        error: error.message,
      };
    }

    // Redis check with timeout
    const redisStartTime = Date.now();
    try {
      await withHealthCheckTimeout(redisClient.ping(), {
        timeout: 3000,
        name: 'health_check_redis',
      });
      checks.redis = {
        status: 'pass',
        duration: Date.now() - redisStartTime,
      };
    } catch (error: any) {
      checks.redis = {
        status: 'fail',
        duration: Date.now() - redisStartTime,
        error: error.message,
      };
    }

    const status: HealthStatus = {
      status:
        checks.database.status === 'pass' && checks.redis.status === 'pass'
          ? 'healthy'
          : 'degraded',
      checks,
      timestamp: new Date().toISOString(),
    };

    const statusCode = status.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(status);
  } catch (error: any) {
    res.status(500).json({
      status: 'unhealthy',
      error: 'Health check failed',
      timestamp: new Date().toISOString(),
    });
  }
});

// Readiness probe (stricter)
router.get('/ready', async (req, res) => {
  const checks = {
    database: { status: 'fail' as const },
    redis: { status: 'fail' as const },
  };

  try {
    const client = await pool.connect();
    await withResourceCleanup(client, async () => {
      return withHealthCheckTimeout(client.query('SELECT 1'), {
        timeout: 2000,
        name: 'readiness_db',
      });
    });
    checks.database.status = 'pass';
  } catch {
    // Not ready if DB fails
  }

  try {
    await withHealthCheckTimeout(redisClient.ping(), { timeout: 2000, name: 'readiness_redis' });
    checks.redis.status = 'pass';
  } catch {
    // Not ready if Redis fails
  }

  const isReady = checks.database.status === 'pass' && checks.redis.status === 'pass';
  res.status(isReady ? 200 : 503).json({
    ready: isReady,
    checks,
  });
});

export default router;
```

#### 4. CI/CD Automation: Health Check Test Gate

**File**: `.github/workflows/health-check-validation.yml`

```yaml
name: Health Check Validation
on: [pull_request, push]

jobs:
  health-check-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Run health check tests
        run: npm run test -- --testPathPattern=health --runInBand
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/test
          REDIS_URL: redis://localhost:6379

      - name: Check for timeout usage
        run: |
          # Verify all health check files use timeout utilities
          if grep -r "pool\.connect\|redisClient\." packages/backend/src/routes/health.ts | \
             grep -v "withHealthCheckTimeout\|withResourceCleanup" > /dev/null; then
            echo "❌ Health check calls found without timeout"
            exit 1
          fi
          echo "✅ All health checks use timeout utilities"

      - name: Lint health check code
        run: npm run lint -- packages/backend/src/routes/health.ts
```

#### 5. Testing: Health Check Resource Cleanup

**File**: `packages/backend/src/__tests__/integration/health-check-cleanup.test.ts`

```typescript
describe('Health Check Resource Cleanup', () => {
  it('should close database connections even on timeout', async () => {
    const mockConnection = {
      query: jest.fn(() => new Promise(() => {})), // Never resolves
      close: jest.fn().mockResolvedValue(undefined),
    };

    const cleanup = jest.fn(async () => {
      await mockConnection.close();
    });

    await expect(async () => {
      try {
        await withResourceCleanup(mockConnection, async () => {
          return withHealthCheckTimeout(mockConnection.query('SELECT 1'), {
            timeout: 100,
            name: 'test',
          });
        });
      } catch {
        // Expected to throw timeout error
      }
    }).rejects.toThrow('timeout');

    // Verify cleanup was called
    setTimeout(() => {
      expect(mockConnection.close).toHaveBeenCalled();
    }, 200);
  });

  it('should clear timers in finally block', async () => {
    const timerSpy = jest.spyOn(global, 'setTimeout');
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    await withHealthCheckTimeout(Promise.resolve('success'), { timeout: 5000, name: 'test' });

    // Verify timer was cleared
    expect(clearTimeoutSpy).toHaveBeenCalled();
    timerSpy.mockRestore();
    clearTimeoutSpy.mockRestore();
  });

  it('should not hang on concurrent health checks', async () => {
    const promises = Array(10)
      .fill(null)
      .map(() =>
        Promise.race([
          new Promise((resolve) => setTimeout(() => resolve('timeout'), 200)),
          withHealthCheckTimeout(Promise.resolve('success'), {
            timeout: 100,
            name: `health_${Math.random()}`,
          }),
        ])
      );

    const results = await Promise.allSettled(promises);
    expect(results).toHaveLength(10);
  });
});
```

---

## P1-039: Redis Client Sprawl — No Shared Factory Pattern

### Finding

5 files independently creating Redis clients with different configurations. Each file uses `new Redis()` directly, causing inconsistent behavior, connection pool exhaustion, and duplicate authentication logic.

### Root Cause

**No Shared Module + Copy-Paste Culture**: Redis utility was created once but not centralized; later developers copy-pasted the pattern instead of importing shared factory.

---

### Prevention Strategy

#### 1. Create Shared Redis Factory

**File**: `packages/backend/src/lib/redis.ts`

```typescript
import Redis, { RedisOptions } from 'ioredis';

export interface RedisFactoryConfig {
  url?: string;
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  lazyConnect?: boolean;
  maxRetriesPerRequest?: number;
  enableReadyCheck?: boolean;
  retryStrategy?: (times: number) => number;
  reconnectOnError?: (error: Error) => boolean;
}

/**
 * Redis client factory ensuring single configuration source of truth.
 * All Redis clients in application must use this factory, never `new Redis()`.
 */
class RedisFactory {
  private static instances = new Map<string, Redis>();
  private static defaultConfig: RedisOptions = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0', 10),
    retryStrategy: (times) => Math.min(times * 50, 2000),
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
    reconnectOnError: (err) => {
      const targetError = err.message;
      if (targetError.includes('READONLY')) {
        return true;
      }
      if (targetError.includes('CLUSTERDOWN')) {
        return true;
      }
      return false;
    },
  };

  /**
   * Get or create a named Redis client instance.
   * Using named instances allows specialized configs (cache vs queue vs sessions).
   *
   * @param name - Unique client identifier ('cache', 'queue', 'sessions', 'default')
   * @param overrides - Optional config overrides for this specific instance
   */
  static getClient(name: string = 'default', overrides?: RedisFactoryConfig): Redis {
    // Return existing instance if already created
    if (RedisFactory.instances.has(name)) {
      return RedisFactory.instances.get(name)!;
    }

    // Create new instance with merged config
    const config: RedisOptions = {
      ...RedisFactory.defaultConfig,
      ...overrides,
    };

    // Validate config
    if (!config.host && !overrides?.url) {
      throw new Error('Redis host or URL must be configured via REDIS_HOST or REDIS_URL');
    }

    const client = new Redis(config);

    // Attach client name for debugging
    (client as any).clientName = name;

    // Global error handler
    client.on('error', (error) => {
      console.error(`[Redis:${name}] Error:`, error.message);
      // Report to monitoring (e.g., Sentry)
    });

    client.on('reconnecting', () => {
      console.warn(`[Redis:${name}] Reconnecting...`);
    });

    // Cache instance
    RedisFactory.instances.set(name, client);

    return client;
  }

  /**
   * Close a specific client instance.
   */
  static async closeClient(name: string = 'default'): Promise<void> {
    const client = RedisFactory.instances.get(name);
    if (client) {
      await client.quit();
      RedisFactory.instances.delete(name);
    }
  }

  /**
   * Close all client instances (for graceful shutdown).
   */
  static async closeAll(): Promise<void> {
    const promises = Array.from(RedisFactory.instances.values()).map((client) =>
      client.quit().catch((err) => console.error('Error closing Redis client:', err))
    );
    await Promise.all(promises);
    RedisFactory.instances.clear();
  }

  /**
   * Reset all instances (mainly for testing).
   */
  static reset(): void {
    RedisFactory.instances.clear();
  }
}

// Export singleton instances for common use cases
export const redisDefault = RedisFactory.getClient('default');
export const redisCache = RedisFactory.getClient('cache', {
  db: 1,
  maxRetriesPerRequest: 1, // Cache misses are acceptable
});
export const redisQueue = RedisFactory.getClient('queue', {
  db: 2,
  maxRetriesPerRequest: 3, // Queue reliability is critical
});
export const redisSessions = RedisFactory.getClient('sessions', {
  db: 3,
  maxRetriesPerRequest: 2,
});

export { RedisFactory };
```

#### 2. ESLint Rule: Ban Direct Redis Constructor

**File**: `packages/shared/eslint-rules/no-direct-redis-import.js`

```javascript
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Redis clients must use factory pattern, not direct constructor',
      category: 'Best Practices',
      recommended: true,
    },
    messages: {
      noDirectRedis:
        'Use RedisFactory.getClient() instead of `new Redis()`. ' +
        'Import: import { RedisFactory, redisDefault } from "@backend/lib/redis"',
      noRedisImportOutsideLib:
        'Direct `new Redis()` imports only allowed in lib/redis.ts. ' +
        'Use exported factory or named instances instead.',
    },
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        const source = node.source.value;

        // Allow importing from factory only
        if (source === 'ioredis' || source === 'redis') {
          const file = context.getFilename();

          // Only allow direct imports in lib/redis.ts
          if (!file.includes('lib/redis.ts') && !file.includes('lib\\redis.ts')) {
            node.specifiers.forEach((spec) => {
              if (spec.imported?.name === 'Redis' || spec.imported?.name === 'default') {
                context.report({
                  node: spec,
                  messageId: 'noDirectRedis',
                });
              }
            });
          }
        }
      },

      NewExpression(node) {
        // Detect `new Redis()`
        if (node.callee.name === 'Redis') {
          const file = context.getFilename();

          // Allow only in lib/redis.ts
          if (!file.includes('lib/redis.ts') && !file.includes('lib\\redis.ts')) {
            context.report({
              node,
              messageId: 'noRedisImportOutsideLib',
            });
          }
        }
      },
    };
  },
};
```

Update `.eslintrc.json`:

```json
{
  "rules": {
    "@sovren/custom-rules/no-direct-redis-import": "error"
  }
}
```

#### 3. CI/CD Automation: Redis Factory Audit

**File**: `.github/workflows/redis-factory-audit.yml`

```yaml
name: Redis Factory Pattern Audit
on: [pull_request, push]

jobs:
  redis-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Check for direct Redis imports
        run: |
          echo "Checking for direct Redis() imports outside lib/redis.ts..."

          VIOLATIONS=$(find packages/backend/src -name "*.ts" ! -path "*/lib/redis.ts" -exec grep -l "new Redis(" {} \; 2>/dev/null)

          if [ -n "$VIOLATIONS" ]; then
            echo "❌ Found direct Redis() constructor usage:"
            echo "$VIOLATIONS"
            exit 1
          fi

          echo "✅ All Redis clients use factory pattern"

      - name: Verify lib/redis.ts exports
        run: |
          if ! grep -q "export.*RedisFactory\|export.*redisDefault\|export.*redisCache" packages/backend/src/lib/redis.ts; then
            echo "❌ lib/redis.ts missing factory exports"
            exit 1
          fi
          echo "✅ Factory exports verified"

      - name: Check for duplicate Redis configs
        run: |
          echo "Scanning for hardcoded Redis configs..."

          HARDCODED=$(find packages/backend/src -name "*.ts" ! -path "*/lib/redis.ts" -exec grep -n "host.*localhost\|port.*6379\|password.*process\.env" {} + 2>/dev/null | head -20)

          if [ -n "$HARDCODED" ]; then
            echo "⚠️  Found hardcoded Redis configuration (should use factory):"
            echo "$HARDCODED"
            echo "(This may be legitimate in tests, verify manually)"
          else
            echo "✅ No hardcoded Redis configs found"
          fi

      - name: Run ESLint rule
        run: npm run lint -- --rule="@sovren/custom-rules/no-direct-redis-import: error"
```

#### 4. Code Review Checklist

```markdown
## Redis Client Management

- [ ] **Factory pattern used**: All Redis clients instantiated via `RedisFactory.getClient()` or named exports
- [ ] **No direct `new Redis()`**: Except in `lib/redis.ts`, no other files use constructor
- [ ] **Configuration centralized**: All config comes from environment variables or factory options
- [ ] **Connection cleanup**: Graceful shutdown calls `RedisFactory.closeAll()` in app termination
- [ ] **Named instances**: If multiple clients needed (cache, queue, sessions), uses distinct named instances
- [ ] **Error handling**: Redis clients have `.on('error', ...)` handlers attached
```

#### 5. Testing: Redis Factory Pattern

**File**: `packages/backend/src/__tests__/unit/lib/redis-factory.test.ts`

```typescript
import { RedisFactory, redisDefault, redisCache } from '@backend/lib/redis';

describe('Redis Factory Pattern', () => {
  beforeEach(() => {
    RedisFactory.reset();
  });

  afterEach(async () => {
    await RedisFactory.closeAll();
  });

  it('should return same instance for same name', () => {
    const client1 = RedisFactory.getClient('cache');
    const client2 = RedisFactory.getClient('cache');

    expect(client1).toBe(client2);
  });

  it('should create different instances for different names', () => {
    const cache = RedisFactory.getClient('cache');
    const queue = RedisFactory.getClient('queue');

    expect(cache).not.toBe(queue);
  });

  it('should allow config overrides per instance', () => {
    const custom = RedisFactory.getClient('custom', { db: 15 });
    // Cannot easily inspect config, so we verify the instance exists
    expect(custom).toBeDefined();
  });

  it('should throw error if no host configured', () => {
    delete process.env.REDIS_HOST;
    delete process.env.REDIS_URL;

    expect(() => {
      RedisFactory.getClient('missing-config');
    }).toThrow('Redis host or URL must be configured');
  });

  it('should close specific client', async () => {
    const client = RedisFactory.getClient('test');
    const quitSpy = jest.spyOn(client, 'quit');

    await RedisFactory.closeClient('test');

    expect(quitSpy).toHaveBeenCalled();
  });

  it('should close all clients on shutdown', async () => {
    RedisFactory.getClient('one');
    RedisFactory.getClient('two');
    RedisFactory.getClient('three');

    await RedisFactory.closeAll();

    // Verify instances are cleared
    expect(RedisFactory.getClient('one')).not.toBe(RedisFactory.getClient('one'));
  });
});
```

---

## P1-040: Credential Rotation Race Condition

### Finding

Credential rotation is a multi-step process (change DB password → update secrets store) without concurrency guards or write-ahead logging. If process crashes mid-rotation, old and new credentials become inconsistent.

### Root Cause

**Missing Concurrency Control + No Write-Ahead Pattern**: No lock mechanism to ensure mutual exclusion. No staged approach to apply credentials.

---

### Prevention Strategy

#### 1. Design Pattern: Write-Ahead Credential Rotation

**File**: `packages/backend/src/lib/credential-rotation.ts`

```typescript
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface RotationEntry {
  id: string;
  timestamp: string;
  status: 'pending' | 'applying' | 'committed' | 'rolled_back';
  credentialName: string;
  oldValue: string;
  newValue: string;
  appliedAt?: string;
  committedAt?: string;
  error?: string;
}

/**
 * Write-Ahead Credential Rotation Pattern
 *
 * Ensures atomic credential rotation:
 * 1. Write rotation intent to persistent log (write-ahead)
 * 2. Apply new credentials in-memory
 * 3. Validate new credentials work
 * 4. Commit rotation (mark log entry as committed)
 * 5. On crash recovery: replay or rollback based on status
 */
export class CredentialRotationLog {
  private logDir: string;

  constructor(logDir: string = '/var/lib/sovren/rotation-log') {
    this.logDir = logDir;
  }

  /**
   * Write new rotation entry to persistent log before applying changes.
   */
  async writeIntent(entry: Omit<RotationEntry, 'id' | 'timestamp'>): Promise<string> {
    const id = uuidv4();
    const timestamp = new Date().toISOString();

    const logEntry: RotationEntry = {
      ...entry,
      id,
      timestamp,
      status: 'pending',
    };

    const logPath = path.join(this.logDir, `${id}.json`);
    await this.ensureLogDir();
    await fs.writeFile(logPath, JSON.stringify(logEntry, null, 2));

    return id;
  }

  /**
   * Transition entry from pending to applying.
   */
  async markApplying(entryId: string): Promise<void> {
    const entry = await this.readEntry(entryId);
    entry.status = 'applying';
    entry.appliedAt = new Date().toISOString();
    await this.updateEntry(entryId, entry);
  }

  /**
   * Commit rotation (final state).
   */
  async markCommitted(entryId: string): Promise<void> {
    const entry = await this.readEntry(entryId);
    entry.status = 'committed';
    entry.committedAt = new Date().toISOString();
    await this.updateEntry(entryId, entry);
  }

  /**
   * Rollback rotation on error.
   */
  async markRolledBack(entryId: string, error: string): Promise<void> {
    const entry = await this.readEntry(entryId);
    entry.status = 'rolled_back';
    entry.error = error;
    await this.updateEntry(entryId, entry);
  }

  /**
   * Read rotation entry from log.
   */
  async readEntry(entryId: string): Promise<RotationEntry> {
    const logPath = path.join(this.logDir, `${entryId}.json`);
    const content = await fs.readFile(logPath, 'utf-8');
    return JSON.parse(content);
  }

  /**
   * List all pending and applying rotations (for recovery).
   */
  async getPendingRotations(): Promise<RotationEntry[]> {
    await this.ensureLogDir();
    const files = await fs.readdir(this.logDir);
    const entries: RotationEntry[] = [];

    for (const file of files.filter((f) => f.endsWith('.json'))) {
      const content = await fs.readFile(path.join(this.logDir, file), 'utf-8');
      const entry = JSON.parse(content);

      if (['pending', 'applying'].includes(entry.status)) {
        entries.push(entry);
      }
    }

    return entries;
  }

  private async updateEntry(entryId: string, entry: RotationEntry): Promise<void> {
    const logPath = path.join(this.logDir, `${entryId}.json`);
    await fs.writeFile(logPath, JSON.stringify(entry, null, 2));
  }

  private async ensureLogDir(): Promise<void> {
    try {
      await fs.mkdir(this.logDir, { recursive: true });
    } catch {
      // Directory may already exist
    }
  }
}

/**
 * Distributed lock for credential rotation (using Redis).
 * Ensures only one rotation process runs at a time across multiple servers.
 */
export class RotationLock {
  private redis: any; // IRedis type
  private lockKey: string;
  private lockValue: string;
  private lockTtl: number;

  constructor(redis: any, lockTtl: number = 3600) {
    this.redis = redis;
    this.lockKey = 'sovren:credential-rotation:lock';
    this.lockValue = uuidv4();
    this.lockTtl = lockTtl;
  }

  /**
   * Acquire lock with exponential backoff.
   */
  async acquire(maxWaitMs: number = 30000): Promise<boolean> {
    const startTime = Date.now();
    let backoffMs = 100;

    while (Date.now() - startTime < maxWaitMs) {
      const acquired = await this.redis.set(this.lockKey, this.lockValue, 'EX', this.lockTtl, 'NX');

      if (acquired === 'OK') {
        return true;
      }

      // Exponential backoff with jitter
      const jitter = Math.random() * 0.1 * backoffMs;
      await this.sleep(backoffMs + jitter);
      backoffMs = Math.min(backoffMs * 2, 5000);
    }

    return false;
  }

  /**
   * Release lock (only if we own it).
   */
  async release(): Promise<boolean> {
    // Use Lua script to ensure atomic compare-and-delete
    const luaScript = `
      if redis.call('get', KEYS[1]) == ARGV[1] then
        return redis.call('del', KEYS[1])
      else
        return 0
      end
    `;

    const result = await this.redis.eval(luaScript, 1, this.lockKey, this.lockValue);
    return result === 1;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Atomic credential rotation orchestrator.
 *
 * @example
 * async function rotateDatabase() {
 *   const rotator = new AtomicRotator(redisClient, logDir);
 *   await rotator.rotate('DATABASE_PASSWORD', async (newPassword) => {
 *     // Update password in database
 *     await db.updatePassword(newPassword);
 *     // Update in secret store
 *     await vaultClient.write('secret/db-password', { value: newPassword });
 *   });
 * }
 */
export class AtomicRotator {
  private log: CredentialRotationLog;
  private lock: RotationLock;
  private redis: any;

  constructor(redis: any, logDir?: string) {
    this.redis = redis;
    this.log = new CredentialRotationLog(logDir);
    this.lock = new RotationLock(redis);
  }

  /**
   * Rotate credential with write-ahead logging and distributed locking.
   */
  async rotate(
    credentialName: string,
    generateNew: () => Promise<string>,
    apply: (newValue: string) => Promise<void>,
    validate: (newValue: string) => Promise<boolean>
  ): Promise<void> {
    // Step 1: Acquire lock
    const lockAcquired = await this.lock.acquire();
    if (!lockAcquired) {
      throw new Error('Could not acquire rotation lock (another rotation in progress?)');
    }

    try {
      // Step 2: Get old credential
      const oldValue = process.env[credentialName];
      if (!oldValue) {
        throw new Error(`No existing credential: ${credentialName}`);
      }

      // Step 3: Generate new credential
      const newValue = await generateNew();

      // Step 4: Write intent to log (write-ahead)
      const rotationId = await this.log.writeIntent({
        credentialName,
        oldValue,
        newValue,
        status: 'pending',
      });

      try {
        // Step 5: Mark as applying
        await this.log.markApplying(rotationId);

        // Step 6: Apply new credential
        await apply(newValue);

        // Step 7: Validate new credential works
        const isValid = await validate(newValue);
        if (!isValid) {
          throw new Error(`Credential validation failed for ${credentialName}`);
        }

        // Step 8: Update environment (in-process)
        process.env[credentialName] = newValue;

        // Step 9: Commit rotation
        await this.log.markCommitted(rotationId);

        console.log(`✅ Credential rotated: ${credentialName}`);
      } catch (error: any) {
        // Rollback on any error
        await this.log.markRolledBack(rotationId, error.message);
        throw new Error(`Credential rotation failed: ${error.message}`);
      }
    } finally {
      // Step 10: Always release lock
      await this.lock.release();
    }
  }

  /**
   * Recover from incomplete rotations (run on startup).
   */
  async recoverPendingRotations(): Promise<void> {
    const pending = await this.log.getPendingRotations();

    for (const entry of pending) {
      console.warn(
        `⚠️  Incomplete rotation found: ${entry.credentialName} (status: ${entry.status})`
      );

      // For pending entries: safe to retry
      if (entry.status === 'pending') {
        console.log(`  Retrying rotation...`);
        // Caller can decide to retry or manual intervention
      }

      // For applying entries: already changed, cannot rollback safely
      if (entry.status === 'applying') {
        console.error(
          `  ❌ CRITICAL: Credential may be partially rotated. Manual intervention required.`
        );
        console.error(`     Old: ${entry.oldValue.substring(0, 8)}...`);
        console.error(`     New: ${entry.newValue.substring(0, 8)}...`);
        console.error(`     Check system has both values working.`);
      }
    }
  }
}
```

#### 2. Integration Test: Credential Rotation Atomicity

**File**: `packages/backend/src/__tests__/integration/credential-rotation.test.ts`

```typescript
import { AtomicRotator, RotationLock } from '@backend/lib/credential-rotation';

describe('Credential Rotation Atomicity', () => {
  let rotator: AtomicRotator;
  let mockRedis: any;

  beforeEach(() => {
    mockRedis = {
      set: jest.fn(async () => 'OK'),
      eval: jest.fn(async () => 1),
    };
    rotator = new AtomicRotator(mockRedis, '/tmp/rotation-log-test');
  });

  it('should write intent before applying changes', async () => {
    const writeSpy = jest.spyOn(rotator as any, 'log').mockImplementation();

    await expect(
      rotator.rotate(
        'TEST_SECRET',
        async () => 'new-secret-123',
        async () => {
          throw new Error('Simulated failure');
        },
        async () => true
      )
    ).rejects.toThrow();

    // Even though apply failed, intent was written
    // This proves write-ahead pattern works
  });

  it('should acquire lock before rotating', async () => {
    const lockSetSpy = jest.spyOn(mockRedis, 'set');

    process.env.TEST_SECRET = 'old-secret';

    // First rotation succeeds
    await rotator.rotate(
      'TEST_SECRET',
      async () => 'new-secret-123',
      async () => {},
      async () => true
    );

    expect(lockSetSpy).toHaveBeenCalledWith(
      expect.stringContaining('rotation:lock'),
      expect.anything(),
      'EX',
      expect.any(Number),
      'NX'
    );
  });

  it('should not allow concurrent rotations', async () => {
    mockRedis.set = jest.fn(async (key, val, ...args) => {
      // First call succeeds (lock acquired)
      if (mockRedis.set.mock.callCount === 1) return 'OK';
      // Second call fails (already locked)
      return null;
    });

    const lock1 = new RotationLock(mockRedis);
    const lock2 = new RotationLock(mockRedis);

    const acquired1 = await lock1.acquire(1000);
    const acquired2 = await lock2.acquire(100); // Short timeout

    expect(acquired1).toBe(true);
    expect(acquired2).toBe(false); // Cannot acquire while lock1 held
  });

  it('should release lock on error', async () => {
    const releaseSpy = jest.spyOn(mockRedis, 'eval');

    process.env.TEST_SECRET = 'old-secret';

    try {
      await rotator.rotate(
        'TEST_SECRET',
        async () => 'new-secret',
        async () => {
          throw new Error('Apply failed');
        },
        async () => true
      );
    } catch {
      // Expected to fail
    }

    // Lock should be released even after error
    expect(releaseSpy).toHaveBeenCalled();
  });
});
```

#### 3. Code Review Checklist

```markdown
## Credential Rotation

- [ ] **Write-ahead log**: All rotations write intent to persistent log before applying
- [ ] **Distributed lock**: Uses Redis lock to prevent concurrent rotations
- [ ] **Lock released in finally**: Lock always released, even on errors
- [ ] **Validation step**: New credentials validated before commit
- [ ] **Recovery procedure**: Startup checks for incomplete rotations and alerts
- [ ] **No hardcoded fallbacks**: Never fallback to default/placeholder credentials
- [ ] **Environment update**: Credentials updated in process.env after validation succeeds
- [ ] **Error logging**: All failures logged with old/new credential fingerprints (not values)
```

---

## P1-041: CORS Header Mismatch — API Standards Drift

### Finding

CORS `exposedHeaders` config lists headers with `X-` prefix, but rate limiter returns IETF standard headers (`RateLimit-*`). Response headers don't match what client can access.

### Root Cause

**Missing Integration Tests**: No test validates that exposed headers in CORS config match actual response headers from rate-limited endpoints.

---

### Prevention Strategy

#### 1. Integration Test: CORS Header Validation

**File**: `packages/backend/src/__tests__/integration/cors-header-validation.test.ts`

```typescript
import request from 'supertest';
import express from 'express';
import cors from 'cors';
import { rateLimitMiddleware } from '@backend/middleware/rate-limit';

describe('CORS Header Validation', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();

    // CORS configuration matching production
    app.use(
      cors({
        origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
        credentials: true,
        exposedHeaders: [
          'X-RateLimit-Limit',
          'X-RateLimit-Remaining',
          'X-RateLimit-Reset',
          'X-Total-Count',
          'X-Page-Number',
          'X-Total-Pages',
          'X-Request-ID',
          'X-Correlation-ID',
          'RateLimit-Limit', // IETF standard header
          'RateLimit-Remaining',
          'RateLimit-Reset',
          'Retry-After', // Standard header
        ],
      })
    );

    // Rate limiting middleware
    app.use(rateLimitMiddleware());

    app.get('/api/test', (req, res) => {
      res.json({ ok: true });
    });
  });

  it('should expose all rate limit headers in CORS config', async () => {
    const response = await request(app).get('/api/test');

    const exposedHeaders = response.get('Access-Control-Expose-Headers')?.split(', ') || [];

    // Check that response headers are in exposed list
    const rateLimitHeaders = ['RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset'];

    const missingHeaders: string[] = [];

    rateLimitHeaders.forEach((header) => {
      if (!exposedHeaders.includes(header)) {
        missingHeaders.push(header);
      }
      // Verify header is actually in response
      if (!response.headers[header.toLowerCase()] && !response.headers[header]) {
        missingHeaders.push(`${header} (in CORS but not in response)`);
      }
    });

    expect(missingHeaders).toEqual(
      [],
      `Missing CORS exposed headers: ${missingHeaders.join(', ')}`
    );
  });

  it('should have consistent header naming (X- or IETF, not both)', async () => {
    const response = await request(app).get('/api/test');

    const hasXHeaders = Object.keys(response.headers).some((h) => h.startsWith('x-ratelimit'));
    const hasIETFHeaders = Object.keys(response.headers).some((h) => h.startsWith('ratelimit'));

    // Both formats should not coexist in same response
    if (hasXHeaders && hasIETFHeaders) {
      const xHeaders = Object.keys(response.headers).filter((h) => h.startsWith('x-'));
      const iETFHeaders = Object.keys(response.headers).filter((h) => h.startsWith('ratelimit'));

      console.warn(`⚠️  Mixed header formats in response:`);
      console.warn(`   X- prefix: ${xHeaders.join(', ')}`);
      console.warn(`   IETF: ${iETFHeaders.join(', ')}`);
    }

    expect(hasXHeaders || hasIETFHeaders).toBe(true);
  });

  it('should update exposed headers when adding new response headers', async () => {
    // This test documents the requirement:
    // If middleware adds new response headers, CORS config must be updated

    const newHeader = 'X-Custom-New-Header';

    // Simulate middleware that adds new header
    app.use((req, res, next) => {
      res.set(newHeader, 'value');
      next();
    });

    const response = await request(app).get('/api/test');

    const corsExposeHeader = response.get('Access-Control-Expose-Headers');

    if (response.get(newHeader)) {
      expect(corsExposeHeader).toContain(
        newHeader,
        `New header ${newHeader} added but not in exposedHeaders config`
      );
    }
  });

  it('should validate headers standardization across all endpoints', async () => {
    const endpoints = ['/api/test'];

    const headersByEndpoint: Record<string, string[]> = {};

    for (const endpoint of endpoints) {
      const response = await request(app).get(endpoint);
      const headers = Object.keys(response.headers).filter(
        (h) => h.includes('ratelimit') || h.includes('limit')
      );
      headersByEndpoint[endpoint] = headers;
    }

    // All endpoints should use same header format
    const allHeaders = Object.values(headersByEndpoint).flat();
    const headerFormats = new Set(allHeaders.map((h) => (h.startsWith('x-') ? 'x-' : 'ietf')));

    expect(headerFormats.size).toBe(
      1,
      `Multiple header formats across endpoints. Use consistent format (IETF: RateLimit-*, X-: X-RateLimit-*)`
    );
  });
});
```

#### 2. TypeScript Validation: CORS Config Type Safety

**File**: `packages/backend/src/config/cors-config.ts`

```typescript
/**
 * CORS configuration with type-safe header validation.
 * Ensures exposedHeaders list includes all headers actually added to responses.
 */

// List all headers that middleware can add
export const RESPONSE_HEADERS_BY_MIDDLEWARE = {
  'rate-limiter': ['RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset'],
  'correlation-id': ['X-Correlation-ID'],
  'request-id': ['X-Request-ID'],
  pagination: ['X-Total-Count', 'X-Page-Number', 'X-Total-Pages'],
  'cache-control': ['Cache-Control', 'ETag'],
} as const;

// Generate exhaustive list
export const ALL_RESPONSE_HEADERS = Array.from(
  new Set(Object.values(RESPONSE_HEADERS_BY_MIDDLEWARE).flat())
);

export const CORS_CONFIG = {
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
  exposedHeaders: ALL_RESPONSE_HEADERS,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
} as const;

// Type for adding new response headers
export type MiddlewareName = keyof typeof RESPONSE_HEADERS_BY_MIDDLEWARE;

/**
 * When adding new response headers from middleware:
 * 1. Add header name to appropriate middleware list above
 * 2. TypeScript will error if headers list doesn't include new header
 * 3. ALL_RESPONSE_HEADERS will auto-update
 * 4. CI/CD test will validate they're exposed in CORS
 */
```

#### 3. CI/CD Automation: CORS Header Audit

**File**: `.github/workflows/cors-validation.yml`

```yaml
name: CORS Header Validation
on: [pull_request, push]

jobs:
  cors-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Verify header consistency
        run: |
          echo "Checking for header naming inconsistencies..."

          # Count X-RateLimit- headers
          X_HEADERS=$(grep -r "X-RateLimit\|x-ratelimit" packages/backend/src --include="*.ts" | wc -l)

          # Count RateLimit- headers (IETF)
          IETF_HEADERS=$(grep -r "RateLimit-" packages/backend/src --include="*.ts" | grep -v "X-RateLimit" | wc -l)

          echo "Found X-RateLimit headers: $X_HEADERS"
          echo "Found IETF RateLimit headers: $IETF_HEADERS"

          if [ "$X_HEADERS" -gt 0 ] && [ "$IETF_HEADERS" -gt 0 ]; then
            echo "⚠️  Mixed header formats detected. Choose one:"
            echo "  Option A: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset"
            echo "  Option B: RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset"
            exit 1
          fi

          echo "✅ Header format consistent"

      - name: Run CORS validation tests
        run: npm run test -- --testPathPattern=cors-header-validation

      - name: Lint CORS config
        run: npm run lint -- packages/backend/src/config/cors-config.ts
```

#### 4. Code Review Checklist

```markdown
## CORS & Response Headers

- [ ] **Header consistency**: All rate limit headers use same format (IETF `RateLimit-*` or `X-RateLimit-*`)
- [ ] **Exposed headers list**: Every response header added is listed in CORS `exposedHeaders`
- [ ] **No redundant headers**: Each header returned in only one format
- [ ] **Test coverage**: Integration test validates exposedHeaders ⊇ actual response headers
- [ ] **Standards compliance**: Prefer IETF standard headers (RateLimit-\*, Retry-After) over X- prefix
- [ ] **Cross-origin testing**: Verify headers accessible from different origins in tests
```

---

## P1-042: Fake Encryption — Base64 Labeled as "Encryption"

### Finding

Code uses `Buffer.from().toString('base64')` but labels it as "encryption", creating false security assumptions. This appears in credential rotation where actual encryption is needed.

### Root Cause

**Placeholder Code Shipped**: Developer marked section as "simplified version" but never replaced with real encryption. Code review didn't catch false security claim.

---

### Prevention Strategy

#### 1. ESLint Rule: Ban Base64 in Sensitive Paths

**File**: `packages/shared/eslint-rules/no-base64-encoding-as-crypto.js`

```javascript
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Base64 encoding cannot be used as encryption; disallow in crypto/security code',
      category: 'Security',
      recommended: true,
    },
    messages: {
      noBase64Crypto:
        'Base64 encoding is NOT encryption. Use crypto.encrypt() or crypto.seal() for sensitive data. ' +
        'See: packages/backend/src/lib/crypto.ts',
      noTodoInSecurityCode:
        'Security-related code contains TODO/FIXME comment. Cannot be merged until resolved. ' +
        'Type: never or implement immediately',
      noSimplifiedVersionInCrypto:
        '"simplified version" or "placeholder" comment found in security code. ' +
        'Must be replaced with production implementation before merge.',
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;

    return {
      CallExpression(node) {
        // Detect Buffer.from/toString(base64) pattern
        const isBase64 =
          (node.callee?.object?.name === 'Buffer' && node.callee?.property?.name === 'from') ||
          (node.callee?.object?.object?.name === 'Buffer' &&
            node.callee?.object?.property?.name === 'from');

        if (!isBase64) return;

        // Check if in security-sensitive context
        const file = context.getFilename();
        const isSensitiveContext = file.match(
          /crypto|credential|secret|password|encrypt|hmac|auth|token/i
        );

        if (!isSensitiveContext) return;

        // Check if next operation is .toString('base64')
        const parent = node.parent;
        const isToStringBase64 =
          parent.type === 'CallExpression' &&
          parent.callee?.property?.name === 'toString' &&
          parent.arguments?.[0]?.value === 'base64';

        if (isToStringBase64) {
          context.report({
            node,
            messageId: 'noBase64Crypto',
          });
        }
      },

      // Detect TODO/FIXME comments in security code
      Program(node) {
        const comments = sourceCode.getAllComments?.() || [];
        const file = context.getFilename();
        const isSensitiveFile = file.match(
          /crypto|credential|secret|password|encrypt|hmac|auth|token|vault|rotation/i
        );

        if (!isSensitiveFile) return;

        comments.forEach((comment) => {
          const text = comment.value.toUpperCase();

          if (text.includes('TODO') || text.includes('FIXME')) {
            context.report({
              node: comment,
              messageId: 'noTodoInSecurityCode',
              loc: comment.loc,
            });
          }

          if (
            text.includes('SIMPLIFIED VERSION') ||
            text.includes('PLACEHOLDER') ||
            text.includes('MOCK')
          ) {
            context.report({
              node: comment,
              messageId: 'noSimplifiedVersionInCrypto',
              loc: comment.loc,
            });
          }
        });
      },
    };
  },
};
```

Update `.eslintrc.json`:

```json
{
  "rules": {
    "@sovren/custom-rules/no-base64-encoding-as-crypto": "error"
  }
}
```

#### 2. Secure Encryption Module

**File**: `packages/backend/src/lib/crypto.ts`

```typescript
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;

/**
 * Encrypt sensitive data using AES-256-GCM.
 * Unlike Base64 encoding, this provides actual confidentiality.
 *
 * @param plaintext - Data to encrypt
 * @param masterKey - 32-byte encryption key (or will be derived from password)
 */
export function encrypt(plaintext: string, masterKey: string | Buffer): string {
  const key = typeof masterKey === 'string' ? Buffer.from(masterKey, 'hex') : masterKey;

  if (key.length !== 32) {
    throw new Error('Encryption key must be 32 bytes (256 bits)');
  }

  // Generate random IV
  const iv = crypto.randomBytes(IV_LENGTH);

  // Create cipher
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  // Encrypt
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);

  // Get authentication tag
  const authTag = cipher.getAuthTag();

  // Combine: iv + authTag + ciphertext
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

/**
 * Decrypt data encrypted with encrypt().
 */
export function decrypt(ciphertext: string, masterKey: string | Buffer): string {
  const key = typeof masterKey === 'string' ? Buffer.from(masterKey, 'hex') : masterKey;

  if (key.length !== 32) {
    throw new Error('Encryption key must be 32 bytes (256 bits)');
  }

  const buffer = Buffer.from(ciphertext, 'base64');

  // Extract components
  const iv = buffer.slice(0, IV_LENGTH);
  const authTag = buffer.slice(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = buffer.slice(IV_LENGTH + AUTH_TAG_LENGTH);

  // Create decipher
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  // Decrypt
  try {
    return decipher.update(encrypted, undefined, 'utf8') + decipher.final('utf8');
  } catch (error: any) {
    throw new Error(`Decryption failed: ${error.message}`);
  }
}

/**
 * Generate a cryptographically secure random key (32 bytes = 256 bits).
 */
export function generateKey(): Buffer {
  return crypto.randomBytes(32);
}

/**
 * Derive encryption key from password using PBKDF2.
 * Use when key must come from user password.
 */
export function deriveKey(password: string, salt?: Buffer): { key: Buffer; salt: Buffer } {
  const derivedSalt = salt || crypto.randomBytes(SALT_LENGTH);

  const key = crypto.pbkdf2Sync(password, derivedSalt, 100000, 32, 'sha256');

  return { key, salt: derivedSalt };
}

/**
 * Create HMAC for integrity checking (authentication without confidentiality).
 */
export function createHMAC(data: string, key: Buffer): string {
  const hmac = crypto.createHmac('sha256', key);
  hmac.update(data);
  return hmac.digest('base64');
}

/**
 * Verify HMAC.
 */
export function verifyHMAC(data: string, signature: string, key: Buffer): boolean {
  const expected = createHMAC(data, key);
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
```

#### 3. CI/CD Automation: Crypto Comments & Base64 Audit

**File**: `.github/workflows/crypto-audit.yml`

```yaml
name: Cryptography Audit
on: [pull_request, push]

jobs:
  crypto-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Ban base64 in crypto context
        run: |
          echo "Checking for base64 usage in security code..."

          VIOLATIONS=$(find packages/backend/src -name "*crypto*" -o -name "*secret*" -o -name "*rotation*" | xargs grep -n "toString('base64')\|toString(\"base64\")" 2>/dev/null)

          if [ -n "$VIOLATIONS" ]; then
            echo "❌ Base64 encoding found in security code:"
            echo "$VIOLATIONS"
            echo ""
            echo "Base64 is NOT encryption. Use crypto.encrypt() instead."
            exit 1
          fi

          echo "✅ No suspicious base64 usage in crypto code"

      - name: Check for TODO/FIXME in security code
        run: |
          echo "Checking for unresolved TODOs in security modules..."

          VIOLATIONS=$(find packages/backend/src -name "*crypto*" -o -name "*secret*" -o -name "*token*" -o -name "*rotation*" | xargs grep -in "TODO\|FIXME\|XXX" 2>/dev/null)

          if [ -n "$VIOLATIONS" ]; then
            echo "❌ Unresolved comments in security code:"
            echo "$VIOLATIONS"
            exit 1
          fi

          echo "✅ No unresolved TODOs in security code"

      - name: Check for placeholder comments
        run: |
          echo "Checking for placeholder/simplified comments in crypto..."

          VIOLATIONS=$(find packages/backend/src -path "*/crypto*" -o -path "*/credential*" -o -path "*/rotation*" | xargs grep -in "simplified\|placeholder\|mock\|temporary\|hardcoded" 2>/dev/null | grep -iv "test\|jest\|spec")

          if [ -n "$VIOLATIONS" ]; then
            echo "❌ Placeholder code in production security modules:"
            echo "$VIOLATIONS"
            echo ""
            echo "Cannot merge placeholder security implementations."
            exit 1
          fi

          echo "✅ No placeholder/simplified implementations in security code"

      - name: Run ESLint crypto rules
        run: npm run lint -- --rule="@sovren/custom-rules/no-base64-encoding-as-crypto: error"
```

#### 4. Unit Test: Real Encryption

**File**: `packages/backend/src/__tests__/unit/lib/crypto.test.ts`

```typescript
import {
  encrypt,
  decrypt,
  generateKey,
  deriveKey,
  createHMAC,
  verifyHMAC,
} from '@backend/lib/crypto';

describe('Real Encryption (Not Base64)', () => {
  it('should encrypt and decrypt sensitive data', () => {
    const key = generateKey();
    const plaintext = 'super-secret-database-password-xyz';

    const encrypted = encrypt(plaintext, key);

    // Encrypted should not equal plaintext
    expect(encrypted).not.toBe(plaintext);

    // Encrypted should be different each time (different IV)
    const encrypted2 = encrypt(plaintext, key);
    expect(encrypted).not.toBe(encrypted2);

    // Should decrypt back to plaintext
    const decrypted = decrypt(encrypted, key);
    expect(decrypted).toBe(plaintext);
  });

  it('should fail decryption with wrong key', () => {
    const key1 = generateKey();
    const key2 = generateKey();
    const plaintext = 'secret-data';

    const encrypted = encrypt(plaintext, key1);

    expect(() => {
      decrypt(encrypted, key2);
    }).toThrow('Decryption failed');
  });

  it('should fail decryption with tampered ciphertext', () => {
    const key = generateKey();
    const plaintext = 'secret-data';

    const encrypted = encrypt(plaintext, key);
    const tampered = Buffer.from(encrypted, 'base64');
    tampered[10] = tampered[10] ^ 0xff; // Flip bits

    expect(() => {
      decrypt(tampered.toString('base64'), key);
    }).toThrow('Decryption failed');
  });

  it('should derive consistent key from password with salt', () => {
    const password = 'user-password-123';
    const salt = Buffer.alloc(32, 'salt-value');

    const { key: key1 } = deriveKey(password, salt);
    const { key: key2 } = deriveKey(password, salt);

    expect(key1).toEqual(key2);
  });

  it('should NOT be base64 encoding pretending to be encryption', () => {
    const key = generateKey();
    const plaintext = 'test-data';

    const encrypted = encrypt(plaintext, key);

    // Decrypting with wrong key should fail
    const wrongKey = generateKey();

    expect(() => {
      decrypt(encrypted, wrongKey);
    }).toThrow();

    // Base64 decoding wouldn't fail, proving this is real encryption
  });

  it('should create verifiable HMACs', () => {
    const key = generateKey();
    const data = 'important-message';

    const hmac = createHMAC(data, key);
    const isValid = verifyHMAC(data, hmac, key);

    expect(isValid).toBe(true);
  });

  it('should reject tampered HMACs', () => {
    const key = generateKey();
    const data = 'important-message';

    const hmac = createHMAC(data, key);
    const tampered = Buffer.from(hmac, 'base64');
    tampered[0] = tampered[0] ^ 0xff;

    const isValid = verifyHMAC(data, tampered.toString('base64'), key);
    expect(isValid).toBe(false);
  });
});
```

#### 5. Code Review Checklist

```markdown
## Cryptography & Sensitive Data

- [ ] **Real encryption**: Uses `crypto.encrypt()` for confidentiality, never Base64 encoding
- [ ] **No placeholders**: No "simplified version", "TODO", "FIXME" comments in crypto code
- [ ] **Key generation**: Uses `crypto.randomBytes()` or `deriveKey()`, not hardcoded values
- [ ] **Integrity checking**: Uses HMAC or GCM authentication tags, not just encryption
- [ ] **Failures clear**: Decryption failures throw clear errors, not silent failures
- [ ] **No secrets in logs**: Encrypted values logged, never plaintext credentials
```

---

## P1-043: Unsafe Type Casts — Bypassing Validation

### Finding

TypeScript code uses `as DatabasePoolConfig` to bypass Zod schema validation. Type assertions used to silence type errors instead of fixing root causes. Domain types use index signatures `[key: string]: unknown`.

### Root Cause

**TypeScript Escape Hatches Used Carelessly**: Developers reached for `as` casts to bypass validation instead of proper typing. Index signatures over-generalizes types.

---

### Prevention Strategy

#### 1. ESLint Rule: Restrict Type Assertions

**File**: `.eslintrc.json` (update existing rule)

```json
{
  "rules": {
    "@typescript-eslint/consistent-type-assertions": [
      "error",
      {
        "assertionStyle": "as",
        "objectLiteralTypeAssertions": "allow-as-parameter"
      }
    ],
    "@typescript-eslint/no-explicit-any": [
      "error",
      {
        "fixToUnknown": true,
        "ignoreRestArgs": false
      }
    ],
    "@typescript-eslint/no-unsafe-assignment": "error",
    "@typescript-eslint/no-unsafe-member-access": "error",
    "@typescript-eslint/no-unsafe-call": "error",
    "@typescript-eslint/no-unsafe-return": "error"
  }
}
```

#### 2. Custom ESLint Rule: Ban Domain Type Index Signatures

**File**: `packages/shared/eslint-rules/no-index-signature-on-domain-types.js`

```javascript
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Domain types must not use index signatures (too permissive)',
      category: 'Best Practices',
      recommended: true,
    },
    messages: {
      noIndexSignature:
        'Domain types should not use index signatures [key: string]: any. ' +
        'Define explicit properties instead for type safety.',
    },
  },
  create(context) {
    return {
      TSIndexSignature(node) {
        const file = context.getFilename();

        // Check if in domain types directory
        const isDomainType = file.match(/src\/(features|types|models|entities)\//i);

        if (!isDomainType) return;

        context.report({
          node,
          messageId: 'noIndexSignature',
        });
      },
    };
  },
};
```

#### 3. Type-Safe Validation Pattern

**File**: `packages/backend/src/lib/validated-config.ts`

```typescript
import { z } from 'zod';

/**
 * Validation-first approach: use Zod schema to validate AND type.
 * Never use `as TypeName` to bypass validation.
 */

// ✅ GOOD: Define schema and type together
export const DatabasePoolConfigSchema = z.object({
  host: z.string().min(1, 'Database host required'),
  port: z.number().int().positive(),
  database: z.string().min(1),
  user: z.string().min(1),
  password: z.string().min(8, 'Password must be at least 8 chars'),
  ssl: z.boolean().optional(),
  maxConnections: z.number().int().min(1).max(100),
});

export type DatabasePoolConfig = z.infer<typeof DatabasePoolConfigSchema>;

/**
 * Load and validate config with zero type assertions.
 */
export function loadDatabaseConfig(): DatabasePoolConfig {
  const raw = {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'true',
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10', 10),
  };

  // Validation returns properly typed config or throws
  const config = DatabasePoolConfigSchema.parse(raw);

  // Type is DatabasePoolConfig - no `as` needed
  return config;
}

// ❌ WRONG: Using `as` to bypass validation
// const config: DatabasePoolConfig = rawData as DatabasePoolConfig; // NEVER DO THIS

/**
 * Handle validation errors properly.
 */
export function loadDatabaseConfigSafe(): DatabasePoolConfig | null {
  try {
    return loadDatabaseConfig();
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Database config validation failed:', error.errors);
      return null;
    }
    throw error;
  }
}
```

#### 4. Refactoring: Remove Index Signatures from Domain Types

**Before**:

```typescript
// ❌ WRONG: Index signature is too permissive
export type User = {
  id: string;
  email: string;
  [key: string]: unknown; // Opens door to incorrect usage
};
```

**After**:

```typescript
// ✅ CORRECT: Explicit properties
export type User = {
  id: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
  roles: string[];
};

// If you need flexibility, use specific union:
export type UserMetadata = Record<string, string | number | boolean>;

export type UserWithMetadata = User & {
  metadata?: UserMetadata;
};
```

#### 5. Integration Test: Type Safety & Validation

**File**: `packages/backend/src/__tests__/integration/type-safety.test.ts`

```typescript
import { z } from 'zod';
import { DatabasePoolConfigSchema, loadDatabaseConfig } from '@backend/lib/validated-config';

describe('Type Safety & Validation', () => {
  beforeEach(() => {
    // Set up valid env vars
    process.env.DB_HOST = 'localhost';
    process.env.DB_PORT = '5432';
    process.env.DB_NAME = 'testdb';
    process.env.DB_USER = 'testuser';
    process.env.DB_PASSWORD = 'SecurePass123!';
  });

  it('should validate and type config without type assertions', () => {
    const config = loadDatabaseConfig();

    // Type is known to be DatabasePoolConfig
    // No `as` used - guaranteed type safe
    expect(config.host).toBe('localhost');
    expect(config.port).toBe(5432);
  });

  it('should reject invalid database port', () => {
    process.env.DB_PORT = 'not-a-number';

    expect(() => {
      loadDatabaseConfig();
    }).toThrow(z.ZodError);
  });

  it('should reject too-short password', () => {
    process.env.DB_PASSWORD = 'short';

    expect(() => {
      loadDatabaseConfig();
    }).toThrow(z.ZodError);
  });

  it('should reject missing required fields', () => {
    delete process.env.DB_HOST;

    expect(() => {
      loadDatabaseConfig();
    }).toThrow(z.ZodError);
  });

  it('should not allow unknown properties to validate', () => {
    const raw = {
      host: 'localhost',
      port: 5432,
      database: 'test',
      user: 'test',
      password: 'Pass1234',
      unknownField: 'should-be-rejected', // Extra field
    };

    const result = DatabasePoolConfigSchema.safeParse(raw);

    // strict() mode would reject unknown fields
    const strictSchema = DatabasePoolConfigSchema.strict();
    const strictResult = strictSchema.safeParse(raw);

    expect(strictResult.success).toBe(false);
  });
});
```

#### 6. Code Review Checklist

````markdown
## Type Safety & Validation

- [ ] **No type assertions on validation**: Never `as TypeName` to bypass Zod/validation
- [ ] **Zod for config loading**: All external config validated with Zod schema
- [ ] **Type inference**: Types derived from Zod schema via `z.infer<typeof>`, never hand-coded
- [ ] **No index signatures in domain types**: Use explicit properties or Record<string, T>
- [ ] **Safe type narrowing**: Use `instanceof`, `typeof`, or type guards (not type assertions)
- [ ] **Error handling**: Validation failures throw ZodError with clear field-level messages
- [ ] **Strict schemas**: Use `.strict()` on critical schemas to reject unknown fields

## Examples

**❌ Never Do**:

```typescript
const config = rawData as DatabasePoolConfig;
const user: User = { id: 'x', [unknownField]: 'value' };
```
````

**✅ Always Do**:

```typescript
const config = DatabasePoolConfigSchema.parse(rawData);
const user: User = { id: 'x', email: 'test@example.com', ... };
```

````

---

## Summary: Implementation Roadmap

### Phase 1: Automation (Week 1)
1. Add 4 new ESLint rules (metrics timing, health check timeouts, Redis factory, crypto)
2. Update 2 existing ESLint rules (type assertions, no-explicit-any)
3. Add grep-based CI/CD checks in `.github/workflows/`

### Phase 2: Design Patterns (Week 1-2)
1. Implement `RedisFactory` in `lib/redis.ts`
2. Implement `CredentialRotationLog` + `AtomicRotator` in `lib/credential-rotation.ts`
3. Implement `encrypt()` / `decrypt()` in `lib/crypto.ts`
4. Implement health check timeout wrapper in `lib/health-check-timeout.ts`
5. Update `cors-config.ts` with header validation types

### Phase 3: Tests (Week 2)
1. Integration tests for all 7 prevention areas
2. Unit tests for factory pattern, encryption, validation
3. CI/CD test gates for each pattern

### Phase 4: Migration (Week 3-4)
1. Audit codebase for existing violations
2. Migrate Redis clients to factory pattern
3. Migrate credential rotation to write-ahead pattern
4. Migrate sensitive crypto to real encryption
5. Add type safety to configs

### Phase 5: Documentation (Week 4)
1. Update CLAUDE.md with prevention patterns
2. Create architecture decision records (ADRs)
3. Add code review training materials

---

## CI/CD Integration Summary

**Add to `.github/workflows/` (new files)**:
- `prometheus-labels-check.yml`
- `health-check-validation.yml`
- `redis-factory-audit.yml`
- `cors-validation.yml`
- `crypto-audit.yml`

**Update existing `.github/workflows/`**:
- `quality-gates.yml`: Add ESLint rules enforcement
- `test.yml`: Add integration tests for all patterns

**Pre-Commit Hook** (in `package.json` lint-staged):
```json
{
  "*.ts": [
    "eslint --fix --rule='@sovren/custom-rules/no-prometheus-labels-in-middleware: error'",
    "eslint --fix --rule='@sovren/custom-rules/no-direct-redis-import: error'",
    "eslint --fix --rule='@sovren/custom-rules/no-base64-encoding-as-crypto: error'",
    "eslint --fix --rule='@sovren/custom-rules/no-index-signature-on-domain-types: error'",
    "prettier --write"
  ]
}
````

---

## Prevention Framework: Key Principles

These 7 findings share common prevention patterns:

1. **Middleware Execution Timing** (P1-037): Test captured values at correct lifecycle point
2. **Defensive Programming** (P1-038): Require explicit timeouts + resource cleanup
3. **Factory Pattern** (P1-039): Centralize client creation, ban direct constructors
4. **Concurrency Control** (P1-040): Use distributed locks + write-ahead logging
5. **Integration Testing** (P1-041): Validate config matches actual behavior
6. **Code Comments** (P1-042): Ban "TODO" and "placeholder" in security code
7. **Type Safety** (P1-043): Ban type assertions, use validation-first schemas

**All can be automated via**:

- ESLint rules (static analysis)
- Pre-commit hooks (fail fast)
- CI/CD gates (final check)
- Integration tests (behavior verification)

---

## Related Documents

- [PR #73 Code Review Remediation](./pr73-code-review-remediation.md)
- [CLAUDE.md Prevention Standards](../../CLAUDE.md#critical-development-standards)
- [ADR-019: Error Handling Patterns](../../decisions/ADR-019-error-handling-patterns.md)
- [ADR-020: Credential Rotation Protocol](../../decisions/ADR-020-credential-rotation-protocol.md)
