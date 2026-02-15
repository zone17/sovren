# IMMED-004: Supabase Database Credential Rotation Procedure

**Status**: Ready for Execution
**Priority**: CRITICAL
**Estimated Downtime**: 0 seconds (zero-downtime rotation)
**Issue**: #9 (IMMED-004)

---

## Executive Summary

This document provides a step-by-step procedure for rotating Supabase database credentials with **zero downtime** following security best practices. The rotation addresses potential credential exposure and ensures secure credential management via AWS Secrets Manager.

## Prerequisites Checklist

- [ ] **Supabase Dashboard Access**: Admin access to https://app.supabase.com
- [ ] **AWS Credentials**: Access to update AWS Secrets Manager secrets
- [ ] **Backup Access**: Ability to rollback if needed
- [ ] **Monitoring Access**: Can monitor application health during rotation

## Current State Analysis

### ✅ Infrastructure Ready
- AWS Secrets Manager integration implemented (`SecretsService.ts`)
- Database connection pooling configured (`DatabasePool`)
- Zero-downtime deployment pipeline operational
- Health check endpoints available

### ⚠️ Action Required
- Database pool currently reads from `process.env.DATABASE_URL` (not SecretsService)
- Manual rotation required (automated script needs Supabase API token)
- Post-rotation integration of SecretsService recommended

## Zero-Downtime Rotation Procedure

### Phase 1: Pre-Rotation (5 minutes)

#### Step 1.1: Backup Current Credentials
```bash
# Navigate to backend directory
cd /Users/fp/Desktop/Sovren/packages/backend

# Create backup directory
mkdir -p .credentials-backup

# Backup current .env file
cp .env .env.backup-$(date +%Y%m%d-%H%M%S)

# Extract current DATABASE_URL for rollback
grep DATABASE_URL .env > .credentials-backup/current-db-url.txt

# Verify backup
ls -la .env.backup-* .credentials-backup/
```

#### Step 1.2: Record Current Metrics (Baseline)
```bash
# Check current pool health
curl http://localhost:3001/health | jq '.'

# Record active connections
echo "Pre-rotation timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)" > .credentials-backup/rotation-log.txt
```

### Phase 2: Credential Rotation (10 minutes)

#### Step 2.1: Generate New Secure Password

**Option A: Using OpenSSL (Recommended)**
```bash
# Generate 32-character alphanumeric + symbols password
NEW_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
echo "Generated secure password (32 chars)"
```

**Option B: Using Python**
```python
import secrets
import string
alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
password = ''.join(secrets.choice(alphabet) for _ in range(32))
print(password)
```

**Save securely:**
```bash
echo "$NEW_PASSWORD" > .credentials-backup/new-password.txt
chmod 600 .credentials-backup/new-password.txt
```

#### Step 2.2: Rotate Password in Supabase Dashboard

1. **Navigate to Database Settings**:
   - Go to: https://app.supabase.com/project/YOUR_PROJECT_REF/settings/database
   - Click **"Database"** → **"Reset database password"**

2. **Set New Password**:
   - **Option 1**: Paste your generated password from Step 2.1
   - **Option 2**: Use Supabase's "Generate a password" (copy immediately!)
   - Click **"Update password"**
   - ⚠️ **CRITICAL**: Copy the password immediately (shown only once)

3. **Verify Password Reset**:
   - You should see: "Database password updated successfully"
   - Keep the Supabase tab open in case rollback is needed

#### Step 2.3: Get Connection Details

From Supabase Dashboard → Settings → Database:
```bash
# Record these values:
PROJECT_REF="your-project-ref"              # From URL or dashboard
DB_HOST="db.${PROJECT_REF}.supabase.co"
DB_PORT="5432"
DB_NAME="postgres"
DB_USER="postgres"
```

