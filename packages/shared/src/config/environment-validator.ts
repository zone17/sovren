/**
 * 🔍 Elite Environment Validation System
 * Comprehensive environment variable validation with startup checks,
 * type coercion, and detailed error reporting
 */

import { z } from 'zod';

// 🎨 ANSI Colors for Terminal Output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
} as const;

function colorize(text: string, color: keyof typeof colors): string {
  return `${colors[color]}${text}${colors.reset}`;
}

// 📝 Logging Utilities
export const logger = {
  error: (message: string) => console.error(colorize(`❌ ${message}`, 'red')),
  warn: (message: string) => console.warn(colorize(`⚠️  ${message}`, 'yellow')),
  success: (message: string) => console.log(colorize(`✅ ${message}`, 'green')),
  info: (message: string) => console.log(colorize(`ℹ️  ${message}`, 'blue')),
  log: (message: string, color: keyof typeof colors = 'reset') =>
    console.log(colorize(message, color)),
};

// 🔧 Custom Validation Schemas
const urlSchema = z.string().url('Must be a valid URL');
const emailSchema = z.string().email('Must be a valid email address');
const portSchema = z.coerce.number().min(1).max(65535, 'Port must be between 1 and 65535');

// Custom boolean coercion that handles string 'false' correctly
const booleanCoercion = z.preprocess((val) => {
  if (typeof val === 'string') {
    return val.toLowerCase() === 'true' || val === '1';
  }
  return Boolean(val);
}, z.boolean());

// Secret validation with minimum length requirements
const secretSchema = (minLength: number, name: string) =>
  z
    .string()
    .min(minLength, `${name} must be at least ${minLength} characters`)
    .refine(
      (val) => !val.includes('change-this') && !val.includes('example') && !val.includes('your-'),
      `${name} appears to contain default/placeholder values - please use a secure secret`
    );

// NOSTR relay validation
const nostrRelaysSchema = z.string().refine((val) => {
  const relays = val.split(',').map((r) => r.trim());
  return relays.every((relay) => relay.startsWith('wss://') || relay.startsWith('ws://'));
}, 'NOSTR relays must be WebSocket URLs (ws:// or wss://)');

// 📋 Environment Variable Categories
/**
 * Allowed environment variable value types
 */
export type EnvVarValue = string | number | boolean | URL;

export interface ValidationRule {
  schema: z.ZodSchema;
  required: boolean;
  category: string;
  description: string;
  defaultValue?: EnvVarValue;
  productionOnly?: boolean;
  developmentOnly?: boolean;
}

