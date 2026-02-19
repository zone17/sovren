---
title: 'Wave 2 Prevention: Integration Guide for Next Sprint'
category: prevention
tags: [integration, workflow, team-coordination]
---

# Wave 2 Prevention: How Three Strategies Work Together

This guide shows how the three prevention strategies prevent Wave 2 problems from recurring in Wave 3 and future sprints.

## The Three Prevention Strategies

| Problem                         | Prevention                         | Timing                              |
| ------------------------------- | ---------------------------------- | ----------------------------------- |
| **Pre-Commit Hooks Masked**     | 8-check pre-commit hook system     | **Before code is committed**        |
| **Test-Service Coupling Drift** | MockValidator CI gate              | **During PR review (before merge)** |
| **Multi-Agent File Conflicts**  | File ownership matrix + git config | **During task assignment**          |

---

## Scenario: Wave 3 Sprint (6 Agents, 3 Domains)

Let's trace how the three strategies prevent problems together:

### Stage 1: Planning & Task Assignment (Architect)

**What Happens**: Architect designs types, services, and assigns agents to exclusive files.

**How Prevention Strategies Work**:

```
Architect reads: docs/file-ownership.md

Creates:
  ✅ src/types.ts (stubs for Payment, Invoice, Creator types)
  ✅ src/bootstrap.ts (stub DI registrations)
  ✅ src/routes/v1/payments.ts (empty route file)
  ✅ src/routes/v1/invoices.ts (empty route file)
  ✅ src/routes/v1/creators.ts (empty route file)

Assigns agents to EXCLUSIVE files:
  ✅ backend-payments: payment-service.ts, payment-repository.ts, payments.routes.ts
  ✅ backend-invoices: invoice-service.ts, invoice-repository.ts, invoices.routes.ts
  ✅ backend-creators: creator-service.ts, creator-repository.ts, creators.routes.ts

Uses task template (from WAVE2_PREVENTION_CHECKLIST.md):
  ✅ Agent briefing includes: "Read file-ownership.md"
  ✅ Agent briefing includes: "Modify ONLY these files"
  ✅ Agent briefing includes: "Run test:validate-mocks before committing"
```

**Prevention Active**: Multi-agent coordination strategy (Problem 3) — prevents future overlap.

---

### Stage 2: Implementation (Agents)

**What Happens**: Agents implement services in parallel, writing code and tests.

#### Agent: backend-payments

```typescript
// services/payment-service.ts (NEW METHOD ADDED)
class PaymentService {
  async createPayment(data: CreatePaymentInput) {
    // Service added new DB call (Payment table + AuditLog table)
    const payment = await db.payments.create(data);
    await db.auditLog.insert({
      // ← NEW METHOD CALL
      action: 'payment_created',
      targetId: payment.id,
      metadata: { amount: data.amount },
    });
    return payment;
  }
}
```

**Test File** (BEFORE prevention):

```typescript
// ❌ BEFORE: Mock is outdated
const mockRepository = {
  createPayment: jest.fn().mockResolvedValue({ id: '123' }),
  // ❌ MISSING: auditLog methods
};
```

**Test File** (AFTER prevention):

```typescript
// ✅ AFTER: Mock validation catches drift
const mockRepository = {
  createPayment: jest.fn().mockResolvedValue({ id: '123' }),
  auditLog: {
    insert: jest.fn().mockResolvedValue({ id: 'audit-1' })
  }
};

beforeAll(() => {
  // CRITICAL: Catch mock drift before tests run
  const validator = new MockValidator(IPaymentRepository, mockRepository);
  const report = validator.validate(strict: true);
  if (!report.isValid) {
    // Error shows: "Missing method: auditLog.insert"
    // Suggestion: "Add mock method: auditLog.insert(data) { ... }"
    throw new Error(report.suggestions.join('\n'));
  }
});
```

**Prevention Active**: Test-service coupling strategy (Problem 2) — catches drift before tests run.

#### Local Development: Pre-Commit Hook

Agent is ready to commit their changes:

