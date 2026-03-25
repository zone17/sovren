# Disaster Recovery

## Overview

This document defines recovery procedures, targets, and validation steps for restoring Sovren services after a significant failure or data loss event. Engineers executing recovery steps should work from this document directly and update it with any deviations for the post-mortem.

---

## RTO / RPO Targets

Recovery Time Objective (RTO) is the maximum acceptable time from incident declaration to service restoration. Recovery Point Objective (RPO) is the maximum acceptable data loss measured in time.

| Tier | Services | RTO | RPO | Priority |
|------|----------|-----|-----|----------|
| **Tier 1** | Payments (Lightning), Authentication (Supabase Auth) | 1 hour | 5 minutes | Highest |
| **Tier 2** | Content delivery, NOSTR relay integration, Social feeds | 4 hours | 1 hour | High |
| **Tier 3** | Analytics, Monitoring dashboards, Background jobs | 24 hours | 24 hours | Standard |

Tier 1 services represent direct revenue and user access. They are restored first, always. Tier 2 services are the core user experience. Tier 3 services are non-customer-facing and can be sacrificed temporarily to recover Tier 1 and 2 faster.

---

## Supabase Point-In-Time Recovery (PITR)

Supabase PITR allows restoring the database to any point within the retention window (default: 7 days on Pro plan).

**When to use**: Data corruption, accidental deletion, migration that caused data loss, or a security incident requiring rollback to a pre-breach state.

**Prerequisites**: PITR must be enabled on the Supabase project before an incident occurs. Verify this is enabled in the Supabase dashboard under Settings → Backups.

### Step-by-Step Restore Procedure

1. **Declare the incident** per [INCIDENT_PLAYBOOK.md](../incident-response/INCIDENT_PLAYBOOK.md). P0 for any data loss scenario.

2. **Identify the target restore point**. Review application logs, Sentry events, and the incident timeline to determine the last known-good timestamp (in UTC).

3. **Notify stakeholders** that a database restore is in progress. Post to the status page: "We are performing a database restore to recover data. Service will be unavailable during this process."

4. **Initiate the restore via Supabase Dashboard**:
   - Navigate to: Supabase Dashboard → Your Project → Settings → Backups
   - Click "Restore to a point in time"
   - Enter the target timestamp (ISO 8601 format, UTC)
   - Confirm the restore operation

   Alternatively, via Supabase CLI (if configured):
   ```bash
   supabase db restore --project-ref <project-ref> --timestamp "2024-01-15T14:30:00Z"
   ```

5. **Monitor restore progress** in the Supabase dashboard. Restore duration depends on database size (typically 5–30 minutes).

6. **Do not run any migrations** during the restore. If application code was deployed with a schema migration after the restore point, you will need to re-run those migrations after the restore completes.

7. **Verify the restore** (see Post-Recovery Validation Checklist below).

8. **Re-run pending migrations** if the restore point predates the current schema version:
   ```bash
   # List pending migrations
   supabase migration list --project-ref <project-ref>

   # Apply pending migrations
   supabase db push --project-ref <project-ref>
   ```

9. **Restart backend services** to clear connection pool state:
   ```bash
   docker compose -f docker-compose.prod.yml restart backend
   ```

10. **Confirm service restoration** and post update to status page.

### Important Notes

- PITR restores to a **new database**. The Supabase project URL and anon key remain the same, but internal replica state is replaced.
- Row Level Security (RLS) policies and database roles are preserved in the restore.
- Storage (files/buckets) is **not included** in PITR. Files must be restored separately if affected.
- Auth users are included in PITR restores.

---

## Redis Persistence Recovery

Sovren uses Redis for session caching, rate limiting, and temporary state. Redis data loss is tolerable for most use cases (sessions expire naturally), but a full Redis failure can cause auth degradation.

**When to use**: Redis container crash, data corruption, or unexpected eviction of critical keys.

### Step-by-Step Recovery

1. **Assess impact**: Redis loss means active sessions are invalidated. Users will need to re-authenticate. This is a Tier 2 issue unless the Redis failure is also blocking payment processing.

