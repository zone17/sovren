# Deployment Quick Reference Card

**Epic**: 006 - Automated Deployment Pipeline
**Version**: 1.0.0
**Last Updated**: 2025-10-27

## Common Commands

### Deploy to Staging

```bash
# Automatic on main branch push
git push origin main

# Manual trigger
gh workflow run backend-deployment.yml -f environment=staging
```

### Deploy to Production

```bash
# Manual trigger (requires approval)
gh workflow run backend-deployment.yml -f environment=production

# Force deploy (bypass time restrictions)
gh workflow run backend-deployment.yml \
  -f environment=production \
  -f force_deploy=true
```

### Trigger Rollback

```bash
# Emergency rollback
gh workflow run automated-rollback.yml \
  -f environment=production \
  -f reason="High error rate detected" \
  -f skip_verification=false
```

### Monitor Deployment

```bash
# Watch current workflow
gh run watch

# List recent runs
gh run list --workflow=backend-deployment.yml --limit 5

# View specific run
gh run view <run-id> --log
```

### Check Health

```bash
# Production
curl https://api.sovren.app/health
curl https://api.sovren.app/health/detailed

# Staging
curl https://staging-api.sovren.app/health

# Deployment metrics
curl https://api.sovren.app/api/deployment/health
```

## Deployment Flow

```
Developer Push → Quality Gates → Build → Security Scan → Deploy
                      ↓ fail         ↓         ↓            ↓
                    Block         GHCR    Trivy/Cosign   Blue Env
                                                            ↓
                                                    Health Checks
                                                            ↓
                                                    Traffic Switch
                                                    (10%→50%→100%)
                                                            ↓
                                                         Monitor
                                                            ↓
                                                    Complete/Rollback
```

## Health Endpoints

| Endpoint                 | Purpose                      | Response Time |
| ------------------------ | ---------------------------- | ------------- |
| `/health`                | Basic health (load balancer) | < 200ms       |
| `/health/ready`          | Readiness probe (DB+Redis)   | < 500ms       |
| `/health/live`           | Liveness probe (process)     | < 100ms       |
| `/health/detailed`       | Full diagnostics             | < 1000ms      |
| `/api/deployment/health` | Deployment metrics           | < 500ms       |
| `/api/metrics`           | Prometheus format            | < 500ms       |

## Rollback Triggers

- ✅ Error rate > 5%
- ✅ P95 response time > 1000ms
- ✅ P99 response time > 2000ms
- ✅ Health check failures (3+ consecutive)
- ✅ 5xx error rate > 10%
- ✅ Manual trigger

## Time Guarantees

| Operation                  | Guaranteed Time |
| -------------------------- | --------------- |
| Full Deployment            | < 10 minutes    |
| Rollback                   | < 2 minutes     |
| Health Check Validation    | < 5 minutes     |
| Traffic Switch (per stage) | 60 seconds      |

## Required Secrets

### Production

- `DATABASE_URL`
- `REDIS_URL`
- `DEPLOYMENT_TOKEN`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `LNBITS_API_URL`
- `LNBITS_ADMIN_KEY`
- `NOSTR_RELAYS`
- `SLACK_WEBHOOK_URL`
- `JWT_SECRET`

### Staging

Same secrets with `STAGING_` prefix

## Troubleshooting

### Deployment Stuck

```bash
gh run cancel <run-id>
gh workflow run backend-deployment.yml -f environment=staging
```

### Health Checks Failing

```bash
# Check logs
gh run view --log | grep "health"

# Test manually
curl https://blue.api.sovren.app/health
```

### Rollback Failed

```bash
# Manual traffic switch
# (Infrastructure-specific - see deployment guide)

# Verify green health
curl https://api.sovren.app/health
```

## Emergency Contacts

- **Slack**: `#engineering` channel
- **On-Call**: Page via incident system
- **Escalation**: Create P1 incident ticket

## Key Files

- Deployment workflow: `.github/workflows/backend-deployment.yml`
- Blue-green workflow: `.github/workflows/deploy-blue-green.yml`
- Rollback workflow: `.github/workflows/automated-rollback.yml`
- Deployment guide: `docs/deployment/DEPLOYMENT_GUIDE.md`
- Secrets guide: `docs/deployment/SECRETS_MANAGEMENT.md`

## Success Criteria Checklist

Pre-Deployment:

- [ ] All tests passing
- [ ] Code reviewed
- [ ] Secrets configured
- [ ] Deployment window checked

Post-Deployment:

- [ ] Health checks passing
- [ ] Error rate < 5%
- [ ] Response times normal
- [ ] Smoke tests passed
- [ ] Monitored for 15 minutes

---

**Quick Help**: See full documentation at `/docs/deployment/DEPLOYMENT_GUIDE.md`
