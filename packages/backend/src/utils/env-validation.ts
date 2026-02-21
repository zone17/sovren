import { z } from 'zod';

/**
 * 🔧 Environment Validation Utility
 * Validates and sanitizes environment variables with Docker-specific optimizations
 * Implements elite security standards with comprehensive validation
 */

const stringToNumber = (defaultValue: string) =>
  z.string().optional().default(defaultValue).transform(Number);

const stringToBoolean = (defaultValue: string) =>
  z
    .string()
    .optional()
    .default(defaultValue)
    .transform((val) => val === 'true');

const stringToArray = (defaultValue: string) =>
  z
    .string()
    .optional()
    .default(defaultValue)
    .transform((val) => val.split(',').map((item) => item.trim()));

// Core environment schema with proper defaults
const envSchema = z.object({
  // Core configuration
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: stringToNumber('3001'),
  HOST: z.string().default('0.0.0.0'),

  // Application metadata
  APP_VERSION: z.string().default('1.0.0-dev'),
  BUILD_TIMESTAMP: z.string().optional(),

  // Database configuration
  SUPABASE_URL: z.string().url('Invalid Supabase URL'),
  SUPABASE_ANON_KEY: z.string().min(1, 'Supabase anonymous key is required'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'Supabase service role key is required'),

  // Security configuration
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  JWT_ALGORITHM: z.enum(['HS256', 'HS384', 'HS512']).default('HS256'),

  SESSION_SECRET: z.string().min(32, 'Session secret must be at least 32 characters'),
  SESSION_MAX_AGE: stringToNumber('604800'),

  ENCRYPTION_KEY: z.string().min(32, 'Encryption key must be at least 32 characters'),

  // Platform token & BYOK encryption keys (C-5: must be separate keys)
  // Used by PlatformConnectionService (OAuth tokens) and InboxPollingService (BYOK API keys)
  PLATFORM_TOKEN_ENCRYPTION_KEY: z
    .string()
    .regex(
      /^[0-9a-f]{64}$/i,
      'PLATFORM_TOKEN_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)'
    )
    .optional(),
  BYOK_ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-f]{64}$/i, 'BYOK_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)')
    .optional(),

  // Lightning Network configuration
  LIGHTNING_NETWORK: z.enum(['mainnet', 'testnet', 'regtest']).default('testnet'),
  LIGHTNING_MIN_AMOUNT: stringToNumber('1000'),
  LIGHTNING_MAX_AMOUNT: stringToNumber('100000000'),

  LNBITS_API_URL: z.string().url().optional(),
  LNBITS_ADMIN_KEY: z.string().optional(),
  LNBITS_INVOICE_READ_KEY: z.string().optional(),
  LNBITS_WEBHOOK_SECRET: z.string().optional(),

  LIGHTNING_ADDRESS_DOMAIN: z.string().default('localhost'),
  ENABLE_LIGHTNING_ADDRESSES: stringToBoolean('true'),

  // NOSTR configuration
  NOSTR_RELAYS: stringToArray('wss://relay.damus.io,wss://nos.lol,wss://relay.snort.social'),
  NOSTR_AUTO_CONNECT: stringToBoolean('true'),
  NOSTR_CONNECTION_TIMEOUT: stringToNumber('5000'),
  NOSTR_MAX_RELAYS: stringToNumber('10'),
  NOSTR_CACHE_TTL: stringToNumber('300000'),
  NOSTR_EVENT_TTL: stringToNumber('86400'),
  NOSTR_MAX_EVENT_SIZE: stringToNumber('65536'),

  // Feature flags
  FEATURE_LIGHTNING_PAYMENTS: stringToBoolean('true'),
  FEATURE_NOSTR_PUBLISHING: stringToBoolean('true'),
  FEATURE_AI_CONTENT_GENERATION: stringToBoolean('true'),
  FEATURE_CONTENT_MONETIZATION: stringToBoolean('true'),
  FEATURE_PREMIUM_SUBSCRIPTIONS: stringToBoolean('true'),
  FEATURE_REALTIME_NOTIFICATIONS: stringToBoolean('true'),
  FEATURE_ADVANCED_ANALYTICS: stringToBoolean('true'),
  FEATURE_INTERNATIONALIZATION: stringToBoolean('false'),
  FEATURE_DEBUG_MODE: stringToBoolean('false'),
  FEATURE_HOT_RELOAD: stringToBoolean('false'),
  FEATURE_MOCK_SERVICES: stringToBoolean('false'),

  // Logging and monitoring
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  LOG_FORMAT: z.enum(['json', 'text']).default('json'),
  METRICS_ENABLED: stringToBoolean('true'),
  METRICS_INTERVAL: stringToNumber('60000'),

  // Error tracking
  SENTRY_DSN: z.string().optional(),
  SENTRY_ENVIRONMENT: z.string().default('development'),
  SENTRY_SAMPLE_RATE: stringToNumber('1.0'),

  // Redis configuration
  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_TTL: stringToNumber('3600'),
  REDIS_MAX_CONNECTIONS: stringToNumber('10'),

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: stringToNumber('900000'),
  RATE_LIMIT_MAX_REQUESTS: stringToNumber('100'),
  RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS: stringToBoolean('true'),

  LIGHTNING_RATE_LIMIT_WINDOW_MS: stringToNumber('60000'),
  LIGHTNING_RATE_LIMIT_MAX_REQUESTS: stringToNumber('10'),

  // Email configuration
  EMAIL_SERVICE: z.string().default('smtp'),
  EMAIL_FROM: z.string().email().default('noreply@localhost'),
  EMAIL_FROM_NAME: z.string().default('Sovren Development'),
  EMAIL_SUPPORT: z.string().email().default('support@localhost'),

  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: stringToNumber('587'),
  SMTP_SECURE: stringToBoolean('false'),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),

  // File storage
  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_FILE_SIZE: stringToNumber('10485760'),
  ALLOWED_FILE_TYPES: stringToArray('image/jpeg,image/png,image/gif,image/webp'),

  // AI configuration
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4'),
  OPENAI_MAX_TOKENS: stringToNumber('2000'),
  OPENAI_TEMPERATURE: stringToNumber('0.7'),

  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default('claude-3-sonnet-20240229'),

  AI_CONTENT_MAX_LENGTH: stringToNumber('5000'),
  AI_CONTENT_CACHE_TTL: stringToNumber('3600'),

  // CORS configuration
  CORS_ORIGIN: stringToArray('http://localhost:3000,http://localhost:3001,http://localhost:5173'),
  CORS_METHODS: stringToArray('GET,POST,PUT,DELETE,OPTIONS'),
  CORS_HEADERS: stringToArray('Content-Type,Authorization,X-Requested-With'),
  CORS_CREDENTIALS: stringToBoolean('true'),
  CORS_MAX_AGE: stringToNumber('86400'),

  // Performance configuration
  CACHE_TTL: stringToNumber('300'),
  CACHE_MAX_SIZE: stringToNumber('1000'),
  CACHE_STRATEGY: z.enum(['lru', 'lfu', 'fifo']).default('lru'),

  REQUEST_TIMEOUT: stringToNumber('30000'),
  LONG_REQUEST_TIMEOUT: stringToNumber('120000'),

  ENABLE_COMPRESSION: stringToBoolean('true'),
  COMPRESSION_LEVEL: stringToNumber('6'),

  // Docker-specific configuration
  DOCKER_DEV_MODE: stringToBoolean('false'),
  WATCHPACK_POLLING: stringToBoolean('false'),
  CHOKIDAR_USEPOLLING: stringToBoolean('false'),

  // Debug configuration
  DEBUG: z.string().optional(),
  NODE_OPTIONS: z.string().optional(),

  // Validation configuration
  VALIDATE_ENV: stringToBoolean('true'),
  REQUIRED_VARS: stringToArray('NODE_ENV,SUPABASE_URL,SUPABASE_ANON_KEY,JWT_SECRET,SESSION_SECRET'),
  OPTIONAL_VARS: stringToArray('OPENAI_API_KEY,LNBITS_ADMIN_KEY,SENTRY_DSN'),
});

