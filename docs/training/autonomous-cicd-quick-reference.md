# 🚀 Autonomous CI/CD Quick Reference Guide

## Visual Workflow References

📊 **Interactive Diagrams**: Refer to the **main training guide** for visual workflow diagrams:

- **Diagram 1**: Complete Development Flow (feature → production)
- **Diagram 2**: AI Pipeline Orchestration (how AI makes decisions)
- **Diagram 3**: Pre-commit Hook Sequence (commit process)
- **Diagram 4**: Deployment Validation (safety checks)
- **Diagram 5**: Emergency Rollback (incident response)
- **Diagram 6**: Environment Management (dev/staging/prod)

---

## Essential Commands

### 🔧 Essential Commands

#### Starting Development

```bash
# Clone and setup
git clone https://github.com/sovren/sovren.git
cd sovren

# Start development environment (AI auto-configures)
docker-compose -f docker-compose.dev.yml up -d

# Create feature branch (AI learns from patterns)
git checkout -b feature/your-feature-name

# Optional: Provide AI context
echo "Feature description and scope" > .sovren/feature-intent.md
```

#### Committing Changes

```bash
# Conventional commit format (required)
git commit -m "feat(scope): description

- Detailed change 1
- Detailed change 2
- Include testing info

Closes: SOVR-XXX"

# Emergency override (use sparingly)
git commit --no-verify -m "emergency fix

Override-AI: SKIP_VALIDATION
Emergency-Level: CRITICAL
Reason: Production down"
```

#### Deployment Workflow

```bash
# Push feature branch (triggers AI pipeline)
git push origin feature/your-feature-name

# Create pull request
gh pr create --title "Feature Title" --body "Description"

# Merge after approval (triggers production deployment)
gh pr merge --squash
```

---

### 🤖 AI Override Commands

#### Pre-commit Hook Overrides

```bash
# Run full test suite instead of AI selection
git commit -m "feat: critical changes

Override-AI: RUN_FULL_TEST_SUITE
Reason: Critical payment logic changes"

# Skip optimization for debugging
git commit -m "debug: investigation

Override-AI: SKIP_OPTIMIZATION
Debug-Mode: ENABLED"

# Force deployment bypass
git commit -m "hotfix: security patch

Override-AI: FORCE_PRODUCTION_DEPLOY
Emergency-Level: CRITICAL"
```

#### Pipeline Strategy Overrides

```bash
# Force comprehensive pipeline
git commit -m "feat: core system changes

Pipeline-Strategy: COMPREHENSIVE
Reason: Core authentication changes"

# Request fast track
git commit -m "fix: minor UI bug

Pipeline-Strategy: FAST_TRACK
Reason: Low-risk styling fix"
```

---

### 📊 Monitoring & Dashboards

#### Essential URLs

- **Pipeline Health**: https://cicd.sovren.dev/dashboard
- **Deployment Status**: https://deploy.sovren.dev/status
- **AI Insights**: https://ai.sovren.dev/insights
- **Production Metrics**: https://metrics.sovren.dev
- **Error Tracking**: https://errors.sovren.dev

#### Environment URLs

- **Development**: http://localhost:3000
- **Staging**: https://staging-pr-{number}.sovren.dev
- **Production**: https://sovren.com

---

### 🎯 Commit Message Templates

#### Feature Implementation

```
feat(lightning): implement payment status widget

- Add real-time payment status polling
- Include QR code generation for invoices
- Add comprehensive error handling
- Include 95% test coverage

Features:
- Lightning BOLT11 invoice support
- WebSocket status updates
- Mobile-optimized UI

Testing:
- Unit tests: 23 test cases
- Integration tests: Lightning testnet validated
- E2E tests: Complete payment flows

Closes: SOVR-123
```

#### Bug Fix

```
fix(auth): resolve NOSTR key validation issue

- Fix signature verification for ed25519 keys
- Add proper error messages for invalid keys
- Include additional test cases for edge cases

Root Cause: Incorrect key encoding in validation
Impact: 0.02% of authentication attempts
Resolution: Updated cryptographic validation logic

Fixes: SOVR-456
```

#### Hotfix (Production)

```
hotfix(lightning): increase payment timeout to 180s

Critical fix for payment failures during network congestion.
Updated timeout based on Lightning Network best practices.

Emergency-Priority: HIGH
Impact: Payment success rate 87% → 99.8%
Deployment: Direct to production after validation
```

---

### 🧪 Testing Commands

#### Local Testing

```bash
# Run AI-selected tests
npm run test:ai-selected

# Run full test suite
npm run test:all

# Run specific test category
npm run test:lightning
npm run test:components
npm run test:integration

# Run with coverage
npm run test:coverage
```