```bash
$ git add services/payment-service.ts __tests__/services/payment-service.test.ts
$ git commit -m "feat(payments): add audit logging to payment creation"

# .husky/pre-commit runs automatically:

[Check 1] Anti-Pattern Scanner ✅ PASS
[Check 2] Jest Configuration ✅ PASS
[Check 3] ESM Compatibility ✅ PASS
[Check 4] TypeScript Compilation ✅ PASS
[Check 5] ESLint ✅ PASS
[Check 6] Prettier ⚠️ WARNING (non-blocking)
[Check 7] Backend Unit Tests ✅ PASS (includes mock validation!)
[Check 8] npm audit ✅ PASS

All pre-commit checks passed! Commit proceeding.

# Agent's local test run
$ npm run test:validate-mocks
✅ Payment service mock validated: 8/8 methods match interface
✅ Mock drift report: ZERO issues
```

**Prevention Active**:

- Pre-commit hooks (Problem 1) — validates code before commit
- Test-service coupling (Problem 2) — mock validation includes 8 methods

#### Agent Verification: File Ownership

Before committing, agent checks they only modified their assigned files:

```bash
$ git diff --name-status

M src/services/payment-service.ts      # ✅ Assigned to me
M src/__tests__/services/payment-service.test.ts  # ✅ Assigned to me
M src/types.ts    # ❌ WAIT: Not assigned to me!
  # Did architect add type stub? Check with architect first.

$ git reset src/types.ts
$ git checkout src/types.ts
$ # Ask architect: "Ready to add PaymentAuditLog type to types.ts?"
```

**Prevention Active**: File ownership strategy (Problem 3) — prevents unexpected file modifications.

---

### Stage 3: Pull Request & CI/CD

**What Happens**: Agent pushes branch; GitHub Actions runs tests + checks.

#### Pre-Commit Hook Summary (Already Ran Locally)

```
✅ All 8 checks passed locally
✅ No --no-verify bypasses used
✅ Code committed with full validation
```

#### CI/CD: Mock Validation Gate

```yaml
# .github/workflows/test-mock-quality.yml runs

Validating all mocks against interfaces...

✅ PaymentService mock: 8/8 methods validated
✅ InvoiceService mock: 6/6 methods validated
✅ CreatorService mock: 5/5 methods validated
✅ All mocks synchronized with interfaces
✅ Zero mock drift detected

Mock validation: PASSED
```

**Prevention Active**: Test-service coupling strategy detects drift DURING CI.

#### PR Review

Code reviewer checks:

```
Checklist:
  ✅ Pre-commit checks passed (from log)
  ✅ Mock validation passed (from CI)
  ✅ Only assigned files modified (verified in git diff)
  ✅ New mocks include validation (code review)
  ✅ Tests pass with new code

APPROVED: Ready to merge
```

---

### Stage 4: Multi-Agent Merge

**What Happens**: 3 agents create PRs; architect merges them.

#### Agent PRs

| Agent            | Branch        | Files                                     | Status   |
| ---------------- | ------------- | ----------------------------------------- | -------- |
| backend-payments | feat/payments | payment-service.ts, payment-repository.ts | ✅ Ready |
| backend-invoices | feat/invoices | invoice-service.ts, invoice-repository.ts | ✅ Ready |
| backend-creators | feat/creators | creator-service.ts, creator-repository.ts | ✅ Ready |

**Shared Files to Merge**:

```
src/types.ts           (architect updated)
src/bootstrap.ts       (architect updated)
src/routes/v1/payments.ts (payment agent)
src/routes/v1/invoices.ts (invoice agent)
src/routes/v1/creators.ts (creator agent)
```

#### Architect Merge Process

**Step 1**: Merge via git with `.gitattributes` merge strategies