export type ValidatedEnv = z.infer<typeof envSchema>;

/**
 * Security validation for sensitive environment variables
 */
function validateSecurity(env: ValidatedEnv): void {
  const securityIssues: string[] = [];

  // Check for weak secrets in production
  if (env.NODE_ENV === 'production') {
    if (env.JWT_SECRET.includes('development') || env.JWT_SECRET.includes('test')) {
      securityIssues.push('JWT_SECRET appears to be a development/test secret');
    }

    if (env.SESSION_SECRET.includes('development') || env.SESSION_SECRET.includes('test')) {
      securityIssues.push('SESSION_SECRET appears to be a development/test secret');
    }

    if (env.ENCRYPTION_KEY.includes('development') || env.ENCRYPTION_KEY.includes('test')) {
      securityIssues.push('ENCRYPTION_KEY appears to be a development/test key');
    }
  }

  // C-5: Validate BYOK_ENCRYPTION_KEY is present and differs from PLATFORM_TOKEN_ENCRYPTION_KEY
  // Both keys are required for multi-platform distribution features.
  // In production, these MUST be set; in dev/test they are optional to ease local setup.
  if (env.NODE_ENV === 'production') {
    if (!env.PLATFORM_TOKEN_ENCRYPTION_KEY) {
      securityIssues.push(
        'PLATFORM_TOKEN_ENCRYPTION_KEY is required in production (generate with: openssl rand -hex 32)'
      );
    }
    if (!env.BYOK_ENCRYPTION_KEY) {
      securityIssues.push(
        'BYOK_ENCRYPTION_KEY is required in production (generate with: openssl rand -hex 32)'
      );
    }
  }

  if (
    env.BYOK_ENCRYPTION_KEY &&
    env.PLATFORM_TOKEN_ENCRYPTION_KEY &&
    env.BYOK_ENCRYPTION_KEY.toLowerCase() === env.PLATFORM_TOKEN_ENCRYPTION_KEY.toLowerCase()
  ) {
    securityIssues.push(
      'BYOK_ENCRYPTION_KEY must differ from PLATFORM_TOKEN_ENCRYPTION_KEY (security requirement C-5). ' +
        'Generate a separate key with: openssl rand -hex 32'
    );
  }

  // LNBits configuration: warn in production if missing (invoicing and escrow non-functional)
  if (env.NODE_ENV === 'production') {
    const lnbitsWarnings: string[] = [];
    if (!env.LNBITS_API_URL) {
      lnbitsWarnings.push('LNBITS_API_URL');
    }
    if (!env.LNBITS_ADMIN_KEY) {
      lnbitsWarnings.push('LNBITS_ADMIN_KEY');
    }
    if (lnbitsWarnings.length > 0) {
      console.warn(
        `[env-validation] WARNING: ${lnbitsWarnings.join(', ')} not configured. ` +
          'Invoicing and marketplace escrow features will be non-functional. ' +
          'Get credentials from your LNBits instance dashboard.'
      );
    }
  }

  // Check for insecure configurations
  if (env.NODE_ENV === 'production' && env.LOG_LEVEL === 'debug') {
    securityIssues.push('Debug logging should not be enabled in production');
  }

  if (env.NODE_ENV === 'production' && env.FEATURE_DEBUG_MODE) {
    securityIssues.push('Debug mode should not be enabled in production');
  }

  if (securityIssues.length > 0) {
    throw new Error(`Security validation failed:\n${securityIssues.join('\n')}`);
  }
}

