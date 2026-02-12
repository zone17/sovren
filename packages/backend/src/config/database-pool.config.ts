import { z } from 'zod';
import { DatabasePoolConfig } from '../database/pool';

/**
 * 🔧 Database Pool Configuration
 *
 * Production-ready PostgreSQL pool configuration with:
 * - **Type Safety**: Zod schema validation
 * - **Environment-Specific**: Optimized settings per environment
 * - **Security**: SSL configuration for production
 * - **Observability**: Query logging and performance tracking
 *
 * WHY: Centralized configuration ensures consistent pool behavior
 * across the application and makes tuning easier.
 */

// 🔒 SSL Configuration Schema
const SSLConfigSchema = z.union([
  z.boolean(),
  z.object({
    rejectUnauthorized: z.boolean().default(true),
    ca: z.string().optional(),
    key: z.string().optional(),
    cert: z.string().optional(),
  }),
]);

// 🔧 Pool Configuration Schema
const PoolConfigSchema = z.object({
  // Connection
  connectionString: z.string().url().optional(),
  host: z.string().optional(),
  port: z.number().int().min(1).max(65535).default(5432),
  database: z.string().optional(),
  user: z.string().optional(),
  password: z.string().optional(),

  // Pool sizing
  max: z.number().int().min(1).max(100).default(20),
  min: z.number().int().min(0).max(50).default(5),

  // Timeouts (milliseconds)
  idleTimeoutMillis: z.number().int().min(0).max(600000).default(30000),
  connectionTimeoutMillis: z.number().int().min(0).max(60000).default(2000),
  statementTimeout: z.number().int().min(0).max(600000).default(30000),
  queryTimeout: z.number().int().min(0).max(600000).default(30000),

  // Connection behavior
  allowExitOnIdle: z.boolean().default(false),
  keepAlive: z.boolean().default(true),
  keepAliveInitialDelayMillis: z.number().int().min(0).max(60000).default(10000),

  // Security
  ssl: SSLConfigSchema.optional(),
});

export type ValidatedPoolConfig = z.infer<typeof PoolConfigSchema>;

/**
 * 🏭 Environment-Specific Pool Configurations
 *
 * WHY: Different environments have different scale and performance needs
 *
 * **Development**:
 * - Smaller pool (10 connections)
 * - Faster timeouts for quick feedback
 * - No SSL required
 *
 * **Test**:
 * - Minimal pool (5 connections)
 * - Short timeouts for fast test execution
 * - In-memory or local database
 *
 * **Production**:
 * - Larger pool (20 connections)
 * - Conservative timeouts
 * - SSL required
 * - Connection keep-alive
 */
export const POOL_CONFIGS: Record<string, Partial<ValidatedPoolConfig>> = {
  development: {
    max: 10,
    min: 2,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000,
    statementTimeout: 60000,
    queryTimeout: 60000,
    allowExitOnIdle: true,
    keepAlive: false,
    ssl: false,
  },

  test: {
    max: 5,
    min: 1,
    idleTimeoutMillis: 1000,
    connectionTimeoutMillis: 2000,
    statementTimeout: 10000,
    queryTimeout: 10000,
    allowExitOnIdle: true,
    keepAlive: false,
    ssl: false,
  },

  staging: {
    max: 15,
    min: 3,
    idleTimeoutMillis: 20000,
    connectionTimeoutMillis: 3000,
    statementTimeout: 45000,
    queryTimeout: 45000,
    allowExitOnIdle: false,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
    ssl: {
      rejectUnauthorized: true,
    },
  },

  production: {
    max: 20,
    min: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
    statementTimeout: 30000,
    queryTimeout: 30000,
    allowExitOnIdle: false,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
    ssl: {
      rejectUnauthorized: true,
    },
  },
};

/**
 * 📊 Pool Size Calculator
 *
 * WHY: Optimal pool size depends on workload characteristics
 *
 * Formula: connections = ((core_count * 2) + effective_spindle_count)
 * Source: HikariCP documentation
 *
 * For CPU-bound workloads: core_count * 2
 * For I/O-bound workloads: core_count * 4
 *
 * @param cores - Number of CPU cores
 * @param workloadType - Type of workload (cpu or io)
 * @returns Recommended pool size
 */
export function calculateOptimalPoolSize(
  cores: number = 4,
  workloadType: 'cpu' | 'io' = 'io'
): { max: number; min: number } {
  const multiplier = workloadType === 'cpu' ? 2 : 4;
  const max = cores * multiplier;
  const min = Math.max(2, Math.floor(max * 0.25));

  return { max, min };
}

/**
 * 🏗️ Create Database Pool Configuration
 *
 * Merges environment-specific defaults with user overrides
 * and validates the final configuration.
 *
 * Environment variable priority:
 * 1. DATABASE_URL (full connection string)
 * 2. Individual PG_* variables
 * 3. Config file defaults
 *
 * @example
 * ```typescript
 * // Use defaults for current environment
 * const config = createPoolConfig();
 *
 * // Override specific settings
 * const config = createPoolConfig({ max: 30 });
 *
 * // Use custom environment
 * const config = createPoolConfig({}, 'staging');
 * ```
 */
