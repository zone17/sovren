/**
 * Sovren Environment Configuration
 * Type-safe environment variable management with validation
 */

import { z } from 'zod';

// Custom boolean coercion that handles string 'false' correctly
const booleanCoercion = z.preprocess((val) => {
  if (typeof val === 'string') {
    return val.toLowerCase() === 'true' || val === '1';
  }
  return Boolean(val);
}, z.boolean());

// Environment validation schemas
const EnvironmentSchema = z.object({
  // Core Application
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().min(1).max(65535).default(3001),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),

  // Domain and SSL
  DOMAIN: z.string().optional(),
  SSL_EMAIL: z.string().email().optional(),

  // Supabase Configuration
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // Database (fallback)
  DATABASE_URL: z.string().optional(),

  // Authentication & Security
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),
  SESSION_SECRET: z.string().min(32),

  // Lightning Network
  LNBITS_API_URL: z.string().url(),
  LNBITS_ADMIN_KEY: z.string().min(1),
  LNBITS_INVOICE_READ_KEY: z.string().min(1),
  LNBITS_WEBHOOK_SECRET: z.string().min(1),
  LIGHTNING_NETWORK: z.enum(['mainnet', 'testnet', 'regtest']).default('testnet'),
  LIGHTNING_MIN_AMOUNT: z.coerce.number().min(1).default(1000),
  LIGHTNING_MAX_AMOUNT: z.coerce.number().min(1000).default(100000000),

  // NOSTR Protocol
  NOSTR_RELAYS: z.string().min(1),
  NOSTR_PRIVATE_KEY: z.string().length(64).optional(),
  NOSTR_PUBLIC_KEY: z.string().length(64).optional(),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_TTL: z.coerce.number().min(1).default(3600),

  // Email
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().min(1).max(65535).optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().email().optional(),
  EMAIL_FROM_NAME: z.string().default('Sovren Platform'),
  EMAIL_SUPPORT: z.string().email().optional(),

  // File Storage
  IPFS_GATEWAY_URL: z.string().url().default('https://ipfs.io/ipfs/'),
  IPFS_API_URL: z.string().url().optional(),
  PINATA_JWT_TOKEN: z.string().optional(),
  ARWEAVE_GATEWAY_URL: z.string().url().default('https://arweave.net'),
  ARWEAVE_WALLET_PATH: z.string().optional(),
  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_FILE_SIZE: z.coerce.number().min(1).default(10485760),

  // AI & Analytics
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4'),
  OPENAI_MAX_TOKENS: z.coerce.number().min(1).default(2000),
  ANALYTICS_ENABLED: booleanCoercion.default(true),
  ANALYTICS_SAMPLING_RATE: z.coerce.number().min(0).max(1).default(0.1),

  // Monitoring
  SENTRY_DSN: z.string().optional(),
  SENTRY_ENVIRONMENT: z.string().optional(),
  GRAFANA_PASSWORD: z.string().optional(),
  PROMETHEUS_ENABLED: booleanCoercion.default(false),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().min(1000).default(900000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().min(1).default(100),
  RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS: booleanCoercion.default(true),
  LIGHTNING_RATE_LIMIT_WINDOW_MS: z.coerce.number().min(1000).default(60000),
  LIGHTNING_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().min(1).default(10),

  // Feature Flags
  FEATURE_LIGHTNING_PAYMENTS: booleanCoercion.default(true),
  FEATURE_AI_CONTENT_GENERATION: booleanCoercion.default(true),
  FEATURE_NOSTR_PUBLISHING: booleanCoercion.default(true),
  FEATURE_CONTENT_MONETIZATION: booleanCoercion.default(true),
  FEATURE_PREMIUM_SUBSCRIPTIONS: booleanCoercion.default(true),

  // Development
  DEBUG_ENABLED: booleanCoercion.default(false),
  DEBUG_NAMESPACE: z.string().default('sovren:*'),
  HOT_RELOAD: booleanCoercion.default(true),
  WATCH_FILES: booleanCoercion.default(true),
  TEST_DATABASE_URL: z.string().optional(),
  TEST_REDIS_URL: z.string().optional(),

  // Production
  CLUSTER_MODE: booleanCoercion.default(false),
  WORKER_PROCESSES: z.union([z.literal('auto'), z.coerce.number().min(1)]).default('auto'),
  KEEP_ALIVE_TIMEOUT: z.coerce.number().min(1000).default(65000),
  CORS_ORIGIN: z.string().optional(),
  SECURE_COOKIES: booleanCoercion.default(false),
  HELMET_ENABLED: booleanCoercion.default(true),

  // Backup
  BACKUP_ENABLED: booleanCoercion.default(false),
  BACKUP_SCHEDULE: z.string().default('0 2 * * *'),
  BACKUP_RETENTION_DAYS: z.coerce.number().min(1).default(30),

  // Container
  CONTAINER_MEMORY_LIMIT: z.string().default('1024m'),
  CONTAINER_CPU_LIMIT: z.coerce.number().min(0.1).default(1.0),
});