/**
 * Docker-specific validation
 */
function validateDockerConfiguration(env: ValidatedEnv): void {
  const dockerIssues: string[] = [];

  // Check Docker-specific configurations
  if (env.DOCKER_DEV_MODE && env.NODE_ENV === 'production') {
    dockerIssues.push('Docker dev mode should not be enabled in production');
  }

  // Validate host configuration for Docker
  if (env.DOCKER_DEV_MODE && env.HOST !== '0.0.0.0') {
    dockerIssues.push('Host should be 0.0.0.0 for Docker containers');
  }

  // Check for polling in Docker
  if (env.DOCKER_DEV_MODE && !env.WATCHPACK_POLLING && !env.CHOKIDAR_USEPOLLING) {
    console.warn('Warning: File watching may not work properly in Docker without polling enabled');
  }

  if (dockerIssues.length > 0) {
    throw new Error(`Docker configuration validation failed:\n${dockerIssues.join('\n')}`);
  }
}

/**
 * Performance validation
 */
function validatePerformance(env: ValidatedEnv): void {
  const performanceIssues: string[] = [];

  // Check timeout configurations
  if (env.REQUEST_TIMEOUT > env.LONG_REQUEST_TIMEOUT) {
    performanceIssues.push('REQUEST_TIMEOUT should be less than LONG_REQUEST_TIMEOUT');
  }

  // Check cache configurations
  if (env.CACHE_TTL <= 0) {
    performanceIssues.push('CACHE_TTL should be greater than 0');
  }

  if (env.CACHE_MAX_SIZE <= 0) {
    performanceIssues.push('CACHE_MAX_SIZE should be greater than 0');
  }

  // Check rate limiting
  if (env.RATE_LIMIT_MAX_REQUESTS <= 0) {
    performanceIssues.push('RATE_LIMIT_MAX_REQUESTS should be greater than 0');
  }

  if (performanceIssues.length > 0) {
    throw new Error(`Performance validation failed:\n${performanceIssues.join('\n')}`);
  }
}

