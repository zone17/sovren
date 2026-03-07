---
title: 'Wave 2 Prevention: Quick Implementation Checklist'
category: prevention
tags: [quick-start, pre-commit, testing, coordination]
---

# Wave 2 Prevention Strategy: Quick Implementation Checklist

This checklist tracks implementation of three prevention strategies to prevent recurrence of Wave 2 problems.

## Problem 1: Broken Pre-Commit Hooks Masked for Months

**Goal**: Pre-commit hook catches ALL failures before code is committed.

### Phase 1: Setup (Week 1, Days 1-2)

- [ ] **Step 1.1**: Read `prevention-wave2-three-problems.md` (Problem 1 section)
- [ ] **Step 1.2**: Create `.husky/pre-commit` from template (8 independent checks)
- [ ] **Step 1.3**: Create `scripts/verify-jest-config.js` from template
- [ ] **Step 1.4**: Create `scripts/verify-esm-compat.js` from template
- [ ] **Step 1.5**: Update `scripts/check-antipatterns.sh` with 4 checks
- [ ] **Step 1.6**: Test hook with intentional failure (e.g., `as any` type)
- [ ] **Step 1.7**: Verify failure message is clear and actionable

### Phase 2: Integration (Week 1, Days 3-4)

- [ ] **Step 2.1**: Verify `jest.config.elite.ts` has correct displayNames
- [ ] **Step 2.2**: Verify `jest.config.elite.ts` displayNames match `--selectProjects` in package.json
- [ ] **Step 2.3**: Fix `--selectProjects` if mismatch found
- [ ] **Step 2.4**: Add to `package.json` scripts:
  ```json
  "check:antipatterns": "scripts/check-antipatterns.sh",
  "verify:jest-config": "node scripts/verify-jest-config.js",
  "verify:esm-compat": "node scripts/verify-esm-compat.js",
  "test:pre-commit": "jest --config jest.config.elite.ts --selectProjects backend shared --bail --maxWorkers=2"
  ```
- [ ] **Step 2.5**: Verify all npm scripts are defined (no "undefined lint:check" in pre-commit)
- [ ] **Step 2.6**: Test hook again with clean commit (should PASS)

### Phase 3: Validation (Week 1, Days 5)

- [ ] **Step 3.1**: Create 5 test commits with intentional failures:
  - 1: TypeScript error (tsc check)
  - 2: ESLint error (lint check)
  - 3: Jest failure (test check)
  - 4: npm audit vulnerability (audit check)
  - 5: Jest config mismatch (jest config check)
- [ ] **Step 3.2**: Verify EACH failure is caught by appropriate check
- [ ] **Step 3.3**: Verify all 8 checks report results (pass + fail)
- [ ] **Step 3.4**: Document any false positives or unclear messages
- [ ] **Step 3.5**: Schedule weekly "pre-commit health check" (run hook on clean branch)

### Success Criteria for Problem 1

- [ ] `git commit` is required (no developers using `--no-verify` regularly)
- [ ] Pre-commit hook catches Jest config mismatches within 30 seconds
- [ ] Pre-commit hook catches nostr-tools ESM issues within 30 seconds
- [ ] npm audit issues flagged but don't block commit (pre-existing OK)
- [ ] All 8 checks have clear remediation instructions
- [ ] <5 bypass (`--no-verify`) uses per sprint

---

## Problem 2: Test-Service Coupling Drift

**Goal**: Detect when service code changes but test mocks are outdated.

### Phase 1: Framework (Week 2, Days 1-2)

- [ ] **Step 4.1**: Read `prevention-wave2-three-problems.md` (Problem 2 section)
- [ ] **Step 4.2**: Create `packages/backend/src/__tests__/test-mocks/mock-validator.ts` from template
- [ ] **Step 4.3**: Create test file: `packages/backend/src/__tests__/test-mocks/mock-validator.test.ts`
- [ ] **Step 4.4**: Test MockValidator with sample interfaces
- [ ] **Step 4.5**: Test drift detection (add method to interface, should FAIL validator)

### Phase 2: Integration (Week 2, Days 3-4)

- [ ] **Step 5.1**: Add npm script: `test:validate-mocks`
  ```json
  "test:validate-mocks": "jest src/__tests__/test-mocks/ --testNamePattern='MockValidator|drift detection'"
  ```
