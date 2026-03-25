# Epic 002: Payment Processing - Quick Reference Guide

## 30-Second Summary

Epic 002 decomposed into **18 stories** across **4 sprints** (52-76 hours total).

**Critical Path**: #001 → #002 → #004 → #007 (13-16 hours sequential)

**Fastest Completion**: 2-3 days with 4 developers

**Files**:

- User Stories: `EPIC-002-USER-STORIES.md`
- Dependencies: `EPIC-002-DEPENDENCY-GRAPH.mmd`
- Sprint Plan: `EPIC-002-STORY-MAP.md`
- Summary: `EPIC-002-IMPLEMENTATION-SUMMARY.md`

---

## Story Quick Lookup

### Sprint 0: Foundation (8-12 hours)

| #   | Story                         | Hours | Priority | Blocks |
| --- | ----------------------------- | ----- | -------- | ------ |
| 001 | Payment State Machine Types   | 2-4   | CRITICAL | ALL    |
| 002 | Payment State Machine Service | 3-4   | CRITICAL | ALL    |
| 003 | Invoice Expiration Handling   | 3-4   | HIGH     | None   |

### Sprint 1: Security (12-16 hours)

| #   | Story                        | Hours | Priority | Blocks     | Parallel   |
| --- | ---------------------------- | ----- | -------- | ---------- | ---------- |
| 004 | Race Condition Prevention    | 4     | CRITICAL | #007, #008 | No         |
| 005 | Webhook Signature Validation | 3-4   | HIGH     | #017       | Yes (#006) |
| 006 | Idempotency Key Support      | 3-4   | HIGH     | None       | Yes (#005) |
| 007 | Exponential Backoff Retry    | 4     | HIGH     | #008       | No         |

### Sprint 2: Features (16-24 hours)

| #   | Story                      | Hours | Priority | Blocks | Parallel  |
| --- | -------------------------- | ----- | -------- | ------ | --------- |
| 008 | Subscription Retry & Grace | 4     | HIGH     | None   | Yes       |
| 009 | Refund Processing          | 4     | MEDIUM   | None   | Yes       |
| 010 | Subscription Upgrade       | 4     | MEDIUM   | None   | Yes       |
| 011 | Multi-Currency Display     | 3-4   | LOW      | None   | Yes (All) |
| 012 | Payment Analytics          | 4     | MEDIUM   | None   | Yes (All) |

### Sprint 3: Advanced (16-24 hours)

| #   | Story                    | Hours | Priority | Blocks | Parallel  |
| --- | ------------------------ | ----- | -------- | ------ | --------- |
| 013 | Batch Payment Processing | 3-4   | LOW      | None   | Yes (All) |
| 014 | Payment Method Fallback  | 3-4   | MEDIUM   | None   | Yes (All) |
| 015 | Tax Calculation          | 3-4   | MEDIUM   | None   | Yes (All) |
| 016 | Invoice PDF Generation   | 3-4   | LOW      | None   | Yes (All) |
| 017 | Payment Webhook System   | 4     | MEDIUM   | None   | Yes       |
| 018 | Mermaid Documentation    | 3-4   | MEDIUM   | None   | Yes (All) |

---

## Critical Path (Must Complete in Order)

```
#001 (2-4h) → #002 (3-4h) → #004 (4h) → #007 (4h)
Total: 13-16 hours sequential
```

**Risk**: HIGH - Everything depends on this path

**Recommendation**: Assign most experienced developer to critical path

---

## Maximum Parallelization

After #002 completes, these can run in parallel:

**Sprint 1**: #005 + #006 (can run simultaneously)
**Sprint 2**: #009 + #010 + #011 + #012 (4 developers)
**Sprint 3**: #013 + #014 + #015 + #016 + #017 (5 developers)

---

## Team Allocation Scenarios

### 1 Developer (Sequential)

**Duration**: 6.5-9.5 days (52-76 hours)
**Order**: Follow numbering (#001 → #002 → ... → #018)

### 2 Developers (Balanced)

**Duration**: 4-5 days (32-40 hours)

- **Dev A**: Critical path (#001, #002, #004, #007)
- **Dev B**: Security + Features (#005, #006, #009, #010)

### 3 Developers (Optimal)

**Duration**: 3-4 days (24-32 hours)

- **Dev A**: Foundation (#001, #002, #003)
- **Dev B**: Security (#004, #005, #006)
- **Dev C**: Features (#009, #010, #011, #012)

### 4+ Developers (Maximum Speed)

**Duration**: 2-3 days (16-24 hours)

- **Dev A**: Foundation (#001, #002, #003)
- **Dev B**: Security (#004, #005, #006)
- **Dev C**: Features (#009, #010, #011, #012)
- **Dev D**: Advanced (#013, #014, #015, #016, #017)
- **Tech Writer**: Documentation (#018)

---

## High-Risk Stories (Extra Review)

### CRITICAL RISK

- **#001** Payment State Machine Types (affects entire codebase)
- **#002** Payment State Machine Service (critical infrastructure)
- **#004** Race Condition Prevention (subtle bugs, hard to test)

**Mitigation**: Pair programming, extensive testing, security review

### MEDIUM RISK

- **#005** Webhook Signature Validation (cryptographic security)
- **#006** Idempotency Key Support (Redis + database coordination)
- **#007** Retry Logic (job queue integration)
- **#008** Subscription Retry (complex business logic)
- **#010** Subscription Upgrade (proration math accuracy)

**Mitigation**: Code review by senior developer, comprehensive tests

---

## Definition of Done Checklist

Every story must have:

- [ ] Acceptance criteria met (all Given-When-Then scenarios passing)
- [ ] Unit tests written (80%+ coverage)
- [ ] Integration tests passing (if applicable)
- [ ] Code review approved
- [ ] Security considerations addressed
- [ ] Performance requirements met
- [ ] Documentation updated
- [ ] Deployed to staging
- [ ] QA validation passed

---

## Quality Gates (Must Pass Before Next Sprint)

### Sprint 0 Complete

- [ ] TypeScript types compile without errors
- [ ] Database migrations run successfully
- [ ] State machine handles all valid transitions
- [ ] 100% unit test coverage on state machine
- [ ] Code review approved

### Sprint 1 Complete

- [ ] 100 concurrent verifications → 0 duplicates
- [ ] Webhook signature passes penetration test
- [ ] Idempotency prevents duplicates (load test: 1000 requests)
- [ ] Security audit passed

### Sprint 2 Complete

- [ ] Subscription grace period tested
- [ ] Refund workflow approved by finance
- [ ] Prorated billing accurate (< 1 sat variance)
- [ ] All E2E tests passing

### Sprint 3 Complete

- [ ] Batch processing: 100 payouts < 60s
- [ ] All Mermaid diagrams render correctly
- [ ] Documentation complete

---

## Success Metrics (Monitor Daily)

### Technical

- Payment success rate: **> 95%** (target: 98%)
- Processing time: **< 2 seconds** (p95)
- Race conditions: **0 incidents**
- Test coverage: **> 80%**

### Business

- Failed payment rate: **< 5%**
- Subscription churn: **< 10%** monthly
- Refund rate: **< 2%**
- Support tickets: **40% reduction**

---

## Common Pitfalls & Solutions

### Pitfall 1: Starting features before foundation

**Problem**: Stories #009-#018 depend on #001, #002
**Solution**: Complete Sprint 0 fully before starting features

### Pitfall 2: Skipping security testing

**Problem**: Race conditions discovered in production
**Solution**: Load test #004 with 100+ concurrent requests

### Pitfall 3: Inadequate test coverage

**Problem**: Bugs discovered after deployment
**Solution**: Enforce 80%+ coverage, require integration tests

### Pitfall 4: Missing security review

**Problem**: Webhook signature vulnerability
**Solution**: External security audit for #005, #006

---

## Emergency Contacts & Resources

### Technical Questions

- **State Machine**: See `EPIC-002-USER-STORIES.md` Story #001, #002
- **Security**: See `EPIC-002-USER-STORIES.md` Story #004-#007
- **Testing**: See each story's "Testing Requirements" section

### Code Examples

- State machine: `packages/backend/src/services/payment/PaymentStateMachine.ts`
- Types: `packages/shared/src/types/payment-state.ts`
- Database: `supabase/migrations/YYYYMMDDHHMMSS_*.sql`

### Documentation

- Full User Stories: `EPIC-002-USER-STORIES.md` (MAIN REFERENCE)
- Dependencies: `EPIC-002-DEPENDENCY-GRAPH.mmd`
- Sprint Plan: `EPIC-002-STORY-MAP.md`
- Summary: `EPIC-002-IMPLEMENTATION-SUMMARY.md`

---

## One-Page Story Summary

**Copy this to your daily standup doc:**

```
EPIC 002 - PAYMENT PROCESSING (18 stories, 52-76 hours)

SPRINT 0 - FOUNDATION (8-12h, CRITICAL)
  #001: Payment State Types (2-4h) ★★★★★ BLOCKS ALL
  #002: State Machine Service (3-4h) ★★★★★ BLOCKS ALL
  #003: Invoice Expiration (3-4h) ★★★

SPRINT 1 - SECURITY (12-16h, CRITICAL)
  #004: Race Prevention (4h) ★★★★★ CRITICAL PATH
  #005: Webhook Signature (3-4h) ★★★★ PARALLEL
  #006: Idempotency Keys (3-4h) ★★★★ PARALLEL
  #007: Retry Logic (4h) ★★★★

SPRINT 2 - FEATURES (16-24h, HIGH)
  #008: Subscription Retry (4h) ★★★★ ALL PARALLEL
  #009: Refunds (4h) ★★★
  #010: Upgrades (4h) ★★★
  #011: Currency (3-4h) ★★
  #012: Analytics (4h) ★★★

SPRINT 3 - ADVANCED (16-24h, MEDIUM-LOW)
  #013: Batch Processing (3-4h) ★★ ALL PARALLEL
  #014: Fallback (3-4h) ★★
  #015: Tax (3-4h) ★★
  #016: PDF (3-4h) ★★
  #017: Webhooks (4h) ★★★
  #018: Docs (3-4h) ★★

CRITICAL PATH: #001 → #002 → #004 → #007 (13-16h)
MAX PARALLELIZATION: 5 developers in Sprint 2 & 3
```

---

## Quick Commands

### View Mermaid Diagram

```bash
# Install mermaid-cli
npm install -g @mermaid-js/mermaid-cli

# Generate PNG
mmdc -i EPIC-002-DEPENDENCY-GRAPH.mmd -o EPIC-002-DEPENDENCY-GRAPH.png
```

### Create GitHub Issues (Template)

```bash
# Use GitHub CLI
gh issue create --title "[STORY-001] Payment State Machine Types" \
                --body-file EPIC-002-USER-STORIES.md \
                --label "payment,critical-path,sprint-0"
```

### Run Tests

```bash
# Unit tests
npm test -- --coverage

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e
```

---

**Quick Links**:

- Main Epic: `EPIC-002-payment-processing-todos.md`
- User Stories: `EPIC-002-USER-STORIES.md` ← **START HERE**
- Dependencies: `EPIC-002-DEPENDENCY-GRAPH.mmd`
- Sprint Plan: `EPIC-002-STORY-MAP.md`
- Summary: `EPIC-002-IMPLEMENTATION-SUMMARY.md`
- This Guide: `EPIC-002-QUICK-REFERENCE.md`

**Next Step**: Review `EPIC-002-USER-STORIES.md` and start Sprint 0 Story #001
