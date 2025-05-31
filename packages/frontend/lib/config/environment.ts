import { z } from 'zod';

// 🔐 ELITE ENVIRONMENT VALIDATION SCHEMA
const environmentSchema = z.object({
  // 🗄️ Database Configuration
  SUPABASE_URL: z.string().url('Invalid Supabase URL'),
  SUPABASE_ANON_KEY: z.string().min(1, 'Supabase anon key is required'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'Supabase service role key is required'),
  DATABASE_URL: z.string().url('Invalid database URL').optional(),

  // 🚀 Environment Configuration
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  VERCEL_ENV: z.enum(['development', 'preview', 'production']).optional(),
  VERCEL_URL: z.string().optional(),

  // 🔑 Security Configuration
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters').optional(),
  NEXTAUTH_SECRET: z.string().min(1, 'NextAuth secret is required in production').optional(),
  ENCRYPTION_KEY: z.string().length(32, 'Encryption key must be exactly 32 characters').optional(),

  // 📧 Email Configuration (Optional)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().transform(val => parseInt(val, 10)).pipe(z.number()).optional(),
  SMTP_USER: z.string().email().optional(),
  SMTP_PASS: z.string().optional(),
  FROM_EMAIL: z.string().email().optional(),

  // 💳 Payment Configuration (Optional)
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // 📊 Monitoring Configuration (Optional)
  GOOGLE_ANALYTICS_ID: z.string().optional(),

  // 🤖 AI Services Configuration (Optional)
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),

  // 🌐 NOSTR Protocol Configuration (Optional)
  NOSTR_PRIVATE_KEY: z.string().optional(),
  NOSTR_PUBLIC_KEY: z.string().optional(),
  NOSTR_RELAYS: z.string().optional(), // Comma-separated relay URLs
  NOSTR_AUTO_CONNECT: z.string().transform(val => val === 'true').default('true'),
  NOSTR_CONNECTION_TIMEOUT: z.string().transform(val => parseInt(val, 10)).pipe(z.number().positive()).default('5000'),
  NOSTR_MAX_RELAYS: z.string().transform(val => parseInt(val, 10)).pipe(z.number().positive()).default('10'),
  NOSTR_CACHE_TTL: z.string().transform(val => parseInt(val, 10)).pipe(z.number().positive()).default('300000'),

  // 🔒 Rate Limiting Configuration
  RATE_LIMIT_REDIS_URL: z.string().url().optional(),
  MAX_LOGIN_ATTEMPTS: z.string().transform(val => parseInt(val, 10)).pipe(z.number().positive()).default('5'),
  LOCKOUT_DURATION: z.string().transform(val => parseInt(val, 10)).pipe(z.number().positive()).default('900'),

  // 📁 File Storage Configuration (Optional)
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_S3_BUCKET: z.string().optional(),
  AWS_REGION: z.string().default('us-east-1'),

  // 🧪 Development Configuration
  ENABLE_API_DOCS: z.string().transform(val => val === 'true').default('false'),
  DEBUG_MODE: z.string().transform(val => val === 'true').default('false'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),

  // 🌐 CORS Configuration
  ALLOWED_ORIGINS: z.string().optional(),
  CORS_CREDENTIALS: z.string().transform(val => val === 'true').default('true'),

  // 📱 Feature Flags
  ENABLE_PAYMENTS: z.string().transform(val => val === 'true').default('false'),
  ENABLE_AI_FEATURES: z.string().transform(val => val === 'true').default('true'),
  ENABLE_EMAIL_NOTIFICATIONS: z.string().transform(val => val === 'true').default('false'),
  ENABLE_FILE_UPLOADS: z.string().transform(val => val === 'true').default('false'),

  // Monitoring and Analytics
  ENABLE_ANALYTICS: z.boolean().optional(),
  ENABLE_PERFORMANCE_MONITORING: z.boolean().optional(),
});

// 🎯 ENVIRONMENT CONFIGURATION CLASS
class EnvironmentConfig {
  private static instance: EnvironmentConfig;
  private config: z.infer<typeof environmentSchema>;

  private constructor() {
    this.config = this.validateEnvironment();
  }

  static getInstance(): EnvironmentConfig {
    if (!EnvironmentConfig.instance) {
      EnvironmentConfig.instance = new EnvironmentConfig();
    }
    return EnvironmentConfig.instance;
  }