```bash
$ git checkout main
$ git pull origin main

# Merge payments branch
$ git merge feat/payments
  ✅ No conflicts (payment agent only modified payment files)
  ✅ Pre-commit hooks validated (from PR checks)

# Merge invoices branch
$ git merge feat/invoices
  ✅ No conflicts (invoice agent only modified invoice files)
  ✅ Pre-commit hooks validated (from PR checks)

# Merge creators branch
$ git merge feat/creators
  ✅ No conflicts (creator agent only modified creator files)
  ✅ Pre-commit hooks validated (from PR checks)

# Merge types.ts changes from architect
$ git merge architect/types
  # May have conflicts if architect added overlapping types
  # Use: scripts/resolve-merge-conflicts.sh src/types.ts
  ✅ Conflict resolved (combine all types)

# Final verification
$ npm run test:validate-mocks
  ✅ All mocks validated
  ✅ Zero drift detected

$ npm run test
  ✅ All tests pass
```

**Prevention Active**: All three strategies combined:

- File ownership (Problem 3) → no conflicts on service files
- Pre-commit hooks (Problem 1) → all code validated
- Mock validation (Problem 2) → all mocks synchronized

**Result**: Clean merge in <15 minutes, zero conflicts, zero surprises.

---

## Preventing Each Wave 2 Problem

### Problem 1: Broken Pre-Commit Hooks (Caught in Stage 2)

**Scenario**: Service adds new npm dependency without updating jest.config.

**Before Prevention**:

```
Agent commits without pre-commit hook.
Tests fail in CI (hidden from local dev).
jest.config missing new dependency.
Pre-commit hook broken for weeks.
```

**After Prevention**:

```
$ git commit -m "feat: add new dependency"
# .husky/pre-commit runs
[Check 3] ESM Compatibility ❌ FAIL
  New dependency "xyz" ESM import failed
  Fix: npm install --save-exact xyz@latest

$ npm install --save-exact xyz@latest
$ git add package.json package-lock.json
$ git commit -m "feat: add new dependency"
# .husky/pre-commit runs again
[Check 3] ESM Compatibility ✅ PASS
# Commit succeeds

Caught locally in <2 minutes. Never reaches CI.
```

**Prevention Checklist**:

- [ ] Pre-commit catches: jest.config mismatches
- [ ] Pre-commit catches: ESM import errors
- [ ] Pre-commit catches: nostr-tools ESM crashes
- [ ] Pre-commit catches: undefined npm scripts
- [ ] Pre-commit catches: TypeScript compile errors

### Problem 2: Test-Service Coupling Drift (Caught in Stage 2 & 3)

**Scenario**: Service adds new DB method; mock not updated.

**Before Prevention**:

```
Agent adds: db.auditLog.insert() to service.
Agent forgets to update mock.
Local tests pass (mock doesn't call auditLog).
CI tests pass (mocks match what agent tested).
Production: "Cannot read properties of undefined" (auditLog is undefined).
```

**After Prevention**:

```
Agent adds: db.auditLog.insert() to service.
beforeAll() calls: MockValidator.validate()
❌ FAIL: Missing method: auditLog.insert
  Suggestion: Add mock method
Agent updates mock in <2 minutes.
beforeAll() passes.
Local tests pass (mock matches service).
CI tests pass (mock validation passed).
Production: Works correctly.
```

**Prevention Checklist**:

- [ ] Mock validation in beforeAll() for all service tests
- [ ] CI gate: test:validate-mocks passes
- [ ] Error message includes method signature suggestion

### Problem 3: Multi-Agent File Conflicts (Prevented in Stage 1 & 4)

**Scenario**: 3 agents all edit types.ts simultaneously.

**Before Prevention**:

```
Agent 1 adds: PaymentType
Agent 2 adds: InvoiceType
Agent 3 adds: CreatorType
All commit to different branches.
All push to main.
Merge conflicts in types.ts:
  <<<<<<<< HEAD
  export interface PaymentType { ... }
  ========
  export interface InvoiceType { ... }
  >>>>>>>>
Manual resolution: 30+ minutes of hand-merging.
Risk: Types accidentally deleted.
```

**After Prevention**:

```
Stage 1: Architect adds ALL types to types.ts first:
  export interface PaymentType { ... }  // Stubs by architect
  export interface InvoiceType { ... }  // Stubs by architect
  export interface CreatorType { ... }  // Stubs by architect

Agents are assigned EXCLUSIVE files:
  Agent 1: payment-service.ts (NOT types.ts)
  Agent 2: invoice-service.ts (NOT types.ts)
  Agent 3: creator-service.ts (NOT types.ts)

All agents implement in parallel:
  ✅ Agent 1: payment-service.ts ONLY
  ✅ Agent 2: invoice-service.ts ONLY
  ✅ Agent 3: creator-service.ts ONLY

Architect merges:
  ✅ No conflicts (each agent modified different file)
  ✅ types.ts unchanged (no merge conflict)

Total merge time: <2 minutes.
```

**Prevention Checklist**:

- [ ] Architect completes Phase 0: types, bootstrap, validators
- [ ] File ownership matrix assigned (exclusive files per agent)
- [ ] Agents briefed: "DO NOT edit types.ts, bootstrap.ts"
- [ ] .gitattributes configured for merge strategies
- [ ] <1 conflict expected, <15 min resolution time

---

## Metrics: Before & After

### Problem 1: Pre-Commit Hooks

| Metric                    | Before         | After         | Improvement |
| ------------------------- | -------------- | ------------- | ----------- |
| Hook failures masked      | 6+ per sprint  | 0             | 100% ↓      |
| `--no-verify` bypass rate | 20+ per sprint | <5 per sprint | 75% ↓       |
| Time to fix hook failure  | 30+ min        | <5 min        | 85% ↓       |
| Jest config mismatches    | 3+ per sprint  | 0             | 100% ↓      |

### Problem 2: Test-Service Coupling

| Metric                          | Before         | After  | Improvement |
| ------------------------------- | -------------- | ------ | ----------- |
| "Cannot read properties" errors | 5-8 per sprint | <1     | 85% ↓       |
| Mock drift issues               | 3-5 per sprint | <1     | 75% ↓       |
| Time to debug drift issue       | 30+ min        | <5 min | 85% ↓       |
| Mocks validated                 | 0%             | 100%   | 100% ↑      |

### Problem 3: Multi-Agent Conflicts

| Metric                               | Before         | After   | Improvement |
| ------------------------------------ | -------------- | ------- | ----------- |
| Merge conflicts per sprint           | 4-6            | <1      | 83% ↓       |
| Manual merge resolution time         | 2+ hours       | <15 min | 87% ↓       |
| File ownership violations            | 3-5 per sprint | 0       | 100% ↓      |
| Agents modifying assigned files only | 60%            | 100%    | 40% ↑       |

---

## Integration: The Complete Flow

```
┌─────────────────────────────────────────────────────────────┐
│ WAVE 3 SPRINT: 6 Agents, 3 Parallel Domains                 │
└─────────────────────────────────────────────────────────────┘

STAGE 1: PLANNING (Architect)
└─ Read docs/file-ownership.md
└─ Design types.ts, bootstrap.ts, validators.ts
└─ Assign agents to exclusive files
└─ Brief agents with task template
└─ Prevention Strategy: Multi-Agent Coordination (Problem 3)

STAGE 2: IMPLEMENTATION (6 Agents in Parallel)
├─ Agent 1: Implement services/payment-service.ts
│  └─ Pre-commit hook validates code locally ✅
│  └─ Mock validation catches coupling drift ✅
│  └─ Verify: Only assigned files modified ✅
├─ Agent 2: Implement services/invoice-service.ts
│  └─ Pre-commit hook validates code locally ✅
│  └─ Mock validation catches coupling drift ✅
│  └─ Verify: Only assigned files modified ✅
├─ Agent 3: Implement services/creator-service.ts
│  └─ (same validation as agents 1-2)
├─ Agent 4: Implement frontend/payments feature
│  └─ Pre-commit hook validates code locally ✅
├─ Agent 5: Implement frontend/invoices feature
│  └─ Pre-commit hook validates code locally ✅
└─ Agent 6: Implement frontend/creators feature
   └─ Pre-commit hook validates code locally ✅
│
└─ Prevention Strategies:
   └─ Pre-Commit Hooks (Problem 1): 8 checks before commit
   └─ Mock Validation (Problem 2): Coupling drift caught locally
   └─ File Ownership (Problem 3): Exclusive files prevent conflicts

STAGE 3: PULL REQUEST & CI/CD
├─ Each agent: git push origin feat/domain
├─ GitHub Actions: Run test:validate-mocks ✅
├─ GitHub Actions: Run full test suite ✅
├─ Code reviewer: Check pre-commit log ✅
└─ Code reviewer: Check mock validation ✅

STAGE 4: MERGE (Architect)
├─ Merge feat/payments: No conflicts (exclusive files) ✅
├─ Merge feat/invoices: No conflicts (exclusive files) ✅
├─ Merge feat/creators: No conflicts (exclusive files) ✅
├─ Merge types.ts: Architect resolves if needed
├─ Final test: npm run test:validate-mocks
└─ Deploy to staging ✅

OUTCOME:
✅ Zero masked pre-commit failures (Problem 1)
✅ Zero test-service coupling drift (Problem 2)
✅ <1 merge conflict, <15 min resolution (Problem 3)
✅ Clean production deployment
```

