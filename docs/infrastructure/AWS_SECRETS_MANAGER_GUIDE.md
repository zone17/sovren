# AWS Secrets Manager Integration Guide

**Centralized Secrets Management for Production-Ready Infrastructure**

## Overview

AWS Secrets Manager provides secure, centralized secrets management for the Sovren platform with:

- **Automatic encryption** at rest (AES-256)
- **Automatic rotation** support
- **Fine-grained access control** via IAM
- **Audit logging** via CloudWatch
- **High availability** (99.99% SLA)
- **FREE tier**: 10,000 API calls/month

## Architecture

```mermaid
graph TB
    A[Application] -->|Get Secrets| B[Secrets Service]
    B -->|Cache Hit| C[In-Memory Cache]
    B -->|Cache Miss| D[AWS Secrets Manager]
    D -->|Encrypted| E[AWS KMS]
    D -->|Audit Logs| F[CloudWatch Logs]
    D -->|Alarms| G[CloudWatch Alarms]

    subgraph "Secrets Service"
        B
        C
    end

    subgraph "AWS"
        D
        E
        F
        G
    end

    style A fill:#3498db,color:#fff
    style B fill:#2ecc71,color:#fff
    style D fill:#e74c3c,color:#fff
```

## Quick Start

### 1. Install AWS CLI

```bash
# macOS
brew install awscli

# Configure credentials
aws configure
```

### 2. Deploy Secrets to AWS

```bash
# Navigate to Terraform directory
cd infrastructure/terraform/environments/production

# Initialize Terraform
./../../scripts/init.sh production

# Validate configuration
./../../scripts/validate.sh production

# Deploy secrets
./../../scripts/deploy.sh production
```

### 3. Update Application Configuration

```bash
# Backend .env
echo "USE_AWS_SECRETS=true" >> packages/backend/.env
echo "AWS_REGION=us-east-1" >> packages/backend/.env
```

### 4. Restart Application

```bash
# Development
npm run dev

# Production
npm run start:prod
```

## Secrets Structure

### Supabase Keys

```json
{
  "url": "https://your-project.supabase.co",
  "anon_key": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "service_key": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**AWS Secret Name**: `sovren/production/supabase-keys`

### Database Configuration

```json
{
  "url": "postgresql://user:password@host:5432/database",
  "host": "db.supabase.co",
  "port": 5432,
  "database": "sovren_production",
  "user": "sovren_prod",
  "password": "secure-password"
}
```

**AWS Secret Name**: `sovren/production/database-url`

### JWT Configuration

```json
{
  "secret": "your-256-bit-secret-key",
  "expires_in": "24h"
}
```

**AWS Secret Name**: `sovren/production/jwt-secret`

### Lightning Network Keys

```json
{
  "lnbits_url": "https://legend.lnbits.com",
  "lnbits_api_key": "your-api-key",
  "lnbits_wallet_id": "your-wallet-id",
  "webhook_secret": "your-webhook-secret"
}
```

**AWS Secret Name**: `sovren/production/lightning-keys`

### GitHub Configuration

```json
{
  "token": "ghp_your_personal_access_token",
  "owner": "zone17",
  "repo": "sovren"
}
```

**AWS Secret Name**: `sovren/production/github-token`

## Usage Examples

### Basic Usage

```typescript
import { getSecretsService } from './services/secrets-service';

// Get secrets service instance
const secrets = getSecretsService();

// Fetch Supabase keys
const supabaseKeys = await secrets.getSupabaseKeys();
console.log(supabaseKeys.url);

// Fetch database config
const dbConfig = await secrets.getDatabaseConfig();
console.log(dbConfig.host);
```

### With Application Startup

```typescript
import { initializeSecretsService } from './services/secrets-service';
import express from 'express';

async function startServer() {
  // Initialize secrets service
  const secrets = await initializeSecretsService({
    environment: 'production',
    region: 'us-east-1',
    useLocalFallback: false, // No fallback in production
  });

  // Create Express app
  const app = express();

  // Use secrets in configuration
  const supabase = await secrets.getSupabaseKeys();
  const jwt = await secrets.getJWTConfig();

  // ... configure app

  app.listen(3000);
}