  private validateEnvironment() {
    try {
      const env = environmentSchema.parse(process.env);

      // 🔒 Additional validation for production
      if (env.NODE_ENV === 'production') {
        if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) {
          throw new Error('JWT_SECRET must be at least 32 characters in production');
        }
        if (!env.NEXTAUTH_SECRET) {
          throw new Error('NEXTAUTH_SECRET is required in production');
        }
      }

      return env;
    } catch (error) {
      console.error('❌ Environment validation failed:', error);
      throw new Error(`Invalid environment configuration: ${error}`);
    }
  }

  // 🗄️ Database Configuration
  get database() {
    return {
      supabaseUrl: this.config.SUPABASE_URL,
      supabaseAnonKey: this.config.SUPABASE_ANON_KEY,
      supabaseServiceRoleKey: this.config.SUPABASE_SERVICE_ROLE_KEY,
      databaseUrl: this.config.DATABASE_URL,
    };
  }

  // 🚀 Environment Information
  get environment() {
    return {
      nodeEnv: this.config.NODE_ENV,
      vercelEnv: this.config.VERCEL_ENV,
      vercelUrl: this.config.VERCEL_URL,
      isDevelopment: this.config.NODE_ENV === 'development',
      isProduction: this.config.NODE_ENV === 'production',
      isTest: this.config.NODE_ENV === 'test',
    };
  }

  // 🔑 Security Configuration
  get security() {
    return {
      jwtSecret: this.config.JWT_SECRET,
      nextAuthSecret: this.config.NEXTAUTH_SECRET,
      encryptionKey: this.config.ENCRYPTION_KEY,
      maxLoginAttempts: this.config.MAX_LOGIN_ATTEMPTS,
      lockoutDuration: this.config.LOCKOUT_DURATION,
    };
  }

  // 📧 Email Configuration
  get email() {
    return {
      smtpHost: this.config.SMTP_HOST,
      smtpPort: this.config.SMTP_PORT,
      smtpUser: this.config.SMTP_USER,
      smtpPass: this.config.SMTP_PASS,
      fromEmail: this.config.FROM_EMAIL,
      isConfigured: !!(this.config.SMTP_HOST && this.config.SMTP_USER && this.config.SMTP_PASS),
    };
  }

  // 💳 Payment Configuration
  get payments() {
    return {
      stripeSecretKey: this.config.STRIPE_SECRET_KEY,
      stripePublishableKey: this.config.STRIPE_PUBLISHABLE_KEY,
      stripeWebhookSecret: this.config.STRIPE_WEBHOOK_SECRET,
      isConfigured: !!(this.config.STRIPE_SECRET_KEY && this.config.STRIPE_PUBLISHABLE_KEY),
    };
  }

  // 📊 Monitoring Configuration
  get monitoring() {
    return {
      googleAnalyticsId: this.config.GOOGLE_ANALYTICS_ID,
      isAnalyticsConfigured: !!this.config.GOOGLE_ANALYTICS_ID,
    };
  }

  // 🤖 AI Services Configuration
  get ai() {
    return {
      openaiApiKey: this.config.OPENAI_API_KEY,
      anthropicApiKey: this.config.ANTHROPIC_API_KEY,
      isOpenAIConfigured: !!this.config.OPENAI_API_KEY,
      isAnthropicConfigured: !!this.config.ANTHROPIC_API_KEY,
    };
  }

  // 🌐 NOSTR Protocol Configuration
  get nostr() {
    return {
      privateKey: this.config.NOSTR_PRIVATE_KEY,
      publicKey: this.config.NOSTR_PUBLIC_KEY,
      relays: this.config.NOSTR_RELAYS ? this.config.NOSTR_RELAYS.split(',').map(url => url.trim()) : [
        'wss://relay.damus.io',
        'wss://nos.lol',
        'wss://relay.nostr.info',
        'wss://nostr-pub.wellorder.net'
      ],
      autoConnect: this.config.NOSTR_AUTO_CONNECT,
      connectionTimeout: this.config.NOSTR_CONNECTION_TIMEOUT,
      maxRelays: this.config.NOSTR_MAX_RELAYS,
      cacheTtl: this.config.NOSTR_CACHE_TTL,
      isConfigured: !!(this.config.NOSTR_RELAYS || this.config.NOSTR_PUBLIC_KEY),
    };
  }

  // 📁 File Storage Configuration
  get storage() {
    return {
      awsAccessKeyId: this.config.AWS_ACCESS_KEY_ID,
      awsSecretAccessKey: this.config.AWS_SECRET_ACCESS_KEY,
      awsS3Bucket: this.config.AWS_S3_BUCKET,
      awsRegion: this.config.AWS_REGION,
      isConfigured: !!(this.config.AWS_ACCESS_KEY_ID && this.config.AWS_SECRET_ACCESS_KEY && this.config.AWS_S3_BUCKET),
    };
  }

  // 🧪 Development Configuration
  get development() {
    return {
      enableApiDocs: this.config.ENABLE_API_DOCS,
      debugMode: this.config.DEBUG_MODE,
      logLevel: this.config.LOG_LEVEL,
    };
  }

  // 🌐 CORS Configuration
  get cors() {
    const allowedOrigins = this.config.ALLOWED_ORIGINS
      ? this.config.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
      : ['http://localhost:3000', 'https://localhost:3000'];

    return {
      allowedOrigins,
      credentials: this.config.CORS_CREDENTIALS,
    };
  }

  // 📱 Feature Flags
  get features() {
    return {
      enablePayments: this.config.ENABLE_PAYMENTS,
      enableAIFeatures: this.config.ENABLE_AI_FEATURES,
      enableEmailNotifications: this.config.ENABLE_EMAIL_NOTIFICATIONS,
      enableFileUploads: this.config.ENABLE_FILE_UPLOADS,
    };
  }

  // 🔍 Configuration Summary
  get summary() {
    return {
      environment: this.config.NODE_ENV,
      features: {
        database: true,
        authentication: true,
        payments: this.payments.isConfigured,
        email: this.email.isConfigured,
        monitoring: this.monitoring.isAnalyticsConfigured,
        fileStorage: this.storage.isConfigured,
        ai: this.ai.isOpenAIConfigured || this.ai.isAnthropicConfigured,
      },
      security: {
        jwtConfigured: !!this.config.JWT_SECRET,
        encryptionConfigured: !!this.config.ENCRYPTION_KEY,
        rateLimitingConfigured: !!this.config.RATE_LIMIT_REDIS_URL,
      }
    };
  }
}

// 🌟 SINGLETON INSTANCE
export const config = EnvironmentConfig.getInstance();

// 🧪 TESTING UTILITIES
export const __testing = {
  EnvironmentConfig,
  environmentSchema,
};