#### Lightning Network Testing

```bash
# Test Lightning integration
npm run test:lightning-integration

# Test payment flows
npm run test:payment-flows

# Test NOSTR events
npm run test:nostr-integration
```

---

### 🔍 Debugging Commands

#### Pipeline Debugging

```bash
# View pipeline logs
gh run list --branch feature/your-branch
gh run view <run-id>

# Check AI decision logs
curl -H "Authorization: Bearer $TOKEN" \
  https://api.sovren.dev/ai/pipeline-analysis/<run-id>
```

#### Environment Debugging

```bash
# Check environment health
curl https://staging-pr-123.sovren.dev/api/health

# View environment logs
docker-compose logs -f sovren-backend

# Check Lightning connectivity
curl https://staging-pr-123.sovren.dev/api/lightning/status
```

---

### 🚨 Emergency Procedures

#### Production Issues

```bash
# View current production status
curl https://api.sovren.dev/health

# Check for active incidents
curl https://api.sovren.dev/incidents/active

# Emergency rollback (if needed)
# Contact: #sovren-incidents on Slack
```

#### Pipeline Failures

```bash
# Retry failed pipeline
gh run rerun <run-id>

# Check AI failure analysis
curl https://ai.sovren.dev/failure-analysis/<run-id>

# Manual override for emergency
git commit --amend -m "emergency: force deployment

Override-AI: EMERGENCY_DEPLOY
Approved-By: CTO"
```

---

### 📈 Performance Targets

#### Code Quality

- **Quality Score**: >95/100
- **Test Coverage**: >95%
- **TypeScript Coverage**: 100%
- **Security Score**: 100/100

#### Performance Metrics

- **Component Load**: <200ms
- **API Response**: <100ms
- **Bundle Size**: <3MB
- **Lighthouse Score**: >90/100

#### Pipeline Timing

- **Pre-commit Hooks**: <10s
- **Pipeline Execution**: <20m
- **Deployment**: <15m
- **Rollback**: <3m

---

### 🎯 Feature Flag Management

#### Feature Flag Structure

```typescript
// packages/shared/src/featureFlags.ts
export const featureFlags = {
  yourFeatureName: {
    enabled: true,
    rolloutPercentage: 5, // Start small
    targeting: {
      userTypes: ['premium', 'creator'],
      regions: ['US', 'EU'],
    },
  },
};
```

#### Rollout Strategy

- **Phase 1**: 5% of targeted users
- **Phase 2**: 25% (if metrics good)
- **Phase 3**: 50% (monitor closely)
- **Phase 4**: 100% (full rollout)

---

### 🔧 Environment Variables

#### Required for Development

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
LIGHTNING_NETWORK_URL=http://localhost:9735
NOSTR_RELAY_URLS=ws://localhost:7000,wss://nos.lol
```

#### AI System Configuration

```bash
# AI system will auto-configure these
SOVREN_AI_ENABLED=true
SOVREN_RISK_THRESHOLD=0.7
SOVREN_AUTO_DEPLOY_THRESHOLD=0.95
```

---

### 🤝 Getting Help

#### Team Channels

- **#sovren-development**: General development questions
- **#sovren-deployments**: Deployment and CI/CD issues
- **#sovren-incidents**: Production issues and emergencies
- **#sovren-ai-insights**: AI system feedback and optimization

#### Documentation

- **Architecture Docs**: `/docs/architecture/`
- **API Documentation**: `/docs/api/`
- **Troubleshooting**: `/docs/troubleshooting/`
- **Training Materials**: `/docs/training/`

#### On-call Support

- **PagerDuty**: For production emergencies
- **Slack**: @oncall for immediate assistance
- **Email**: engineering@sovren.com

---

### 📝 Best Practices Checklist

#### Before Committing

- [ ] Feature flag implemented and tested
- [ ] Comprehensive tests written (>95% coverage)
- [ ] TypeScript types properly defined
- [ ] Error handling and validation included
- [ ] Performance impact considered
- [ ] Security implications reviewed
- [ ] Documentation updated

#### Before Merging PR

- [ ] AI pipeline passed successfully
- [ ] Code review approved by team
- [ ] Staging deployment validated
- [ ] Performance benchmarks met
- [ ] Security scan clean
- [ ] Feature flag ready for rollout
- [ ] Rollback plan documented

#### After Production Deployment

- [ ] Feature metrics tracking active
- [ ] User feedback monitoring enabled
- [ ] Performance dashboards updated
- [ ] Team notified of deployment
- [ ] Documentation published
- [ ] Success metrics validated
- [ ] Next iteration planned

---

_Quick Reference Version: 2.1_
_Last Updated: January 15, 2024_
_AI System Version: 3.4.1_