startServer();
```

### With Configuration Integration

```typescript
import { getDatabaseConfig } from './config/aws-secrets.config';

// Initialize secrets at startup
await initializeSecrets();

// Get database configuration
const dbConfig = await getDatabaseConfig();

// Create database connection
const pool = createDatabasePool(dbConfig);
```

## Caching Behavior

The secrets service implements intelligent caching:

- **Default TTL**: 5 minutes
- **Cache Location**: In-memory (per process)
- **Cache Invalidation**: Automatic after TTL expires
- **Manual Invalidation**: `secrets.clearCache()`

### Cache Metrics

```typescript
// Cache hit ratio
const totalRequests = 1000;
const cacheHits = 990;
const hitRatio = (cacheHits / totalRequests) * 100; // 99%

// API call reduction
const withoutCache = 1000; // API calls
const withCache = 10; // Only on cache misses
const savings = withoutCache - withCache; // 990 API calls saved
```

**With 5-minute caching, you reduce AWS API calls by 99%!**

## Local Development

For local development, the service automatically falls back to environment variables:

```bash
# packages/backend/.env.development
NODE_ENV=development
USE_AWS_SECRETS=false  # Use local .env

# Supabase
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=local-anon-key

# Database
DATABASE_URL=postgresql://localhost:5432/sovren_dev
DB_HOST=localhost
DB_PORT=5432
DB_NAME=sovren_dev
DB_USER=sovren
DB_PASSWORD=dev_password

# JWT
JWT_SECRET=dev-jwt-secret-change-in-production
JWT_EXPIRES_IN=24h

# Lightning
LNBITS_URL=https://legend.lnbits.com
LNBITS_API_KEY=dev-api-key
LNBITS_WALLET_ID=dev-wallet-id
LIGHTNING_WEBHOOK_SECRET=dev-webhook-secret

# GitHub
GITHUB_TOKEN=your-github-token
```

## Secrets Rotation

### Manual Rotation

```bash
# Update secret value
aws secretsmanager update-secret \
  --secret-id sovren/production/jwt-secret \
  --secret-string '{"secret":"new-secret","expires_in":"24h"}'

# Clear application cache (optional - auto-refreshes after TTL)
curl -X POST https://api.sovren.dev/admin/secrets/clear-cache
```

### Automatic Rotation

AWS Secrets Manager supports automatic rotation via Lambda functions:

```hcl
# terraform/modules/secrets-manager/rotation.tf
resource "aws_secretsmanager_secret_rotation" "jwt_secret" {
  secret_id           = aws_secretsmanager_secret.jwt_secret.id
  rotation_lambda_arn = aws_lambda_function.rotate_jwt.arn

  rotation_rules {
    automatically_after_days = 90
  }
}
```

**Rotation Schedule**:

- **JWT secrets**: 90 days
- **API keys**: 90 days
- **Database passwords**: 180 days
- **Service keys**: Manual (on-demand)

## Security Best Practices

### 1. Never Commit Secrets to Git

```bash
# .gitignore
*.tfvars
*.tfstate
*.tfstate.backup
.env
.env.local
secrets-backup.txt
```

### 2. Use IAM Roles (Not Access Keys)

```hcl
# For EC2/ECS/Lambda
resource "aws_iam_role_policy_attachment" "secrets_access" {
  role       = aws_iam_role.app_role.name
  policy_arn = module.secrets_manager.secrets_access_policy_arn
}
```

### 3. Enable Audit Logging

```bash
# View secret access logs
aws logs tail /aws/secretsmanager/sovren/production --follow
```

### 4. Set Up Alarms

```bash
# High access rate alarm
aws cloudwatch describe-alarms \
  --alarm-names sovren-production-high-secret-access
```

### 5. Principle of Least Privilege

Only grant `GetSecretValue` permission, not `PutSecretValue`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"],
      "Resource": "arn:aws:secretsmanager:*:*:secret:sovren/production/*"
    }
  ]
}
```

## Monitoring & Observability

### CloudWatch Metrics

```bash
# Get secret access count
aws cloudwatch get-metric-statistics \
  --namespace AWS/SecretsManager \
  --metric-name GetSecretValue \
  --dimensions Name=SecretId,Value=sovren/production/supabase-keys \
  --start-time $(date -u -d '7 days ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 86400 \
  --statistics Sum
```

