# 🐳 Docker Development Environment Configuration

## Overview

This document provides comprehensive configuration for the Sovren Docker development environment, enabling consistent development experience across all team members with hot reloading, debugging, and optimized performance.

## Development Environment Template

Copy the following configuration to your `.env.development` file:

```bash
# 🔧 Sovren Development Environment Configuration
# Docker-optimized development environment with validation and security

# ==========================================
# 🚀 CORE DEVELOPMENT CONFIGURATION
# ==========================================

# Environment type - Docker development mode
NODE_ENV=development

# Application version
APP_VERSION=1.0.0-dev

# Build timestamp
BUILD_TIMESTAMP=

# Development server settings
HOST=0.0.0.0
PORT=3001
FRONTEND_PORT=5173
BACKEND_PORT=3001

# ==========================================
# 🗄️ DATABASE CONFIGURATION
# ==========================================

# Supabase configuration
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Local PostgreSQL (optional for development)
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=sovren_dev
POSTGRES_USER=sovren
POSTGRES_PASSWORD=dev_password_change_in_production

# Database connection pool settings
DB_MAX_CONNECTIONS=20
DB_CONNECTION_TIMEOUT=10000
DB_IDLE_TIMEOUT=30000

# ==========================================
# 🔐 SECURITY CONFIGURATION
# ==========================================

# JWT configuration
JWT_SECRET=development-jwt-secret-at-least-32-characters-long-for-security
JWT_EXPIRES_IN=7d
JWT_ALGORITHM=HS256

# Session configuration
SESSION_SECRET=development-session-secret-at-least-32-characters-long
SESSION_MAX_AGE=604800

# Encryption keys for sensitive data
ENCRYPTION_KEY=development-32-character-key-12345

# ==========================================
# ⚡ LIGHTNING NETWORK CONFIGURATION
# ==========================================

# Lightning Network settings
LIGHTNING_NETWORK=testnet
LIGHTNING_MIN_AMOUNT=1000
LIGHTNING_MAX_AMOUNT=100000000

# LNbits configuration
LNBITS_API_URL=https://legend.lnbits.com
LNBITS_ADMIN_KEY=your-lnbits-admin-key
LNBITS_INVOICE_READ_KEY=your-lnbits-invoice-read-key
LNBITS_WEBHOOK_SECRET=your-webhook-secret

# Lightning address configuration
LIGHTNING_ADDRESS_DOMAIN=localhost
ENABLE_LIGHTNING_ADDRESSES=true

# ==========================================
# 🌐 NOSTR CONFIGURATION
# ==========================================

# NOSTR relay configuration
NOSTR_RELAYS=wss://relay.damus.io,wss://nos.lol,wss://relay.snort.social,wss://relay.current.fyi

# NOSTR connection settings
NOSTR_AUTO_CONNECT=true
NOSTR_CONNECTION_TIMEOUT=5000
NOSTR_MAX_RELAYS=10
NOSTR_CACHE_TTL=300000

# NOSTR event settings
NOSTR_EVENT_TTL=86400
NOSTR_MAX_EVENT_SIZE=65536

# ==========================================
# 🚩 FEATURE FLAGS
# ==========================================

# Core feature flags for development
FEATURE_LIGHTNING_PAYMENTS=true
FEATURE_NOSTR_PUBLISHING=true
FEATURE_AI_CONTENT_GENERATION=true
FEATURE_CONTENT_MONETIZATION=true
FEATURE_PREMIUM_SUBSCRIPTIONS=true
FEATURE_REALTIME_NOTIFICATIONS=true
FEATURE_ADVANCED_ANALYTICS=true
FEATURE_INTERNATIONALIZATION=false

# Development-specific features
FEATURE_DEBUG_MODE=true
FEATURE_HOT_RELOAD=true
FEATURE_MOCK_SERVICES=true

# ==========================================
# 📊 MONITORING & LOGGING
# ==========================================

# Logging configuration
LOG_LEVEL=debug
LOG_FORMAT=json

# Metrics collection
METRICS_ENABLED=true
METRICS_INTERVAL=60000

# Error tracking (Sentry) - disabled for development
SENTRY_DSN=
SENTRY_ENVIRONMENT=development
SENTRY_SAMPLE_RATE=1.0

# ==========================================
# 🔒 RATE LIMITING & CACHING
# ==========================================

# Redis configuration
REDIS_URL=redis://redis:6379
REDIS_PASSWORD=
REDIS_TTL=3600
REDIS_MAX_CONNECTIONS=10

# Rate limiting settings (relaxed for development)
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=1000
RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS=true

# Lightning-specific rate limits
LIGHTNING_RATE_LIMIT_WINDOW_MS=60000
LIGHTNING_RATE_LIMIT_MAX_REQUESTS=100

# ==========================================
# 📧 EMAIL CONFIGURATION
# ==========================================

# Email service configuration (using Mailhog for development)
EMAIL_SERVICE=smtp
EMAIL_FROM=noreply@localhost
EMAIL_FROM_NAME=Sovren Development
EMAIL_SUPPORT=support@localhost

# SMTP configuration (Mailhog)
SMTP_HOST=mailhog
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=

# Email templates
EMAIL_TEMPLATE_DIR=./templates/email
EMAIL_TEMPLATE_CACHE=true

# ==========================================
# 📁 FILE STORAGE CONFIGURATION
# ==========================================

# File storage settings
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/gif,image/webp,video/mp4,audio/mpeg

# IPFS configuration (optional)
IPFS_GATEWAY_URL=https://ipfs.io/ipfs/
IPFS_API_URL=https://api.pinata.cloud
PINATA_JWT_TOKEN=your-pinata-jwt-token

# Arweave configuration (optional)
ARWEAVE_GATEWAY_URL=https://arweave.net
ARWEAVE_WALLET_PATH=./arweave-wallet.json

# ==========================================
# 🤖 AI CONFIGURATION
# ==========================================

# OpenAI configuration
OPENAI_API_KEY=sk-your-openai-api-key
OPENAI_MODEL=gpt-4
OPENAI_MAX_TOKENS=2000
OPENAI_TEMPERATURE=0.7

# Anthropic configuration (alternative)
ANTHROPIC_API_KEY=sk-ant-your-anthropic-api-key
ANTHROPIC_MODEL=claude-3-sonnet-20240229

# AI feature settings
AI_CONTENT_MAX_LENGTH=5000
AI_CONTENT_CACHE_TTL=3600

# ==========================================
# 🌐 CORS CONFIGURATION
# ==========================================

# CORS settings for development
CORS_ORIGIN=http://localhost:3000,http://localhost:3001,http://localhost:5173,http://localhost:8080
CORS_METHODS=GET,POST,PUT,DELETE,OPTIONS
CORS_HEADERS=Content-Type,Authorization,X-Requested-With
CORS_CREDENTIALS=true
CORS_MAX_AGE=86400

# ==========================================
# 🔧 PERFORMANCE CONFIGURATION
# ==========================================

# Cache settings
CACHE_TTL=300
CACHE_MAX_SIZE=1000
CACHE_STRATEGY=lru

# Request timeout settings
REQUEST_TIMEOUT=30000
LONG_REQUEST_TIMEOUT=120000

# Compression settings
ENABLE_COMPRESSION=true
COMPRESSION_LEVEL=6

# ==========================================
# 🧪 TESTING CONFIGURATION
# ==========================================

# Test database configuration
TEST_DATABASE_URL=postgresql://sovren:test_password@postgres:5432/sovren_test
TEST_REDIS_URL=redis://redis:6379

# Test environment settings
TEST_TIMEOUT=30000

# ==========================================
# 🐳 DOCKER DEVELOPMENT CONFIGURATION
# ==========================================

# Docker-specific settings
DOCKER_DEV_MODE=true
WATCHPACK_POLLING=true
CHOKIDAR_USEPOLLING=true

# Development server settings
VITE_API_URL=http://localhost:3001
VITE_SUPABASE_URL=${SUPABASE_URL}
VITE_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
VITE_LNBITS_API_URL=${LNBITS_API_URL}
VITE_NOSTR_RELAYS=${NOSTR_RELAYS}

# Hot reload configuration
FAST_REFRESH=true
WDS_SOCKET_HOST=localhost
WDS_SOCKET_PORT=5173

# Debug configuration
DEBUG=*
NODE_OPTIONS=--inspect=0.0.0.0:9229

# ==========================================
# 📝 VALIDATION RULES
# ==========================================

# Environment validation (set to true to enable strict validation)
VALIDATE_ENV=true

# Required environment variables for development
REQUIRED_VARS=NODE_ENV,SUPABASE_URL,SUPABASE_ANON_KEY,JWT_SECRET,SESSION_SECRET

# Optional environment variables
OPTIONAL_VARS=OPENAI_API_KEY,LNBITS_ADMIN_KEY,SENTRY_DSN
```