- [ ] **Step 5.2**: Update top 5 critical service tests with mock validation:
  - [ ] PaymentService test
  - [ ] InvoiceService test
  - [ ] ReceiptService test
  - [ ] CreatorService test
  - [ ] (Pick 5 most-changed services)
- [ ] **Step 5.3**: In each test, add:
  ```typescript
  beforeAll(() => {
    const validator = new MockValidator(IServiceInterface, mockInstance);
    const report = validator.validate(strict: true);
    if (!report.isValid) throw new Error(report.suggestions.join('\n'));
  });
  ```
- [ ] **Step 5.4**: Run `npm run test:validate-mocks` — should PASS
- [ ] **Step 5.5**: Intentionally break a mock (remove a method) — should FAIL with clear suggestion

### Phase 3: CI/CD Integration (Week 2, Days 5)

- [ ] **Step 6.1**: Create `.github/workflows/test-mock-quality.yml` from template
- [ ] **Step 6.2**: Add workflow to CI/CD pipeline
- [ ] **Step 6.3**: Test workflow by breaking a mock on a branch
- [ ] **Step 6.4**: Verify GitHub comment with suggestions appears on PR
- [ ] **Step 6.5**: Fix the mock and verify workflow passes

### Success Criteria for Problem 2

- [ ] <1 "Cannot read properties of undefined" test error per sprint
- [ ] When service changes, mocks automatically flagged within 2 minutes (CI/CD)
- [ ] All agent-written tests include mock validation
- [ ] Mock drift issues resolved in <10 minutes (clear error message)

---

## Problem 3: Multi-Agent File Ownership & Merge Conflicts

**Goal**: Prevent merge conflicts by assigning exclusive files to each agent.

### Phase 1: Documentation (Week 3, Days 1-2)

- [ ] **Step 7.1**: Read `prevention-wave2-three-problems.md` (Problem 3 section)
- [ ] **Step 7.2**: Create `docs/file-ownership.md` from template
- [ ] **Step 7.3**: Create `scripts/resolve-merge-conflicts.sh` from template
- [ ] **Step 7.4**: Review with team: file ownership matrix makes sense?
- [ ] **Step 7.5**: Document exception process: "How to handle shared file edits"

### Phase 2: Git Configuration (Week 3, Days 3-4)

- [ ] **Step 8.1**: Create `.gitattributes` with merge strategies
- [ ] **Step 8.2**: Test merge conflict resolution:
  - [ ] Simulate 2 agents editing same type file
  - [ ] Verify `merge=ours` prevents auto-merge
  - [ ] Manually resolve using `resolve-merge-conflicts.sh`
- [ ] **Step 8.3**: Test route file merge:
  - [ ] Simulate 2 agents adding different routes
  - [ ] Verify `merge=union` combines them
- [ ] **Step 8.4**: Update team git config:
  ```bash
  git config merge.conflictstyle diff3  # Better conflict markers
  ```

### Phase 3: Process Integration (Week 3, Days 5)

- [ ] **Step 9.1**: Create task template for future multi-agent work (see end of Problem 3)
- [ ] **Step 9.2**: Update team CLAUDE.md with:
  - [ ] Link to file-ownership.md
  - [ ] When to assign agents vs architect
  - [ ] How to request shared file edits
- [ ] **Step 9.3**: Create pre-commit check: "Verify files modified are assigned to this agent"
- [ ] **Step 9.4**: Test: Simulate multi-agent work with template, verify <1 conflict

### Success Criteria for Problem 3

- [ ] <1 merge conflict per multi-agent sprint
- [ ] Merge conflict resolution <15 minutes
- [ ] Agents modify only assigned files (0 violations)
- [ ] Architect successfully merges all parallel work

---

## Week 4: Monitoring & Handoff

### Metrics Setup

- [ ] **Step 10.1**: Create dashboard tracking:
  - Pre-commit bypass rate (goal: <5/sprint)
  - Mock drift issues (goal: <1/sprint)
  - Merge conflicts (goal: <1/sprint)
  - Hook failure resolution time (goal: <5 min)

- [ ] **Step 10.2**: Add GitHub Actions job to track metrics:

  ```yaml
  # In CI/CD workflow
  - name: Report Prevention Metrics
    run: |
      echo "Pre-commit bypass attempts: $(git log --grep='--no-verify' | wc -l)"
      echo "Mock drift issues: $(git log --grep='MockValidator' | wc -l)"
      echo "Merge conflicts resolved: $(git log --grep='Merge conflict' | wc -l)"
  ```

