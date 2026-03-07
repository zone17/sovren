# R7 Prevention: Quick Start (2-Week Implementation)

## TL;DR

R7 found 15 issues (3 P1, 7 P2, 5 P3) across **7 review rounds**. Same patterns appeared repeatedly.

**Real problem**: Review methodology was diff-focused and domain-siloed. Manual review can't scale.

**Real solution**:

1. Add automated pattern detection (eslint rules, CI checks)
2. Write integration tests for all 15 patterns
3. Use `/workflows:review` (13 agents, divide-and-conquer) instead of sequential manual rounds
4. Use `/workflows:plan` to enforce standards upfront

**Time**: 2 weeks for critical path (automation + key tests), 4 weeks for full implementation.

---

## Week 1: Automated Pattern Detection

### Day 1-2: ESLint Rules (2 hours)

Add rules to `.eslintrc.cjs` to catch R7 patterns automatically:

```bash
# 1. Open file
vim packages/backend/.eslintrc.cjs

# 2. Add rules section (copy from r7-prevention-strategies.md § ESLint Rules)
# Rules to add:
# - no-auth-without-role-check (R7-135)
# - payment-routes-must-validate-idempotency (R7-136)
# - no-stale-token-claims (R7-137)
# - atomic-writes-require-fsync (R7-138)
# - cache-must-coalesce-concurrent-misses (R7-139)
# - no-sync-io-except-startup (R7-140)
# - setinterval-must-be-tracked (R7-142)
# - no-zod-any (R7-149)

# 3. Test rules
npm run lint -- packages/backend/src/routes/lightning.ts
npm run lint -- packages/backend/src/services/nostr-auth.ts
npm run lint -- packages/backend/src/services/payment-persistence.ts

# 4. Fix violations
npm run lint -- --fix

# 5. Commit
git add .eslintrc.cjs
git commit -m "chore: add R7 pattern detection rules (8 eslint rules)"
```

**Output**: All 8 ESLint rules in place. `npm run lint` now catches R7 patterns.

### Day 3: CI/CD Security Patterns Workflow (2 hours)

Create `.github/workflows/r7-security-patterns.yml` (copy from r7-prevention-strategies.md § CI/CD template):

```bash
# 1. Create workflow file
cat > .github/workflows/r7-security-patterns.yml << 'EOF'
name: R7 Security Patterns
on: [pull_request]
jobs:
  r7-patterns:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      # Add all R7 pattern checks from CI/CD template
      # ...
EOF

# 2. Test on current branch
gh workflow run r7-security-patterns.yml

# 3. Verify all checks pass
gh run watch

# 4. Commit
git add .github/workflows/r7-security-patterns.yml
git commit -m "ci: add R7 security pattern detection workflow"
```

**Output**: CI/CD pipeline fails PR if R7 patterns detected. No bad code merges to main.

### Day 4-5: Pattern Templates (2 hours)

Document canonical patterns in `/docs/architecture/canonical-patterns-r7.md`:

```bash
# 1. Create file
cat > docs/architecture/canonical-patterns-r7.md << 'EOF'
# R7 Canonical Patterns

## 1. Payment Operations (R7-135, 136)
All payment routes MUST:
- [ ] authenticate middleware
- [ ] requireCreator/Admin middleware
- [ ] Validate Idempotency-Key header
- [ ] Service-level role check (defense in depth)

## 2. Token Operations (R7-137)
Token refresh MUST:
- [ ] Query current role from DB, not from old token
- [ ] Return 401 if user deleted
- [ ] Test: demote user, refresh token, verify new role

## 3. File Writes (R7-138, 140)
Atomic writes MUST:
- [ ] Use open + write + fsync + close + rename sequence
- [ ] Use async APIs in handlers (except rename, stays sync)
- [ ] Only sync reads in startup code

## 4. Cache Operations (R7-139)
Cache misses MUST:
- [ ] Coalesce concurrent requests for same key
- [ ] Track pending lookups in Map
- [ ] Clean up on error and success

## 5. Middleware (R7-141)
Body parser MUST:
- [ ] Rate limiter BEFORE body parser
- [ ] Explicit size limit (100kb form, 1mb json)

## 6. Resource Cleanup (R7-142)
Services with intervals MUST:
- [ ] Store interval IDs in service fields
- [ ] Clear all intervals in shutdown()

## 7. Signature Operations (R7-143)
Signature verification MUST:
- [ ] Track used signatures in TTL cache
- [ ] Timestamp within 5-minute window
- [ ] Reject replayed signatures

## 8. Compensating Transactions (R7-144)
Rollback steps MUST:
- [ ] Retry up to 3 times with backoff
- [ ] Emit alert event on final failure
- [ ] Log orphaned record IDs

## 9. Validators (R7-149)
Zod schemas MUST:
- [ ] Zero z.any() usage
- [ ] Specific types for record values
- [ ] Max keys/string length limits
EOF

git add docs/architecture/canonical-patterns-r7.md
git commit -m "docs: add R7 canonical patterns template"
```

**Output**: Living documentation of "how to do R7-sensitive operations right".

---

## Week 2: Integration Tests

### Day 1-3: Test All 15 Patterns (6 hours)

Create `/packages/backend/src/__tests__/r7-prevention/`:

```bash
mkdir -p packages/backend/src/__tests__/r7-prevention

# Test structure:
# r7-prevention/
# ├── auth-bypass.test.ts (R7-135)
# ├── idempotency.test.ts (R7-136)
# ├── jwt-refresh.test.ts (R7-137)
# ├── fsync.test.ts (R7-138)
# ├── cache-stampede.test.ts (R7-139)
# ├── blocking-io.test.ts (R7-140)
# ├── body-limits.test.ts (R7-141)
# ├── memory-leaks.test.ts (R7-142)
# ├── replay-protection.test.ts (R7-143)
# ├── rollback-retry.test.ts (R7-144)
# └── validator-safety.test.ts (R7-149)
```

Copy test patterns from r7-prevention-strategies.md for each finding.

```bash
# Run all R7 tests
npm run test -- r7-prevention

# Verify all pass
npm run test:coverage -- r7-prevention

# Commit
git add packages/backend/src/__tests__/r7-prevention/
git commit -m "test: add comprehensive R7 pattern integration tests (11 test suites, 50+ cases)"
```

**Output**: All 15 findings have integration tests. New issues will be caught immediately.

### Day 4-5: Chaos & Load Tests (4 hours)

Create `/packages/backend/src/__tests__/r7-prevention/chaos-tests.ts`:

```typescript
// Chaos tests: verify resilience to real-world failures
describe('R7 Chaos Tests', () => {
  // Cache stampede: 100 concurrent misses
  // Role escalation: demote, then refresh, verify
  // Rollback failure: fail at each step, verify retry + alert
  // Memory leak: init/shutdown 10x, verify no growth
  // etc.
});
```

```bash
npm run test -- chaos-tests
npm run test:load # Simulate high concurrency
git commit -m "test: add R7 chaos and load tests"
```

**Output**: Confidence that fixes are resilient to real failures.

---

## Week 3-4: Review Methodology (Optional but Recommended)

### Use `/workflows:review` Instead of Manual Rounds

**Problem** (what happened in R7):

- Round 1: Found obvious security issues
- Round 2: Found different issues (roundtrip took 1 week)
- Round 3-7: Kept finding new issues (each round 1 week)
- **Total: 7 weeks, still finding bugs**

**Solution** (use Compound Engineering):

```bash
# Instead of sequential manual review, use:
/workflows:review

# This spawns 13+ agents in parallel:
# - architect (design review)
# - security-audit (security issues)
# - code-review (style, patterns)
# - tester (coverage, test quality)
# - performance-reviewer (perf issues)
# - api-reviewer (API contracts)
# - database-reviewer (SQL, schema)
# - accessibility-reviewer (a11y)
# - etc.

# Result: All issues found in 1 round, high confidence
```

See: [CLAUDE.md § /workflows:review](../../../CLAUDE.md)

---

## Success Checklist: How to Know R7 Prevention Works

- [ ] Week 1 complete: 8 ESLint rules, CI workflow, pattern templates

  ```bash
  npm run lint
  npm run type-check
  gh workflow run r7-security-patterns.yml
  ```

- [ ] Week 2 complete: 11 test suites, 50+ integration tests

  ```bash
  npm run test -- r7-prevention
  npm run test:coverage -- r7-prevention
  ```

- [ ] New PR arrives: lint + CI catches R7 patterns BEFORE code review
  - Git hook prevents commit if patterns detected ✅
  - CI workflow blocks merge if patterns detected ✅
  - Tests fail if implementation missing patterns ✅

- [ ] Code review (single pass, 13 agents): zero P1 findings expected
  - If P1 found, update pattern templates
  - If pattern replicated, add more tests/lints

- [ ] Measure: "Review rounds per PR" drops from 7 to 1-2
  - Week 1-2: Implementing R7 prevention
  - Week 3+: All new PRs require ≤ 2 review rounds (automation caught the easy ones)

---

## Deep Dive: If You Have More Time

| Document                                                                     | Time   | Next Steps                             |
| ---------------------------------------------------------------------------- | ------ | -------------------------------------- |
| [r7-prevention-strategies.md](./security-issues/r7-prevention-strategies.md) | 60 min | Full analysis, every pattern explained |
| [r7-remediation-plan.md](../plans/r7-remediation-plan.md)                    | 30 min | Detailed fixes for all 15 findings     |
| [r7-remediation-dod.md](../plans/r7-remediation-dod.md)                      | 30 min | Acceptance criteria for each fix       |
| [CLAUDE.md § Compound Engineering](../../../CLAUDE.md)                       | 20 min | How to prevent issues upfront          |

---

## Commands Quick Reference

```bash
# Lint check (catches 8 R7 patterns)
npm run lint

# Run R7 tests
npm run test -- r7-prevention

# Run with coverage
npm run test:coverage -- r7-prevention

# Run chaos tests (resilience)
npm run test -- chaos-tests

# CI workflow
gh workflow run r7-security-patterns.yml
gh run watch

# Full quality gate
npm run quality:check

# Type check
npm run type-check
```

---

## Key Insight: Prevention > Remediation

- **R7 approach** (what happened): Find issue → Fix → Review → Repeat 7x (7 weeks, 15 findings)
- **R7 Prevention approach** (do this next): Automate detection → Test comprehensively → Single thorough review (2 weeks setup, then 1 round per PR)

Prevention is 10x faster than remediation at scale.

---

**Status**: Ready to implement
**Time to implement**: 2 weeks critical path (Week 1 automation + Week 2 tests)
**Payoff**: 90% reduction in code review rounds

Next: `/workflows:plan` before coding, `/workflows:review` for comprehensive first review.