## Docker Development Scripts

Add these scripts to your `package.json` files:

### Root Package.json Scripts

```json
{
  "scripts": {
    "docker:dev": "docker-compose up --build",
    "docker:dev:detached": "docker-compose up --build -d",
    "docker:dev:logs": "docker-compose logs -f",
    "docker:dev:clean": "docker-compose down -v --rmi local",
    "docker:dev:reset": "docker-compose down -v && docker-compose build --no-cache && docker-compose up",
    "docker:dev:shell:backend": "docker-compose exec backend sh",
    "docker:dev:shell:frontend": "docker-compose exec frontend sh",
    "docker:dev:test": "docker-compose exec backend npm test",
    "docker:dev:test:frontend": "docker-compose exec frontend npm test",
    "docker:health": "docker-compose ps --services --filter 'health=healthy'",
    "docker:setup": "cp .env.development.template .env.development && echo 'Please configure your .env.development file'"
  }
}
```

## Environment Variable Validation

Create this validation utility in your backend:

```typescript
// src/utils/env-validation.ts
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  PORT: z.string().transform(Number),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  SESSION_SECRET: z.string().min(32),
  REDIS_URL: z.string().optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  DOCKER_DEV_MODE: z.string().transform(Boolean).optional(),
});

export function validateEnvironment() {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    console.error('Environment validation failed:', error);
    process.exit(1);
  }
}
```