// Infer TypeScript types from schema
export type EnvironmentConfig = z.infer<typeof EnvironmentSchema>;

// Validation function
export function validateEnvironment(env: Record<string, string | undefined>): EnvironmentConfig {
  try {
    // Parse with base schema
    const config = EnvironmentSchema.parse(env);

    // Additional validation for production
    if (config.NODE_ENV === 'production') {
      // Check critical production fields
      const missingFields: string[] = [];

      if (!env.DOMAIN) missingFields.push('DOMAIN');
      if (!env.SSL_EMAIL) missingFields.push('SSL_EMAIL');
      if (!env.SENTRY_DSN) missingFields.push('SENTRY_DSN');
      if (!env.CORS_ORIGIN) missingFields.push('CORS_ORIGIN');

      if (missingFields.length > 0) {
        throw new Error(
          `Missing required production environment variables: ${missingFields.join(', ')}`
        );
      }

      // Validate JWT secret strength in production
      if (config.JWT_SECRET.length < 64) {
        throw new Error('JWT_SECRET must be at least 64 characters in production');
      }

      // Validate session secret strength in production
      if (config.SESSION_SECRET.length < 64) {
        throw new Error('SESSION_SECRET must be at least 64 characters in production');
      }
    }

    // Validate NOSTR relays format
    if (config.NOSTR_RELAYS) {
      const relays = config.NOSTR_RELAYS.split(',').map((r) => r.trim());
      const invalidRelays = relays.filter(
        (relay) => !relay.startsWith('wss://') && !relay.startsWith('ws://')
      );

      if (invalidRelays.length > 0) {
        throw new Error(
          `Invalid NOSTR relay URLs: ${invalidRelays.join(', ')}. Must start with ws:// or wss://`
        );
      }
    }

    // Validate Lightning Network configuration
    if (config.LIGHTNING_MIN_AMOUNT >= config.LIGHTNING_MAX_AMOUNT) {
      throw new Error('LIGHTNING_MIN_AMOUNT must be less than LIGHTNING_MAX_AMOUNT');
    }

    return config;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors
        .map((err) => `${err.path.join('.')}: ${err.message}`)
        .join('\n');

      throw new Error(`Environment validation failed:\n${errorMessages}`);
    }

    throw error;
  }
}

// Load and validate environment
export function loadEnvironment(): EnvironmentConfig {
  return validateEnvironment(process.env);
}

// Environment utilities
export const isProduction = () => process.env.NODE_ENV === 'production';
export const isDevelopment = () => process.env.NODE_ENV === 'development';
export const isTest = () => process.env.NODE_ENV === 'test';

// Feature flag utilities
export function isFeatureEnabled(
  feature: keyof Pick<
    EnvironmentConfig,
    | 'FEATURE_LIGHTNING_PAYMENTS'
    | 'FEATURE_AI_CONTENT_GENERATION'
    | 'FEATURE_NOSTR_PUBLISHING'
    | 'FEATURE_CONTENT_MONETIZATION'
    | 'FEATURE_PREMIUM_SUBSCRIPTIONS'
  >
): boolean {
  const config = loadEnvironment();
  return config[feature];
}

// Configuration helpers
export function getDatabaseConfig(): {
  url: string;
  supabase: {
    url: string;
    anonKey: string;
    serviceRoleKey: string;
  };
} {
  const config = loadEnvironment();

  return {
    url: config.DATABASE_URL || '',
    supabase: {
      url: config.SUPABASE_URL,
      anonKey: config.SUPABASE_ANON_KEY,
      serviceRoleKey: config.SUPABASE_SERVICE_ROLE_KEY,
    },
  };
}

export function getLightningConfig(): {
  apiUrl: string;
  adminKey: string;
  invoiceReadKey: string;
  webhookSecret: string;
  network: string;
  minAmount: number;
  maxAmount: number;
} {
  const config = loadEnvironment();

  return {
    apiUrl: config.LNBITS_API_URL,
    adminKey: config.LNBITS_ADMIN_KEY,
    invoiceReadKey: config.LNBITS_INVOICE_READ_KEY,
    webhookSecret: config.LNBITS_WEBHOOK_SECRET,
    network: config.LIGHTNING_NETWORK,
    minAmount: config.LIGHTNING_MIN_AMOUNT,
    maxAmount: config.LIGHTNING_MAX_AMOUNT,
  };
}

export function getNostrConfig(): {
  relays: string[];
  privateKey?: string;
  publicKey?: string;
} {
  const config = loadEnvironment();

  return {
    relays: config.NOSTR_RELAYS.split(',').map((r) => r.trim()),
    privateKey: config.NOSTR_PRIVATE_KEY,
    publicKey: config.NOSTR_PUBLIC_KEY,
  };
}

// Export singleton instance
let configInstance: EnvironmentConfig | null = null;

export function getConfig(): EnvironmentConfig {
  if (!configInstance) {
    configInstance = loadEnvironment();
  }
  return configInstance;
}

// Reset configuration (useful for testing)
export function resetConfig(): void {
  configInstance = null;
}