### Health Check Endpoint

```typescript
app.get('/health/secrets', async (req, res) => {
  const healthy = await checkSecretsHealth();

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'healthy' : 'degraded',
    service: 'AWS Secrets Manager',
    timestamp: new Date().toISOString(),
  });
});
```

## Cost Optimization

### FREE Tier Breakdown

- **Secrets Storage**: 10,000 API calls/month (FREE)
- **After FREE tier**: $0.05 per 10,000 API calls
- **Secret Storage**: $0.40 per secret per month

### Cost Calculation

**Without Caching** (1 req/sec):

```
60 sec/min × 60 min/hr × 24 hr/day × 30 days = 2,592,000 requests/month
Cost: $12.96/month (API calls) + $2.00/month (5 secrets) = $14.96/month
```

**With 5-Minute Caching** (99% reduction):

```
2,592,000 × 0.01 = 25,920 requests/month
Cost: $0.13/month (API calls) + $2.00/month (5 secrets) = $2.13/month
```

**Savings with caching: $12.83/month (85% reduction)**

### Optimization Tips

1. **Use appropriate TTL**: 5 minutes is optimal
2. **Preload secrets**: Load all secrets at startup
3. **Monitor usage**: Set CloudWatch alarms
4. **Batch operations**: Group secret fetches
5. **Use fallback**: Environment variables for dev/test

## Troubleshooting

### Error: "ResourceNotFoundException"

**Cause**: Secret doesn't exist in AWS

**Solution**:

```bash
# Verify secret exists
aws secretsmanager list-secrets --query 'SecretList[?starts_with(Name, `sovren/production`)].Name'

# Create missing secret
terraform apply
```

### Error: "AccessDeniedException"

**Cause**: IAM permissions missing

**Solution**:

```bash
# Check current identity
aws sts get-caller-identity

# Verify permissions
aws secretsmanager get-secret-value \
  --secret-id sovren/production/supabase-keys

# Attach policy (if using IAM role)
aws iam attach-role-policy \
  --role-name sovren-app-role \
  --policy-arn arn:aws:iam::123456789012:policy/sovren-production-secrets-access
```

### Error: "Application can't access secrets"

**Cause**: Secrets service not initialized

**Solution**:

```typescript
// Ensure initializeSecrets() is called at startup
await initializeSecrets();

// Verify initialization
const secrets = getSecrets();
const healthy = await secrets.healthCheck();
console.log('Secrets healthy:', healthy);
```

### Error: "Cache not refreshing"

**Cause**: Cache TTL too long or cache not expiring

**Solution**:

```typescript
// Clear cache manually
const secrets = getSecrets();
secrets.clearCache();

// Adjust TTL (in config)
const secrets = getSecretsService({
  cacheTTL: 60 * 1000, // 1 minute
});
```

## Migration Checklist

- [ ] Install AWS CLI and configure credentials
- [ ] Create Terraform configuration with actual secrets
- [ ] Deploy secrets to AWS Secrets Manager
- [ ] Verify secrets are accessible via AWS CLI
- [ ] Update application configuration (USE_AWS_SECRETS=true)
- [ ] Test secret retrieval in development
- [ ] Deploy to staging and verify
- [ ] Set up CloudWatch alarms
- [ ] Document rotation procedures
- [ ] Remove secrets from .env files
- [ ] Update CI/CD pipelines
- [ ] Train team on secrets management
- [ ] Schedule first secret rotation

## Support

- **Documentation**: `/Users/fp/Desktop/Sovren/infrastructure/terraform/README.md`
- **Terraform Config**: `/Users/fp/Desktop/Sovren/infrastructure/terraform/`
- **Service Code**: `/Users/fp/Desktop/Sovren/packages/backend/src/services/secrets-service.ts`
- **AWS Docs**: https://docs.aws.amazon.com/secretsmanager/

## References

- [AWS Secrets Manager Pricing](https://aws.amazon.com/secrets-manager/pricing/)
- [AWS Secrets Manager Best Practices](https://docs.aws.amazon.com/secretsmanager/latest/userguide/best-practices.html)
- [Terraform AWS Provider Docs](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