/**
 * Network connectivity validation
 */
async function validateConnectivity(env: ValidatedEnv): Promise<void> {
  const connectivityIssues: string[] = [];

  // Validate Supabase URL accessibility
  try {
    const response = await fetch(`${env.SUPABASE_URL}/rest/v1/`, {
      method: 'HEAD',
      headers: {
        apikey: env.SUPABASE_ANON_KEY,
      },
    });

    if (!response.ok) {
      connectivityIssues.push(`Supabase URL ${env.SUPABASE_URL} is not accessible`);
    }
  } catch (error) {
    connectivityIssues.push(`Failed to connect to Supabase: ${error}`);
  }

  // Validate NOSTR relays
  for (const relay of env.NOSTR_RELAYS) {
    try {
      const wsUrl = new URL(relay);
      if (!wsUrl.protocol.startsWith('ws')) {
        connectivityIssues.push(`Invalid NOSTR relay protocol: ${relay}`);
      }
    } catch (error) {
      connectivityIssues.push(`Invalid NOSTR relay URL: ${relay}`);
    }
  }

  if (connectivityIssues.length > 0) {
    console.warn(`Connectivity validation warnings:\n${connectivityIssues.join('\n')}`);
  }
}

/**
 * Load and validate environment configuration
 */
export async function validateEnvironment(): Promise<ValidatedEnv> {
  try {
    console.log('🔧 Validating environment configuration...');

    // Parse environment variables
    const parsed = envSchema.parse(process.env);

    // Run validation checks
    validateSecurity(parsed);
    validateDockerConfiguration(parsed);
    validatePerformance(parsed);

    // Run connectivity checks (non-blocking)
    if (parsed.VALIDATE_ENV) {
      validateConnectivity(parsed).catch((error) => {
        console.warn('⚠️  Connectivity validation failed:', error);
      });
    }

    console.log('✅ Environment validation successful');
    console.log(`📊 Environment: ${parsed.NODE_ENV}`);
    console.log(`🚀 Application: ${parsed.APP_VERSION}`);
    console.log(`🐳 Docker Mode: ${parsed.DOCKER_DEV_MODE ? 'enabled' : 'disabled'}`);
    console.log(
      `🔒 Security Level: ${parsed.NODE_ENV === 'production' ? 'production' : 'development'}`
    );

    return parsed;
  } catch (error) {
    console.error('❌ Environment validation failed:', error);

    // In development, provide helpful error messages
    if (process.env.NODE_ENV === 'development') {
      console.log('\n📝 Development environment setup:');
      console.log('1. Copy .env.development.template to .env.development');
      console.log('2. Configure your Supabase credentials');
      console.log('3. Generate secure secrets for JWT and sessions');
      console.log('4. Review and adjust feature flags');
      console.log(
        '\nFor detailed setup instructions, see: docs/development/docker-development-configuration.md'
      );
    }

    process.exit(1);
  }
}