export const VALIDATION_RULES: Record<string, ValidationRule> = {
  // 🚀 Core Application
  NODE_ENV: {
    schema: z.enum(['development', 'production', 'test']).default('development'),
    required: true,
    category: 'Core',
    description: 'Application environment',
  },
  PORT: {
    schema: portSchema.default(3001),
    required: false,
    category: 'Core',
    description: 'Server port number',
  },
  LOG_LEVEL: {
    schema: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
    required: false,
    category: 'Core',
    description: 'Logging verbosity level',
  },

  // 🗄️ Database Configuration
  SUPABASE_URL: {
    schema: urlSchema,
    required: true,
    category: 'Database',
    description: 'Supabase project URL',
  },
  SUPABASE_ANON_KEY: {
    schema: z.string().min(1, 'Supabase anon key is required'),
    required: true,
    category: 'Database',
    description: 'Supabase anonymous key',
  },
  SUPABASE_SERVICE_ROLE_KEY: {
    schema: z.string().min(1, 'Supabase service role key is required'),
    required: true,
    category: 'Database',
    description: 'Supabase service role key (server-side only)',
  },
  DATABASE_URL: {
    schema: urlSchema,
    required: false,
    category: 'Database',
    description: 'Direct PostgreSQL connection URL (alternative to Supabase)',
  },

  // 🔐 Authentication & Security
  JWT_SECRET: {
    schema: secretSchema(32, 'JWT_SECRET'),
    required: true,
    category: 'Security',
    description: 'JWT signing secret (minimum 32 characters)',
  },
  JWT_EXPIRES_IN: {
    schema: z.string().default('7d'),
    required: false,
    category: 'Security',
    description: 'JWT token expiration time',
  },
  SESSION_SECRET: {
    schema: secretSchema(32, 'SESSION_SECRET'),
    required: true,
    category: 'Security',
    description: 'Session encryption secret (minimum 32 characters)',
  },
  NEXTAUTH_SECRET: {
    schema: secretSchema(32, 'NEXTAUTH_SECRET'),
    required: false,
    category: 'Security',
    description: 'NextAuth.js encryption secret',
  },
  ENCRYPTION_KEY: {
    schema: z.string().length(32, 'Encryption key must be exactly 32 characters'),
    required: false,
    category: 'Security',
    description: 'Data encryption key (32 characters)',
  },

  // ⚡ Lightning Network
  LNBITS_API_URL: {
    schema: urlSchema,
    required: true,
    category: 'Lightning',
    description: 'LNbits API endpoint URL',
  },
  LNBITS_ADMIN_KEY: {
    schema: z.string().min(1, 'LNbits admin key is required'),
    required: true,
    category: 'Lightning',
    description: 'LNbits administrative API key',
  },
  LNBITS_INVOICE_READ_KEY: {
    schema: z.string().min(1, 'LNbits invoice read key is required'),
    required: true,
    category: 'Lightning',
    description: 'LNbits invoice reading API key',
  },
  LNBITS_WEBHOOK_SECRET: {
    schema: secretSchema(16, 'LNBITS_WEBHOOK_SECRET'),
    required: true,
    category: 'Lightning',
    description: 'LNbits webhook verification secret',
  },
  LIGHTNING_NETWORK: {
    schema: z.enum(['mainnet', 'testnet', 'regtest']).default('testnet'),
    required: false,
    category: 'Lightning',
    description: 'Lightning Network type',
  },
  LIGHTNING_MIN_AMOUNT: {
    schema: z.coerce.number().min(1).default(1000),
    required: false,
    category: 'Lightning',
    description: 'Minimum payment amount in satoshis',
  },
  LIGHTNING_MAX_AMOUNT: {
    schema: z.coerce.number().min(1000).default(100000000),
    required: false,
    category: 'Lightning',
    description: 'Maximum payment amount in satoshis',
  },

  // 🌐 NOSTR Protocol
  NOSTR_RELAYS: {
    schema: nostrRelaysSchema,
    required: true,
    category: 'NOSTR',
    description: 'Comma-separated list of NOSTR relay URLs',
  },
  NOSTR_PRIVATE_KEY: {
    schema: z.string().length(64, 'NOSTR private key must be 64 characters (hex)'),
    required: false,
    category: 'NOSTR',
    description: 'NOSTR private key for publishing (hex format)',
  },
  NOSTR_PUBLIC_KEY: {
    schema: z.string().length(64, 'NOSTR public key must be 64 characters (hex)'),
    required: false,
    category: 'NOSTR',
    description: 'NOSTR public key for identity (hex format)',
  },

  // 🔄 Redis & Caching
  REDIS_URL: {
    schema: urlSchema.default('redis://localhost:6379'),
    required: false,
    category: 'Cache',
    description: 'Redis connection URL',
  },
  REDIS_PASSWORD: {
    schema: z.string(),
    required: false,
    category: 'Cache',
    description: 'Redis authentication password',
  },
  REDIS_TTL: {
    schema: z.coerce.number().min(1).default(3600),
    required: false,
    category: 'Cache',
    description: 'Default cache TTL in seconds',
  },

  // 📧 Email Configuration
  SMTP_HOST: {
    schema: z.string(),
    required: false,
    category: 'Email',
    description: 'SMTP server hostname',
  },
  SMTP_PORT: {
    schema: portSchema,
    required: false,
    category: 'Email',
    description: 'SMTP server port',
  },
  SMTP_USER: {
    schema: emailSchema,
    required: false,
    category: 'Email',
    description: 'SMTP authentication username',
  },
  SMTP_PASS: {
    schema: z.string(),
    required: false,
    category: 'Email',
    description: 'SMTP authentication password',
  },

  // 🚩 Feature Flags
  FEATURE_LIGHTNING_PAYMENTS: {
    schema: booleanCoercion.default(true),
    required: false,
    category: 'Features',
    description: 'Enable Lightning Network payments',
  },
  FEATURE_AI_CONTENT_GENERATION: {
    schema: booleanCoercion.default(true),
    required: false,
    category: 'Features',
    description: 'Enable AI content generation',
  },
  FEATURE_NOSTR_PUBLISHING: {
    schema: booleanCoercion.default(true),
    required: false,
    category: 'Features',
    description: 'Enable NOSTR protocol publishing',
  },
  FEATURE_CONTENT_MONETIZATION: {
    schema: booleanCoercion.default(true),
    required: false,
    category: 'Features',
    description: 'Enable content monetization features',
  },
  FEATURE_PREMIUM_SUBSCRIPTIONS: {
    schema: booleanCoercion.default(true),
    required: false,
    category: 'Features',
    description: 'Enable premium subscription system',
  },

  // 📊 Monitoring & Analytics
  SENTRY_DSN: {
    schema: urlSchema,
    required: false,
    category: 'Monitoring',
    description: 'Sentry error tracking DSN',
    productionOnly: true,
  },
  SENTRY_ENVIRONMENT: {
    schema: z.string().default('development'),
    required: false,
    category: 'Monitoring',
    description: 'Sentry environment identifier',
  },
  ANALYTICS_ENABLED: {
    schema: booleanCoercion.default(false),
    required: false,
    category: 'Monitoring',
    description: 'Enable analytics collection',
  },

  // 🔒 Rate Limiting
  RATE_LIMIT_WINDOW_MS: {
    schema: z.coerce.number().min(1000).default(900000),
    required: false,
    category: 'Rate Limiting',
    description: 'Rate limit window in milliseconds',
  },
  RATE_LIMIT_MAX_REQUESTS: {
    schema: z.coerce.number().min(1).default(100),
    required: false,
    category: 'Rate Limiting',
    description: 'Maximum requests per window',
  },

  // 🌐 CORS & Security
  CORS_ORIGIN: {
    schema: z.string(),
    required: false,
    category: 'Security',
    description: 'Allowed CORS origins (comma-separated)',
    productionOnly: true,
  },
  DOMAIN: {
    schema: z.string(),
    required: false,
    category: 'Security',
    description: 'Primary domain name',
    productionOnly: true,
  },
  SSL_EMAIL: {
    schema: emailSchema,
    required: false,
    category: 'Security',
    description: 'Email for SSL certificate generation',
    productionOnly: true,
  },

  // 🧪 Development
  DEBUG_ENABLED: {
    schema: booleanCoercion.default(false),
    required: false,
    category: 'Development',
    description: 'Enable debug mode',
    developmentOnly: true,
  },
  HOT_RELOAD: {
    schema: booleanCoercion.default(false),
    required: false,
    category: 'Development',
    description: 'Enable hot reload in development',
    developmentOnly: true,
  },
};