2. **Restart the Redis container**:
   ```bash
   docker compose -f docker-compose.prod.yml restart redis
   ```

3. **Verify Redis is healthy**:
   ```bash
   docker exec sovren-redis redis-cli ping
   # Expected output: PONG

   docker exec sovren-redis redis-cli info replication
   ```

4. **If Redis data is corrupted and AOF/RDB persistence files are damaged**:
   ```bash
   # Stop Redis
   docker compose -f docker-compose.prod.yml stop redis

   # Remove corrupted data files
   docker exec sovren-redis sh -c "rm -f /data/dump.rdb /data/appendonly.aof"

   # Start Redis with a clean state
   docker compose -f docker-compose.prod.yml start redis
   ```

   Starting with a clean state means all cached data is lost. Sessions are invalidated, rate limit counters reset, and any temporary state is cleared. This is acceptable — the system recovers through normal user interactions.

5. **Monitor error rates** in Sentry and Grafana for the 30 minutes following recovery. An increase in auth errors is expected as users re-authenticate; it should taper off within 15 minutes.

6. **If using Redis Sentinel or Cluster** (future configuration): follow the sentinel failover procedure in the infrastructure runbook rather than this procedure.

---

## Vercel Frontend Rollback

Vercel maintains a full deployment history. Rollback to any previous successful deployment is near-instant (under 60 seconds).

**When to use**: A frontend deployment caused a regression, white-screen error, or broke a critical user flow.

### Step-by-Step Rollback

1. **Identify the last known-good deployment**:
   - Navigate to: Vercel Dashboard → sovren project → Deployments
   - Find the most recent deployment marked "Ready" before the problematic one
   - Note the deployment URL (e.g., `sovren-abc123.vercel.app`)

   Via CLI:
   ```bash
   # List recent deployments
   npx vercel ls --limit 10

   # Or using gh CLI if Vercel GitHub app is connected
   gh run list --workflow=deploy-frontend.yml --limit 10
   ```

2. **Promote the previous deployment to production**:
   - In Vercel Dashboard: click the target deployment → "..." menu → "Promote to Production"
   - Confirm the promotion

   Via CLI:
   ```bash
   npx vercel promote <deployment-url-or-id> --scope <team-slug>
   ```

3. **Verify the rollback** by visiting the production URL and confirming the previous version is serving.

4. **Post status update**: "Frontend has been rolled back to the previous stable version. The team is investigating the root cause."

5. **Investigate the regression** in the problematic deployment's build logs:
   ```bash
   gh run view <run-id> --log-failed
   ```

6. **Do not re-deploy** until the root cause is identified and fixed.

---

## Docker Backend Rollback

The backend is deployed as a Docker image tagged with the Git commit SHA and pushed to GHCR (GitHub Container Registry).

**When to use**: A backend deployment caused API errors, health check failures, or broke a critical service.

### Step-by-Step Rollback

1. **Identify the previous image tag**:
   ```bash
   # List recent images in GHCR
   gh api /orgs/<org>/packages/container/sovren-backend/versions \
     --jq '.[0:5] | .[] | {id: .id, tags: .metadata.container.tags, created: .created_at}'
   ```

   Or check GitHub Actions deployment history to find the image tag of the last successful production deploy.

2. **Update the production compose file or deployment config** to reference the previous image tag:
   ```bash
   # Edit docker-compose.prod.yml
   # Change: image: ghcr.io/<org>/sovren-backend:<current-tag>
   # To:     image: ghcr.io/<org>/sovren-backend:<previous-tag>
   ```

3. **Pull and redeploy**:
   ```bash
   # Pull the previous image
   docker pull ghcr.io/<org>/sovren-backend:<previous-tag>

   # Redeploy with the previous image
   docker compose -f docker-compose.prod.yml up -d backend
   ```

4. **Verify the rollback**:
   ```bash
   # Check container is running
   docker compose -f docker-compose.prod.yml ps

   # Check health endpoint
   curl -f https://api.sovren.dev/health

   # Check logs for startup errors
   docker compose -f docker-compose.prod.yml logs --tail=50 backend
   ```

