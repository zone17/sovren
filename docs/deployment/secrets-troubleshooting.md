# Secrets Troubleshooting Guide

**Status**: Production-Ready
**Last Updated**: 2025-10-27
**Epic**: 006 - Automated Deployment Pipeline
**User Story**: US-E6-006

Complete troubleshooting guide for all deployment secrets issues.

## Table of Contents

- [Quick Diagnostics](#quick-diagnostics)
- [Common Issues](#common-issues)
- [Platform-Specific Issues](#platform-specific-issues)
- [Error Messages](#error-messages)
- [Debugging Tools](#debugging-tools)
- [Emergency Procedures](#emergency-procedures)

## Quick Diagnostics

### Run Automated Validation

```bash
# Validate all secrets
./scripts/validate-deployment-secrets.sh production

# Check specific environment
./scripts/validate-deployment-secrets.sh staging

# Trigger GitHub Actions validation
gh workflow run validate-secrets.yml
```

### Quick Health Check

```bash
# Test essential connectivity
curl -f https://sovren.dev/api/v1/health || echo "❌ Health check failed"
curl -f https://staging.sovren.dev/api/v1/health || echo "❌ Staging health check failed"

# Test database
psql "$DATABASE_URL" -c "SELECT 1;" || echo "❌ Database connection failed"

# Test Redis
redis-cli -u "$REDIS_URL" ping || echo "❌ Redis connection failed"

# Test Vercel
vercel whoami --token "$VERCEL_TOKEN" || echo "❌ Vercel auth failed"
```

## Common Issues

### 1. "Secret not found" in GitHub Actions

**Symptoms**:

- Workflow fails with "secret not found"
- Environment variable is empty/undefined
- Workflow step skipped due to missing secret

**Causes**:

- Secret name typo (case-sensitive)
- Secret not set at correct level (repo vs organization)
- Secret name changed but workflow not updated

**Solutions**:

```bash
# List all secrets
gh secret list

# Check specific secret exists
gh secret list | grep SECRET_NAME

# Set the secret
gh secret set SECRET_NAME

# Verify in workflow (add debug step)
- name: Debug secrets
  run: |
    echo "Checking SECRET_NAME..."
    if [ -z "${{ secrets.SECRET_NAME }}" ]; then
      echo "❌ SECRET_NAME is not set"
      exit 1
    else
      echo "✅ SECRET_NAME is set"
    fi
```

**Prevention**:

- Use consistent naming conventions
- Document all required secrets
- Run validation workflow after changes

---

### 2. "Invalid credentials" / Authentication Failed

**Symptoms**:

- 401 Unauthorized errors
- "Authentication failed" messages
- API returns "invalid token"

**Causes**:

- Secret expired (tokens have expiration)
- Secret value incorrect or truncated
- Whitespace in secret value
- Wrong secret for environment

**Solutions**:

```bash
# Verify secret value (be careful not to expose)
# Check length
echo ${#SECRET_VALUE}

# Check for whitespace
echo "$SECRET_VALUE" | cat -A
# Should not show spaces/tabs at start/end

# Test token directly
# For Vercel
vercel whoami --token "$VERCEL_TOKEN"

# For Supabase
curl -H "apikey: $SUPABASE_ANON_KEY" \
     -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
     "$SUPABASE_URL/rest/v1/"

# Regenerate secret at source
# - Vercel: https://vercel.com/account/tokens
# - GitHub: https://github.com/settings/tokens
# - Supabase: Project Settings → API
```

**Prevention**:

- Always trim whitespace when copying secrets
- Test secrets immediately after setting
- Set expiration reminders (90 days before)

---

### 3. "Environment variable not defined" in Vercel

**Symptoms**:

- Build fails with "VITE_XXX is not defined"
- Frontend cannot access configuration
- Blank values in production

**Causes**:

- Variable not set in correct environment (Production/Preview/Development)
- Missing `VITE_` prefix for frontend variables
- Variable added but not redeployed

**Solutions**:

```bash
# List Vercel environment variables
vercel env ls

# Add missing variable to all environments
vercel env add VITE_SUPABASE_URL production
vercel env add VITE_SUPABASE_URL preview
vercel env add VITE_SUPABASE_URL development

# Pull environment to local
vercel env pull .env.local

# Verify in build logs
# Vercel Dashboard → Deployments → [deployment] → Build Logs
# Search for: "VITE_XXX"

# Trigger redeploy after adding variables
vercel --prod
```

**Prevention**:

- Always set variables in all three environments
- Use `.env.example` as checklist
- Test preview deployment before production

---

### 4. JWT_SECRET / SESSION_SECRET Too Short

**Symptoms**:

- Validation fails with "too short" error
- Security warnings in logs
- Authentication issues

**Causes**:

- Using default/weak secret
- Generated secret too short
- Development secret used in production

**Solutions**:

```bash
# Generate proper production secret (64 chars)
openssl rand -hex 64

# Update GitHub Secret
NEW_JWT_SECRET=$(openssl rand -hex 64)
gh secret set JWT_SECRET -b"$NEW_JWT_SECRET"

# Verify length
echo ${#JWT_SECRET}
# Should output: 64 or greater

# Trigger redeploy
gh workflow run release.yml -f environment=production
```

**Prevention**:

- Always use `openssl rand -hex 64` for production
- Document minimum lengths in `.env.example`
- Run validation before deployment

---

### 5. Database Connection Failed

**Symptoms**:

- "connection refused" errors
- "no pg_hba.conf entry for host" error
- Timeout connecting to database

**Causes**:

- IP not whitelisted in database firewall
- Connection string incorrect
- SSL/TLS not configured
- Database service down

**Solutions**:

```bash
# Test connection locally
psql "$DATABASE_URL" -c "SELECT version();"

# Common errors and fixes:

# Error: "no pg_hba.conf entry for host"
# Fix: Whitelist GitHub Actions IP ranges
# Supabase: Settings → Database → Network Restrictions
# Add: 0.0.0.0/0 (for GitHub Actions) or specific IPs

# Error: "connection refused"
# Fix: Check connection string format
# Correct: postgresql://user:pass@host:5432/db?sslmode=require
# Check: Host, port, credentials

# Error: "SSL connection required"
# Fix: Add SSL mode to connection string
DATABASE_URL="${DATABASE_URL}?sslmode=require"

# Test from GitHub Actions
# Add this step to workflow:
- name: Test Database
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
  run: |
    sudo apt-get install -y postgresql-client
    psql "$DATABASE_URL" -c "SELECT 1;"
```

**Prevention**:

- Always use SSL: `?sslmode=require`
- Whitelist GitHub Actions IP ranges
- Test connectivity from CI before production

---

### 6. Redis Connection Failed

**Symptoms**:

- "connection refused" to Redis
- "NOAUTH Authentication required"
- Cache operations failing

**Causes**:

- Wrong Redis URL format
- Missing authentication
- TLS not configured
- IP restrictions

**Solutions**:

```bash
# Test connection
redis-cli -u "$REDIS_URL" ping
# Should return: PONG

# Common errors:

# Error: "NOAUTH Authentication required"
# Fix: Include password in URL
# Correct: redis://default:PASSWORD@host:6379
# or: rediss://default:PASSWORD@host:6379 (TLS)

# Error: "connection refused"
# Fix: Check firewall rules
# Upstash: Console → Database → Settings → IP Restrictions
# Add GitHub Actions IPs or 0.0.0.0/0

# Error: "SSL connection required"
# Fix: Use rediss:// instead of redis://
REDIS_URL="rediss://default:PASSWORD@host:6379"

# Test from GitHub Actions:
- name: Test Redis
  env:
    REDIS_URL: ${{ secrets.REDIS_URL }}
  run: |
    sudo apt-get install -y redis-tools
    redis-cli -u "$REDIS_URL" ping
```

**Prevention**:

- Use `rediss://` (TLS) in production
- Include authentication in URL
- Test from CI environment

---

### 7. Slack Webhook Not Working

**Symptoms**:

- No notifications received
- HTTP 404 or 403 errors
- Webhook URL rejected

**Causes**:

- Webhook URL expired or revoked
- Incorrect URL format
- Channel deleted or app removed

**Solutions**:

```bash
# Test webhook
curl -X POST -H 'Content-type: application/json' \
  --data '{"text":"Test notification"}' \
  "$SLACK_WEBHOOK_URL"

# Expected: HTTP 200, message appears in Slack

# Common errors:

# HTTP 404: Webhook deleted
# Fix: Create new webhook
# 1. https://api.slack.com/apps/YOUR_APP/incoming-webhooks
# 2. Click "Add New Webhook to Workspace"
# 3. Select channel
# 4. Update SLACK_WEBHOOK_URL secret

# HTTP 403: Forbidden
# Fix: Check app permissions
# Ensure app has chat:write permission

# No message appears: Wrong channel
# Fix: Verify webhook channel in Slack
# Look for previous bot messages

# Update secret
gh secret set SLACK_WEBHOOK_URL -b"https://hooks.slack.com/services/..."
```

**Prevention**:

- Document which channel webhook posts to
- Test after rotation
- Monitor for failed webhook calls

---

### 8. Lightning Node Connection Issues

**Symptoms**:

- "unable to connect to LND" errors
- "invalid macaroon" errors
- Payment operations failing

**Causes**:

- Macaroon expired or invalid
- TLS certificate mismatch
- Node unreachable
- Wrong network (mainnet vs testnet)

**Solutions**:

```bash
# Test LND connection (requires grpcurl or similar)
# For LNbits (easier):
curl -H "X-Api-Key: $LNBITS_ADMIN_KEY" \
  "$LNBITS_API_URL/api/v1/wallet"

# Expected: JSON with wallet info

# Common errors:

# "Invalid macaroon"
# Fix: Regenerate macaroon
# SSH to LND node:
rm ~/.lnd/data/chain/bitcoin/mainnet/admin.macaroon
sudo systemctl restart lnd
xxd -ps -u -c 1000 ~/.lnd/data/chain/bitcoin/mainnet/admin.macaroon
# Update LIGHTNING_NODE_MACAROON

# "TLS certificate verification failed"
# Fix: Update TLS cert
cat ~/.lnd/tls.cert | base64
# Update LIGHTNING_NODE_TLS_CERT

# "Connection refused"
# Fix: Check firewall/network
# Verify LIGHTNING_NODE_URL is accessible
curl -k "$LIGHTNING_NODE_URL"

# Wrong network
# Fix: Ensure testnet for staging, mainnet for production
# Check: /v1/getinfo endpoint
```

**Prevention**:

- Use LNbits for easier integration
- Document network (testnet/mainnet) per environment
- Test payments in staging first

---

## Platform-Specific Issues

### GitHub Secrets

#### Secret Not Accessible in Fork

**Problem**: Secrets not available in pull requests from forks

**Cause**: Security feature - forks don't have access to secrets

**Solution**:

- Secrets only work in main repository
- Use `pull_request_target` trigger (with caution)
- Or: Approve fork PRs to run in main repo

---

#### Secret Updated But Old Value Used

**Problem**: Workflow uses old secret value after update

**Cause**: Workflow run started before secret update

**Solution**:

```bash
# Cancel running workflows
gh run list --workflow=release.yml | head -1 | awk '{print $7}' | xargs gh run cancel

# Trigger new run
gh workflow run release.yml

# Or wait for automatic trigger
```

---

### Vercel Environment Variables

#### Variable Not Loading in Build

**Problem**: Environment variable undefined during build

**Cause**:

- Variable set for wrong environment
- Build cache using old value

**Solution**:

```bash
# Clear Vercel build cache
vercel --prod --force

# Or in Vercel dashboard:
# Settings → General → Clear Cache

# Verify variable is set for production
vercel env ls

# Should show:
# Production: [value]
# Preview: [value]
# Development: [value]
```

---

#### VITE\_ Prefix Required But Missing

**Problem**: Frontend can't access environment variable

**Cause**: Vite requires `VITE_` prefix for client-side variables

**Solution**:

```bash
# Wrong (not accessible in frontend)
SUPABASE_URL=https://...

# Correct (accessible in frontend)
VITE_SUPABASE_URL=https://...

# Rename variable
vercel env rm SUPABASE_URL production
vercel env add VITE_SUPABASE_URL production

# Update code
# Before:
const url = import.meta.env.SUPABASE_URL;

# After:
const url = import.meta.env.VITE_SUPABASE_URL;
```

---

### Supabase

#### Service Role Key Not Working

**Problem**: Service role operations failing

**Cause**:

- Using anon key instead of service role key
- Row Level Security blocking operation
- Key expired/rotated

**Solution**:

```bash
# Verify you're using service role key (not anon key)
# Service role key bypasses RLS, anon key doesn't

# Check if RLS is the issue:
# 1. Go to Supabase Dashboard
# 2. SQL Editor
# 3. Run query with service role key
# If it works in SQL Editor but not API, issue is with key

# Regenerate service role key:
# Settings → API → Generate New Service Role Key
# Copy new key
gh secret set SUPABASE_SERVICE_ROLE_KEY

# Important: Service role key should NEVER be in frontend
# Only use in trusted backend services
```

---

## Error Messages

### "TypeError: Cannot read property 'XXX' of undefined"

**Cause**: Environment variable not loaded

**Solution**:

```typescript
// Add defensive checks
const supabaseUrl = process.env.VITE_SUPABASE_URL;
if (!supabaseUrl) {
  throw new Error('VITE_SUPABASE_URL is required');
}

// Or use optional chaining
const config = {
  url: process.env.VITE_SUPABASE_URL ?? 'fallback',
};
```

---

### "Invalid format for secret XXX"

**Cause**: Secret doesn't match expected pattern

**Solution**:

```bash
# Check validation requirements
./scripts/validate-deployment-secrets.sh production

# Common format issues:

# DATABASE_URL: Must start with postgresql://
DATABASE_URL=postgresql://user:pass@host:5432/db

# REDIS_URL: Must start with redis:// or rediss://
REDIS_URL=rediss://default:pass@host:6379

# SUPABASE_URL: Must end with .supabase.co
SUPABASE_URL=https://project.supabase.co

# SLACK_WEBHOOK_URL: Must start with https://hooks.slack.com/
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T.../B.../...
```

---

### "ECONNREFUSED" / "Connection Refused"

**Cause**: Service unreachable or firewall blocking

**Solution**:

```bash
# Check service is running
curl -I https://your-service.com

# Check firewall rules
# GitHub Actions IP ranges need to be whitelisted
# See: https://api.github.com/meta (actions section)

# Test from GitHub Actions
- name: Debug Connection
  run: |
    curl -v https://your-service.com
    # Check DNS resolution
    nslookup your-service.com
    # Check port accessibility
    nc -zv your-service.com 5432
```

---

## Debugging Tools

### Secret Value Inspection (Secure)

```bash
# Check secret is set (without revealing value)
if [ -z "$SECRET_NAME" ]; then
  echo "❌ SECRET_NAME is not set"
else
  echo "✅ SECRET_NAME is set (length: ${#SECRET_NAME})"
fi

# Check first/last characters (for debugging format)
echo "${SECRET_NAME:0:3}...${SECRET_NAME: -3}"
# Example output: "sk-...xyz"
```

---

### GitHub Actions Debugging

```yaml
# Enable debug logging
# Repository Settings → Secrets → Actions
# Add secret: ACTIONS_STEP_DEBUG = true

# Or in workflow:
- name: Debug Environment
  run: |
    echo "Node version: $(node --version)"
    echo "Environment: $NODE_ENV"
    echo "Secrets loaded: $(env | grep -c SECRET || echo 0)"
    # Don't echo actual secret values!

# Check secret masking
- name: Test Secret Masking
  env:
    TEST_SECRET: ${{ secrets.TEST_SECRET }}
  run: |
    echo "::add-mask::$TEST_SECRET"
    echo "Secret is masked in logs"
```

---

### Local Testing

```bash
# Load secrets locally (development only)
export $(cat .env | xargs)

# Validate locally
npm run validate:env

# Test specific integration
node -e "
require('dotenv').config();
const { testDatabaseConnection } = require('./test-db');
testDatabaseConnection();
"
```

---

## Emergency Procedures

### All Secrets Compromised

**If secrets are exposed publicly**:

```bash
#!/bin/bash
# emergency-rotate-all-secrets.sh

echo "🚨 EMERGENCY: Rotating ALL secrets"

# Infrastructure
gh secret set VERCEL_TOKEN -b"$(read -p 'New Vercel token: ' token && echo $token)"

# Database (requires database admin access)
# Generate new password
NEW_DB_PASS=$(openssl rand -base64 32)
# Update in database
psql -h $DB_HOST -U postgres -c "ALTER USER sovren WITH PASSWORD '$NEW_DB_PASS';"
# Update secret
gh secret set DATABASE_URL -b"postgresql://sovren:$NEW_DB_PASS@$DB_HOST:5432/sovren?sslmode=require"

# Auth secrets
gh secret set JWT_SECRET -b"$(openssl rand -hex 64)"
gh secret set SESSION_SECRET -b"$(openssl rand -hex 64)"
gh secret set ENCRYPTION_KEY -b"$(openssl rand -hex 32)"

# Trigger emergency deployment
gh workflow run release.yml -f environment=production

echo "⏳ Waiting for deployment..."
sleep 300

# Validate
if ./scripts/validate-deployment-secrets.sh production; then
  echo "✅ Emergency rotation complete"
else
  echo "❌ Validation failed - manual intervention required"
  exit 1
fi
```

---

### Rollback After Failed Rotation

**If rotation causes issues**:

```bash
# 1. Identify the secret to rollback
SECRET_NAME="JWT_SECRET"

# 2. Have old secret value ready
read -p "Enter old $SECRET_NAME value: " OLD_VALUE

# 3. Restore old value
gh secret set "$SECRET_NAME" -b"$OLD_VALUE"

# 4. Trigger deployment
gh workflow run release.yml -f environment=production

# 5. Monitor
watch -n 5 'curl -f https://sovren.dev/api/v1/health'
```

---

## Getting Help

### Documentation

- [Secrets Management Guide](./secrets-management.md)
- [Secrets Setup Guide](./secrets-setup-guide.md)
- [Secrets Rotation Procedures](./secrets-rotation.md)

### Support Channels

- **GitHub Issues**: Report bugs/issues
- **Slack**: `#devops` channel for urgent issues
- **On-Call**: Page DevOps engineer for production incidents

### Escalation

**Critical Issues** (production down):

1. Page on-call DevOps engineer
2. Post in #incidents Slack channel
3. Start incident response procedure

**High Priority** (deployment blocked):

1. Post in #devops Slack channel
2. Review this troubleshooting guide
3. Run validation script

**Medium Priority** (non-blocking issues):

1. Create GitHub issue
2. Tag with `secrets`, `deployment`
3. Assign to DevOps team

---

**Document Version**: 1.0.0
**Last Updated**: 2025-10-27
**Maintained by**: DevOps Team