// 🏗️ Validation Result Types
export interface ValidationError {
  variable: string;
  message: string;
  category: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  success: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  config: Record<string, EnvVarValue | undefined>;
  summary: {
    total: number;
    validated: number;
    errors: number;
    warnings: number;
    categories: string[];
  };
}

// 🔍 Environment Validator Class
export class EnvironmentValidator {
  private env: Record<string, string | undefined>;
  private isProduction: boolean;
  private isDevelopment: boolean;

  constructor(env: Record<string, string | undefined> = process.env) {
    this.env = env;
    this.isProduction = env.NODE_ENV === 'production';
    this.isDevelopment = env.NODE_ENV === 'development';
  }

  /**
   * Validate all environment variables
   */
  validate(): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];
    const config: Record<string, EnvVarValue | undefined> = {};
    const categories = new Set<string>();

    let validated = 0;

    // Validate each rule
    for (const [varName, rule] of Object.entries(VALIDATION_RULES)) {
      categories.add(rule.category);

      // Skip environment-specific variables
      if (rule.productionOnly && !this.isProduction) continue;
      if (rule.developmentOnly && !this.isDevelopment) continue;

      const value = this.env[varName];

      try {
        // Check if required variable is missing
        if (rule.required && (!value || value.trim() === '')) {
          errors.push({
            variable: varName,
            message: `${varName} is required but not set`,
            category: rule.category,
            severity: 'error',
          });
          continue;
        }

        // Parse and validate the value
        const parsedValue = rule.schema.parse(value);
        config[varName] = parsedValue;
        validated++;

        // Additional production validations
        if (this.isProduction) {
          this.addProductionValidations(varName, parsedValue, warnings);
        }
      } catch (error) {
        if (error instanceof z.ZodError) {
          const message = error.errors.map((e) => e.message).join(', ');
          errors.push({
            variable: varName,
            message: `${varName}: ${message}`,
            category: rule.category,
            severity: 'error',
          });
        } else {
          errors.push({
            variable: varName,
            message: `${varName}: Validation failed - ${error}`,
            category: rule.category,
            severity: 'error',
          });
        }
      }
    }

    // Additional cross-variable validations
    this.addCrossVariableValidations(config, errors, warnings);

    return {
      success: errors.length === 0,
      errors,
      warnings,
      config,
      summary: {
        total: Object.keys(VALIDATION_RULES).length,
        validated,
        errors: errors.length,
        warnings: warnings.length,
        categories: Array.from(categories),
      },
    };
  }

  /**
   * Add production-specific validations
   */
  private addProductionValidations(varName: string, value: EnvVarValue | undefined, warnings: ValidationError[]): void {
    // Check for weak secrets in production
    if (varName.includes('SECRET') && typeof value === 'string') {
      if (value.length < 64) {
        warnings.push({
          variable: varName,
          message: `${varName} should be at least 64 characters in production for enhanced security`,
          category: 'Security',
          severity: 'warning',
        });
      }
    }

    // Check for development values in production
    if (
      typeof value === 'string' &&
      (value.includes('localhost') ||
        value.includes('127.0.0.1') ||
        value.includes('dev') ||
        value.includes('test'))
    ) {
      warnings.push({
        variable: varName,
        message: `${varName} appears to contain development/test values in production`,
        category: 'Security',
        severity: 'warning',
      });
    }
  }

  /**
   * Add cross-variable validations
   */
  private addCrossVariableValidations(
    config: Record<string, EnvVarValue | undefined>,
    errors: ValidationError[],
    _warnings: ValidationError[]
  ): void {
    // Lightning amount validation
    if (config.LIGHTNING_MIN_AMOUNT && config.LIGHTNING_MAX_AMOUNT) {
      if (config.LIGHTNING_MIN_AMOUNT >= config.LIGHTNING_MAX_AMOUNT) {
        errors.push({
          variable: 'LIGHTNING_MIN_AMOUNT',
          message: 'LIGHTNING_MIN_AMOUNT must be less than LIGHTNING_MAX_AMOUNT',
          category: 'Lightning',
          severity: 'error',
        });
      }
    }

    // Production required variables
    if (this.isProduction) {
      const productionRequired = ['DOMAIN', 'SSL_EMAIL', 'SENTRY_DSN', 'CORS_ORIGIN'];
      for (const varName of productionRequired) {
        if (!config[varName]) {
          errors.push({
            variable: varName,
            message: `${varName} is required in production environment`,
            category: 'Security',
            severity: 'error',
          });
        }
      }
    }
  }

  /**
   * Print validation results to console
   */
  printResults(result: ValidationResult): void {
    logger.log(colorize('\n🔍 Sovren Environment Validation', 'bright'));
    logger.log('=====================================\n');

    logger.info(`Environment: ${colorize(this.env.NODE_ENV?.toUpperCase() || 'UNKNOWN', 'cyan')}`);
    logger.log('');

    // Print results by category
    const categorizedResults = this.groupByCategory(result);

    for (const [category, items] of Object.entries(categorizedResults)) {
      logger.log(colorize(`📋 ${category.toUpperCase()} Configuration:`, 'bright'));

      for (const item of items) {
        if (item.type === 'success') {
          logger.success(`${item.variable} ✓`);
        } else if (item.type === 'error') {
          logger.error(`${item.variable}: ${item.message}`);
        } else if (item.type === 'warning') {
          logger.warn(`${item.variable}: ${item.message}`);
        }
      }
      logger.log('');
    }

    // Print summary
    logger.log(colorize('📊 Validation Summary:', 'bright'));
    logger.log('====================');
    logger.log(`Total Variables: ${result.summary.total}`);
    logger.log(`Validated: ${result.summary.validated}`);
    logger.log(
      `Errors: ${colorize(result.summary.errors.toString(), result.summary.errors > 0 ? 'red' : 'green')}`
    );
    logger.log(
      `Warnings: ${colorize(result.summary.warnings.toString(), result.summary.warnings > 0 ? 'yellow' : 'green')}`
    );
    logger.log('');

    // Final status
    if (result.success) {
      if (result.warnings.length > 0) {
        logger.warn('Environment validation completed with warnings');
        logger.success('Configuration is valid but could be improved');
      } else {
        logger.success('Environment validation PASSED');
        logger.success('All required variables are properly configured');
      }
    } else {
      logger.error('Environment validation FAILED');
      logger.error('Please fix the errors above before proceeding');
    }
    logger.log('');
  }

  /**
   * Group validation results by category
   */
  private groupByCategory(result: ValidationResult): Record<
    string,
    Array<{
      variable: string;
      message?: string;
      type: 'success' | 'error' | 'warning';
    }>
  > {
    const grouped: Record<
      string,
      Array<{
        variable: string;
        message?: string;
        type: 'success' | 'error' | 'warning';
      }>
    > = {};

    // Add successful validations
    for (const [varName] of Object.entries(result.config)) {
      const rule = VALIDATION_RULES[varName];
      if (!rule) continue;

      const category = rule.category;
      if (!grouped[category]) grouped[category] = [];

      grouped[category].push({
        variable: varName,
        type: 'success',
      });
    }

    // Add errors
    for (const error of result.errors) {
      const category = error.category;
      if (!grouped[category]) grouped[category] = [];

      grouped[category].push({
        variable: error.variable,
        message: error.message,
        type: 'error',
      });
    }

    // Add warnings
    for (const warning of result.warnings) {
      const category = warning.category;
      if (!grouped[category]) grouped[category] = [];

      grouped[category].push({
        variable: warning.variable,
        message: warning.message,
        type: 'warning',
      });
    }

    return grouped;
  }
}

