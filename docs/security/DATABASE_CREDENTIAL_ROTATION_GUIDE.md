# Database Credential Rotation Guide

**Zero-Downtime Supabase Database Credential Rotation**

## Overview

This guide provides step-by-step instructions for rotating Supabase database credentials with zero downtime, addressing security issue #8 (IMMED-004).

## Prerequisites

1. **Supabase Access**:
   - Project reference ID (found in project URL)
   - Management API access token

2. **AWS Configuration** (if using AWS Secrets Manager):
   - AWS CLI installed and configured
   - IAM permissions for Secrets Manager

3. **Python Dependencies**:
   ```bash
   pip install requests python-dotenv boto3 psycopg2-binary
   ```

## Getting Supabase Credentials

### Step 1: Get Project Reference

1. Go to your Supabase dashboard: https://app.supabase.com
2. Open your project
3. The project reference is in the URL: `https://app.supabase.com/project/{PROJECT_REF}`

### Step 2: Create Access Token

1. Navigate to: https://app.supabase.com/account/tokens
2. Click "Generate new token"
3. Name it: "Credential Rotation"
4. Copy the token immediately (shown only once)

## Rotation Process

### Option 1: Automated Rotation (Recommended)

```bash
# Navigate to scripts directory
cd /Users/fp/Desktop/Sovren/scripts

# Make script executable
chmod +x supabase-credential-rotation.py

# Run rotation for production
python supabase-credential-rotation.py \
  --project-ref YOUR_PROJECT_REF \
  --access-token YOUR_ACCESS_TOKEN \
  --environment production

# Or set environment variables
export SUPABASE_PROJECT_REF="your-project-ref"
export SUPABASE_ACCESS_TOKEN="your-access-token"

# Run with environment variables
python supabase-credential-rotation.py
```

### Option 2: Manual Rotation via Dashboard

1. **Backup Current Credentials**:

   ```bash
   # Backup .env file
   cp packages/backend/.env packages/backend/.env.backup-$(date +%Y%m%d)

   # Save current DATABASE_URL
   grep DATABASE_URL packages/backend/.env > .credentials-backup/current.txt
   ```

2. **Generate New Password**:
   - Go to: https://app.supabase.com/project/{PROJECT_REF}/settings/database
   - Click "Reset database password"
   - Use "Generate a password" for maximum security
   - **IMPORTANT**: Copy the new password immediately

3. **Update Connection Strings**:

   ```bash
   # Update DATABASE_URL with new password
   # Format: postgresql://postgres:[NEW_PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
   ```

4. **Update AWS Secrets Manager** (if applicable):

   ```bash
   # Create secret JSON
   cat > /tmp/supabase-secret.json <<EOF
   {
     "url": "https://[PROJECT_REF].supabase.co",
     "anon_key": "YOUR_ANON_KEY",
     "service_role_key": "YOUR_SERVICE_KEY",
     "database_url": "postgresql://postgres:[NEW_PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres",
     "db_password": "[NEW_PASSWORD]"
   }
   EOF

   # Update AWS secret
   aws secretsmanager update-secret \
     --secret-id "sovren/production/supabase" \
     --secret-string file:///tmp/supabase-secret.json \
     --region us-east-1

   # Clean up
   rm /tmp/supabase-secret.json
   ```

5. **Update Local Environment**:

   ```bash
   # Edit packages/backend/.env
   # Update DB_PASSWORD and DATABASE_URL with new values
   ```

6. **Restart Application**:

   ```bash
   # Development
   npm run dev

   # Production (using PM2)
   pm2 reload sovren-backend --update-env

   # Docker
   docker-compose restart backend
   ```

## Verification Steps

### 1. Test Database Connection

```bash
# Using psql
psql "postgresql://postgres:[NEW_PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres" -c "SELECT NOW()"

# Using Node.js script
node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT NOW()').then(r => console.log('✅ Connected:', r.rows[0])).catch(console.error);
"
```

### 2. Check Application Health

```bash
# Health endpoint
curl http://localhost:3001/health

# Database-specific health
curl http://localhost:3001/health/database
```