5. **Post status update** and begin root cause investigation.

6. **Tag the problematic image** for investigation:
   ```bash
   # Add a label to the broken image so it is not GC'd before post-mortem
   gh api -X PATCH /orgs/<org>/packages/container/sovren-backend/versions/<version-id> \
     --field metadata='{"container":{"tags":["broken-YYYY-MM-DD"]}}'
   ```

---

## Post-Recovery Validation Checklist

Run this checklist after any recovery procedure before declaring the incident resolved.

### Health Endpoints

```bash
# Backend liveness
curl -f https://api.sovren.dev/live
# Expected: 200 OK, {"status":"ok"}

# Backend readiness (includes DB + Redis connectivity)
curl -f https://api.sovren.dev/ready
# Expected: 200 OK, {"status":"ok","database":"connected","redis":"connected"}

# Detailed health check
curl -f https://api.sovren.dev/detailed
# Review all subsystem statuses

# Frontend
curl -f https://sovren.dev
# Expected: 200 OK, HTML response
```

### Authentication Flow Smoke Test

1. Navigate to `https://sovren.dev`
2. Click "Sign In" or "Get Started"
3. Complete a full authentication flow (NOSTR key login or Supabase email/password)
4. Verify the authenticated dashboard loads
5. Verify the user session persists across a page refresh

### Payment Flow Smoke Test

For Tier 1 recovery, perform a test Lightning payment:

1. Log in as a test creator account
2. Navigate to a content item with a Lightning payment gate
3. Generate a Lightning invoice
4. Pay the invoice from a test wallet (regtest or small mainnet amount)
5. Verify the content unlocks after payment confirmation
6. Verify the payment appears in the creator's transaction history

### NOSTR Connectivity Check

1. Log in with a NOSTR key
2. Post a test note
3. Verify the note appears in the feed
4. Verify relay connectivity indicators show green

### Database Integrity Spot Check

After a PITR restore, run these queries via Supabase SQL editor to verify data integrity:

```sql
-- Check recent user records
SELECT COUNT(*), MAX(created_at) FROM auth.users;

-- Check payment records are consistent
SELECT COUNT(*), MAX(created_at) FROM payments
WHERE created_at > NOW() - INTERVAL '24 hours';

-- Check for orphaned records
SELECT COUNT(*) FROM content c
LEFT JOIN auth.users u ON c.user_id = u.id
WHERE u.id IS NULL;
```

### Monitoring Restoration

After recovery, verify monitoring is functioning:
- Grafana dashboards show current data (not gaps)
- Sentry is receiving new events
- Uptime monitor shows service as "Up"

---

## Emergency Contact List

_Fill in before going to production._

| Role | Name | Slack | Phone | When to Contact |
|------|------|-------|-------|-----------------|
| Engineering Lead | [TBD] | @[handle] | [number] | P0 at declaration, P1 at 1hr mark |
| Backend Owner | [TBD] | @[handle] | [number] | Backend / DB / API incidents |
| Payments Owner | [TBD] | @[handle] | [number] | Lightning / payment incidents |
| Infrastructure Owner | [TBD] | @[handle] | [number] | Docker / infra incidents |
| CTO | [TBD] | @[handle] | [number] | Data breach, legal exposure, P0 at 2hr |
| Supabase Support | — | — | [support URL] | Database issues beyond team capability |
| Vercel Support | — | — | [support URL] | Deployment platform issues |

---

## Related Documents

- [Incident Playbook](../incident-response/INCIDENT_PLAYBOOK.md) — declaration, command structure, post-mortem template
- [On-Call Policy](../incident-response/ON_CALL_POLICY.md) — rotation, escalation matrix, paging
- [Deployment Guide](./DEPLOYMENT_GUIDE.md) — normal deployment procedures
- [Secrets Management](./SECRETS_MANAGEMENT.md) — credential rotation during security incidents
- [Docker Guide](./DOCKER_GUIDE.md) — Docker operations reference