// 🚀 Startup Validation Function
export function validateEnvironmentOnStartup(
  env: Record<string, string | undefined> = process.env,
  exitOnError: boolean = true
): ValidationResult {
  const validator = new EnvironmentValidator(env);
  const result = validator.validate();

  validator.printResults(result);

  if (!result.success && exitOnError) {
    process.exit(1);
  }

  return result;
}

// 🔧 Utility Functions
export function getValidatedConfig(
  env: Record<string, string | undefined> = process.env
): Record<string, EnvVarValue | undefined> {
  const result = validateEnvironmentOnStartup(env, false);
  if (!result.success) {
    throw new Error('Environment validation failed');
  }
  return result.config;
}

export function isFeatureEnabled(
  featureName: string,
  env: Record<string, string | undefined> = process.env
): boolean {
  const value = env[featureName];
  return value === 'true' || value === '1';
}

export function getRequiredEnvVar(
  varName: string,
  env: Record<string, string | undefined> = process.env
): string {
  const value = env[varName];
  if (!value || value.trim() === '') {
    throw new Error(`Required environment variable ${varName} is not set`);
  }
  return value;
}

export function getEnvVar(
  varName: string,
  defaultValue: string,
  env: Record<string, string | undefined> = process.env
): string {
  return env[varName] || defaultValue;
}
