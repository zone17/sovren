# Secrets Migration Guide

**Version**: 1.0.0
**Last Updated**: 2025-10-30
**User Story**: US-005

## Overview

This guide provides step-by-step instructions for migrating from `.env` file-based secrets management to AWS Secrets Manager in the Sovren platform.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Migration Steps](#migration-steps)
- [Secret Rotation](#secret-rotation)
- [Zero-Downtime Migration](#zero-downtime-migration)
- [Rollback Procedure](#rollback-procedure)
- [Validation](#validation)

## Prerequisites

### Required Access

- [ ] AWS account with Secrets Manager access
- [ ] IAM permissions to create/read secrets
- [ ] Production environment access
- [ ] Deployment pipeline permissions

### Required Tools

```bash
# AWS CLI
aws --version  # v2.x required

# GitHub CLI
gh --version

# jq for JSON processing
jq --version
```

### Current State Assessment

```bash
# List all environment variables in use
cd packages/backend
grep -r "process.env\." src/ | cut -d'.' -f2 | cut -d')' -f1 | sort | uniq

# Check current .env file
cat .env | grep -v "^#" | grep -v "^$" | wc -l
```

## Migration Steps

### Phase 1: AWS Setup (30 minutes)

#### 1.1 Create IAM Policy

Create file `sovren-secrets-policy.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret",
        "secretsmanager:CreateSecret",
        "secretsmanager:UpdateSecret",
        "secretsmanager:ListSecrets"
      ],
      "Resource": [
        "arn:aws:secretsmanager:us-east-1:*:secret:sovren/prod/*",
        "arn:aws:secretsmanager:us-east-1:*:secret:sovren/staging/*",
        "arn:aws:secretsmanager:us-east-1:*:secret:sovren/dev/*"
      ]
    }
  ]
}
```

Apply policy:

```bash
# Create policy
aws iam create-policy \
  --policy-name SovrenSecretsReadWrite \
  --policy-document file://sovren-secrets-policy.json

# Create IAM user for backend
aws iam create-user --user-name sovren-backend-prod

# Attach policy
aws iam attach-user-policy \
  --user-name sovren-backend-prod \
  --policy-arn arn:aws:iam::YOUR_ACCOUNT_ID:policy/SovrenSecretsReadWrite

# Create access keys
aws iam create-access-key --user-name sovren-backend-prod > backend-credentials.json
```

**Save credentials securely!**

#### 1.2 Create Secrets in AWS

Migration script `migrate-secrets.sh`:

```bash
#!/bin/bash
set -e

# Load current .env
source packages/backend/.env

# Environment (prod/staging/dev)
ENV=${1:-prod}
REGION=${AWS_REGION:-us-east-1}

echo "Migrating secrets to AWS Secrets Manager for environment: $ENV"

# Function to create secret
create_secret() {
  local env_var=$1
  local secret_name=$2
  local value=${!env_var}

  if [ -z "$value" ]; then
    echo "⚠️  Skipping $env_var (not set)"
    return
  fi

  echo "Creating secret: $secret_name"
  aws secretsmanager create-secret \
    --name "$secret_name" \
    --secret-string "$value" \
    --region "$REGION" \
    2>/dev/null || \
  aws secretsmanager update-secret \
    --secret-id "$secret_name" \
    --secret-string "$value" \
    --region "$REGION"

  echo "✅ Migrated: $env_var → $secret_name"
}

# Migrate Database Secrets
create_secret "SUPABASE_URL" "sovren/$ENV/supabase/url"
create_secret "SUPABASE_ANON_KEY" "sovren/$ENV/supabase/anon-key"
create_secret "SUPABASE_SERVICE_ROLE_KEY" "sovren/$ENV/supabase/service-role-key"

# Migrate Auth Secrets
create_secret "JWT_SECRET" "sovren/$ENV/auth/jwt-secret"
create_secret "JWT_REFRESH_SECRET" "sovren/$ENV/auth/jwt-refresh-secret"

# Migrate Lightning Secrets
create_secret "LNBITS_API_KEY" "sovren/$ENV/lightning/lnbits-api-key"
create_secret "LNBITS_WALLET_ID" "sovren/$ENV/lightning/lnbits-wallet-id"
create_secret "LIGHTNING_WEBHOOK_SECRET" "sovren/$ENV/lightning/webhook-secret"

# Migrate Redis Secrets
create_secret "REDIS_URL" "sovren/$ENV/redis/url"
create_secret "REDIS_PASSWORD" "sovren/$ENV/redis/password"

# Migrate Email Secrets
create_secret "SMTP_PASSWORD" "sovren/$ENV/email/smtp-password"
create_secret "SENDGRID_API_KEY" "sovren/$ENV/email/sendgrid-api-key"

# Migrate Monitoring Secrets
create_secret "SENTRY_DSN" "sovren/$ENV/monitoring/sentry-dsn"
create_secret "DATADOG_API_KEY" "sovren/$ENV/monitoring/datadog-api-key"

# Migrate NOSTR Secrets
create_secret "NOSTR_RELAY_AUTH_SECRET" "sovren/$ENV/nostr/relay-auth-secret"

echo ""
echo "✅ Migration complete for environment: $ENV"
echo ""
echo "Verify secrets:"
echo "aws secretsmanager list-secrets --region $REGION | grep sovren/$ENV"
```

Run migration:

```bash
chmod +x migrate-secrets.sh

# Migrate staging first
./migrate-secrets.sh staging

# Then production
./migrate-secrets.sh prod
```

#### 1.3 Verify Migration

```bash
# List all migrated secrets
aws secretsmanager list-secrets \
  --region us-east-1 \
  --query "SecretList[?starts_with(Name, 'sovren/prod/')].Name" \
  --output table

# Test secret retrieval
aws secretsmanager get-secret-value \
  --secret-id sovren/prod/auth/jwt-secret \
  --region us-east-1 \
  --query SecretString \
  --output text
```

### Phase 2: Code Integration (1 hour)

#### 2.1 Update Environment Configuration

Update `.env.example` to show AWS-based configuration:

```bash
# AWS Configuration (Production)
AWS_REGION=us-east-1
NODE_ENV=production
# AWS credentials provided by IAM role or environment

# Development Override (Optional)
# Set FORCE_AWS_SECRETS=false to use local .env
FORCE_AWS_SECRETS=true

# Development-only local secrets (when FORCE_AWS_SECRETS=false)
# These will be ignored in production
JWT_SECRET=dev-only-secret
SUPABASE_URL=http://localhost:54321
```

#### 2.2 Update Application Bootstrap

Update `packages/backend/src/server.ts`:

```typescript
import { getSecretsService } from './services/SecretsService';

async function bootstrap() {
  try {
    console.log('[Bootstrap] Initializing secrets service...');
    const secretsService = await getSecretsService();

    // Verify critical secrets are available
    const criticalSecrets = ['JWT_SECRET', 'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'LNBITS_API_KEY'];

    console.log('[Bootstrap] Loading critical secrets...');
    const secrets = await secretsService.getSecrets(criticalSecrets);

    // Validate all required secrets are present
    const missing = criticalSecrets.filter((key) => !secrets[key]);
    if (missing.length > 0) {
      throw new Error(`Missing required secrets: ${missing.join(', ')}`);
    }

    console.log('[Bootstrap] All secrets loaded successfully');

    // Continue with app initialization
    const app = await createApp();
    await app.listen(process.env.PORT || 3001);
  } catch (error) {
    console.error('[Bootstrap] Failed to initialize:', error);
    process.exit(1);
  }
}

bootstrap();
```

### Phase 3: Staging Deployment (2 hours)

#### 3.1 Configure Staging Environment

```bash
# Add AWS credentials to staging environment
gh secret set AWS_ACCESS_KEY_ID --env staging --body "..."
gh secret set AWS_SECRET_ACCESS_KEY --env staging --body "..."
gh secret set AWS_REGION --env staging --body "us-east-1"
```

#### 3.2 Deploy to Staging

```bash
# Trigger staging deployment
gh workflow run backend-deployment.yml -f environment=staging

# Monitor deployment
gh run watch

# Check logs
gh run view --log
```

#### 3.3 Validate Staging

```bash
# Health check
curl https://staging-api.sovren.app/health

# Test authentication (should use AWS secrets)
curl -X POST https://staging-api.sovren.app/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}'

# Check secret service stats
curl https://staging-api.sovren.app/admin/secrets/stats \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Phase 4: Production Migration (1 hour)

#### 4.1 Blue-Green Deployment Setup

```bash
# Deploy new version alongside current (blue-green)
# Current production: blue
# New version with AWS secrets: green

# Configure green environment
kubectl apply -f k8s/green-deployment.yml
```

#### 4.2 Gradual Traffic Shift

```bash
# Route 10% traffic to green
kubectl patch service sovren-backend -p '{"spec":{"selector":{"version":"green","weight":"10"}}}'

# Monitor for 15 minutes
# Check error rates, response times

# If stable, increase to 50%
kubectl patch service sovren-backend -p '{"spec":{"selector":{"version":"green","weight":"50"}}}'

# Monitor for 15 minutes

# If stable, route 100% to green
kubectl patch service sovren-backend -p '{"spec":{"selector":{"version":"green","weight":"100"}}}'
```

#### 4.3 Decommission Blue

```bash
# After 24 hours of stable green deployment
kubectl delete deployment sovren-backend-blue
```

## Secret Rotation

### Automated Rotation Script

Create `rotate-secret.sh`:

```bash
#!/bin/bash
set -e

SECRET_NAME=$1
ENV=${2:-prod}
REGION=${AWS_REGION:-us-east-1}

if [ -z "$SECRET_NAME" ]; then
  echo "Usage: ./rotate-secret.sh <env-var-name> [environment]"
  exit 1
fi

echo "Rotating secret: $SECRET_NAME for environment: $ENV"

# Map env var to AWS secret name
case $SECRET_NAME in
  "JWT_SECRET")
    AWS_SECRET="sovren/$ENV/auth/jwt-secret"
    NEW_VALUE=$(openssl rand -hex 32)
    ;;
  "LIGHTNING_WEBHOOK_SECRET")
    AWS_SECRET="sovren/$ENV/lightning/webhook-secret"
    NEW_VALUE=$(openssl rand -hex 32)
    ;;
  *)
    echo "❌ Unknown secret: $SECRET_NAME"
    exit 1
    ;;
esac

# Backup current value
echo "📦 Backing up current secret..."
CURRENT_VALUE=$(aws secretsmanager get-secret-value \
  --secret-id "$AWS_SECRET" \
  --region "$REGION" \
  --query SecretString \
  --output text)

echo "$CURRENT_VALUE" > "backup-$SECRET_NAME-$(date +%Y%m%d-%H%M%S).txt"
echo "✅ Backup saved"

# Update secret
echo "🔄 Updating secret in AWS..."
aws secretsmanager update-secret \
  --secret-id "$AWS_SECRET" \
  --secret-string "$NEW_VALUE" \
  --region "$REGION"

echo "✅ Secret updated in AWS"

# Trigger cache refresh in running instances
echo "♻️  Refreshing secret cache in running instances..."
curl -X POST https://api.sovren.app/admin/secrets/refresh \
  -H "Authorization: Bearer $ADMIN_TOKEN"

echo "✅ Rotation complete for $SECRET_NAME"
echo ""
echo "⚠️  Important notes:"
case $SECRET_NAME in
  "JWT_SECRET")
    echo "- All user sessions are now invalid"
    echo "- Users must re-authenticate"
    ;;
esac
```

Usage:

```bash
# Rotate JWT secret
./rotate-secret.sh JWT_SECRET prod

# Rotate webhook secret
./rotate-secret.sh LIGHTNING_WEBHOOK_SECRET prod
```

## Zero-Downtime Migration

### Strategy: Dual-Read Mode

During migration, support both .env and AWS simultaneously:

```typescript
// Temporary migration mode
async function getSecretWithFallback(secretsService: SecretsService, key: string): Promise<string> {
  try {
    // Try AWS first
    const value = await secretsService.getSecret(key);
    if (value) return value;
  } catch (error) {
    console.warn(`AWS lookup failed for ${key}, using fallback`);
  }

  // Fallback to env var
  return process.env[key] || '';
}
```

This allows gradual migration without service interruption.

## Rollback Procedure

### Quick Rollback

If issues occur after migration:

```bash
# 1. Disable AWS Secrets Manager
export FORCE_AWS_SECRETS=false

# 2. Ensure .env file is present
cp .env.backup .env

# 3. Restart application
pm2 restart sovren-backend

# Or for Docker
docker-compose restart backend

# Or for Kubernetes
kubectl rollout undo deployment/sovren-backend
```

### Full Rollback Script

```bash
#!/bin/bash
# rollback-to-env.sh

echo "🔄 Rolling back to .env-based secrets..."

# 1. Update environment variable
gh variable set USE_AWS_SECRETS --body "false"

# 2. Trigger deployment with previous version
gh workflow run backend-deployment.yml \
  -f environment=production \
  -f version=previous \
  -f force_deploy=true

# 3. Monitor rollback
gh run watch

echo "✅ Rollback initiated"
echo "⚠️  Monitor logs for any issues"
```

## Validation

### Post-Migration Checklist

```bash
# 1. Verify all secrets accessible
node scripts/validate-secrets.js

# 2. Check secret service stats
curl https://api.sovren.app/admin/secrets/stats

# 3. Verify zero .env file in production
ssh production-server "cat /app/.env 2>&1"  # Should not exist

# 4. Check AWS CloudTrail for access logs
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=ResourceName,AttributeValue=sovren/prod/auth/jwt-secret \
  --region us-east-1

# 5. Load test with new secrets
k6 run tests/performance/auth-flow.js
```

### Validation Script

Create `scripts/validate-secrets.js`:

```javascript
#!/usr/bin/env node
const { getSecretsService } = require('../dist/services/SecretsService');

async function validate() {
  const secretsService = await getSecretsService();

  const requiredSecrets = [
    'JWT_SECRET',
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'LNBITS_API_KEY',
    'LNBITS_WALLET_ID',
    'LIGHTNING_WEBHOOK_SECRET',
  ];

  console.log('🔍 Validating secrets...\n');

  let allValid = true;

  for (const secret of requiredSecrets) {
    try {
      const value = await secretsService.getSecret(secret);
      if (value && value.length > 0) {
        console.log(`✅ ${secret}: OK (${value.length} chars)`);
      } else {
        console.log(`❌ ${secret}: EMPTY`);
        allValid = false;
      }
    } catch (error) {
      console.log(`❌ ${secret}: ERROR - ${error.message}`);
      allValid = false;
    }
  }

  const stats = secretsService.getStats();
  console.log('\n📊 Secret Service Stats:');
  console.log(`   Cache Hits: ${stats.cacheHits}`);
  console.log(`   Cache Misses: ${stats.cacheMisses}`);
  console.log(`   AWS Calls: ${stats.awsCalls}`);
  console.log(`   Env Fallbacks: ${stats.envFallbacks}`);
  console.log(`   Errors: ${stats.errors}`);

  if (allValid) {
    console.log('\n✅ All secrets validated successfully');
    process.exit(0);
  } else {
    console.log('\n❌ Some secrets failed validation');
    process.exit(1);
  }
}

validate().catch((error) => {
  console.error('❌ Validation failed:', error);
  process.exit(1);
});
```

## Timeline Summary

| Phase                | Duration      | Description                          |
| -------------------- | ------------- | ------------------------------------ |
| AWS Setup            | 30 min        | Create IAM policies, migrate secrets |
| Code Integration     | 1 hour        | Update application code              |
| Staging Deploy       | 2 hours       | Test in staging environment          |
| Production Migration | 1 hour        | Blue-green deployment to production  |
| **Total**            | **4.5 hours** | Complete migration                   |

## Success Criteria

- [ ] All secrets migrated to AWS Secrets Manager
- [ ] Zero secrets in `.env` files in production
- [ ] All services running with AWS secrets
- [ ] Secret rotation tested and working
- [ ] Rollback procedure validated
- [ ] Monitoring and alerting configured
- [ ] Team trained on new system
- [ ] Documentation updated

## Support

For migration issues:

- **Slack**: #platform-engineering
- **On-Call**: PagerDuty - Platform Team
- **Email**: platform@sovren.com

---

**Document Version**: 1.0.0
**User Story**: US-005
**Last Updated**: 2025-10-30
