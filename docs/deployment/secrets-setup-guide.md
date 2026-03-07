# Secrets Setup Guide

**Status**: Production-Ready
**Last Updated**: 2025-10-27
**Epic**: 006 - Automated Deployment Pipeline
**User Story**: US-E6-006

Complete step-by-step instructions for configuring all deployment secrets in the Sovren platform.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Setup Overview](#setup-overview)
- [GitHub Secrets Configuration](#github-secrets-configuration)
- [Vercel Secrets Configuration](#vercel-secrets-configuration)
- [Environment-Specific Configuration](#environment-specific-configuration)
- [Validation & Testing](#validation--testing)
- [Troubleshooting](#troubleshooting)

## Prerequisites

Before configuring secrets, ensure you have:

- [ ] GitHub repository admin access
- [ ] Vercel account with project access
- [ ] Supabase project created
- [ ] Command-line tools installed:
  - `gh` (GitHub CLI)
  - `vercel` (Vercel CLI)
  - `openssl` (for secret generation)

### Install Required Tools

```bash
# GitHub CLI
brew install gh
gh auth login

# Vercel CLI
npm install -g vercel
vercel login

# OpenSSL (usually pre-installed on macOS/Linux)
openssl version
```

## Setup Overview

Secrets must be configured in three locations:

1. **GitHub Secrets**: For CI/CD workflows (34 secrets)
2. **Vercel Environment Variables**: For frontend deployment (18 secrets)
3. **Local `.env` Files**: For development (not checked into git)

**Total Setup Time**: ~45-60 minutes (first time)

## GitHub Secrets Configuration

GitHub Secrets are used by GitHub Actions workflows for automated deployments.

### Access GitHub Secrets

**Via Web Interface**:

1. Go to `https://github.com/YOUR_USERNAME/sovren`
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**

**Via CLI** (faster for bulk operations):

```bash
# Set a secret
gh secret set SECRET_NAME

# Set from file
gh secret set SECRET_NAME < secret.txt

# Set inline
gh secret set SECRET_NAME -b"secret-value"
```

---

### 1. Infrastructure & Deployment Secrets

#### VERCEL_TOKEN

**Purpose**: Allows GitHub Actions to deploy to Vercel

**How to Obtain**:

1. Go to https://vercel.com/account/tokens
2. Click **Create Token**
3. **Name**: `GitHub Actions Deploy - Sovren`
4. **Scope**: **Full Account** (or specific team)
5. **Expiration**: 1 year (recommended)
6. Click **Create Token**
7. **Copy the token** (shown only once!)

**Add to GitHub**:

```bash
# Via CLI (recommended - token stays secure)
gh secret set VERCEL_TOKEN
# Paste token and press Enter, then Ctrl+D

# Or via web interface:
# Name: VERCEL_TOKEN
# Value: [paste token]
```

**Validation**:

```bash
# Test token works
vercel whoami --token YOUR_TOKEN
# Should show your username
```

**Rotation Schedule**: Every 90 days

---

#### VERCEL_ORG_ID

**Purpose**: Identifies your Vercel organization/team

**How to Obtain**:

**Method 1: Via Vercel CLI (easiest)**

```bash
# Link project and view config
cd packages/frontend
vercel link

# View .vercel/project.json
cat .vercel/project.json
# Look for "orgId": "team_xxxxxxxxxxxx"
```

**Method 2: Via Vercel Dashboard**

1. Go to https://vercel.com/[your-username]/[project-name]/settings
2. **Settings** → **General**
3. Scroll to **Project ID** section
4. Copy the **Team/Org ID**

**Add to GitHub**:

```bash
gh secret set VERCEL_ORG_ID -b"team_xxxxxxxxxxxx"
```

**Rotation Schedule**: Never (static identifier)

---

#### VERCEL_PROJECT_ID

**Purpose**: Identifies your specific Vercel project

**How to Obtain**:

**Method 1: Via Vercel CLI**

```bash
cat .vercel/project.json
# Look for "projectId": "prj_xxxxxxxxxxxx"
```

**Method 2: Via Vercel Dashboard**

1. Go to project **Settings** → **General**
2. Copy **Project ID**

**Add to GitHub**:

```bash
gh secret set VERCEL_PROJECT_ID -b"prj_xxxxxxxxxxxx"
```

**Rotation Schedule**: Never (static identifier)

---

#### GHCR_TOKEN

**Purpose**: Authenticates Docker image push to GitHub Container Registry

**How to Obtain**:

**Option 1: Use GITHUB_TOKEN (Recommended)**

No setup needed! GitHub automatically provides `GITHUB_TOKEN` to workflows.

**Option 2: Create Personal Access Token (if GITHUB_TOKEN insufficient)**

1. Go to https://github.com/settings/tokens
2. Click **Generate new token** → **Generate new token (classic)**
3. **Note**: `GHCR Push Token - Sovren`
4. **Expiration**: 90 days
5. **Scopes**:
   - ✅ `write:packages` (upload packages)
   - ✅ `read:packages` (download packages)
   - ✅ `delete:packages` (cleanup old images)
6. Click **Generate token**
7. **Copy the token** (shown only once!)

**Add to GitHub**:

```bash
# Only if not using GITHUB_TOKEN
gh secret set GHCR_TOKEN -b"ghp_xxxxxxxxxxxx"
```

**Workflow Usage**:

```yaml
# Prefer GITHUB_TOKEN
- name: Login to GHCR
  run: echo "${{ secrets.GITHUB_TOKEN }}" | docker login ghcr.io -u ${{ github.actor }} --password-stdin

# Or use custom token if needed
- name: Login to GHCR
  run: echo "${{ secrets.GHCR_TOKEN }}" | docker login ghcr.io -u ${{ github.actor }} --password-stdin
```

**Rotation Schedule**: Every 90 days (or use `GITHUB_TOKEN` for automatic)

---

#### DOCKER_USERNAME & DOCKER_PASSWORD (Backup Registry)

**Purpose**: Backup image registry (Docker Hub) if GHCR unavailable

**How to Obtain**:

1. Go to https://hub.docker.com/settings/security
2. Click **New Access Token**
3. **Description**: `Sovren CI/CD Backup`
4. **Access permissions**: **Read, Write, Delete**
5. Click **Generate**
6. **Copy the token**

**Add to GitHub**:

```bash
# Username
gh secret set DOCKER_USERNAME -b"your-dockerhub-username"

# Access Token (not password!)
gh secret set DOCKER_PASSWORD
# Paste token and press Enter, then Ctrl+D
```

**Rotation Schedule**: Every 90 days

---

### 2. Database & Caching Secrets

#### DATABASE_URL

**Purpose**: PostgreSQL connection string for backend services

**How to Obtain**:

**Using Supabase (Recommended)**:

1. Go to https://app.supabase.com/project/YOUR_PROJECT/settings/database
2. **Database Settings** → **Connection string**
3. Select **URI** tab
4. Copy connection string (format: `postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT].supabase.co:5432/postgres`)

**Using External PostgreSQL**:

```bash
# Format
postgresql://username:password@host:port/database

# Example
postgresql://sovren_prod:secure_password@postgres.example.com:5432/sovren_production
```

**Add to GitHub**:

```bash
# Production
gh secret set DATABASE_URL
# Paste connection string and press Enter, then Ctrl+D

# Staging
gh secret set DATABASE_URL_STAGING
# Paste staging connection string
```

**Security Notes**:

- ⚠️ Contains password - never log or expose
- Use SSL mode: add `?sslmode=require` to connection string
- Restrict IP access in database firewall

**Rotation Schedule**: Every 30 days

---

#### SUPABASE_URL

**Purpose**: Supabase project URL for authentication and database

**How to Obtain**:

1. Go to https://app.supabase.com/project/YOUR_PROJECT/settings/api
2. **Project URL** section
3. Copy URL (format: `https://YOUR-PROJECT.supabase.co`)

**Add to GitHub**:

```bash
# Production
gh secret set SUPABASE_URL -b"https://your-project.supabase.co"

# Staging
gh secret set SUPABASE_URL_STAGING -b"https://your-staging-project.supabase.co"
```

**Rotation Schedule**: Never (static project URL)

---

#### SUPABASE_ANON_KEY

**Purpose**: Public anonymous key for client-side Supabase operations

**How to Obtain**:

1. Go to https://app.supabase.com/project/YOUR_PROJECT/settings/api
2. **Project API keys** section
3. Copy **anon** **public** key

**Add to GitHub**:

```bash
# Production
gh secret set SUPABASE_ANON_KEY
# Paste anon key and press Enter, then Ctrl+D

# Staging
gh secret set SUPABASE_ANON_KEY_STAGING
```

**Security Notes**:

- Safe to expose in frontend (Row Level Security protects data)
- Still recommended to keep as secret in CI/CD

**Rotation Schedule**: Every 180 days

---

#### SUPABASE_SERVICE_ROLE_KEY

**Purpose**: Admin key for server-side Supabase operations (bypasses RLS)

**How to Obtain**:

1. Go to https://app.supabase.com/project/YOUR_PROJECT/settings/api
2. **Project API keys** section
3. Copy **service_role** **secret** key
4. ⚠️ Click **Reveal** to show the key

**Add to GitHub**:

```bash
# Production
gh secret set SUPABASE_SERVICE_ROLE_KEY
# Paste service role key and press Enter, then Ctrl+D

# Staging
gh secret set SUPABASE_SERVICE_ROLE_KEY_STAGING
```

**Security Notes**:

- 🔴 **CRITICAL**: Never expose in frontend or logs
- Grants full database access, bypasses Row Level Security
- Use only in trusted backend services

**Rotation Schedule**: Every 30 days

---

#### REDIS_URL

**Purpose**: Redis connection string for caching and sessions

**How to Obtain**:

**Option 1: Upstash (Free tier available)**

1. Go to https://upstash.com/
2. Create account and database
3. Copy **Redis URL** (format: `rediss://default:PASSWORD@HOST:PORT`)

**Option 2: Redis Cloud**

1. Go to https://redis.com/try-free/
2. Create database
3. Copy connection string

**Option 3: Self-hosted**

```bash
# Format with authentication
redis://username:password@host:port

# Format without authentication (development only)
redis://localhost:6379
```

**Add to GitHub**:

```bash
# Production (use TLS: rediss://)
gh secret set REDIS_URL -b"rediss://default:password@redis.example.com:6379"

# Staging
gh secret set REDIS_URL_STAGING -b"rediss://default:staging-password@redis-staging.example.com:6379"
```

**Security Notes**:

- Use TLS in production (`rediss://` not `redis://`)
- Enable authentication (not default Redis)

**Rotation Schedule**: Every 90 days

---

### 3. Authentication & Security Secrets

#### JWT_SECRET

**Purpose**: Signs and verifies JWT tokens for user authentication

**How to Generate**:

```bash
# Generate 64-character secure random string
openssl rand -hex 64

# Alternative: base64 encoding
openssl rand -base64 48
```

**Add to GitHub**:

```bash
# Production
JWT_SECRET=$(openssl rand -hex 64)
gh secret set JWT_SECRET -b"$JWT_SECRET"

# Staging (must be different!)
JWT_SECRET_STAGING=$(openssl rand -hex 64)
gh secret set JWT_SECRET_STAGING -b"$JWT_SECRET_STAGING"
```

**Security Notes**:

- 🔴 **CRITICAL**: Must be cryptographically secure random
- Minimum 64 characters for production
- Rotation invalidates all existing user sessions
- Never reuse between environments

**Rotation Schedule**: Every 30 days

---

#### SESSION_SECRET

**Purpose**: Signs session cookies

**How to Generate**:

```bash
# Generate 64-character secure random string
openssl rand -hex 64
```

**Add to GitHub**:

```bash
# Production
SESSION_SECRET=$(openssl rand -hex 64)
gh secret set SESSION_SECRET -b"$SESSION_SECRET"

# Staging
SESSION_SECRET_STAGING=$(openssl rand -hex 64)
gh secret set SESSION_SECRET_STAGING -b"$SESSION_SECRET_STAGING"
```

**Security Notes**:

- Must be different from JWT_SECRET
- Rotation invalidates all active sessions

**Rotation Schedule**: Every 30 days

---

#### ENCRYPTION_KEY

**Purpose**: Encrypts sensitive data at rest (e.g., private NOSTR keys)

**How to Generate**:

```bash
# Generate 32-byte (64 hex chars) encryption key
openssl rand -hex 32
```

**Add to GitHub**:

```bash
# Production
ENCRYPTION_KEY=$(openssl rand -hex 32)
gh secret set ENCRYPTION_KEY -b"$ENCRYPTION_KEY"

# Staging
ENCRYPTION_KEY_STAGING=$(openssl rand -hex 32)
gh secret set ENCRYPTION_KEY_STAGING -b"$ENCRYPTION_KEY_STAGING"
```

**Security Notes**:

- 🔴 **CRITICAL**: Rotation requires re-encrypting all encrypted data
- Store old key temporarily during rotation for data migration
- Exactly 32 bytes (64 hex characters) required

**Rotation Schedule**: Every 90 days (requires data re-encryption)

---

#### COSIGN_PASSWORD

**Purpose**: Password for Cosign private key to sign Docker images

**How to Generate**:

```bash
# Generate strong password
openssl rand -base64 32
```

**Add to GitHub**:

```bash
COSIGN_PASSWORD=$(openssl rand -base64 32)
gh secret set COSIGN_PASSWORD -b"$COSIGN_PASSWORD"
```

**Security Notes**:

- Used with Cosign for container image signing
- Required for supply chain security (SLSA)

**Rotation Schedule**: Every 90 days

---

### 4. External Services Secrets

#### SLACK_WEBHOOK_URL

**Purpose**: Sends deployment and alert notifications to Slack

**How to Obtain**:

1. Go to https://api.slack.com/apps
2. Create new app or select existing
3. **Incoming Webhooks** → **Activate Incoming Webhooks**
4. Click **Add New Webhook to Workspace**
5. Select channel (e.g., `#deployments`)
6. Click **Authorize**
7. Copy **Webhook URL**

**Add to GitHub**:

```bash
gh secret set SLACK_WEBHOOK_URL -b"https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX"

# Optional: staging notifications to different channel
gh secret set SLACK_WEBHOOK_URL_STAGING -b"https://hooks.slack.com/services/..."
```

**Validation**:

```bash
# Test webhook
curl -X POST -H 'Content-type: application/json' \
  --data '{"text":"Test from Sovren setup"}' \
  YOUR_WEBHOOK_URL
```

**Rotation Schedule**: Every 180 days or on compromise

---

#### SENTRY_DSN

**Purpose**: Data Source Name for Sentry error tracking

**How to Obtain**:

1. Go to https://sentry.io/
2. Create account and organization
3. Create new project (select **React** for frontend)
4. Copy **DSN** from project settings
5. Format: `https://PUBLIC_KEY@sentry.io/PROJECT_ID`

**Add to GitHub**:

```bash
# Production
gh secret set SENTRY_DSN -b"https://public_key@o123456.ingest.sentry.io/123456"

# Staging
gh secret set SENTRY_DSN_STAGING -b"https://staging_key@o123456.ingest.sentry.io/123457"
```

**Rotation Schedule**: Every 180 days

---

#### OPENAI_API_KEY (Optional)

**Purpose**: Access OpenAI API for AI-powered features

**How to Obtain**:

1. Go to https://platform.openai.com/api-keys
2. Click **Create new secret key**
3. **Name**: `Sovren Production`
4. **Permissions**: **All** (or restrict to specific models)
5. Copy key (starts with `sk-proj-...`)

**Add to GitHub**:

```bash
gh secret set OPENAI_API_KEY
# Paste API key and press Enter, then Ctrl+D
```

**Security Notes**:

- Monitor usage to prevent unexpected costs
- Set usage limits in OpenAI dashboard
- Consider using restricted keys per environment

**Rotation Schedule**: Every 90 days

---

#### ANTHROPIC_API_KEY (Optional)

**Purpose**: Access Claude API for AI-powered features

**How to Obtain**:

1. Go to https://console.anthropic.com/
2. **API Keys** → **Create Key**
3. **Name**: `Sovren Production`
4. Copy key (starts with `sk-ant-api03-...`)

**Add to GitHub**:

```bash
gh secret set ANTHROPIC_API_KEY
# Paste API key and press Enter, then Ctrl+D
```

**Rotation Schedule**: Every 90 days

---

### 5. NOSTR & Lightning Network Secrets

#### NOSTR_RELAY_SECRET (Optional)

**Purpose**: Authenticates to private NOSTR relays (if used)

**How to Obtain**:

- Provided by your private relay operator
- Only needed if using authenticated relays

**Add to GitHub** (if needed):

```bash
gh secret set NOSTR_RELAY_SECRET -b"your-relay-secret"
```

**Rotation Schedule**: Every 90 days

---

#### LIGHTNING_NODE_MACAROON

**Purpose**: Authenticates to Lightning Network daemon (LND)

**How to Obtain**:

**Option 1: LNbits (Recommended for ease)**

1. Go to https://legend.lnbits.com (testnet) or your LNbits instance
2. Create wallet
3. **Extensions** → **LndHub**
4. Copy **Admin Key** (acts as macaroon)

**Option 2: Direct LND Access**

```bash
# SSH to your Lightning node
ssh lightning-node

# Read admin macaroon
xxd -ps -u -c 1000 ~/.lnd/data/chain/bitcoin/mainnet/admin.macaroon
# Copy the hex output
```

**Add to GitHub**:

```bash
# Production (mainnet)
gh secret set LIGHTNING_NODE_MACAROON
# Paste macaroon hex and press Enter, then Ctrl+D

# Staging (testnet)
gh secret set LIGHTNING_NODE_MACAROON_STAGING
```

**Security Notes**:

- 🔴 **CRITICAL**: Admin macaroon grants full node access
- Consider creating restricted macaroons (invoice-only for production)
- Never expose in frontend or logs

**Rotation Schedule**: Every 90 days

---

#### LIGHTNING_NODE_TLS_CERT

**Purpose**: TLS certificate for secure LND connection

**How to Obtain**:

**LNbits**: Not needed (HTTPS endpoint)

**Direct LND**:

```bash
# SSH to Lightning node
cat ~/.lnd/tls.cert | base64
# Copy base64 output
```

**Add to GitHub**:

```bash
gh secret set LIGHTNING_NODE_TLS_CERT
# Paste base64 cert and press Enter, then Ctrl+D
```

**Rotation Schedule**: Before cert expiration (usually 1 year)

---

#### LIGHTNING_NODE_URL

**Purpose**: Lightning node gRPC endpoint

**How to Obtain**:

**LNbits**:

```
https://legend.lnbits.com/api/v1
```

**Direct LND**:

```
https://your-node.example.com:10009
```

**Add to GitHub**:

```bash
# Production
gh secret set LIGHTNING_NODE_URL -b"https://your-node.example.com:10009"

# Staging (testnet)
gh secret set LIGHTNING_NODE_URL_STAGING -b"https://legend.lnbits.com/api/v1"
```

**Rotation Schedule**: On infrastructure change only

---

## Vercel Secrets Configuration

Vercel environment variables are used by the frontend application at build time and runtime.

### Access Vercel Environment Variables

**Via Web Interface**:

1. Go to https://vercel.com/YOUR_USERNAME/sovren
2. **Settings** → **Environment Variables**
3. Click **Add New**

**Via CLI** (recommended):

```bash
# Add variable
vercel env add VARIABLE_NAME

# Select environment: Production, Preview, Development
# Enter value

# Or from file
cat secret.txt | vercel env add VARIABLE_NAME production
```

### Required Vercel Variables

#### Frontend-Specific (18 variables)

```bash
# Supabase
vercel env add VITE_SUPABASE_URL production
# Enter: https://your-project.supabase.co

vercel env add VITE_SUPABASE_ANON_KEY production
# Enter: your-anon-key

# NOSTR Relays (comma-separated)
vercel env add VITE_NOSTR_RELAYS production
# Enter: wss://relay.damus.io,wss://nos.lol,wss://relay.snort.social

# Lightning Network
vercel env add VITE_LIGHTNING_NETWORK production
# Enter: mainnet (or testnet for staging)

# Sentry (optional)
vercel env add VITE_SENTRY_DSN production
# Enter: https://public_key@sentry.io/project_id

# Feature Flags
vercel env add VITE_FEATURE_LIGHTNING_PAYMENTS production
# Enter: true

vercel env add VITE_FEATURE_NOSTR_PUBLISHING production
# Enter: true

vercel env add VITE_FEATURE_AI_CONTENT_GENERATION production
# Enter: true

vercel env add VITE_FEATURE_CONTENT_MONETIZATION production
# Enter: true

# Environment
vercel env add VITE_NODE_ENV production
# Enter: production

# Repeat for staging and development environments
```

**Bulk Import via `.env` file**:

```bash
# Create .env.production file
cat > .env.production << 'EOF'
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_NOSTR_RELAYS=wss://relay.damus.io,wss://nos.lol
VITE_LIGHTNING_NETWORK=mainnet
VITE_SENTRY_DSN=https://key@sentry.io/id
VITE_FEATURE_LIGHTNING_PAYMENTS=true
VITE_FEATURE_NOSTR_PUBLISHING=true
EOF

# Import to Vercel (requires vercel CLI with jq)
# This is a manual process - no bulk import in Vercel CLI
# Recommended: Use web interface for initial setup
```

---

## Environment-Specific Configuration

### Production Environment

**Checklist**:

- [ ] All 34 GitHub Secrets configured
- [ ] All 18 Vercel production environment variables configured
- [ ] JWT_SECRET minimum 64 characters
- [ ] SESSION_SECRET minimum 64 characters
- [ ] LIGHTNING_NETWORK=mainnet
- [ ] SECURE_COOKIES=true
- [ ] Database uses SSL
- [ ] Redis uses TLS (rediss://)
- [ ] CORS_ORIGIN set to production domain
- [ ] Sentry configured for error tracking

### Staging Environment

**Checklist**:

- [ ] All secrets have `_STAGING` suffix in GitHub
- [ ] Separate Supabase project for staging
- [ ] Separate database (staging)
- [ ] LIGHTNING_NETWORK=testnet
- [ ] Slack notifications to staging channel
- [ ] Sentry separate project for staging

### Development Environment (Local)

**Setup**:

```bash
# Copy template
cp env.development .env

# Generate secrets
cat > .env << EOF
NODE_ENV=development
PORT=3001

# Supabase (create separate dev project)
SUPABASE_URL=https://your-dev-project.supabase.co
SUPABASE_ANON_KEY=your-dev-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-dev-service-role-key

# Generate local secrets
JWT_SECRET=$(openssl rand -hex 32)
SESSION_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 16)

# Redis (local)
REDIS_URL=redis://localhost:6379

# Lightning (testnet)
LIGHTNING_NETWORK=testnet
LNBITS_API_URL=https://legend.lnbits.com
LNBITS_ADMIN_KEY=your-testnet-key

# NOSTR
NOSTR_RELAYS=wss://relay.damus.io,wss://nos.lol

# Feature Flags
FEATURE_LIGHTNING_PAYMENTS=true
FEATURE_NOSTR_PUBLISHING=true
EOF

# Validate
npm run validate:env
```

---

## Validation & Testing

### 1. Validate GitHub Secrets

**Run Validation Workflow**:

```bash
# Trigger secrets validation workflow
gh workflow run validate-secrets.yml

# Check status
gh run list --workflow=validate-secrets.yml

# View logs
gh run view --log
```

**Expected Output**:

```
✅ All required production secrets present
✅ All required staging secrets present
✅ Secret connectivity tests passed
✅ No missing or invalid secrets detected
```

### 2. Validate Vercel Environment

**Test Vercel Deployment**:

```bash
# Deploy preview to test secrets
vercel --prod

# Check build logs for missing variables
vercel logs YOUR_DEPLOYMENT_URL
```

### 3. Test Secret Connectivity

**Database Connection**:

```bash
# Test DATABASE_URL
psql "$DATABASE_URL" -c "SELECT 1;"
# Should return: 1
```

**Redis Connection**:

```bash
# Test REDIS_URL
redis-cli -u "$REDIS_URL" ping
# Should return: PONG
```

**Vercel API**:

```bash
# Test VERCEL_TOKEN
vercel whoami --token YOUR_TOKEN
# Should return your username
```

**Slack Webhook**:

```bash
# Test SLACK_WEBHOOK_URL
curl -X POST -H 'Content-type: application/json' \
  --data '{"text":"✅ Secrets setup test"}' \
  "$SLACK_WEBHOOK_URL"
# Check Slack channel for message
```

### 4. Run Full Validation Script

```bash
# Run comprehensive validation
./scripts/validate-deployment-secrets.sh

# Expected output:
# ✅ All 34 required secrets present
# ✅ Secret format validation passed
# ✅ Connectivity tests passed
# ✅ Secrets setup complete
```

---

## Troubleshooting

### Common Issues

#### "Secret not found" in Workflow

**Problem**: GitHub Actions can't access secret

**Solutions**:

1. Verify secret name exactly matches (case-sensitive)
2. Check secret is set at repository level (not organization)
3. Ensure workflow has correct permissions
4. Re-add the secret if corrupted

```yaml
# Correct reference
env:
  DATABASE_URL: ${{ secrets.DATABASE_URL }}

# Incorrect (typo)
env:
  DATABASE_URL: ${{ secrets.DATABSE_URL }}
```

#### "Environment variable not defined" in Vercel

**Problem**: Vercel build fails due to missing variable

**Solutions**:

1. Check variable is set for correct environment (Production/Preview/Development)
2. Verify variable name has `VITE_` prefix for frontend
3. Redeploy after adding variable
4. Check `.env.example` for required variables

#### "Invalid credentials" Errors

**Problem**: Secret value is incorrect or expired

**Solutions**:

1. Regenerate the secret at source (e.g., new Vercel token)
2. Update in GitHub Secrets
3. Trigger re-deployment
4. Check for whitespace in secret value

#### Secrets Not Loading Locally

**Problem**: `.env` file not being read

**Solutions**:

```bash
# Verify .env file exists
ls -la .env

# Check file is in project root
pwd
# Should be: /path/to/sovren

# Verify dotenv is loading
node -e "require('dotenv').config(); console.log(process.env.DATABASE_URL)"

# Restart development server
npm run dev
```

For more troubleshooting, see [Secrets Troubleshooting Guide](./secrets-troubleshooting.md).

---

## Next Steps

After completing secrets setup:

1. ✅ **Run Validation**: `gh workflow run validate-secrets.yml`
2. ✅ **Test Deployment**: Deploy to staging first
3. ✅ **Set Rotation Reminders**: Calendar reminders for secret rotation
4. ✅ **Document Custom Secrets**: Add any project-specific secrets to inventory
5. ✅ **Review Access**: Ensure team members have appropriate access levels
6. ✅ **Enable Monitoring**: Set up Sentry and Slack notifications

## Related Documentation

- [Secrets Management Guide](./secrets-management.md) - Comprehensive secrets overview
- [Secrets Rotation Procedures](./secrets-rotation.md) - How to rotate secrets
- [Secrets Troubleshooting](./secrets-troubleshooting.md) - Common issues and solutions
- [Environment Configuration](./environment-configuration.md) - Environment variables guide

---

**Setup Complete!** 🎉

You're now ready to deploy Sovren with production-grade secrets management.

**Document Version**: 1.0.0
**Last Updated**: 2025-10-27
