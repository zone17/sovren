# Secrets Management Guide

**Epic**: 006 - Automated Deployment Pipeline
**Last Updated**: 2025-10-27
**Status**: Production-Ready

## Table of Contents

- [Overview](#overview)
- [Required Secrets](#required-secrets)
- [Secret Configuration](#secret-configuration)
- [Secrets by Environment](#secrets-by-environment)
- [Rotation Procedures](#rotation-procedures)
- [Security Best Practices](#security-best-practices)
- [Troubleshooting](#troubleshooting)

## Overview

This document provides a comprehensive inventory of all secrets required for the Sovren automated deployment pipeline and backend services.

**Security Principles**:
- ✅ No secrets in code (ever)
- ✅ Use GitHub Secrets for CI/CD
- ✅ Environment-specific secrets
- ✅ Regular rotation (90-day cycle)
- ✅ Least privilege access
- ✅ Audit logging enabled

## Required Secrets

### Container Registry

#### `GITHUB_TOKEN`
- **Type**: Automatically provided by GitHub Actions
- **Purpose**: Authenticate to GitHub Container Registry (GHCR)
- **Permissions**: `packages:write`, `contents:read`
- **Scope**: Repository
- **Rotation**: Automatic (GitHub managed)
- **Validation**: Automatic in workflow

**No manual configuration required** - GitHub automatically provides this token with appropriate permissions.

---

### Deployment Infrastructure

#### `DEPLOYMENT_TOKEN`
- **Type**: API token for deployment platform
- **Purpose**: Authenticate to deployment service (Railway, Render, etc.)
- **Where to Obtain**:
  - **Railway**: Dashboard → Settings → Tokens → Create Token
  - **Render**: Account Settings → API Keys → Create Key
  - **Kubernetes**: Service account token
- **Permissions**: Deploy services, manage environments
- **Rotation**: Every 90 days
- **Validation**: Test deployment to staging

**Setup Instructions**:
```bash
# Add to GitHub Secrets
gh secret set DEPLOYMENT_TOKEN --body "your-token-here"

# Verify secret is set
gh secret list | grep DEPLOYMENT_TOKEN
```

---

### Database & Cache

#### `DATABASE_URL`
- **Type**: PostgreSQL connection string
- **Purpose**: Connect to Supabase PostgreSQL database
- **Format**: `postgresql://[user]:[password]@[host]:[port]/[database]?sslmode=require`
- **Where to Obtain**: Supabase Dashboard → Settings → Database → Connection string
- **Permissions**: Read/write access to application schema
- **Rotation**: Every 90 days (password rotation)
- **Validation**: Connection test in health check

**Example**:
```
postgresql://postgres.abcdefghij:password@aws-0-us-west-1.pooler.supabase.com:6543/postgres
```

**Setup Instructions**:
```bash
# Production
gh secret set DATABASE_URL --body "postgresql://..."

# Staging
gh secret set STAGING_DATABASE_URL --body "postgresql://..."
```

#### `REDIS_URL`
- **Type**: Redis connection string
- **Purpose**: Connect to Redis cache
- **Format**: `redis://[user]:[password]@[host]:[port]/[db]`
- **Where to Obtain**:
  - **Upstash**: Dashboard → Database → Connection Details
  - **Redis Cloud**: Database → Configuration → Connection String
- **Permissions**: Read/write to cache keys
- **Rotation**: Every 90 days
- **Validation**: PING command in health check

**Example**:
```
redis://:password@redis-12345.c1.us-west-1.ec2.cloud.redislabs.com:12345
```

**Setup Instructions**:
```bash
gh secret set REDIS_URL --body "redis://..."
gh secret set STAGING_REDIS_URL --body "redis://..."
```

---

### Supabase

#### `SUPABASE_URL`
- **Type**: Project URL
- **Purpose**: Connect to Supabase services
- **Format**: `https://[project-id].supabase.co`
- **Where to Obtain**: Supabase Dashboard → Settings → API → Project URL
- **Permissions**: N/A (public URL)
- **Rotation**: Never (static project URL)
- **Validation**: API reachability test

**Example**:
```
https://abcdefghij.supabase.co
```

#### `SUPABASE_ANON_KEY`
- **Type**: Public anonymous key
- **Purpose**: Client-side authentication and RLS-protected queries
- **Where to Obtain**: Supabase Dashboard → Settings → API → Project API keys (anon public)
- **Permissions**: Respects Row Level Security policies
- **Rotation**: Only if compromised
- **Validation**: Auth endpoint test

**Security Note**: This key is safe to use in client-side code as it respects RLS policies.

#### `SUPABASE_SERVICE_ROLE_KEY`
- **Type**: Service role secret key
- **Purpose**: Server-side operations bypassing RLS
- **Where to Obtain**: Supabase Dashboard → Settings → API → Project API keys (service_role)
- **Permissions**: Full database access (bypasses RLS)
- **Rotation**: Every 90 days
- **Validation**: Service role query test

**Security Warning**: ⚠️ **NEVER expose this key in client-side code**. Server-side only.

**Setup Instructions**:
```bash
gh secret set SUPABASE_URL --body "https://..."
gh secret set SUPABASE_ANON_KEY --body "eyJhbGci..."
gh secret set SUPABASE_SERVICE_ROLE_KEY --body "eyJhbGci..."
```

---

### Lightning Network

#### `LNBITS_API_URL`
- **Type**: LNbits instance URL
- **Purpose**: Connect to Lightning Network node
- **Format**: `https://[your-lnbits-instance].com`
- **Where to Obtain**: Your LNbits installation or hosted service
- **Permissions**: N/A (public URL)
- **Rotation**: Never (static URL)
- **Validation**: Health endpoint check

**Example**:
```
https://legend.lnbits.com
```

#### `LNBITS_ADMIN_KEY`
- **Type**: Admin API key
- **Purpose**: Create invoices, check payment status
- **Where to Obtain**: LNbits → Wallets → Your Wallet → API Info → Admin Key
- **Permissions**: Full wallet access (create invoices, check balances)
- **Rotation**: Every 90 days
- **Validation**: Invoice creation test

**Security Warning**: ⚠️ Grants full access to Lightning wallet. Protect carefully.

**Setup Instructions**:
```bash
gh secret set LNBITS_API_URL --body "https://..."
gh secret set LNBITS_ADMIN_KEY --body "your-admin-key"
```

---

### NOSTR Protocol

#### `NOSTR_RELAYS`
- **Type**: Comma-separated relay URLs
- **Purpose**: Connect to NOSTR relay network
- **Format**: `wss://relay1.com,wss://relay2.com,wss://relay3.com`
- **Where to Obtain**: Public relay list at https://nostr.watch
- **Permissions**: N/A (public relays)
- **Rotation**: Update when relays are unreliable
- **Validation**: WebSocket connection test

**Recommended Relays**:
```
wss://relay.damus.io,wss://relay.snort.social,wss://nos.lol,wss://relay.nostr.band
```

**Setup Instructions**:
```bash
gh secret set NOSTR_RELAYS --body "wss://relay.damus.io,wss://relay.snort.social"
```

---

### Monitoring & Notifications

#### `SLACK_WEBHOOK_URL`
- **Type**: Incoming webhook URL
- **Purpose**: Send deployment notifications to Slack
- **Where to Obtain**:
  1. Go to https://api.slack.com/messaging/webhooks
  2. Create new app or select existing
  3. Enable Incoming Webhooks
  4. Create webhook for your channel
- **Permissions**: Post messages to specific channel
- **Rotation**: Only if compromised
- **Validation**: Test message in workflow

**Example**:
```
https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX
```

**Setup Instructions**:
```bash
gh secret set SLACK_WEBHOOK_URL --body "https://hooks.slack.com/..."
```

**Testing**:
```bash
curl -X POST "$SLACK_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{"text": "Test deployment notification from Sovren"}'
```

---

### Application Secrets

#### `JWT_SECRET`
- **Type**: Secret key for JWT signing
- **Purpose**: Sign and verify authentication tokens
- **Format**: Random string, minimum 32 characters
- **Where to Obtain**: Generate cryptographically secure random string
- **Permissions**: N/A
- **Rotation**: Every 90 days (requires re-authentication of all users)
- **Validation**: Token signing test

**Generate New Secret**:
```bash
# Generate 64-character random string
openssl rand -hex 32

# Or use Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Setup Instructions**:
```bash
jwt_secret=$(openssl rand -hex 32)
gh secret set JWT_SECRET --body "$jwt_secret"
```

**Rotation Impact**: ⚠️ Invalidates all existing user sessions. Plan rotation during low-traffic period.

---

## Secret Configuration

### Via GitHub CLI

```bash
# Add repository secret
gh secret set SECRET_NAME --body "value"

# Add environment-specific secret
gh secret set SECRET_NAME --env production --body "value"
gh secret set SECRET_NAME --env staging --body "value"

# List all secrets
gh secret list

# Delete secret
gh secret delete SECRET_NAME
```

### Via GitHub Web UI

1. Go to repository **Settings**
2. Navigate to **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Enter secret **Name** and **Value**
5. Click **Add secret**

**Environment-Specific Secrets**:
1. Go to **Settings** → **Environments**
2. Select environment (production/staging)
3. Click **Add secret**
4. Enter name and value

---

## Secrets by Environment

### Development (Local)

Secrets stored in `.env` file (never committed to git):

```bash
# Copy example file
cp .env.example .env

# Edit with your local values
nano .env
```

**`.env` Example**:
```env
# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/sovren_dev
REDIS_URL=redis://localhost:6379

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key

# Lightning (testnet)
LNBITS_API_URL=https://legend.lnbits.com
LNBITS_ADMIN_KEY=your-testnet-key

# NOSTR
NOSTR_RELAYS=wss://relay.damus.io,wss://nos.lol

# Application
JWT_SECRET=development-secret-key-change-in-production
NODE_ENV=development
```

### Staging

All secrets configured in GitHub Environments → `staging`:

- `STAGING_DATABASE_URL`
- `STAGING_REDIS_URL`
- `STAGING_DEPLOYMENT_TOKEN`
- All other secrets with `STAGING_` prefix

### Production

All secrets configured in GitHub Environments → `production`:

- `DATABASE_URL`
- `REDIS_URL`
- `DEPLOYMENT_TOKEN`
- All production secrets (no prefix)

---

## Rotation Procedures

### Quarterly Rotation (Every 90 Days)

**Secrets to Rotate**:
- `DEPLOYMENT_TOKEN`
- `DATABASE_URL` (password component)
- `REDIS_URL` (password component)
- `SUPABASE_SERVICE_ROLE_KEY`
- `LNBITS_ADMIN_KEY`
- `JWT_SECRET`

**Rotation Process**:

```bash
#!/bin/bash
# Automated rotation script

# 1. Generate new values
new_jwt_secret=$(openssl rand -hex 32)
new_db_password=$(openssl rand -base64 24)

# 2. Update secrets in GitHub
gh secret set JWT_SECRET --body "$new_jwt_secret"

# 3. Update database password in Supabase
# (Use Supabase CLI or dashboard)

# 4. Update GitHub secret with new connection string
gh secret set DATABASE_URL --body "postgresql://user:$new_db_password@host:port/db"

# 5. Deploy to staging for validation
gh workflow run backend-deployment.yml -f environment=staging

# 6. Monitor staging deployment
gh run watch

# 7. If successful, deploy to production
gh workflow run backend-deployment.yml -f environment=production

# 8. Monitor production health
curl https://api.sovren.app/health
```

### Emergency Rotation (Compromised Secret)

**Immediate Steps**:

1. **Revoke compromised secret** in source system
2. **Generate new secret** immediately
3. **Update GitHub Secret** with new value
4. **Deploy to production** ASAP
5. **Monitor for unauthorized access**
6. **Audit logs** for suspicious activity

**Example (Compromised JWT Secret)**:
```bash
# 1. Generate new secret
new_secret=$(openssl rand -hex 32)

# 2. Update immediately
gh secret set JWT_SECRET --body "$new_secret"

# 3. Emergency deployment
gh workflow run backend-deployment.yml \
  -f environment=production \
  -f force_deploy=true

# 4. Monitor deployment
gh run watch

# 5. All users must re-authenticate
# (Sessions invalidated with old JWT secret)
```

---

## Security Best Practices

### Secret Generation

✅ **DO**:
- Use cryptographically secure random generators
- Minimum 32 characters for secrets
- Use different secrets for each environment
- Document secret purpose and permissions

❌ **DON'T**:
- Use predictable values (e.g., "password123")
- Reuse secrets across environments
- Share secrets via email or chat
- Commit secrets to version control

### Secret Storage

✅ **DO**:
- Use GitHub Secrets for CI/CD
- Use environment variables for runtime
- Encrypt secrets at rest
- Use secret management services (HashiCorp Vault, AWS Secrets Manager)

❌ **DON'T**:
- Hardcode secrets in source code
- Store secrets in configuration files
- Log secret values
- Share secrets in public channels

### Access Control

✅ **DO**:
- Limit access to production secrets
- Use separate secrets for staging/production
- Audit secret access regularly
- Revoke access when team members leave

❌ **DON'T**:
- Share admin credentials
- Use same account for multiple services
- Grant unnecessary permissions
- Skip access reviews

### Rotation

✅ **DO**:
- Rotate secrets every 90 days
- Automate rotation where possible
- Test rotation in staging first
- Document rotation procedures

❌ **DON'T**:
- Delay rotation when compromise suspected
- Rotate without testing
- Skip staging validation
- Forget to update dependent systems

---

## Troubleshooting

### Secret Not Found Error

**Symptom**:
```
Error: Secret DATABASE_URL not found
```

**Solution**:
```bash
# 1. Verify secret exists
gh secret list | grep DATABASE_URL

# 2. Check environment configuration
# Settings → Environments → production → Secrets

# 3. Add missing secret
gh secret set DATABASE_URL --body "postgresql://..."

# 4. Retry deployment
gh workflow run backend-deployment.yml
```

### Invalid Secret Value

**Symptom**:
```
Error: Connection to database failed - authentication failed
```

**Solution**:
```bash
# 1. Test secret locally
export DATABASE_URL="<secret-value>"
psql $DATABASE_URL -c "SELECT 1"

# 2. If fails, regenerate secret
# (Get new connection string from Supabase)

# 3. Update GitHub secret
gh secret set DATABASE_URL --body "new-connection-string"

# 4. Deploy to staging for validation
gh workflow run backend-deployment.yml -f environment=staging
```

### Secret Rotation Failed

**Symptom**:
```
Deployment failed after secret rotation
```

**Solution**:
```bash
# 1. Rollback to previous secret value
# (Use backup of old secret)
gh secret set DATABASE_URL --body "old-connection-string"

# 2. Trigger rollback
gh workflow run automated-rollback.yml \
  -f environment=production \
  -f reason="Secret rotation failed"

# 3. Investigate rotation issue
# (Check logs, verify new secret format)

# 4. Retry rotation after fixing issue
```

---

## Secrets Checklist

### Pre-Deployment

- [ ] All required secrets configured
- [ ] Secrets tested in staging
- [ ] No secrets in source code
- [ ] Environment variables documented
- [ ] Access controls configured

### Post-Deployment

- [ ] Deployment successful with new secrets
- [ ] Health checks passing
- [ ] No authentication errors
- [ ] Secrets rotation scheduled
- [ ] Team notified of changes

### Monthly Review

- [ ] Audit secret access logs
- [ ] Verify rotation schedule
- [ ] Check for unused secrets
- [ ] Update documentation
- [ ] Test secret recovery procedures

---

## Support

**Questions?**
- Slack: `#engineering`
- Docs: `/docs/deployment/`
- Escalation: Create incident ticket

**Security Issues?**
- Report immediately to security team
- Do not discuss in public channels
- Follow incident response protocol

---

**Document Version**: 1.0.0
**Last Updated**: 2025-10-27
**Maintained By**: DevOps Team
**Epic**: 006 - Automated Deployment Pipeline