---

## Quick Integration Checklist

For the next multi-agent sprint, ensure:

### Before Sprint Starts

- [ ] All three prevention strategies implemented (from WAVE2_PREVENTION_CHECKLIST.md)
- [ ] Pre-commit hook working on all developer machines
- [ ] Mock validation framework integrated
- [ ] File ownership matrix created
- [ ] All agents briefed on procedures

### During Agent Work

- [ ] Each agent runs `git commit` (triggers pre-commit hook)
- [ ] Each agent runs `npm run test:validate-mocks` before push
- [ ] Each agent verifies they modified only assigned files
- [ ] Architect monitors for any shared file requests

### During Code Review

- [ ] Verify: Pre-commit check log shows all 8 checks passed
- [ ] Verify: Mock validation gate shows zero drift
- [ ] Verify: git diff shows only assigned files modified
- [ ] Verify: No `--no-verify` bypass was used

### During Merge

- [ ] Merge should be smooth (<15 min total)
- [ ] Expect <1 conflict (on shared files only)
- [ ] All tests pass after merge
- [ ] Deploy to staging with confidence

---

## Success: Wave 3 Sprint Report

After running the next multi-agent sprint with all three strategies, you should report:

**Metrics**:

- Pre-commit hook failures: **0** (caught locally)
- Test-service coupling drift: **0** (caught in CI)
- Merge conflicts: **<1** (caught in planning)
- Manual merge resolution time: **<15 min**
- Full test suite pass rate: **100%**

**Outcomes**:

- [ ] All code merged cleanly to main
- [ ] Zero production issues from masked hooks
- [ ] Zero production issues from mock drift
- [ ] Zero production issues from merge conflicts
- [ ] Deployment successful
- [ ] Agents report better workflow (no frustration from surprises)

**Learnings**:

- What worked well? (Keep doing it)
- What needs improvement? (Iterate on prevention strategies)
- Where did problems still slip through? (Add new check)

---

## Next Steps

1. **Implement all three strategies** using WAVE2_PREVENTION_CHECKLIST.md (4 weeks)
2. **Run test multi-agent sprint** to verify they work together
3. **Document learnings** in docs/solutions/
4. **Update CLAUDE.md** with new procedures
5. **Monitor metrics** monthly
6. **Iterate** based on real-world usage

---

## Related Documentation

- **Detailed Strategies**: `prevention-wave2-three-problems.md`
- **Implementation Checklist**: `WAVE2_PREVENTION_CHECKLIST.md`
- **File Ownership Matrix**: `docs/file-ownership.md` (created during implementation)
- **Project CLAUDE.md**: `/Users/fp/Desktop/Sovren/CLAUDE.md`

---

## Contact & Questions

For questions about these strategies:

1. Review the detailed section in `prevention-wave2-three-problems.md`
2. Check the troubleshooting section in `WAVE2_PREVENTION_CHECKLIST.md`
3. Run through the integration scenario above
4. Ask: "How would this prevent [my problem]?"

**Goal**: Wave 3 and beyond run smoothly with zero surprises from Wave 2 problems.
