/**
 * Secrets Configuration
 * Maps environment variables to AWS Secrets Manager secret names
 * Supports dev/staging/prod environments with graceful fallback
 */

export interface SecretMapping {
  /** Environment variable name */
  envVar: string;
  /** AWS Secrets Manager secret name (supports environment interpolation) */
  secretName: string;
  /** JSON key path if secret is JSON (dot notation: e.g., 'database.password') */
  jsonKey?: string;
  /** Whether this secret is required in production */
  required: boolean;
  /** Description for documentation */
  description: string;
}

export interface SecretsConfig {
  /** AWS region for Secrets Manager */
  awsRegion: string;
  /** Environment (development, staging, production) */
  environment: string;
  /** Cache TTL in seconds (default 1 hour) */
  cacheTtlSeconds: number;
  /** Enable AWS Secrets Manager (false for local dev) */
  useAwsSecrets: boolean;
  /** Secret mappings */
  secrets: SecretMapping[];
  /** Retry configuration */
  retry: {
    maxAttempts: number;
    baseDelay: number; // milliseconds
    maxDelay: number; // milliseconds
  };
}

/**
 * Get secrets configuration based on environment
 */
export function getSecretsConfig(): SecretsConfig {
  const environment = process.env.NODE_ENV || 'development';
  const useAwsSecrets =
    environment === 'production' ||
    environment === 'staging' ||
    process.env.FORCE_AWS_SECRETS === 'true';

  return {
    awsRegion: process.env.AWS_REGION || 'us-east-1',
    environment,
    cacheTtlSeconds: parseInt(process.env.SECRETS_CACHE_TTL || '3600', 10),
    useAwsSecrets,

    secrets: [
      // Database Secrets
      {
        envVar: 'SUPABASE_URL',
        secretName: `sovren/${environment}/supabase/url`,
        required: true,
        description: 'Supabase project URL',
      },
      {
        envVar: 'SUPABASE_ANON_KEY',
        secretName: `sovren/${environment}/supabase/anon-key`,
        required: true,
        description: 'Supabase anonymous key for client-side operations',
      },
      {
        envVar: 'SUPABASE_SERVICE_ROLE_KEY',
        secretName: `sovren/${environment}/supabase/service-role-key`,
        required: false,
        description: 'Supabase service role key for admin operations',
      },

      // Security Secrets
      {
        envVar: 'JWT_SECRET',
        secretName: `sovren/${environment}/auth/jwt-secret`,
        required: true,
        description: 'JWT signing secret (minimum 256-bit)',
      },
      {
        envVar: 'JWT_REFRESH_SECRET',
        secretName: `sovren/${environment}/auth/jwt-refresh-secret`,
        required: false,
        description: 'JWT refresh token signing secret',
      },

      // Lightning Network Secrets
      {
        envVar: 'LNBITS_API_KEY',
        secretName: `sovren/${environment}/lightning/lnbits-api-key`,
        required: true,
        description: 'LNbits API key for Lightning payments',
      },
      {
        envVar: 'LNBITS_WALLET_ID',
        secretName: `sovren/${environment}/lightning/lnbits-wallet-id`,
        required: true,
        description: 'LNbits wallet ID',
      },
      {
        envVar: 'LIGHTNING_WEBHOOK_SECRET',
        secretName: `sovren/${environment}/lightning/webhook-secret`,
        required: true,
        description: 'Webhook verification secret for Lightning callbacks',
      },

      // Redis Secrets
      {
        envVar: 'REDIS_URL',
        secretName: `sovren/${environment}/redis/url`,
        required: false,
        description: 'Redis connection URL with credentials',
      },
      {
        envVar: 'REDIS_PASSWORD',
        secretName: `sovren/${environment}/redis/password`,
        required: false,
        description: 'Redis password for authentication',
      },

      // Email Service Secrets
      {
        envVar: 'SMTP_PASSWORD',
        secretName: `sovren/${environment}/email/smtp-password`,
        required: false,
        description: 'SMTP server password for email sending',
      },
      {
        envVar: 'SENDGRID_API_KEY',
        secretName: `sovren/${environment}/email/sendgrid-api-key`,
        required: false,
        description: 'SendGrid API key (if using SendGrid)',
      },

      // Analytics & Monitoring
      {
        envVar: 'SENTRY_DSN',
        secretName: `sovren/${environment}/monitoring/sentry-dsn`,
        required: false,
        description: 'Sentry DSN for error tracking',
      },
      {
        envVar: 'DATADOG_API_KEY',
        secretName: `sovren/${environment}/monitoring/datadog-api-key`,
        required: false,
        description: 'Datadog API key for metrics',
      },

      // External APIs
      {
        envVar: 'NOSTR_RELAY_AUTH_SECRET',
        secretName: `sovren/${environment}/nostr/relay-auth-secret`,
        required: false,
        description: 'Authentication secret for private NOSTR relays',
      },
    ],

    retry: {
      maxAttempts: 3,
      baseDelay: 1000, // 1 second
      maxDelay: 5000,  // 5 seconds
    },
  };
}

/**
 * Validate secrets configuration
 * Ensures all required secrets are available
 */
export function validateSecretsConfig(config: SecretsConfig): {
  valid: boolean;
  missing: string[];
  errors: string[];
} {
  const missing: string[] = [];
  const errors: string[] = [];

  // Check required secrets in production
  if (config.environment === 'production') {
    const requiredSecrets = config.secrets.filter(s => s.required);

    for (const secret of requiredSecrets) {
      if (!process.env[secret.envVar]) {
        missing.push(secret.envVar);
      }
    }
  }

  // Validate AWS region if using AWS secrets
  if (config.useAwsSecrets && !config.awsRegion) {
    errors.push('AWS_REGION must be set when using AWS Secrets Manager');
  }

  // Validate cache TTL
  if (config.cacheTtlSeconds < 60 || config.cacheTtlSeconds > 86400) {
    errors.push('SECRETS_CACHE_TTL must be between 60 and 86400 seconds');
  }

  return {
    valid: missing.length === 0 && errors.length === 0,
    missing,
    errors,
  };
}

/**
 * Secret name templates for different environments
 */
export const SECRET_NAME_PATTERNS = {
  development: 'sovren/dev/{service}/{key}',
  staging: 'sovren/staging/{service}/{key}',
  production: 'sovren/prod/{service}/{key}',
} as const;

/**
 * Environment variable to AWS secret mapping
 * Used for documentation and migration
 */
export const SECRET_MIGRATION_MAP = {
  // Database
  SUPABASE_URL: 'Database connection URL',
  SUPABASE_ANON_KEY: 'Public API key',
  SUPABASE_SERVICE_ROLE_KEY: 'Admin API key',

  // Auth
  JWT_SECRET: 'JWT signing key (generate with: openssl rand -base64 32)',
  JWT_REFRESH_SECRET: 'JWT refresh token key',

  // Lightning
  LNBITS_API_KEY: 'LNbits admin key',
  LNBITS_WALLET_ID: 'LNbits wallet identifier',
  LIGHTNING_WEBHOOK_SECRET: 'Webhook signature key',

  // Infrastructure
  REDIS_URL: 'Redis connection string',
  REDIS_PASSWORD: 'Redis auth password',

  // Email
  SMTP_PASSWORD: 'Email server password',
  SENDGRID_API_KEY: 'SendGrid API key',

  // Monitoring
  SENTRY_DSN: 'Sentry error tracking DSN',
  DATADOG_API_KEY: 'Datadog metrics key',

  // NOSTR
  NOSTR_RELAY_AUTH_SECRET: 'Private relay auth token',
} as const;
