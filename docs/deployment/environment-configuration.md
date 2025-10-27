# Environment Configuration Guide

This guide provides comprehensive instructions for configuring environment variables in the Sovren platform. Our environment configuration system ensures type safety, validation, and secure deployment across all environments.

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [Environment Templates](#environment-templates)
- [Configuration Categories](#configuration-categories)
- [Validation System](#validation-system)
- [Security Guidelines](#security-guidelines)
- [Environment-Specific Settings](#environment-specific-settings)
- [Troubleshooting](#troubleshooting)

## 🚀 Quick Start

### 1. Copy Environment Template

```bash
# For development
cp env.development .env

# Or copy the comprehensive example
cp env.example .env
```

### 2. Configure Required Variables

Edit `.env` and set these **required** variables:

```bash
# Supabase (Required)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Authentication (Required)
JWT_SECRET=your-secure-jwt-secret-at-least-32-characters
SESSION_SECRET=your-secure-session-secret-at-least-32-characters

# Lightning Network (Required)
LNBITS_API_URL=https://your-lnbits-instance.com
LNBITS_ADMIN_KEY=your-admin-key
LNBITS_INVOICE_READ_KEY=your-invoice-key
LNBITS_WEBHOOK_SECRET=your-webhook-secret

# NOSTR Protocol (Required)
NOSTR_RELAYS=wss://relay.damus.io,wss://nos.lol,wss://relay.snort.social
```

### 3. Validate Configuration

```bash
# Run validation script
node scripts/validate-env.cjs

# Or use npm script (if added to package.json)
npm run validate:env
```

### 4. Start Development

```bash
# Using Docker (recommended)
./scripts/docker-dev.sh start

# Or traditional npm
npm run dev
```

## 📁 Environment Templates

We provide several environment templates for different use cases:

| Template          | Purpose             | Use Case                                 |
| ----------------- | ------------------- | ---------------------------------------- |
| `env.example`     | Complete reference  | All available configuration options      |
| `env.development` | Development setup   | Local development with sensible defaults |
| `env.production`  | Production template | Production deployment checklist          |

### Template Usage

```bash
# Development setup
cp env.development .env

# Production setup (create from example)
cp env.example .env.production
```

## ⚙️ Configuration Categories

### Core Application Settings

```bash
NODE_ENV=development          # Environment: development, production, test
PORT=3001                     # Server port (1-65535)
LOG_LEVEL=debug              # Logging: error, warn, info, debug
```

### Supabase Configuration (Required)

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

**Setup Instructions:**

1. Create account at [Supabase](https://supabase.com)
2. Create new project
3. Go to Settings → API
4. Copy URL and keys

### Authentication & Security (Required)

```bash
JWT_SECRET=your-super-secure-jwt-secret-change-this-in-production
JWT_EXPIRES_IN=7d
SESSION_SECRET=your-session-secret-change-this-in-production
```

**Security Requirements:**

- JWT_SECRET: Minimum 32 characters (64+ for production)
- SESSION_SECRET: Minimum 32 characters (64+ for production)
- Use cryptographically secure random strings

**Generate Secure Secrets:**

```bash
# Generate 32-character secret
openssl rand -hex 32

# Generate 64-character secret (production)
openssl rand -hex 64
```

### Lightning Network Configuration (Required)

```bash
LNBITS_API_URL=https://your-lnbits-instance.com
LNBITS_ADMIN_KEY=your-lnbits-admin-key
LNBITS_INVOICE_READ_KEY=your-lnbits-invoice-read-key
LNBITS_WEBHOOK_SECRET=your-webhook-secret
LIGHTNING_NETWORK=testnet     # mainnet, testnet, regtest
LIGHTNING_MIN_AMOUNT=1000     # Minimum satoshis
LIGHTNING_MAX_AMOUNT=100000000 # Maximum satoshis
```

**Setup Instructions:**

1. Get LNbits instance at [legend.lnbits.com](https://legend.lnbits.com) (testnet)
2. Create wallet and get admin key
3. Generate invoice/read key in Extensions → API
4. Set webhook secret for payment notifications

### NOSTR Protocol Configuration (Required)

```bash
NOSTR_RELAYS=wss://relay.damus.io,wss://nos.lol,wss://relay.snort.social
NOSTR_PRIVATE_KEY=your-64-char-hex-private-key  # Optional
NOSTR_PUBLIC_KEY=your-64-char-hex-public-key    # Optional
```

**Setup Instructions:**

1. Use public relays for development
2. Generate keys at [nostrtool.com](https://nostrtool.com) (optional)
3. Private key enables publishing, public key for identity

### Feature Flags

```bash
FEATURE_LIGHTNING_PAYMENTS=true
FEATURE_AI_CONTENT_GENERATION=true
FEATURE_NOSTR_PUBLISHING=true
FEATURE_CONTENT_MONETIZATION=true
FEATURE_PREMIUM_SUBSCRIPTIONS=true
```

**Usage in Code:**

```typescript
import { isFeatureEnabled } from '@sovren/shared';

if (isFeatureEnabled('FEATURE_LIGHTNING_PAYMENTS')) {
  // Lightning payment logic
}
```

## 🔍 Validation System

Our environment validation system provides:

- **Type Safety**: Automatic type conversion and validation
- **Required Field Checking**: Ensures all required variables are set
- **Format Validation**: URLs, emails, ports, etc.
- **Environment-Specific Rules**: Different requirements for dev/prod
- **Security Validation**: Checks for insecure default values

### Running Validation

```bash
# Validate current environment
node scripts/validate-env.js

# Output example:
🔍 Sovren Environment Validation
=====================================

ℹ️  Environment: DEVELOPMENT

📋 CORE Configuration:
✅ NODE_ENV ✓
✅ PORT ✓

📋 SUPABASE Configuration:
✅ SUPABASE_URL ✓
✅ SUPABASE_ANON_KEY ✓
✅ SUPABASE_SERVICE_ROLE_KEY ✓

🔒 Security Checks:
✅ Security configuration ✓

📊 Validation Summary:
====================
✅ Environment validation PASSED
✅ All required variables are properly configured
```

### Validation Rules

| Variable          | Development  | Production   | Validation              |
| ----------------- | ------------ | ------------ | ----------------------- |
| JWT_SECRET        | Min 32 chars | Min 64 chars | Length + security check |
| SUPABASE_URL      | Required     | Required     | Valid URL format        |
| PORT              | Default 3001 | Required     | 1-65535 range           |
| NOSTR_RELAYS      | Required     | Required     | WebSocket URLs (wss://) |
| Lightning amounts | Optional     | Required     | Min < Max validation    |

## 🔒 Security Guidelines

### Secret Management

1. **Never commit secrets to version control**
2. **Use different secrets per environment**
3. **Rotate secrets regularly**
4. **Use strong, random secrets**

### Production Security Checklist

- [ ] JWT_SECRET is 64+ characters
- [ ] SESSION_SECRET is 64+ characters
- [ ] SECURE_COOKIES=true
- [ ] HELMET_ENABLED=true
- [ ] DEBUG_ENABLED=false
- [ ] Sentry DSN configured
- [ ] CORS_ORIGIN set to production domain

### Secret Generation

```bash
# Strong JWT secret (64 chars)
openssl rand -hex 64

# Session secret (64 chars)
openssl rand -hex 64

# Webhook secret (32 chars)
openssl rand -hex 32
```

## 🌍 Environment-Specific Settings

### Development Environment

```bash
NODE_ENV=development
DEBUG_ENABLED=true
LOG_LEVEL=debug
HOT_RELOAD=true
CORS_ORIGIN=http://localhost:3000,http://localhost:5173
SECURE_COOKIES=false
RATE_LIMIT_MAX_REQUESTS=1000  # Relaxed for development
```

### Production Environment

```bash
NODE_ENV=production
DEBUG_ENABLED=false
LOG_LEVEL=info
SECURE_COOKIES=true
HELMET_ENABLED=true
CORS_ORIGIN=https://your-domain.com
RATE_LIMIT_MAX_REQUESTS=100   # Stricter for production

# Additional production requirements
DOMAIN=your-domain.com
SSL_EMAIL=admin@your-domain.com
SENTRY_DSN=https://your-sentry-dsn
```

### Test Environment

```bash
NODE_ENV=test
LOG_LEVEL=error
TEST_DATABASE_URL=postgresql://sovren:test@localhost:5432/sovren_test
TEST_REDIS_URL=redis://localhost:6380
```

## 🔧 Advanced Configuration

### Database Configuration

```bash
# Supabase (recommended)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Alternative: Direct PostgreSQL
DATABASE_URL=postgresql://user:pass@localhost:5432/sovren
```

### File Storage Configuration

```bash
# Local storage (development)
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760  # 10MB

# IPFS storage (optional)
IPFS_GATEWAY_URL=https://ipfs.io/ipfs/
PINATA_JWT_TOKEN=your-pinata-token

# Arweave storage (optional)
ARWEAVE_GATEWAY_URL=https://arweave.net
ARWEAVE_WALLET_PATH=./arweave-wallet.json
```

### Monitoring & Observability

```bash
# Sentry error tracking
SENTRY_DSN=https://your-sentry-dsn
SENTRY_ENVIRONMENT=production

# Prometheus metrics
PROMETHEUS_ENABLED=true

# Grafana
GRAFANA_PASSWORD=secure-password
```

## 🐛 Troubleshooting

### Common Issues

#### "Environment validation FAILED"

**Problem**: Required variables are missing or invalid.

**Solution**:

1. Run validation script: `node scripts/validate-env.cjs`
2. Check error messages for specific missing variables
3. Copy from template: `cp env.development .env`
4. Configure required variables

#### "SUPABASE_URL must be a valid URL"

**Problem**: Invalid or missing Supabase URL.

**Solution**:

1. Check Supabase project dashboard
2. Copy URL from Settings → API
3. Ensure format: `https://your-project.supabase.co`

#### "JWT_SECRET must be at least 32 characters"

**Problem**: JWT secret is too short.

**Solution**:

```bash
# Generate secure secret
openssl rand -hex 32
# Copy output to JWT_SECRET in .env
```

#### "Invalid NOSTR relay URLs"

**Problem**: NOSTR relays must use WebSocket protocol.

**Solution**:

```bash
# Correct format
NOSTR_RELAYS=wss://relay.damus.io,wss://nos.lol

# Not http:// or https://
```

#### Docker Environment Issues

**Problem**: Environment variables not loading in Docker.

**Solution**:

1. Ensure `.env` file exists in project root
2. Check docker-compose.yml env_file configuration
3. Restart containers: `./scripts/docker-dev.sh restart`

### Debugging Environment

```bash
# Check loaded environment variables
node -e "console.log(process.env)" | grep SUPABASE

# Validate specific configuration
node -e "
const { getConfig } = require('./packages/shared/src/config/environment');
console.log(getConfig());
"

# Test environment loading
npm run test packages/shared/src/config/__tests__/environment.test.ts
```

### Getting Help

1. **Check validation output**: `node scripts/validate-env.cjs`
2. **Review this documentation**: Ensure all required variables are set
3. **Check example files**: Compare with `env.example` or `env.development`
4. **Run tests**: `npm test` to ensure configuration is working
5. **Docker logs**: `./scripts/docker-dev.sh logs` for container issues

## 📚 References

- [Supabase Documentation](https://supabase.com/docs)
- [LNbits API Documentation](https://github.com/lnbits/lnbits)
- [NOSTR Protocol](https://github.com/nostr-protocol/nostr)
- [Environment Variables Best Practices](https://12factor.net/config)
- [Docker Environment Variables](https://docs.docker.com/compose/environment-variables/)

---

**Need Help?** Check our [troubleshooting guide](../troubleshooting.md) or open an issue on GitHub.