/**
 * Get environment configuration (cached)
 */
let cachedEnv: ValidatedEnv | null = null;

export function getEnvironment(): ValidatedEnv {
  if (!cachedEnv) {
    throw new Error('Environment not validated. Call validateEnvironment() first.');
  }
  return cachedEnv;
}

/**
 * Initialize environment validation
 */
export async function initializeEnvironment(): Promise<ValidatedEnv> {
  if (!cachedEnv) {
    cachedEnv = await validateEnvironment();
  }
  return cachedEnv;
}

/**
 * Environment health check
 */
export function getEnvironmentHealth(): {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: Array<{
    name: string;
    status: 'pass' | 'fail' | 'warn';
    message?: string;
  }>;
} {
  const env = getEnvironment();
  const checks: Array<{
    name: string;
    status: 'pass' | 'fail' | 'warn';
    message?: string;
  }> = [];

  // Check required configuration
  checks.push({
    name: 'Supabase Configuration',
    status: env.SUPABASE_URL && env.SUPABASE_ANON_KEY ? 'pass' : 'fail',
    message:
      env.SUPABASE_URL && env.SUPABASE_ANON_KEY ? undefined : 'Missing Supabase configuration',
  });

  checks.push({
    name: 'Security Configuration',
    status: env.JWT_SECRET.length >= 32 && env.SESSION_SECRET.length >= 32 ? 'pass' : 'fail',
    message:
      env.JWT_SECRET.length >= 32 && env.SESSION_SECRET.length >= 32
        ? undefined
        : 'Weak security configuration',
  });

  checks.push({
    name: 'Docker Configuration',
    status: env.DOCKER_DEV_MODE ? (env.HOST === '0.0.0.0' ? 'pass' : 'warn') : 'pass',
    message:
      env.DOCKER_DEV_MODE && env.HOST !== '0.0.0.0'
        ? 'Host should be 0.0.0.0 for Docker'
        : undefined,
  });

  // LNBits configuration check
  const hasLnbits = Boolean(env.LNBITS_API_URL && env.LNBITS_ADMIN_KEY);
  checks.push({
    name: 'LNBits Configuration',
    status: hasLnbits ? 'pass' : 'warn',
    message: hasLnbits
      ? undefined
      : 'LNBITS_API_URL and/or LNBITS_ADMIN_KEY missing — invoicing and escrow disabled',
  });

  checks.push({
    name: 'Feature Flags',
    status: 'pass',
    message: `${Object.keys(env).filter((key) => key.startsWith('FEATURE_') && env[key as keyof ValidatedEnv]).length} features enabled`,
  });

  const failedChecks = checks.filter((check) => check.status === 'fail');
  const warnChecks = checks.filter((check) => check.status === 'warn');

  return {
    status: failedChecks.length > 0 ? 'unhealthy' : warnChecks.length > 0 ? 'degraded' : 'healthy',
    checks,
  };
}
