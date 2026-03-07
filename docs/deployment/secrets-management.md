# Secrets Management Guide

**Status**: Production-Ready
**Last Updated**: 2025-10-27
**Epic**: 006 - Automated Deployment Pipeline
**User Story**: US-E6-006

## Table of Contents

- [Overview](#overview)
- [Secrets Architecture](#secrets-architecture)
- [Complete Secrets Inventory](#complete-secrets-inventory)
- [Security Best Practices](#security-best-practices)
- [Secrets Lifecycle](#secrets-lifecycle)
- [Access Control Matrix](#access-control-matrix)
- [Emergency Procedures](#emergency-procedures)
- [Compliance & Auditing](#compliance--auditing)

## Overview

This guide provides comprehensive documentation for managing all deployment secrets in the Sovren platform. Our secrets management strategy ensures:

- **Zero Secret Leakage**: No secrets in version control or logs
- **Principle of Least Privilege**: Role-based access to secrets
- **Regular Rotation**: Automated rotation procedures
- **Environment Isolation**: Different secrets per environment
- **Audit Trail**: Complete logging of secret access

### Secrets Storage Locations

| Location                     | Purpose             | Access Control         | Encryption            |
| ---------------------------- | ------------------- | ---------------------- | --------------------- |
| GitHub Secrets               | CI/CD workflows     | Repository admins      | AES-256 at rest       |
| Vercel Environment Variables | Frontend deployment | Project admins         | AES-256 at rest       |
| Environment Files (`.env`)   | Local development   | Developer workstations | Not stored in git     |
| Docker Secrets               | Container runtime   | Docker Swarm/K8s RBAC  | Encrypted in transit  |
| HashiCorp Vault (Future)     | Centralized secrets | Policy-based           | End-to-end encryption |

## Secrets Architecture

### Hierarchical Secret Organization

```
Production Secrets (PROD_*)
├── Infrastructure
│   ├── VERCEL_TOKEN
│   ├── VERCEL_ORG_ID
│   ├── VERCEL_PROJECT_ID
│   ├── GHCR_TOKEN
│   └── DOCKER_PASSWORD
├── Database
│   ├── DATABASE_URL
│   ├── SUPABASE_URL
│   ├── SUPABASE_ANON_KEY
│   ├── SUPABASE_SERVICE_ROLE_KEY
│   └── REDIS_URL
├── Authentication & Security
│   ├── JWT_SECRET
│   ├── SESSION_SECRET
│   ├── ENCRYPTION_KEY
│   └── COSIGN_PASSWORD
├── External Services
│   ├── SLACK_WEBHOOK_URL
│   ├── SENTRY_DSN
│   ├── OPENAI_API_KEY
│   └── ANTHROPIC_API_KEY
└── NOSTR & Lightning
    ├── NOSTR_RELAY_SECRET
    ├── LIGHTNING_NODE_MACAROON
    ├── LIGHTNING_NODE_TLS_CERT
    └── LIGHTNING_NODE_URL

Staging Secrets (*_STAGING)
└── [Same structure with _STAGING suffix]

Development Secrets (Local .env only)
└── [Not stored in GitHub Secrets]
```

### Secret Classification

| Classification | Examples                          | Rotation Frequency | Access Level        |
| -------------- | --------------------------------- | ------------------ | ------------------- |
| **Critical**   | Database credentials, JWT secrets | Every 30 days      | Admin only          |
| **High**       | API keys, service tokens          | Every 90 days      | DevOps + Admin      |
| **Medium**     | Webhook URLs, integration keys    | Every 180 days     | Developers + DevOps |
| **Low**        | Public relay URLs, feature flags  | Annually           | All team members    |

## Complete Secrets Inventory

### Production Secrets (Required)

#### 1. Infrastructure & Deployment

##### VERCEL_TOKEN

- **Purpose**: Authenticates GitHub Actions to deploy frontend to Vercel
- **Format**: Vercel API token (32-character alphanumeric)
- **Scope**: Full account access
- **Rotation**: Every 90 days
- **Used In**: `.github/workflows/release.yml`
- **Classification**: High
- **Fallback**: Manual deployment via Vercel CLI

##### VERCEL_ORG_ID

- **Purpose**: Identifies Vercel organization for deployments
- **Format**: Organization ID (e.g., `team_abc123`)
- **Scope**: Read-only organization metadata
- **Rotation**: Never (static identifier)
- **Used In**: `.github/workflows/release.yml`
- **Classification**: Low

##### VERCEL_PROJECT_ID

- **Purpose**: Identifies specific Vercel project
- **Format**: Project ID (e.g., `prj_abc123`)
- **Scope**: Project-specific deployments
- **Rotation**: Never (static identifier)
- **Used In**: `.github/workflows/release.yml`
- **Classification**: Low

##### GHCR_TOKEN

- **Purpose**: Authenticates Docker image push to GitHub Container Registry
- **Format**: GitHub Personal Access Token or use `GITHUB_TOKEN`
- **Scope**: `write:packages`, `read:packages`, `delete:packages`
- **Rotation**: Every 90 days (or use GITHUB_TOKEN for auto-rotation)
- **Used In**: `.github/workflows/docker-build.yml` (future)
- **Classification**: High
- **Best Practice**: Use `GITHUB_TOKEN` instead for automatic rotation

##### DOCKER_USERNAME (Backup)

- **Purpose**: Docker Hub username for backup image registry
- **Format**: Docker Hub username
- **Scope**: Public profile
- **Rotation**: Never (username)
- **Classification**: Low

##### DOCKER_PASSWORD (Backup)

- **Purpose**: Docker Hub access token for backup registry
- **Format**: Docker Hub access token
- **Scope**: Repository read/write
- **Rotation**: Every 90 days
- **Used In**: Backup deployment workflows
- **Classification**: High

#### 2. Database & Caching

##### DATABASE_URL

- **Purpose**: PostgreSQL connection string for backend services
- **Format**: `postgresql://user:password@host:port/database`
- **Scope**: Full database access
- **Rotation**: Every 30 days
- **Used In**: Backend services, migrations
- **Classification**: Critical
- **Security**:
  - Never log this value
  - Use SSL/TLS connections only
  - Restrict IP whitelist

##### SUPABASE_URL

- **Purpose**: Supabase project URL for authentication and database
- **Format**: `https://your-project.supabase.co`
- **Scope**: Public project URL
- **Rotation**: Never (project identifier)
- **Used In**: Frontend and backend
- **Classification**: Low

##### SUPABASE_ANON_KEY

- **Purpose**: Public anonymous key for client-side Supabase operations
- **Format**: JWT token (long base64 string)
- **Scope**: Row-level security enforced operations
- **Rotation**: Every 180 days
- **Used In**: Frontend authentication, public queries
- **Classification**: Medium
- **Note**: Safe to expose in frontend (RLS protects data)

##### SUPABASE_SERVICE_ROLE_KEY

- **Purpose**: Admin key for server-side Supabase operations (bypasses RLS)
- **Format**: JWT token (long base64 string)
- **Scope**: Full database access, bypasses row-level security
- **Rotation**: Every 30 days
- **Used In**: Backend services, admin operations
- **Classification**: Critical
- **Security**:
  - NEVER expose in frontend
  - NEVER log this value
  - Use only in trusted backend services

##### REDIS_URL

- **Purpose**: Redis connection string for caching and sessions
- **Format**: `redis://user:password@host:port` or `rediss://` for TLS
- **Scope**: Full cache access
- **Rotation**: Every 90 days
- **Used In**: Backend caching, session storage
- **Classification**: High
- **Security**: Use TLS connections in production

#### 3. Authentication & Security

##### JWT_SECRET

- **Purpose**: Signs and verifies JWT tokens for user authentication
- **Format**: Random string (minimum 64 characters for production)
- **Scope**: Authentication token validation
- **Rotation**: Every 30 days (requires user re-authentication)
- **Used In**: Authentication middleware
- **Classification**: Critical
- **Generation**: `openssl rand -hex 64`
- **Security**:
  - Must be cryptographically secure random
  - Rotation invalidates all existing tokens
  - Store separately per environment

##### SESSION_SECRET

- **Purpose**: Signs session cookies
- **Format**: Random string (minimum 64 characters for production)
- **Scope**: Session validation
- **Rotation**: Every 30 days
- **Used In**: Session middleware
- **Classification**: Critical
- **Generation**: `openssl rand -hex 64`

##### ENCRYPTION_KEY

- **Purpose**: Encrypts sensitive data at rest (e.g., private NOSTR keys)
- **Format**: 32-byte hex string (64 characters)
- **Scope**: Data encryption/decryption
- **Rotation**: Every 90 days (requires data re-encryption)
- **Used In**: Data encryption services
- **Classification**: Critical
- **Generation**: `openssl rand -hex 32`
- **Note**: Rotation requires re-encrypting all encrypted data

##### COSIGN_PASSWORD

- **Purpose**: Password for Cosign private key to sign Docker images
- **Format**: Strong password (minimum 32 characters)
- **Scope**: Image signing
- **Rotation**: Every 90 days
- **Used In**: Docker image signing workflow
- **Classification**: High
- **Generation**: `openssl rand -base64 32`

#### 4. External Services

##### SLACK_WEBHOOK_URL

- **Purpose**: Sends deployment and alert notifications to Slack
- **Format**: `https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX`
- **Scope**: Post messages to specific channel
- **Rotation**: Every 180 days or on compromise
- **Used In**: `.github/workflows/release.yml`, monitoring alerts
- **Classification**: Medium
- **Security**: Channel-specific, limited to posting messages

##### SENTRY_DSN

- **Purpose**: Data Source Name for Sentry error tracking
- **Format**: `https://public_key@sentry.io/project_id`
- **Scope**: Error reporting to specific project
- **Rotation**: Every 180 days
- **Used In**: Frontend and backend error tracking
- **Classification**: Medium
- **Note**: Contains public key, but should not be exposed unnecessarily

##### OPENAI_API_KEY (Optional)

- **Purpose**: Access OpenAI API for AI-powered features
- **Format**: `sk-proj-...` (OpenAI API key format)
- **Scope**: API usage within quota limits
- **Rotation**: Every 90 days
- **Used In**: AI content generation features
- **Classification**: High
- **Cost**: Monitor usage to prevent bill shock

##### ANTHROPIC_API_KEY (Optional)

- **Purpose**: Access Claude API for AI-powered features
- **Format**: `sk-ant-api03-...` (Anthropic API key format)
- **Scope**: API usage within quota limits
- **Rotation**: Every 90 days
- **Used In**: AI analytics and recommendations
- **Classification**: High
- **Cost**: Monitor usage to prevent bill shock

#### 5. NOSTR & Lightning Network

##### NOSTR_RELAY_SECRET

- **Purpose**: Authenticates to private NOSTR relays (if used)
- **Format**: Relay-specific secret
- **Scope**: Access to private relay
- **Rotation**: Every 90 days
- **Used In**: NOSTR relay connections
- **Classification**: Medium
- **Note**: Only needed if using private relays with authentication

##### LIGHTNING_NODE_MACAROON

- **Purpose**: Authenticates to Lightning Network daemon (LND)
- **Format**: Hex-encoded macaroon (admin.macaroon)
- **Scope**: Full LND access (invoice creation, payment)
- **Rotation**: Every 90 days
- **Used In**: Lightning payment services
- **Classification**: Critical
- **Security**:
  - Admin macaroon grants full node access
  - Consider using restricted macaroons (invoice-only)
  - NEVER expose in frontend

##### LIGHTNING_NODE_TLS_CERT

- **Purpose**: TLS certificate for secure LND connection
- **Format**: Base64-encoded TLS certificate
- **Scope**: Encrypted communication
- **Rotation**: Before expiration (typically 1 year)
- **Used In**: Lightning payment services
- **Classification**: High

##### LIGHTNING_NODE_URL

- **Purpose**: Lightning node gRPC endpoint
- **Format**: `https://your-node.example.com:10009`
- **Scope**: Node address
- **Rotation**: On infrastructure change
- **Used In**: Lightning payment services
- **Classification**: Low

### Staging Secrets

All production secrets are duplicated with `_STAGING` suffix:

```
VERCEL_TOKEN_STAGING
DATABASE_URL_STAGING
SUPABASE_URL_STAGING
SUPABASE_ANON_KEY_STAGING
SUPABASE_SERVICE_ROLE_KEY_STAGING
REDIS_URL_STAGING
JWT_SECRET_STAGING
SESSION_SECRET_STAGING
SLACK_WEBHOOK_URL_STAGING
SENTRY_DSN_STAGING
NOSTR_RELAY_SECRET_STAGING
LIGHTNING_NODE_MACAROON_STAGING
LIGHTNING_NODE_TLS_CERT_STAGING
LIGHTNING_NODE_URL_STAGING
```

**Important**: Staging secrets should:

- Point to separate staging infrastructure
- Use different credentials than production
- Use testnet for Lightning Network
- Use test mode for payment processors

### Development Secrets (Local Only)

**Never stored in GitHub Secrets**. Developers manage these locally in `.env` files.

```bash
# Copy from template
cp env.development .env

# Required for local development
SUPABASE_URL=https://your-dev-project.supabase.co
SUPABASE_ANON_KEY=your-dev-anon-key
JWT_SECRET=$(openssl rand -hex 32)
SESSION_SECRET=$(openssl rand -hex 32)
REDIS_URL=redis://localhost:6379
LIGHTNING_NETWORK=testnet
```

## Security Best Practices

### 1. Secret Generation

Always use cryptographically secure random generation:

```bash
# JWT/Session secrets (64 characters)
openssl rand -hex 64

# Encryption keys (32 bytes = 64 hex chars)
openssl rand -hex 32

# General secrets (32 characters)
openssl rand -base64 32

# UUID-based secrets
uuidgen
```

### 2. Secret Storage

#### GitHub Secrets

- Stored encrypted at rest (AES-256)
- Encrypted in transit (TLS)
- Never logged or exposed in workflow output
- Redacted in logs automatically

#### Environment Variables

```bash
# ✅ GOOD: Using environment variables
const dbUrl = process.env.DATABASE_URL;

# ❌ BAD: Hardcoding secrets
const dbUrl = 'postgresql://user:pass@host/db';

# ❌ BAD: Committing .env files
# Never commit .env to version control
```

#### Code References

```typescript
// ✅ GOOD: Reference via environment
import { env } from '@/config';
const jwtSecret = env.JWT_SECRET;

// ❌ BAD: Hardcoded in code
const jwtSecret = 'my-secret-key-123';

// ✅ GOOD: Validation on startup
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is required');
}
```

### 3. Secret Transmission

- **HTTPS Only**: Always use TLS for API calls with secrets
- **No Query Parameters**: Never pass secrets in URLs
- **Headers Preferred**: Use Authorization headers
- **Body When Necessary**: POST body for secret transmission

```typescript
// ✅ GOOD: Secret in header
fetch(url, {
  headers: {
    Authorization: `Bearer ${apiKey}`,
  },
});

// ❌ BAD: Secret in URL
fetch(`${url}?api_key=${apiKey}`);
```

### 4. Secret Logging

Configure logging to prevent secret leakage:

```typescript
// ✅ GOOD: Redact secrets in logs
const safeLog = {
  ...data,
  password: '[REDACTED]',
  apiKey: '[REDACTED]',
  token: '[REDACTED]',
};
logger.info(safeLog);

// ❌ BAD: Logging raw secrets
logger.info({ password, apiKey, token });

// ✅ GOOD: Use environment-aware logging
if (process.env.NODE_ENV !== 'production') {
  // Debug logging only in development
}
```

### 5. Secrets in CI/CD

```yaml
# ✅ GOOD: Reference GitHub Secrets
env:
  DATABASE_URL: ${{ secrets.DATABASE_URL }}

# ✅ GOOD: Mask custom values
- name: Use secret
  run: echo "::add-mask::$SECRET_VALUE"

# ❌ BAD: Echo secrets (even masked, avoid this)
- run: echo ${{ secrets.API_KEY }}

# ✅ GOOD: Set as environment variable
- name: Deploy
  env:
    API_KEY: ${{ secrets.API_KEY }}
  run: ./deploy.sh
```

### 6. Secret Validation

Validate secrets on application startup:

```typescript
// Startup validation
const requiredSecrets = ['DATABASE_URL', 'JWT_SECRET', 'SUPABASE_SERVICE_ROLE_KEY'];

for (const secret of requiredSecrets) {
  if (!process.env[secret]) {
    throw new Error(`Missing required secret: ${secret}`);
  }
}

// Length validation
if (process.env.JWT_SECRET.length < 64) {
  throw new Error('JWT_SECRET must be at least 64 characters');
}
```

## Secrets Lifecycle

### Creation

1. **Generate**: Use secure random generation
2. **Document**: Add to secrets inventory
3. **Store**: Add to GitHub Secrets / Vercel
4. **Validate**: Run validation workflow
5. **Audit**: Log creation in audit trail

### Rotation

See [Secrets Rotation Guide](./secrets-rotation.md) for detailed procedures.

**Summary**:

- **Critical secrets**: Every 30 days
- **High secrets**: Every 90 days
- **Medium secrets**: Every 180 days
- **Low secrets**: Annually or never (static IDs)

### Revocation

**Immediate revocation required if**:

- Secret exposed in code commit
- Secret exposed in logs
- Compromised team member access
- Security incident detected
- Third-party breach affecting secret

**Revocation Procedure**:

1. Generate new secret immediately
2. Update in all environments
3. Rotate dependent secrets
4. Invalidate old secret
5. Audit access logs
6. Document in incident log

### Deletion

When removing unused secrets:

1. Verify no code references
2. Remove from GitHub Secrets
3. Remove from Vercel environment
4. Update documentation
5. Archive for audit (metadata only, not value)

## Access Control Matrix

| Secret                    | GitHub Admin  | DevOps Engineer | Developer    | CI/CD   | Justification               |
| ------------------------- | ------------- | --------------- | ------------ | ------- | --------------------------- |
| VERCEL_TOKEN              | ✅ Read/Write | ✅ Read/Write   | ❌ No Access | ✅ Read | Deployment automation       |
| DATABASE_URL              | ✅ Read/Write | ✅ Read/Write   | ❌ No Access | ✅ Read | Production data access      |
| SUPABASE_SERVICE_ROLE_KEY | ✅ Read/Write | ✅ Read/Write   | ❌ No Access | ✅ Read | Admin database operations   |
| JWT_SECRET                | ✅ Read/Write | ✅ Read/Write   | ❌ No Access | ✅ Read | Authentication              |
| SLACK_WEBHOOK_URL         | ✅ Read/Write | ✅ Read/Write   | ✅ Read      | ✅ Read | Notifications               |
| GHCR_TOKEN                | ✅ Read/Write | ✅ Read/Write   | ❌ No Access | ✅ Read | Container registry          |
| LIGHTNING_NODE_MACAROON   | ✅ Read/Write | ✅ Read/Write   | ❌ No Access | ✅ Read | Payment processing          |
| SENTRY_DSN                | ✅ Read/Write | ✅ Read/Write   | ✅ Read      | ✅ Read | Error tracking (public key) |

**Access Levels**:

- **Read/Write**: Can view and modify secret
- **Read**: Can view secret value
- **No Access**: Cannot view secret (GitHub automatically restricts)

**Role Definitions**:

- **GitHub Admin**: Repository administrators, full access
- **DevOps Engineer**: Manages deployments and infrastructure
- **Developer**: Writes code, uses development secrets only
- **CI/CD**: GitHub Actions workflows (read-only, automatic)

## Emergency Procedures

### 1. Secret Exposed in Commit

**Immediate Actions** (within 15 minutes):

```bash
# 1. Rotate exposed secret immediately
# Generate new value
NEW_SECRET=$(openssl rand -hex 64)

# 2. Update GitHub Secret
gh secret set SECRET_NAME -b"$NEW_SECRET"

# 3. Update Vercel (if applicable)
vercel env rm SECRET_NAME production
vercel env add SECRET_NAME production < <(echo $NEW_SECRET)

# 4. Trigger re-deployment
gh workflow run release.yml

# 5. Invalidate old secret at source
# (e.g., revoke API token, rotate database password)
```

**Post-Incident** (within 24 hours):

1. Review commit history for other exposures
2. Scan codebase for secret patterns: `./scripts/scan-secrets.sh`
3. Update `.gitignore` to prevent future exposures
4. Add pre-commit hook for secret detection
5. Document incident in security log
6. Review and update access controls
7. Team training on secret management

### 2. Compromised Team Member Access

**Immediate Actions**:

1. Revoke GitHub access immediately
2. Rotate all secrets they had access to
3. Review audit logs for unauthorized access
4. Re-deploy all affected environments
5. Notify security team
6. Document revocation

**Secrets to Rotate** (based on role):

- Developer leaving: Development secrets only
- DevOps leaving: All production secrets
- Admin leaving: All secrets + access keys

### 3. Third-Party Service Breach

If a service provider (Vercel, Supabase, etc.) reports a breach:

1. Rotate all secrets related to that service
2. Enable 2FA/MFA if not already enabled
3. Review service access logs
4. Consider alternative providers
5. Document in security log

### 4. Unauthorized Secret Access Detected

If audit logs show unauthorized access:

1. Identify affected secrets
2. Rotate immediately
3. Investigate access source
4. Revoke unauthorized access
5. Review and tighten access controls
6. File security incident report

## Compliance & Auditing

### Audit Logging

All secret access is automatically logged:

**GitHub Secrets**:

- View audit log: Settings → Security → Audit log
- Filter by secret access events
- Retention: 180 days (private repos)

**Vercel Environment Variables**:

- View audit log: Project Settings → Audit Log
- Filter by environment variable changes
- Retention: 90 days

### Compliance Requirements

#### SOC 2 Compliance

- ✅ Secrets encrypted at rest and in transit
- ✅ Access controls documented
- ✅ Regular rotation procedures
- ✅ Audit trail maintained
- ✅ Incident response procedures

#### GDPR Compliance

- ✅ Data encryption keys managed securely
- ✅ Access logging for personal data keys
- ✅ Right to erasure supported via key rotation

### Audit Checklist

Run quarterly:

- [ ] All critical secrets rotated within 30 days
- [ ] All high secrets rotated within 90 days
- [ ] No secrets exposed in version control
- [ ] Access control matrix is current
- [ ] All team members have appropriate access levels
- [ ] Audit logs reviewed for anomalies
- [ ] Secrets validation passing in CI
- [ ] Documentation updated
- [ ] Backup secrets tested
- [ ] Emergency procedures tested

## Related Documentation

- [Secrets Setup Guide](./secrets-setup-guide.md) - Step-by-step configuration
- [Secrets Rotation Procedures](./secrets-rotation.md) - Detailed rotation guides
- [Secrets Troubleshooting](./secrets-troubleshooting.md) - Common issues and solutions
- [Environment Configuration](./environment-configuration.md) - Environment variables guide
- [Deployment Architecture](./deployment-architecture.md) - Overall deployment strategy

---

**Document Version**: 1.0.0
**Last Review**: 2025-10-27
**Next Review**: 2025-11-27
**Owner**: DevOps Team