- [ ] **Step 10.3**: Schedule monthly review: "Prevention Strategy Health Check"

### Documentation

- [ ] **Step 11.1**: Update `CLAUDE.md` with new sections:
  - Pre-commit hooks section
  - Mock validation section
  - File ownership section
  - Links to all documentation

- [ ] **Step 11.2**: Add to team onboarding:
  - "Running pre-commit hooks"
  - "Validating mocks when changing services"
  - "Requesting shared file edits"

- [ ] **Step 11.3**: Create team training: "How to work with Prevention Strategies" (15 min video/walkthrough)

---

## Verification: One Multi-Agent Sprint

Once all three problems are implemented, run a test multi-agent sprint to verify:

### Before Sprint

- [ ] File ownership matrix filled out for 4 agents
- [ ] Each agent briefed on file ownership rules
- [ ] Each agent has their assigned files documented
- [ ] Architect ready to coordinate shared file edits

### During Sprint

- [ ] Each agent runs pre-commit hooks before committing
- [ ] Each agent validates mocks (if modifying services)
- [ ] Each agent verifies they only modified assigned files
- [ ] Architect monitors for any shared file conflicts

### After Sprint

- [ ] Merge conflicts: **Expect <1** (success: 0)
- [ ] Pre-commit bypass: **Expect 0**
- [ ] Mock drift issues: **Expect 0**
- [ ] Merge resolution time: **Expect <15 min total**
- [ ] Full test suite passes: **Expect 100%**

---

## Troubleshooting

### Pre-Commit Hook Issues

**Issue**: "Prettier check keeps failing"

- Solution: Run `npm run format` first, then commit

**Issue**: "Jest says displayName not found"

- Solution: Check `jest.config.elite.ts` has exact displayName match, rebuild with `npm run build`

**Issue**: "npm audit fails but no new vulnerabilities"

- Solution: Expected for pre-existing vulns. Mark as warning in hook.

### Mock Validation Issues

**Issue**: "MockValidator says methods don't match but they do"

- Solution: Check parameter count and names. Validator is strict about signature matching.

**Issue**: "Mock drift detected but I didn't change the service"

- Solution: Check if architect added method to interface. Validator is correct; update your mocks.

### Merge Conflict Issues

**Issue**: ".gitattributes merge strategy not working"

- Solution: Check file was staged AFTER `.gitattributes` change. May need to re-checkout and re-add.

**Issue**: Merge script modifies too much"

- Solution: Script is conservative. Review changes manually and commit with message "Manual merge resolution: [file]"

---

## Quick Reference Commands

### Pre-Commit Testing

```bash
npm run check:antipatterns          # Check 4 anti-patterns
npm run verify:jest-config          # Check Jest config
npm run verify:esm-compat           # Check ESM compatibility
npm run test:pre-commit             # Run backend unit tests
```

### Mock Validation

```bash
npm run test:validate-mocks         # Validate all mocks
npm run test:validate-mocks -- --strict    # Strict mode
npm run test:validate-mocks -- --report    # Detailed report
```

### Merge Conflict Resolution

```bash
scripts/resolve-merge-conflicts.sh src/types.ts
scripts/resolve-merge-conflicts.sh src/routes/index.ts
git status                          # Check conflicts
```

### File Ownership Verification

```bash
git diff --name-status origin/main HEAD  # Files modified in branch
# Verify all modified files are in your assigned list
```

---

## Summary: Three Victories

| Problem                     | Prevention                         | Success Metric                              |
| --------------------------- | ---------------------------------- | ------------------------------------------- |
| **Broken Pre-Commit Hooks** | 8-check modular hook system        | <5 bypass/sprint, 0 masked failures         |
| **Test-Service Coupling**   | MockValidator + CI gate            | <1 drift issue/sprint, <10 min resolution   |
| **Multi-Agent Conflicts**   | File ownership matrix + git config | <1 merge conflict/sprint, 0 file violations |

---

## Implementation Timeline

- **Week 1 (Feb 19-23)**: Pre-commit hooks complete + validated
- **Week 2 (Feb 26-Mar 2)**: Mock validation framework complete + CI gate active
- **Week 3 (Mar 5-9)**: File ownership matrix active + test multi-agent sprint
- **Week 4 (Mar 12-16)**: Monitoring dashboard live, metrics tracked, handoff complete

**Target**: Zero recurrence of Wave 2 problems in Wave 3 and beyond.