#### Step 2.4: Build New Connection String
```bash
# Format: postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
NEW_DATABASE_URL="postgresql://postgres:${NEW_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

# Verify format (password should be masked)
echo "${NEW_DATABASE_URL}" | sed 's/:[^@]*@/:***@/'
```

### Phase 3: Update Secrets Storage (5 minutes)

#### Step 3.1: Update AWS Secrets Manager

**Option A: Using AWS CLI**
```bash
# Set AWS region
export AWS_REGION="us-east-1"

# Prepare secret JSON
cat > /tmp/supabase-secret.json <<EOF
{
  "url": "https://${PROJECT_REF}.supabase.co",
  "anon_key": "$(grep SUPABASE_ANON_KEY .env | cut -d'=' -f2)",
  "service_role_key": "$(grep SUPABASE_SERVICE_ROLE_KEY .env | cut -d'=' -f2)",
  "database_url": "${NEW_DATABASE_URL}",
  "db_password": "${NEW_PASSWORD}"
}
EOF

# Update the secret (production)
aws secretsmanager update-secret \
  --secret-id "sovren/production/supabase" \
  --secret-string file:///tmp/supabase-secret.json \
  --region $AWS_REGION

# Verify update
aws secretsmanager describe-secret \
  --secret-id "sovren/production/supabase" \
  --region $AWS_REGION

# Clean up
rm /tmp/supabase-secret.json
```

**Option B: AWS Console**
1. Navigate to: https://console.aws.amazon.com/secretsmanager
2. Select region: `us-east-1`
3. Find secret: `sovren/production/supabase`
4. Click **"Retrieve secret value"** → **"Edit"**
5. Update JSON with new `db_password` and `database_url`
6. Click **"Save"**

#### Step 3.2: Update Local Environment (Development Only)
```bash
# Update .env file with new credentials
# IMPORTANT: Only update local development .env, NOT committed files!

# Backup current .env
cp .env .env.pre-rotation

# Update DATABASE_URL
sed -i.bak "s|DATABASE_URL=.*|DATABASE_URL=${NEW_DATABASE_URL}|" .env

# Update DB_PASSWORD if exists
sed -i.bak "s|DB_PASSWORD=.*|DB_PASSWORD=${NEW_PASSWORD}|" .env

# Verify changes (password should be visible in .env)
grep -E "DATABASE_URL|DB_PASSWORD" .env
```

### Phase 4: Verification (10 minutes)

#### Step 4.1: Test Database Connection

**Using psql (if installed)**:
```bash
# Test connection with new credentials
psql "${NEW_DATABASE_URL}" -c "SELECT NOW() AS current_time, version() AS postgres_version;"

# Expected output:
#          current_time          |           postgres_version
# -------------------------------+--------------------------------------
#  2025-11-08 10:30:00.123456+00 | PostgreSQL 15.x on x86_64...
```

**Using Node.js**:
```bash
# Create test script
cat > /tmp/test-db-connection.js <<'EOF'
const { Pool } = require('pg');

async function testConnection() {
  const pool = new Pool({
    connectionString: process.env.NEW_DATABASE_URL
  });

  try {
    const result = await pool.query('SELECT NOW() as time, current_database() as db');
    console.log('✅ Connection successful!');
    console.log('Timestamp:', result.rows[0].time);
    console.log('Database:', result.rows[0].db);
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    await pool.end();
    process.exit(1);
  }
}

testConnection();
EOF

# Run test
NEW_DATABASE_URL="${NEW_DATABASE_URL}" node /tmp/test-db-connection.js
```

#### Step 4.2: Restart Application (Zero-Downtime)

**Development (local)**:
```bash
# Stop current dev server
# Ctrl+C or kill the process

# Start with new credentials
npm run dev

# Monitor startup logs
# Should see: "Database pool initialized" or similar
```

**Production (Docker/PM2)**:

**Option A: PM2 (Rolling Restart)**
```bash
# Update environment variables
pm2 restart sovren-backend --update-env

# Monitor restart
pm2 logs sovren-backend --lines 50

# Verify no errors
pm2 status
```