export function createPoolConfig(
  overrides?: Partial<DatabasePoolConfig>,
  environment?: string
): DatabasePoolConfig {
  const env = environment || process.env.NODE_ENV || 'development';

  // Get environment-specific defaults
  const envDefaults = POOL_CONFIGS[env] || POOL_CONFIGS.development;

  // Build configuration from environment variables
  const envConfig: Partial<ValidatedPoolConfig> = {};

  // Connection string takes precedence
  if (process.env.DATABASE_URL) {
    envConfig.connectionString = process.env.DATABASE_URL;
  } else {
    // Individual connection parameters
    if (process.env.PGHOST) envConfig.host = process.env.PGHOST;
    if (process.env.PGPORT) envConfig.port = parseInt(process.env.PGPORT, 10);
    if (process.env.PGDATABASE) envConfig.database = process.env.PGDATABASE;
    if (process.env.PGUSER) envConfig.user = process.env.PGUSER;
    if (process.env.PGPASSWORD) envConfig.password = process.env.PGPASSWORD;
  }

  // Pool size overrides
  if (process.env.DB_POOL_MAX) {
    envConfig.max = parseInt(process.env.DB_POOL_MAX, 10);
  }
  if (process.env.DB_POOL_MIN) {
    envConfig.min = parseInt(process.env.DB_POOL_MIN, 10);
  }

  // Timeout overrides
  if (process.env.DB_IDLE_TIMEOUT) {
    envConfig.idleTimeoutMillis = parseInt(process.env.DB_IDLE_TIMEOUT, 10);
  }
  if (process.env.DB_CONNECTION_TIMEOUT) {
    envConfig.connectionTimeoutMillis = parseInt(process.env.DB_CONNECTION_TIMEOUT, 10);
  }
  if (process.env.DB_STATEMENT_TIMEOUT) {
    envConfig.statementTimeout = parseInt(process.env.DB_STATEMENT_TIMEOUT, 10);
  }

  // SSL configuration
  if (process.env.DB_SSL === 'true') {
    envConfig.ssl = {
      rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
    };
  } else if (process.env.DB_SSL === 'false') {
    envConfig.ssl = false;
  }

  // Merge configurations (priority: overrides > env vars > env defaults)
  const mergedConfig = {
    ...envDefaults,
    ...envConfig,
    ...overrides,
  };

  // Validate configuration
  try {
    const validated = PoolConfigSchema.parse(mergedConfig);
    return validated as DatabasePoolConfig;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.errors.map((err) => `${err.path.join('.')}: ${err.message}`).join(', ');

      throw new Error(
        `Database pool configuration error: ${issues}. ` +
          'Please check your environment variables and configuration.'
      );
    }
    throw error;
  }
}

/**
 * 🔍 Get Connection String
 *
 * Builds PostgreSQL connection string from configuration
 *
 * WHY: Some tools require connection strings (e.g., migrations, CLI tools)
 */
export function getConnectionString(config: ValidatedPoolConfig): string {
  if (config.connectionString) {
    return config.connectionString;
  }

  if (!config.host || !config.database || !config.user || !config.password) {
    throw new Error(
      'Cannot build connection string: missing required parameters ' +
        '(host, database, user, password)'
    );
  }

  const { host, port, database, user, password, ssl } = config;

  let connectionString = `postgresql://${user}:${password}@${host}:${port}/${database}`;

  // Add SSL parameter if needed
  if (ssl) {
    connectionString += '?sslmode=require';
  } else {
    connectionString += '?sslmode=disable';
  }

  return connectionString;
}

/**
 * 📈 Pool Performance Recommendations
 *
 * WHY: Provides guidance for tuning pool based on observed metrics
 */
export function getPoolRecommendations(metrics: {
  averageWaitTime: number;
  maxWaitTime: number;
  waitingRequests: number;
  idleConnections: number;
  errorRate: number;
}): string[] {
  const recommendations: string[] = [];

  // High wait times indicate insufficient pool size
  if (metrics.averageWaitTime > 100) {
    recommendations.push(
      `High average wait time (${metrics.averageWaitTime}ms). ` +
        'Consider increasing pool size (max) or optimizing queries.'
    );
  }

  // Consistent waiting requests indicate pool saturation
  if (metrics.waitingRequests > 5) {
    recommendations.push(
      `${metrics.waitingRequests} requests waiting for connections. ` +
        'Pool is saturated. Increase max pool size.'
    );
  }

  // Many idle connections indicate over-provisioned pool
  if (metrics.idleConnections > 10) {
    recommendations.push(
      `${metrics.idleConnections} idle connections. ` +
        'Consider reducing min pool size to free resources.'
    );
  }

  // High error rate indicates database or network issues
  if (metrics.errorRate > 5) {
    recommendations.push(
      `High error rate (${metrics.errorRate.toFixed(2)}%). ` +
        'Check database health, network connectivity, and query validity.'
    );
  }

  // Extreme wait times indicate serious issues
  if (metrics.maxWaitTime > 5000) {
    recommendations.push(
      `Maximum wait time of ${metrics.maxWaitTime}ms is critical. ` +
        'Immediate action required: investigate query performance or database capacity.'
    );
  }

  return recommendations;
}
