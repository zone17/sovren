# Universal Deployment Integration Template for ALL Agents

**Status**: MANDATORY (Post Epic 006 - 100% CI/CD Automation)
**Effective Date**: 2025-10-27
**Applies To**: ALL specialized agents working on Sovren

---

## 🚨 CRITICAL REQUIREMENT

**Every agent MUST integrate with the automated CI/CD pipeline when completing stories.**

Stories are **NOT COMPLETE** until:
- ✅ CI/CD quality gates passing
- ✅ Staging deployment successful
- ✅ Health checks passing
- ✅ Smoke tests passing (28/28)
- ✅ Deployment status documented

---

## Mandatory Story Completion Template

When completing ANY story, agents MUST include this section in their output:

```markdown
## Deployment Status ✅

### CI/CD Pipeline
- [x] PR created: #[PR-NUMBER]
- [x] CI/CD checks: All passing ✅
  - Quality gates: ✅ PASS
  - Security scans: ✅ PASS
  - Docker build: ✅ PASS
  - Tests: ✅ PASS (coverage: XX%)

### Staging Deployment
- [x] Auto-deployment: Success ✅
- [x] Deployment time: [X] minutes
- [x] Health checks: All passing ✅
  - /health: ✅ 200 OK
  - /ready: ✅ 200 OK
  - /live: ✅ 200 OK
  - /detailed: ✅ 200 OK
- [x] Smoke tests: 28/28 passing ✅
- [x] Error rate: < 5% ✅
- [x] Response time P95: < 1000ms ✅

### Production Deployment
- [ ] Pending manual approval
- [ ] Command: `gh workflow run backend-deployment.yml -f environment=production`
- [ ] Requires: 1 approving reviewer

### Deployment Verification Commands

\```bash
# View deployment status
gh run list --workflow=backend-deployment.yml --limit 5

# Monitor deployment
gh run watch

# Verify staging health
curl https://api-staging.sovren.dev/health

# Check smoke tests
npm run test:smoke

# View deployment logs
gh run view --log

# Trigger production deployment (after approval)
gh workflow run backend-deployment.yml -f environment=production

# Emergency rollback (if needed)
gh workflow run automated-rollback.yml -f environment=staging
\```

### Health Check Response (Staging)
\```json
{
  "status": "healthy",
  "timestamp": "2025-10-27T...",
  "uptime": XXX,
  "version": "1.0.0",
  "services": {
    "database": "connected",
    "cache": "connected"
  }
}
\```
```

---

## Agent-Specific Requirements

### Backend API Builder Agent

**Additional Checks**:
- ✅ Health check endpoints implemented (/health, /ready, /live)
- ✅ Database migrations included in deployment
- ✅ API documentation updated (OpenAPI spec)
- ✅ Backward compatibility verified
- ✅ Integration tests passing (testcontainers)

**Health Check Implementation**:
```typescript
// Required for all new services
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'service-name',
    timestamp: new Date().toISOString()
  });
});

app.get('/ready', async (req, res) => {
  const dbHealthy = await checkDatabaseConnection();
  const cacheHealthy = await checkCacheConnection();

  if (dbHealthy && cacheHealthy) {
    res.json({ status: 'ready' });
  } else {
    res.status(503).json({ status: 'not ready' });
  }
});
```

---

### Elite Frontend Dev Agent

**Additional Checks**:
- ✅ Vercel preview deployment verified
- ✅ Lighthouse CI checks passing (≥90)
- ✅ Bundle size within limits (< 250KB per chunk)
- ✅ Responsive design validated (mobile/tablet/desktop)
- ✅ Accessibility checks passing (WCAG 2.1 AA)

**Frontend Deployment**:
```bash
# Preview URL provided in PR comments
# Production deployment (after backend deployed)
gh workflow run release.yml -f environment=production
```

---

### CICD Pipeline Architect Agent

**Additional Checks**:
- ✅ Workflow changes tested in feature branch
- ✅ Deployment procedures documented
- ✅ Secrets updated if new integrations added
- ✅ Backward compatibility with existing deployments verified

---

### Test Automation Engineer Agent

**Additional Checks**:
- ✅ Deployment tests added for new features
- ✅ Smoke test suite updated if new endpoints added
- ✅ Test coverage > 90% for deployment logic
- ✅ Performance regression tests added if applicable

---

### Technical Docs Writer Agent

**Additional Checks**:
- ✅ Deployment documentation updated if procedures changed
- ✅ Health check endpoints documented
- ✅ Troubleshooting guides updated with new scenarios
- ✅ Runbooks created for new operational procedures

---

### Infrastructure Provisioner Agent

**Additional Checks**:
- ✅ Terraform configs updated if infrastructure changed
- ✅ Infrastructure changes applied to staging first
- ✅ Infrastructure changes tested before production
- ✅ Environment configs updated if new resources added

---

## Deployment Workflow