**Option B: Docker (Rolling Update)**
```bash
# Update docker-compose environment
# Edit docker-compose.prod.yml with new DATABASE_URL

# Rolling restart (zero downtime)
docker-compose -f docker-compose.prod.yml up -d --no-deps --build backend

# Monitor logs
docker-compose -f docker-compose.prod.yml logs -f backend | grep -E "database|pool|connection"
```

**Option C: Kubernetes (if applicable)**
```bash
# Update secret
kubectl create secret generic sovren-db-credentials \
  --from-literal=database-url="${NEW_DATABASE_URL}" \
  --dry-run=client -o yaml | kubectl apply -f -

# Rolling restart
kubectl rollout restart deployment/sovren-backend

# Monitor rollout
kubectl rollout status deployment/sovren-backend

# Check pod health
kubectl get pods -l app=sovren-backend
```

#### Step 4.3: Health Check Verification

```bash
# Wait 30 seconds for connection pool to stabilize
sleep 30

# Test health endpoints
curl http://localhost:3001/health

# Expected output:
# {
#   "status": "healthy",
#   "database": "connected",
#   "uptime": 12345
# }

# Test database-specific health
curl http://localhost:3001/health/database

# Check pool metrics
curl http://localhost:3001/health/pool | jq '.'
```

#### Step 4.4: Functional Testing

```bash
# Run smoke tests
npm run test:smoke

# Expected: All 28 tests passing

# Run database integration tests
npm run test:integration

# Test a real database operation (read)
curl http://localhost:3001/api/users/me \
  -H "Authorization: Bearer YOUR_TEST_TOKEN"

# Test a write operation
curl -X POST http://localhost:3001/api/content \
  -H "Authorization: Bearer YOUR_TEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","content":"Rotation verification"}'
```

### Phase 5: Monitoring & Validation (15 minutes)

#### Step 5.1: Monitor Error Rates

```bash
# Watch application logs
tail -f logs/application.log | grep -E "error|database|authentication"

# Docker logs
docker logs -f sovren-backend --since 5m | grep -E "error|database"

# Check for connection errors
grep -i "connection.*failed\|authentication.*failed" logs/application.log
```

#### Step 5.2: Verify Old Credentials Disabled

**Test old connection string fails**:
```bash
# Read old credentials from backup
OLD_DATABASE_URL=$(cat .credentials-backup/current-db-url.txt | cut -d'=' -f2)

# Attempt connection (should fail with authentication error)
psql "${OLD_DATABASE_URL}" -c "SELECT 1" 2>&1 | grep -i "password\|authentication"

# Expected: "FATAL: password authentication failed for user "postgres""
```

If old credentials still work:
- ⚠️ **WARNING**: Password rotation may not have taken effect
- Verify you're testing the correct environment
- Check Supabase dashboard for confirmation

#### Step 5.3: Performance Validation

```bash
# Check pool metrics
curl http://localhost:3001/health/pool | jq '.poolMetrics'

# Expected healthy metrics:
# - idleConnections: 5-15
# - activeConnections: 0-5 (at rest)
# - waitingRequests: 0
# - errorRate: < 1%

# Run load test (optional)
npm run test:load -- --duration 60 --rps 10
```

### Phase 6: Documentation & Cleanup (5 minutes)

#### Step 6.1: Update Audit Log

Update `/Users/fp/Desktop/Sovren/docs/security/audit-log.md`:

```bash
# Generate audit entry
cat >> /Users/fp/Desktop/Sovren/docs/security/audit-log.md <<EOF

---

## $(date +%Y-%m-%d): Database Credential Rotation (IMMED-004)

### Incident Type
**Scheduled Security Rotation**: Supabase Database Credentials

### Details
- **Date**: $(date -u +%Y-%m-%dT%H:%M:%SZ)
- **Issue**: #9 (IMMED-004)
- **Environment**: Production
- **Performed By**: Security Engineer (following IMMED-004 procedure)
- **Rotation Method**: Manual (Supabase Dashboard + AWS Secrets Manager)

### Actions Taken
1. ✅ Backed up current credentials
2. ✅ Generated new 32-character secure password
3. ✅ Rotated password in Supabase dashboard
4. ✅ Updated AWS Secrets Manager (\`sovren/production/supabase\`)
5. ✅ Tested new connection string
6. ✅ Performed rolling restart (zero downtime)
7. ✅ Verified old credentials disabled
8. ✅ Monitored error rates and performance

### Verification Results
- **Connection Test**: ✅ Passed
- **Health Checks**: ✅ All healthy
- **Smoke Tests**: ✅ 28/28 passed
- **Old Credentials**: ✅ Disabled (authentication failed)
- **Downtime**: 0 seconds
- **Error Rate**: < 0.1%

### Rollback Capability
- Backup location: \`.credentials-backup/\`
- Backup retention: 7 days
- Rollback time: < 2 minutes

### Next Rotation
- Scheduled: $(date -d '+90 days' +%Y-%m-%d) (90 days)
- Automation: Consider implementing automated rotation

---
EOF

echo "✅ Audit log updated"
```

#### Step 6.2: Secure Cleanup

```bash
# Keep backups for 7 days, then delete
# DO NOT delete immediately (rollback insurance)

# Set restrictive permissions on backup directory
chmod 700 .credentials-backup
chmod 600 .credentials-backup/*

# Schedule cleanup (7 days)
echo "find .credentials-backup -type f -mtime +7 -delete" > .credentials-backup/cleanup.sh
chmod +x .credentials-backup/cleanup.sh

# Add to crontab (optional)
# 0 0 * * * cd /path/to/backend && ./.credentials-backup/cleanup.sh
```

#### Step 6.3: Update CHANGELOG

```bash
# Add entry to CHANGELOG.md
cat >> /Users/fp/Desktop/Sovren/packages/backend/CHANGELOG.md <<EOF

### Security - $(date +%Y-%m-%d)

**IMMED-004: Database Credential Rotation**

- **Rotated Supabase database credentials** following security best practices
- **Updated AWS Secrets Manager** with new credentials (\`sovren/production/supabase\`)
- **Zero downtime** achieved through graceful connection pool transition
- **Verification**: All health checks passing, smoke tests 28/28, error rate < 0.1%
- **Documentation**: Updated audit log, rotation procedure, rollback plan
- **Next Rotation**: $(date -d '+90 days' +%Y-%m-%d) (90-day schedule)

**Files Changed**:
- \`docs/security/audit-log.md\` - Added rotation entry
- \`docs/security/IMMED-004-ROTATION-PROCEDURE.md\` - Created procedure
- AWS Secrets Manager: \`sovren/production/supabase\` - Updated
- \`.credentials-backup/\` - Backup created (7-day retention)

**Issue**: #9 (IMMED-004)

EOF
```

## Rollback Procedure

If issues occur during rotation, follow this immediate rollback:

### Rollback Steps (< 2 minutes)

```bash
# Step 1: Restore old credentials from backup
cp .env.pre-rotation .env

# Step 2: Restart application
pm2 restart sovren-backend --update-env
# OR
docker-compose restart backend

# Step 3: Verify old connection works
OLD_DATABASE_URL=$(grep DATABASE_URL .env | cut -d'=' -f2)
psql "${OLD_DATABASE_URL}" -c "SELECT NOW()"

# Step 4: Restore AWS secret (if updated)
aws secretsmanager update-secret \
  --secret-id "sovren/production/supabase" \
  --secret-string file://.credentials-backup/previous-secret.json

# Step 5: Monitor recovery
curl http://localhost:3001/health
```

### Post-Rollback Actions