## Health Check Implementation

### Backend Health Check

```typescript
// src/routes/health.ts
import { Router } from 'express';
import { Request, Response } from 'express';

const router = Router();

interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  dependencies: {
    database: 'connected' | 'disconnected';
    redis: 'connected' | 'disconnected';
  };
}

router.get('/health', async (req: Request, res: Response) => {
  const memoryUsage = process.memoryUsage();
  const totalMemory = memoryUsage.heapTotal;
  const usedMemory = memoryUsage.heapUsed;

  const healthStatus: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      used: usedMemory,
      total: totalMemory,
      percentage: (usedMemory / totalMemory) * 100,
    },
    dependencies: {
      database: 'connected', // Add actual database check
      redis: 'connected', // Add actual Redis check
    },
  };

  res.status(200).json(healthStatus);
});

export default router;
```

### Frontend Health Check

```typescript
// src/utils/health-check.ts
export async function performHealthCheck(): Promise<boolean> {
  try {
    const response = await fetch('/api/health');
    return response.ok;
  } catch (error) {
    console.error('Health check failed:', error);
    return false;
  }
}
```

## Docker Development Best Practices

### 1. Layer Optimization

- Use multi-stage builds for optimal caching
- Install dependencies before copying source code
- Use `.dockerignore` to exclude unnecessary files

### 2. Security Hardening

- Run containers as non-root users
- Use minimal base images (Alpine Linux)
- Scan images for vulnerabilities
- Implement proper secret management

### 3. Performance Optimization

- Use volume mounts for hot reloading
- Implement proper caching strategies
- Optimize health check intervals
- Use appropriate resource limits

### 4. Development Workflow

- Use Docker Compose for local development
- Implement proper logging and monitoring
- Use environment-specific configurations
- Maintain consistent development environments

## Troubleshooting

### Common Issues

1. **Port conflicts**: Ensure ports are available
2. **Volume permissions**: Check file ownership
3. **Network issues**: Verify container communication
4. **Environment variables**: Validate configuration
5. **Memory issues**: Monitor resource usage

### Debug Commands

```bash
# Check container logs
docker-compose logs -f [service_name]

# Execute shell in container
docker-compose exec [service_name] sh

# Check container resource usage
docker stats

# Inspect container configuration
docker inspect [container_name]

# Check network connectivity
docker network ls
docker network inspect [network_name]
```

## Monitoring and Observability

### Container Metrics

- CPU usage and memory consumption
- Network traffic and I/O operations
- Container restart frequency
- Health check success rates

### Application Metrics

- Request response times
- Error rates and types
- Database connection pools
- Cache hit rates

### Logging Strategy

- Structured logging with JSON format
- Centralized log aggregation
- Log rotation and retention
- Error tracking and alerting

## Next Steps

1. Configure your `.env.development` file
2. Run `npm run docker:dev` to start the development environment
3. Access the application at `http://localhost:8080`
4. Monitor health checks at `http://localhost:3001/health`
5. Check email testing at `http://localhost:8025` (Mailhog)

This configuration provides a robust, secure, and efficient Docker development environment that meets elite engineering standards.
