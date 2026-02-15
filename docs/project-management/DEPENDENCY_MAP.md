# Dependency Map - Sovren Production Launch

This document maps all dependencies between user stories in the Sovren Production Launch project, identifies the critical path, and highlights opportunities for parallel work.

## Table of Contents

1. [Visual Dependency Maps](#visual-dependency-maps)
2. [Epic-Level Dependencies](#epic-level-dependencies)
3. [Story-Level Dependencies](#story-level-dependencies)
4. [Critical Path Analysis](#critical-path-analysis)
5. [Blocking Dependencies](#blocking-dependencies)
6. [Dependency Matrix](#dependency-matrix)

---

## Visual Dependency Maps

### Epic Dependencies

![Epic Dependencies](https://github.com/zone17/Sovren/blob/main/docs/architecture/diagrams/project-management/epic-dependencies.mmd)

**Diagram**: [epic-dependencies.mmd](../architecture/diagrams/project-management/epic-dependencies.mmd)

**Key Insights**:
- EPIC 1 (Immediate Blockers) MUST complete before EPIC 2 starts
- Within EPIC 2, three parallel streams: NOSTR Auth, Content Creation, Lightning Payments
- EPIC 3 (Integration) requires completion of all EPIC 2 streams
- EPIC 4 (Production) is sequential with some parallel opportunities

### Critical Path

![Critical Path](https://github.com/zone17/Sovren/blob/main/docs/architecture/diagrams/project-management/critical-path.mmd)

**Diagram**: [critical-path.mmd](../architecture/diagrams/project-management/critical-path.mmd)

**Critical Path Duration**: 6 weeks (Nov 4 - Dec 13)
**Longest Chain**: Test Fix → NOSTR Auth → Content Creation → Lightning Pay → E2E Testing → Production

### Parallel Work Streams

![Parallel Streams](https://github.com/zone17/Sovren/blob/main/docs/architecture/diagrams/project-management/parallel-streams.mmd)

**Diagram**: [parallel-streams.mmd](../architecture/diagrams/project-management/parallel-streams.mmd)

**Parallelization Opportunities**:
- Week 1: Sequential (foundation work)
- Week 2: Sequential (NOSTR auth design-first approach)
- Weeks 3-4: **3 parallel streams** (Content, Lightning, Subscriptions)
- Week 5: **2 parallel streams** (E2E Testing, Accessibility)
- Week 6: **2 parallel streams** (Security/Performance, Infrastructure)

---

## Epic-Level Dependencies

### EPIC 1: Immediate Blockers (Week 1)

**Total Stories**: 7 (Issues #5-11)
**Duration**: 13 hours (~2 days)
**Blocking**: All other epics

#### Internal Dependencies

```
#5 (Fix Jest Config) → #6 (Security Remediation) → #11 (Validate Tests)
                                    ↓
                           #8 (Update Dependencies)

Parallel:
#7 (Commit US-007) can run anytime
#9 (Fix Pool Tests) depends on #5
#10 (Update Monitoring) depends on #6
```

#### Blocks

- **Blocks EPIC 2**: Cannot start frontend development until tests are passing
- **Blocks EPIC 3**: Integration tests require working test infrastructure
- **Blocks EPIC 4**: Production deployment requires clean security audit

**Reason**: Test infrastructure and security remediation are foundational for all subsequent work.

---

### EPIC 2: Frontend Critical Stories (Weeks 2-4)

**Total Stories**: 41 (Issues #12-52)
**Duration**: 3 weeks
**Blocked By**: EPIC 1 (#5, #6, #11)

#### Sub-Epics (Parallel Streams)

##### Stream A: NOSTR Authentication (Week 2)

**Stories**: #12-26 (15 stories)
**Duration**: 5 days
**Pattern**: Design → Implementation → Testing → Review

```
Design Phase (2 days):
  #12: User Flows
  #13: Wireframes
  #14: Mockups
  #15: Component Specs
  #16: Accessibility Annotations
    ↓
Implementation Phase (2 days):
  #17: NOSTRAuthButton
  #18: AuthModal
  #19: ExtensionAuth
  #20: ManualKeyInput
  #21: RoleSelector
    ↓
Testing Phase (1 day):
  #22: Unit Tests
  #23: Integration Tests
  #24: Service Tests
  #25: Hook Tests
  #26: E2E Scenarios
```

**Blocks**:
- Required for user onboarding
- Blocks content creation (users must auth first)
- Blocks payment flow (auth required for transactions)

##### Stream B: Content Creation (Week 3)

**Stories**: #27-41 (15 stories)
**Duration**: 6 days
**Pattern**: Design → Implementation → Testing

```
Design Phase (2 days):
  #27: User Flows
  #28: Wireframes
  #29: Editor Mockups
  #30: Media Upload Design
  #31: Component Specs
    ↓
Implementation Phase (3 days):
  #32: ContentEditor (rich text)
  #33: MediaUploader
  #34: PremiumToggle
  #35: PublishButton
  #36: Auto-save Service
    ↓
Testing Phase (1 day):
  #37: Editor Unit Tests
  #38: Upload Integration Tests
  #39: Auto-save Tests
  #40: NOSTR Publishing Tests
  #41: E2E Content Flow
```

**Blocks**:
- Required for creators to publish
- Blocks analytics (no content = no data)
- Blocks discovery (need content to discover)

**Parallel With**:
- Stream C (Subscription Tiers) - different components, no conflicts
- Can start after NOSTR Auth design phase complete (with mocked auth)

##### Stream C: Lightning Payments (Week 4)

**Stories**: #42-52 (11 stories)
**Duration**: 5.5 days
**Pattern**: Design → Implementation → Validation → Testing

```
Design Phase (2 days):
  #42: Payment Flows
  #43: Invoice Display Design
  #44: Payment Modal Mockups
  #45: Transaction History Design
  #46: Component Specs
    ↓
Implementation Phase (3 days):
  #47: LightningWalletConnect
  #48: InvoiceDisplay (BOLT11 + QR)
  #49: PaymentStatus
  #50: TransactionHistory
  #51: WebLN Integration
    ↓
Validation (0.5 days):
  #52: Lightning Protocol Validation
```

**Blocks**:
- Required for monetization
- Blocks subscription management
- Critical for MVP launch

**Parallel With**:
- Stream B (Content Creation) - different feature modules
- Can start after NOSTR Auth implementation complete

---

### EPIC 3: Integration & Testing (Week 5)

**Total Stories**: 10 (Issues #53-62)
**Duration**: 5 days
**Blocked By**: EPIC 2 (all streams must complete)

#### Stream D: E2E Testing (Sequential)

```
#53: Creator Onboarding E2E
#54: Supporter Flow E2E
#55: Content Creation Flow E2E
#56: Payment Flow E2E
#57: Error Recovery E2E
  ↓
#58: NOSTR Protocol Validation
```

**Duration**: 4 days
**Agent**: e2e-testing-specialist, nostr-protocol-specialist

#### Stream E: Accessibility Audit (Parallel)

```
#59: Component Accessibility Audit
#60: Screen Reader Testing
#61: Keyboard Navigation Testing
#62: Lighthouse Accessibility Scores
```

**Duration**: 2 days
**Agent**: accessibility-specialist
**Can run in parallel with**: Stream D (independent testing)

**Blocks**:
- EPIC 4 (Production) - Must verify all functionality works end-to-end

---

### EPIC 4: Production Readiness (Week 6)

**Total Stories**: 9 (Issues #63-71)
**Duration**: 7 days
**Blocked By**: EPIC 3 (#53-58 minimum)

#### Stream F: Security & Performance (Sequential)

```
Security Audit (2 days):
  #63: Frontend Security Audit
  #64: Backend Security Audit
  #65: NOSTR & Lightning Security
    ↓
Performance Optimization (2 days):
  #66: Core Web Vitals Optimization
  #67: Bundle Size Optimization
  #68: React Performance Tuning
```

**Agent**: security-engineer, performance-optimization-engineer

#### Stream G: Infrastructure (Parallel)

```
#69: Monitoring & Observability Setup (2 days)
#70: API Documentation Update (1 day)
```

**Agent**: monitoring-observability-architect, api-documentation-engineer
**Can run in parallel with**: Stream F (different concerns)

#### Final Gate

```
#71: Final Code Review & Production Certification (1 day)
```

**Agent**: code-review-specialist
**Blocks**: Production launch
**Requires**: All other stories complete

---

## Story-Level Dependencies

### Detailed Dependency Chains

#### Chain 1: Foundation → Auth → Content

```
#5 (Fix Jest) → #6 (Security) → #11 (Validate Tests)
  ↓
#12 (Auth Design) → #17 (Auth Implementation) → #22 (Auth Testing)
  ↓
#27 (Content Design) → #32 (Content Implementation) → #37 (Content Testing)
  ↓
#53 (E2E Testing) → #63 (Security Audit) → #71 (Final Review)
```

**Duration**: 25 days (critical path)
**Risk**: Any delay cascades through entire chain

#### Chain 2: Foundation → Payment → Integration

```
#5 (Fix Jest) → #6 (Security) → #11 (Validate Tests)
  ↓
#42 (Payment Design) → #47 (Payment Implementation) → #52 (Lightning Validation)
  ↓
#56 (Payment E2E) → #65 (Lightning Security) → #71 (Final Review)
```

**Duration**: 22 days
**Risk**: Lightning integration complexity, payment testing critical

#### Chain 3: Accessibility Path (Parallel)

```
#12-26 (NOSTR Auth complete)
  ↓
#59 (A11y Audit) → #60 (Screen Reader) → #61 (Keyboard Nav) → #62 (Lighthouse)
  ↓
#71 (Final Review)
```

**Duration**: 7 days (not on critical path)
**Can run in parallel with**: E2E testing stream

---

## Critical Path Analysis

### Critical Path Stories (in sequence)

1. **#5**: Fix Jest Configuration (2 hours) - CRITICAL
2. **#6**: Security Remediation (4 hours) - CRITICAL
3. **#11**: Validate Test Suite (1 hour) - CRITICAL
4. **#12-16**: NOSTR Auth Design (2 days) - CRITICAL
5. **#17-21**: NOSTR Auth Implementation (2 days) - CRITICAL
6. **#22-26**: NOSTR Auth Testing (1 day) - CRITICAL
7. **#27-31**: Content Design (2 days) - CRITICAL
8. **#32-36**: Content Implementation (3 days) - CRITICAL
9. **#37-41**: Content Testing (1 day) - CRITICAL
10. **#53-57**: E2E Critical Flows (3 days) - CRITICAL
11. **#58**: NOSTR Protocol Validation (1 day) - CRITICAL
12. **#63-65**: Security Audit (2 days) - CRITICAL
13. **#66-68**: Performance Optimization (2 days) - CRITICAL
14. **#69**: Monitoring Setup (2 days) - CRITICAL
15. **#71**: Final Review (1 day) - CRITICAL

**Total Critical Path Duration**: 27 working days (~6 weeks with weekends)
**Float/Buffer**: 3 days (built into estimates)

### High-Risk Dependencies

#### Risk 1: Test Infrastructure (#5, #6, #11)

**Risk Level**: CRITICAL
**Impact**: Blocks all development
**Mitigation**:
- Prioritize completion in Week 1
- Allocate dedicated developer
- No parallel work until complete

#### Risk 2: NOSTR Auth (#12-26)

**Risk Level**: HIGH
**Impact**: Blocks content creation and payments
**Mitigation**:
- Use design-first approach
- Implement with mocked backend initially
- Parallel implementation of auth UI while backend finalizes

#### Risk 3: Lightning Integration (#42-52)

**Risk Level**: HIGH
**Impact**: Blocks monetization (critical for MVP)
**Mitigation**:
- Early validation of Lightning service
- Use testnet for development
- Have lightning-network-specialist validate early
- Fallback: Launch without payments initially if blocked

---

## Blocking Dependencies

### Hard Blockers (Cannot Proceed Without)

| Story | Blocked By | Reason | Mitigation |
|-------|-----------|--------|------------|
| #12-52 (All EPIC 2) | #5, #6, #11 | Tests must pass | Complete Week 1 foundation first |
| #17-21 (Auth Impl) | #12-16 (Auth Design) | Cannot implement without design | Use design-first workflow |
| #22-26 (Auth Tests) | #17-21 (Auth Impl) | Cannot test without code | Follow TDD where possible |
| #32-36 (Content Impl) | #27-31 (Content Design) | Cannot implement without design | Design-first workflow |
| #47-51 (Payment Impl) | #42-46 (Payment Design) | Cannot implement without design | Design-first workflow |
| #53-58 (Integration) | #22-26, #37-41, #52 (All testing complete) | Need complete features to integrate | Ensure all feature testing done |
| #63-71 (Production) | #53-58 (Integration complete) | Need stable integration | E2E tests must pass 100% |
| #71 (Final Review) | #63-70 (All production tasks) | Final gate | Cannot launch without all approvals |

### Soft Blockers (Can Work Around)

| Story | Soft Blocker | Workaround |
|-------|-------------|------------|
| #17-21 (Auth Impl) | Backend auth API | Use mocked API responses during development |
| #32-36 (Content Impl) | Backend content API | Use MSW (Mock Service Worker) for API mocking |
| #47-51 (Payment Impl) | Lightning service | Use Lightning testnet and mock invoices |
| #22-26 (Auth Tests) | Backend integration | Mock API calls, integration tests can wait |

---

## Dependency Matrix

### Epic Dependency Matrix

| Epic | Depends On | Blocks | Can Parallelize With |
|------|-----------|--------|---------------------|
| EPIC 1 (Immediate) | None | EPIC 2, 3, 4 | None (foundation) |
| EPIC 2 (Frontend) | EPIC 1 | EPIC 3, 4 | Internal streams can parallelize |
| EPIC 3 (Integration) | EPIC 2 | EPIC 4 | A11y stream can parallelize with E2E |
| EPIC 4 (Production) | EPIC 3 | Launch | Infrastructure can parallelize with Security/Perf |

### Story Dependency Matrix (Sample)

| Story | Depends On | Blocks | Parallel With |
|-------|-----------|--------|---------------|
| #5 (Fix Jest) | None | #9, #11, EPIC 2 | #7, #8 |
| #12 (Auth Design) | #11 | #17 | None |
| #17 (Auth Impl) | #12 | #22 | None |
| #27 (Content Design) | #22 (Auth complete) | #32 | #42 (Payment Design) |
| #32 (Content Impl) | #27 | #37 | #47 (Payment Impl) |
| #42 (Payment Design) | #22 (Auth complete) | #47 | #27 (Content Design) |
| #53 (E2E Testing) | #37, #52 (All features) | #63 | #59 (A11y Audit) |
| #63 (Security) | #53 | #71 | #69 (Monitoring) |

---

## Parallel Work Opportunities

### Maximum Parallelization Points

#### Week 1: 2 parallel threads
- Thread 1: #5 → #6 → #11 (test infrastructure)
- Thread 2: #7, #8 (cleanup and updates)

**Developers Needed**: 2

#### Week 2: 1 thread (sequential design-first)
- Thread 1: #12 → #17 → #22 (NOSTR auth)

**Developers Needed**: 3 (1 design, 1 implementation, 1 testing - sequential handoff)

#### Weeks 3-4: 3 parallel threads (MAXIMUM PARALLELIZATION)
- Thread 1: #27 → #32 → #37 (Content Creation)
- Thread 2: #42 → #47 → #52 (Lightning Payments)
- Thread 3: #48-52 (Subscription Tiers - overlap with Thread 2)

**Developers Needed**: 6-9 (2-3 per thread: design, implementation, testing)

#### Week 5: 2 parallel threads
- Thread 1: #53 → #58 (E2E Testing + NOSTR Validation)
- Thread 2: #59 → #62 (Accessibility Audit)

**Developers Needed**: 3 (2 for E2E, 1 for A11y)

#### Week 6: 2 parallel threads
- Thread 1: #63 → #66 (Security → Performance)
- Thread 2: #69, #70 (Monitoring, API Docs)

**Developers Needed**: 4 (2 for security/perf, 2 for infrastructure)

---

## Recommendations

### Resource Allocation

**Optimal Team Size**: 6-9 developers across 4 specialties

1. **Design Specialists** (1-2): Focus on Weeks 2-4 (auth, content, payment design)
2. **Frontend Developers** (2-3): Implementation across Weeks 2-4
3. **Test Engineers** (1-2): Testing across Weeks 2-5
4. **Full-Stack/DevOps** (1-2): Week 1 (foundation), Week 6 (production)

### Risk Mitigation Strategy

1. **Build Foundation First** (Week 1):
   - Zero parallelization
   - Focus on test infrastructure and security
   - Cannot skip or rush

2. **Design-First Approach** (Weeks 2-4):
   - Always complete design phase before implementation
   - Reduces rework and technical debt
   - Enables parallel implementation streams

3. **Early Integration Testing** (Week 5):
   - Don't wait until Week 6
   - Run integration tests as features complete
   - Catch issues early

4. **Buffer Time**:
   - 3 days buffer built into 6-week timeline
   - Use for unexpected blockers
   - Priority: Lightning integration (highest risk)

### Success Metrics

**Velocity Tracking**:
- Week 1: 7 stories (foundation) - 100% completion required
- Weeks 2-4: 41 stories (frontend) - Target 90%+ completion
- Week 5: 10 stories (integration) - 100% completion required
- Week 6: 9 stories (production) - 100% completion required

**Critical Path Monitoring**:
- Track critical path stories daily
- Any delay > 1 day triggers escalation
- Re-plan if critical path at risk

---

## Tools and Scripts

### Dependency Checker Script

```bash
# Check if all dependencies are met for a story
./scripts/check-dependencies.sh <ISSUE_NUMBER>

# Example
./scripts/check-dependencies.sh 17
# Output: ✅ All dependencies met (#12-16 complete)
#         or
#         ❌ Blocked: Waiting for #12 (Auth Design)
```

### Critical Path Monitor

```bash
# View current critical path status
./scripts/critical-path-status.sh

# Output: Critical Path Status:
#   Week 1: ✅ Complete (100%)
#   Week 2: 🟡 In Progress (60%)
#   Week 3: ⏸️ Blocked
#   Estimated Completion: Dec 15 (2 days delay)
```

---

## Appendix

### Full Story List by Epic

#### EPIC 1: Immediate Blockers (#5-11)
- #5: Fix Jest Configuration
- #6: Security Remediation
- #7: Commit US-007 Work
- #8: Update Dependencies
- #9: Fix Pool Tests
- #10: Update Monitoring Dashboard
- #11: Validate Test Suite

#### EPIC 2: Frontend (#12-52)
**NOSTR Auth (#12-26)**:
- #12-16: Design Phase
- #17-21: Implementation Phase
- #22-26: Testing Phase

**Content Creation (#27-41)**:
- #27-31: Design Phase
- #32-36: Implementation Phase
- #37-41: Testing Phase

**Lightning Payments (#42-52)**:
- #42-46: Design Phase
- #47-51: Implementation Phase
- #52: Lightning Validation

#### EPIC 3: Integration (#53-62)
- #53-57: E2E Testing (5 flows)
- #58: NOSTR Protocol Validation
- #59-62: Accessibility Audit

#### EPIC 4: Production (#63-71)
- #63-65: Security Audit (Frontend, Backend, Lightning)
- #66-68: Performance Optimization
- #69: Monitoring & Observability
- #70: API Documentation
- #71: Final Review & Certification

---

**Document Version**: 1.0
**Last Updated**: 2025-11-06
**Maintained By**: Project Management Team
**Related**: [STORY_WORKFLOW.md](STORY_WORKFLOW.md), [PARALLEL_STREAMS.md](PARALLEL_STREAMS.md)