1. **Identify root cause** of rotation failure
2. **Document issues** in audit log
3. **Fix underlying problems** before retry
4. **Schedule new rotation attempt** after fixes validated

## Success Criteria

The rotation is considered successful when:

- ✅ New credentials verified working
- ✅ Old credentials confirmed disabled
- ✅ AWS Secrets Manager updated
- ✅ Application health checks passing
- ✅ Smoke tests 28/28 passing
- ✅ Error rate < 1%
- ✅ Zero downtime achieved
- ✅ Audit log updated
- ✅ Backups created and secured

## Post-Rotation Recommendations

### Immediate (Next 24 Hours)
1. ✅ Monitor error rates for spikes
2. ✅ Verify all production services functioning
3. ✅ Test disaster recovery procedures
4. ✅ Confirm backups accessible

### Short-Term (Next Week)
1. **Integrate SecretsService with DatabasePool**:
   - Modify `src/database/pool.ts` to use `SecretsService.getSecret('DATABASE_URL')`
   - Update health checks to verify secrets retrieval
   - Test graceful secret refresh without restart

2. **Automate Rotation**:
   - Set up Supabase Management API access token
   - Test automated rotation script in staging
   - Schedule quarterly rotations via GitHub Actions

### Long-Term (Next Month)
1. **Implement Secret Rotation Monitoring**:
   - Alert on rotation failures
   - Dashboard for credential age
   - Automated testing of backup credentials

2. **Document Lessons Learned**:
   - Update rotation procedure based on experience
   - Create runbook for common issues
   - Train team on rotation process

## Support & Escalation

If issues occur:

1. **Critical Issues** (service down):
   - Execute immediate rollback
   - Contact: security@sovren.dev
   - Escalate to: DevOps team lead

2. **Non-Critical Issues**:
   - Document in GitHub issue #9
   - Review during next security sync
   - Update procedure documentation

## Compliance & Audit

This rotation procedure satisfies:
- ✅ **OWASP Top 10 (A07)**: Identification and Authentication Failures
- ✅ **CWE-798**: Use of Hard-coded Credentials (prevention)
- ✅ **PCI-DSS 8.2.4**: Change credentials every 90 days
- ✅ **SOC 2**: Access control and credential management

## Appendix

### A. Troubleshooting Common Issues

**Issue: "password authentication failed"**
- Cause: Password not rotated correctly or connection string malformed
- Solution: Verify password in Supabase dashboard, check connection string format

**Issue: "connection refused"**
- Cause: Firewall or network issue
- Solution: Verify DB_HOST, check security groups/firewall rules

**Issue: "too many connections"**
- Cause: Old connections not drained
- Solution: Wait 30 seconds, verify pool configuration

### B. Verification Checklist

Print this checklist and check off each item:

```
Pre-Rotation:
[ ] Backups created
[ ] Current metrics recorded
[ ] Rollback plan reviewed

Rotation:
[ ] New password generated (32+ chars)
[ ] Supabase password rotated
[ ] Connection string built
[ ] AWS Secrets Manager updated
[ ] Local .env updated (dev only)

Verification:
[ ] New connection tested (psql/Node.js)
[ ] Application restarted (zero downtime)
[ ] Health checks passing
[ ] Smoke tests 28/28
[ ] Old credentials disabled

Documentation:
[ ] Audit log updated
[ ] CHANGELOG updated
[ ] Backups secured (chmod 600)
[ ] Next rotation scheduled

Sign-off:
Name: _________________
Date: _________________
Issue: #9 (IMMED-004)
```

### C. Contact Information

- **Security Team**: security@sovren.dev
- **DevOps Lead**: devops@sovren.dev
- **On-Call**: +1-XXX-XXX-XXXX
- **GitHub Issue**: #9

---

**Document Version**: 1.0
**Last Updated**: 2025-11-08
**Next Review**: 2025-12-08 (30 days)