### 1. Create Pull Request

```bash
gh pr create --title "feat(US-XXX): Description" \
  --body "$(cat <<'EOF'
## Summary
[Changes summary]

## Deployment Checklist
- [x] CI/CD checks passing
- [x] Tests passing (XX% coverage)
- [x] Documentation updated
- [x] CHANGELOG.md updated
- [x] Ready for staging deployment

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

### 2. Wait for CI/CD Checks

```bash
# View PR checks
gh pr checks

# Wait for all checks to pass
gh pr checks --watch
```

### 3. Merge to Main (Triggers Staging Deployment)

```bash
# Merge PR (auto-deploys to staging)
gh pr merge --auto --squash

# Monitor deployment
gh run watch
```

### 4. Validate Staging Deployment

```bash
# Check deployment status
gh run list --workflow=backend-deployment.yml --limit 1

# Verify health
curl https://api-staging.sovren.dev/health

# Run smoke tests
npm run test:smoke

# View logs
gh run view --log
```

### 5. Production Deployment (Manual)

```bash
# Trigger production deployment
gh workflow run backend-deployment.yml -f environment=production

# Approve in GitHub UI
# Navigate to: Actions → Backend Deployment → Review deployments → Approve

# Monitor deployment
gh run watch

# Verify production health
curl https://api.sovren.dev/health
```

---

## Rollback Procedure

### Automatic Rollback Triggers

- HTTP 5xx error rate > 5% for 2 minutes
- Response time P95 > 1000ms
- Health check failures > 3 consecutive
- Manual trigger via workflow_dispatch

### Manual Rollback

```bash
# Emergency rollback (< 2 minutes)
gh workflow run automated-rollback.yml -f environment=staging

# Or for production
gh workflow run automated-rollback.yml -f environment=production

# Monitor rollback
gh run watch

# Verify rollback success
curl https://api-staging.sovren.dev/health
```

---

## Health Check Endpoints (MANDATORY for All Services)

Every service MUST implement these 4 endpoints:

1. **GET /health** - General health status
2. **GET /ready** - Readiness probe (DB, cache connectivity)
3. **GET /live** - Liveness probe (process alive)
4. **GET /detailed** - Detailed health report (admin only)

---

## Quality Gates (Must Pass Before Deployment)

### Pre-Deployment Checks
- ✅ All tests passing (≥95% coverage for services)
- ✅ ESLint checks passing (0 errors/warnings)
- ✅ TypeScript type checks passing
- ✅ Security scans passing (0 high/critical vulnerabilities)
- ✅ Docker build successful
- ✅ Image size < 150MB
- ✅ Trivy security scan clean
- ✅ SBOM generated
- ✅ Image signed with Cosign

### Post-Deployment Validation
- ✅ Deployment time < 10 minutes
- ✅ Health checks passing (all 4 endpoints)
- ✅ Smoke tests passing (28/28)
- ✅ Error rate < 5%
- ✅ Response time P95 < 1000ms
- ✅ Zero errors in logs
- ✅ Metrics normal

---

## Troubleshooting

### Issue: CI/CD Checks Failing

```bash
# View failing checks
gh pr checks

# View specific check logs
gh run view <run-id> --log

# Fix issues and push
git add . && git commit -m "fix: resolve CI issues" && git push
```

### Issue: Staging Deployment Failed

```bash
# View deployment logs
gh run view --log

# Check staging health
curl https://api-staging.sovren.dev/health

# Rollback if needed
gh workflow run automated-rollback.yml -f environment=staging
```

### Issue: Health Checks Failing

```bash
# Check each health endpoint
curl https://api-staging.sovren.dev/health
curl https://api-staging.sovren.dev/ready
curl https://api-staging.sovren.dev/live

# View detailed health report
curl https://api-staging.sovren.dev/detailed
```

### Issue: Smoke Tests Failing

```bash
# Run smoke tests locally
npm run test:smoke

# View test results
cat test-results/smoke-tests.xml

# Check specific failing test
npm test -- smoke-tests.test.ts -t "test name"
```

---

## Reference Documentation

- **Deployment Integration Standards**: docs/development/DEPLOYMENT_INTEGRATION_STANDARDS.md
- **Deployment Guide**: docs/deployment/DEPLOYMENT_GUIDE.md
- **Docker Guide**: docs/deployment/DOCKER_GUIDE.md
- **Secrets Management**: docs/deployment/secrets-management.md
- **Epic 006 Summary**: EPIC-006-DEPLOYMENT-AUTOMATION-COMPLETE.md

---

## Compliance

**This template is MANDATORY for all agents.**

Non-compliance will result in:
- ❌ PR rejection
- ❌ Blocked merge to main
- ❌ Failed deployment
- ❌ Automatic rollback

**Stories are incomplete until staging deployment succeeds.**

---

**Last Updated**: 2025-10-27
**Version**: 1.0.0
**Status**: MANDATORY