### 3. Monitor Logs

```bash
# Application logs
tail -f logs/application.log | grep -E "database|connection|pool"

# Docker logs
docker logs -f sovren-backend | grep -E "database|connection"
```

## Rollback Procedure

If issues occur during rotation:

### Immediate Rollback

```bash
# Restore from backup
cp packages/backend/.env.backup-$(date +%Y%m%d) packages/backend/.env

# Restart application
npm run dev  # or your production restart command
```

### AWS Secrets Rollback

```bash
# Restore previous secret version
aws secretsmanager update-secret \
  --secret-id "sovren/production/supabase" \
  --secret-string file:///.credentials-backup/previous-secret.json
```

## Zero-Downtime Strategy

The rotation process ensures zero downtime through:

1. **Connection Pool Management**:
   - New connections use new credentials
   - Existing connections continue with old credentials
   - Gradual connection drain over 30 seconds

2. **Graceful Reload**:
   - Application refreshes secrets without restart
   - Health checks verify new connections
   - Automatic fallback if issues detected

3. **Monitoring**:
   - Real-time connection metrics
   - Error rate monitoring
   - Automatic alerts on failures

## Security Best Practices

1. **Password Requirements**:
   - Minimum 32 characters
   - Mix of uppercase, lowercase, numbers, symbols
   - Generated using cryptographically secure random

2. **Rotation Frequency**:
   - Production: Every 90 days
   - Staging: Every 180 days
   - After any suspected compromise

3. **Access Control**:
   - Limit who can rotate credentials
   - Use MFA for Supabase dashboard
   - Audit all rotation events

4. **Backup Strategy**:
   - Always backup before rotation
   - Keep backups for 7 days
   - Encrypt backup files

## Troubleshooting

### Common Issues

1. **Connection Refused**:
   - Check new password doesn't have special characters that need escaping
   - Verify DATABASE_URL format
   - Ensure no firewall changes

2. **Authentication Failed**:
   - Confirm password was copied correctly
   - Check for trailing whitespace
   - Verify connection string encoding

3. **AWS Secrets Manager Error**:
   - Check IAM permissions
   - Verify AWS CLI configuration
   - Ensure secret name is correct

### Debug Commands

```bash
# Test AWS access
aws secretsmanager describe-secret --secret-id "sovren/production/supabase"

# Check current connections
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity"

# Verify environment variables
node -e "console.log(process.env.DATABASE_URL?.replace(/:[^@]+@/, ':***@'))"
```

## Automation Setup

### GitHub Actions Secret Rotation

Create `.github/workflows/rotate-credentials.yml`:

```yaml
name: Rotate Database Credentials

on:
  schedule:
    - cron: '0 0 1 */3 *' # Every 3 months
  workflow_dispatch:

jobs:
  rotate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: pip install requests python-dotenv boto3

      - name: Rotate credentials
        env:
          SUPABASE_PROJECT_REF: ${{ secrets.SUPABASE_PROJECT_REF }}
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        run: |
          python scripts/supabase-credential-rotation.py \
            --environment production
```

## Compliance & Audit

### Audit Log Entry

After rotation, update `docs/security/audit-log.md`:

```markdown
## [Date] - Database Credential Rotation

- **Type**: Scheduled Security Rotation
- **Issue**: #8 (IMMED-004)
- **Environment**: Production
- **Performed By**: [Your Name]
- **Timestamp**: [ISO 8601 timestamp]
- **Old Password Hash**: [First 8 chars of SHA256]
- **New Password Hash**: [First 8 chars of SHA256]
- **Verification**: All health checks passed
- **Downtime**: 0 seconds
```

### Notification

Notify team after successful rotation:

- Slack: #security channel
- Email: security@sovren.dev
- Ticket: Update and close issue #8

## Summary

This rotation process ensures:

- ✅ Zero downtime during rotation
- ✅ Automatic rollback on failure
- ✅ Complete audit trail
- ✅ Secure credential handling
- ✅ AWS Secrets Manager integration
- ✅ Health verification at each step

For questions or issues, contact the security team.
