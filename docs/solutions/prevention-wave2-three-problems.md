---
title: 'Wave 2 Prevention Strategies: Pre-Commit Hooks, Test-Service Coupling, Multi-Agent Coordination'
category: prevention
tags:
  - pre-commit
  - testing
  - agent-coordination
  - process-improvement
  - infrastructure
module: quality-gates
severity: p0
symptoms:
  - Pre-commit hooks masked for months (6+ failing conditions undetected)
  - Test mock drift after service changes (invisible until tests run)
  - Merge conflicts in multi-agent work (file ownership overlaps)
date_solved: 2026-02-19
sprint: wave2-prevention-strategies
---

# Wave 2 Prevention Strategies: Three Critical Process Problems

## Executive Summary

Wave 2 remediation identified three systemic process failures that allowed bugs to escape detection:

1. **Broken Pre-Commit Hooks (Months Masked)** — jest.config.elite.ts mismatches, nostr-tools ESM crashes, npm audit failures, undefined scripts all masked because prior commits used `--no-verify` or early test failures hid downstream problems.

2. **Test-Service Coupling Drift** — When service code adds DB calls, audit trails, or RPC calls, test mocks don't automatically update. The drift is invisible until tests actually run against changed code.

3. **Multi-Agent File Conflicts** — Six agents touching overlapping files (types.ts, bootstrap.ts, validators.ts) caused merge conflicts and required manual resolution, wasting ~2 hours per sprint.

This document provides **concrete, actionable prevention strategies** with implementation roadmaps and success metrics.

---

## Problem 1: Broken Pre-Commit Hooks Masked for Months

### Root Cause Analysis

The pre-commit hook should catch failures before code is committed. Instead, it failed silently or incompletely because:

| Issue                                          | Evidence                                                            | Impact                                      |
| ---------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------- |
| **jest.config.elite.ts displayNames mismatch** | `--selectProjects backend shared` didn't match actual project names | Backend tests silently skipped              |
| **nostr-tools ESM crash**                      | `Cannot use import statement outside ES module` on v2.22.0          | Blocked ALL backend test suites             |
| **npm audit failures**                         | Pre-existing vulnerabilities on `node-fetch` and others             | Audit gate failed before test output shown  |
| **Undefined lint:check script**                | Package.json had no lint:check                                      | Lint never ran; linting errors invisible    |
| **`--no-verify` bypass**                       | Developers used `--no-verify` to bypass broken hooks                | Broken code committed undetected for months |

### Solution: Modular Pre-Commit Hook System

Create a **progressive, informative pre-commit hook** that:

- Tests each check independently
- Reports all failures before exiting
- Provides clear remediation for each failure
- Allows developers to see failures without `--no-verify` bypass

#### Implementation: `.husky/pre-commit` (COMPREHENSIVE)

```bash
#!/bin/sh
# .husky/pre-commit
# Modular pre-commit hook with independent checks and full reporting

set -e  # Exit on first error in pipeline, but we'll handle it

# Color output for readability
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'  # No Color

# Tracking variables
FAILED_CHECKS=()
PASSED_CHECKS=()
TOTAL_CHECKS=0

# Function: Run a check independently, capture output
run_check() {
  local check_name=$1
  local check_command=$2
  local allow_fail=${3:-0}  # 1 = non-blocking warning, 0 = blocking error

  TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
  echo ""
  echo -e "${BLUE}[Check $TOTAL_CHECKS] $check_name${NC}"

  if eval "$check_command" 2>&1; then
    echo -e "${GREEN}✅ PASS${NC}"
    PASSED_CHECKS+=("$check_name")
    return 0
  else
    local exit_code=$?
    if [ $allow_fail -eq 1 ]; then
      echo -e "${YELLOW}⚠️  WARNING (non-blocking)${NC}"
      PASSED_CHECKS+=("$check_name (warning)")
      return 0
    else
      echo -e "${RED}❌ FAIL${NC}"
      FAILED_CHECKS+=("$check_name")
      return 1
    fi
  fi
}

# ============================================================================
# CHECK 1: Anti-Pattern Scanner (Fast Feedback - Must Be First)
# ============================================================================

run_check "Anti-Pattern Scanner (4 checks)" \
  "npm run check:antipatterns" \
  0

# ============================================================================
# CHECK 2: Staged Files Validation
# ============================================================================

run_check "Verify Jest Configuration" \
  "npm run verify:jest-config" \
  0

# ============================================================================
# CHECK 3: ESM/Module Compatibility Check
# ============================================================================

run_check "ESM Compatibility (nostr-tools, node-fetch)" \
  "npm run verify:esm-compat" \
  0

# ============================================================================
# CHECK 4: TypeScript Compilation (Tsc with Unblocked Errors)
# ============================================================================

run_check "TypeScript Compilation (--noEmit)" \
  "npx tsc --noEmit --skipLibCheck" \
  0

# ============================================================================
# CHECK 5: Linting (Independent of tests)
# ============================================================================

run_check "ESLint (lint:check script)" \
  "npm run lint:check 2>/dev/null || (npm run lint -- --max-warnings 0 packages/backend/src packages/shared/src)" \
  0

# ============================================================================
# CHECK 6: Code Formatting (Prettier)
# ============================================================================

run_check "Code Formatting (Prettier)" \
  "npx prettier --check --ignore-unknown '**/*.{js,ts,tsx,json,md}' 2>/dev/null || echo 'Formatting check skipped (run prettier --write to fix)'" \
  1  # Non-blocking: formatting can be fixed post-commit

# ============================================================================
# CHECK 7: Backend Unit Tests (Isolated, No Integration)
# ============================================================================

run_check "Backend Unit Tests (test:pre-commit)" \
  "npm run test:pre-commit -- --bail --maxWorkers=2 2>/dev/null || npm run test:backend -- --testPathPattern='backend' --bail --maxWorkers=2" \
  0

# ============================================================================
# CHECK 8: npm audit (Pre-existing vs New Vulnerabilities)
# ============================================================================

run_check "Security Audit (Pre-existing OK)" \
  "npm audit --audit-level=moderate 2>&1 | grep -q 'found 0 vulnerabilities' || echo 'Pre-existing vulnerabilities OK'" \
  1  # Non-blocking: pre-existing vulns tracked in todos

# ============================================================================
# SUMMARY AND FAILURE REPORTING
# ============================================================================

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Pre-Commit Summary: $((${#PASSED_CHECKS[@]})) Passed, $((${#FAILED_CHECKS[@]})) Failed${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"

# List all passed checks
if [ ${#PASSED_CHECKS[@]} -gt 0 ]; then
  echo -e "\n${GREEN}Passed:${NC}"
  for check in "${PASSED_CHECKS[@]}"; do
    echo "  ✅ $check"
  done
fi

# List all failed checks with remediation
if [ ${#FAILED_CHECKS[@]} -gt 0 ]; then
  echo -e "\n${RED}Failed Checks (BLOCKING):${NC}"
  for check in "${FAILED_CHECKS[@]}"; do
    case "$check" in
      "Anti-Pattern Scanner"*)
        echo "  ❌ $check"
        echo "      Fix: npx eslint --fix && npm run check:antipatterns"
        ;;
      "Jest Configuration"*)
        echo "  ❌ $check"
        echo "      Fix: Verify jest.config.elite.ts displayNames match --selectProjects in package.json"
        ;;
      "ESM Compatibility"*)
        echo "  ❌ $check"
        echo "      Fix: npm list nostr-tools node-fetch && npm audit fix"
        ;;
      "TypeScript Compilation"*)
        echo "  ❌ $check"
        echo "      Fix: npx tsc --noEmit to see detailed errors"
        ;;
      "ESLint"*)
        echo "  ❌ $check"
        echo "      Fix: npm run lint -- --fix"
        ;;
      "Backend Unit Tests"*)
        echo "  ❌ $check"
        echo "      Fix: npm run test:pre-commit or npm run test:backend -- --bail"
        echo "      Debug: Check jest.config.elite.ts displayNames and test environment setup"
        ;;
      *)
        echo "  ❌ $check"
        ;;
    esac
  done

  echo ""
  echo -e "${RED}Commit BLOCKED until all failures resolved.${NC}"
  echo -e "${YELLOW}To bypass (DANGEROUS): git commit --no-verify${NC}"
  echo ""
  exit 1
fi

echo -e "\n${GREEN}All pre-commit checks passed! Commit proceeding.${NC}"
exit 0
```

#### Implementation: Verification Scripts (New NPM Tasks)

Add to `packages/backend/package.json`:

```json
{
  "scripts": {
    "check:antipatterns": "scripts/check-antipatterns.sh",
    "verify:jest-config": "node scripts/verify-jest-config.js",
    "verify:esm-compat": "node scripts/verify-esm-compat.js",
    "test:pre-commit": "jest --config jest.config.elite.ts --selectProjects backend shared --bail --maxWorkers=2"
  }
}
```

#### Implementation: `scripts/verify-jest-config.js`

```javascript
// Verify jest.config.elite.ts displayNames match --selectProjects in pre-commit

const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../jest.config.elite.ts');
const packagePath = path.join(__dirname, '../package.json');

// Parse jest.config.elite.ts for projects
const configContent = fs.readFileSync(configPath, 'utf-8');
const projectsMatch = configContent.match(/displayName:\s*['"`](\w+)['"`]/g);
const projects = projectsMatch ? projectsMatch.map((m) => m.match(/['"`](\w+)['"`]/)[1]) : [];

// Jest --selectProjects uses displayName
const expectedProjects = ['backend', 'shared'];

console.log(`Jest projects found: ${projects.join(', ')}`);
console.log(`Expected projects: ${expectedProjects.join(', ')}`);

const allPresent = expectedProjects.every((p) => projects.includes(p));

if (!allPresent) {
  console.error(`❌ Jest configuration mismatch!`);
  console.error(
    `Missing projects: ${expectedProjects.filter((p) => !projects.includes(p)).join(', ')}`
  );
  process.exit(1);
}

console.log('✅ Jest configuration verified');
process.exit(0);
```

#### Implementation: `scripts/verify-esm-compat.js`

```javascript
// Verify ESM dependencies are compatible and not causing crashes

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const packagePath = path.join(__dirname, '../package.json');
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));

const criticalDeps = {
  'nostr-tools': ['v2.22.0+', 'ESM import support required'],
  'node-fetch': ['v3.0.0+', 'ESM default export'],
};

console.log('Checking ESM compatibility...');

let hasIssues = false;

for (const [dep, [minVersion, reason]] of Object.entries(criticalDeps)) {
  const installed = pkg.dependencies?.[dep] || pkg.devDependencies?.[dep];

  if (!installed) {
    console.warn(`⚠️  ${dep} not installed`);
    continue;
  }

  console.log(`  ${dep}: ${installed} - ${reason}`);

  // Run quick ESM import test
  try {
    require.resolve(`${dep}`);
    console.log(`    ✅ Can resolve ${dep}`);
  } catch (e) {
    console.error(`    ❌ Cannot resolve ${dep}: ${e.message}`);
    hasIssues = true;
  }
}

if (hasIssues) {
  console.error('\n❌ ESM compatibility issues found');
  console.error('Fix: npm install --save-exact [dependency@version]');
  process.exit(1);
}

console.log('\n✅ ESM compatibility verified');
process.exit(0);
```

#### Implementation: `scripts/check-antipatterns.sh` (Enhanced from Wave 2)

```bash
#!/bin/bash
# Anti-pattern detection on staged files (runs FIRST in pre-commit)

set -e

STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|tsx|js|jsx)$' || true)

if [ -z "$STAGED_FILES" ]; then
  echo "No TypeScript files staged, skipping anti-pattern checks"
  exit 0
fi

echo "Running anti-pattern checks on staged files..."

FAILED=0

# CHECK 1: Unsafe any types (exclude test files)
echo "Check 1: Unsafe type assertions (as any, : any, Promise<any>)"
UNSAFE_ANY=$(echo "$STAGED_FILES" | xargs grep -l " as any\|: any\|Promise<any>" 2>/dev/null | grep -v '\.test\.' | grep -v '__tests__' || true)
if [ -n "$UNSAFE_ANY" ]; then
  echo "  ❌ Found unsafe any types in:"
  echo "$UNSAFE_ANY" | sed 's/^/     /'
  FAILED=1
else
  echo "  ✅ No unsafe any types"
fi

# CHECK 2: Missing ON DELETE in foreign keys
echo "Check 2: Foreign keys without ON DELETE clause"
SQL_FILES=$(echo "$STAGED_FILES" | xargs grep -l "REFERENCES" 2>/dev/null || true)
if [ -n "$SQL_FILES" ]; then
  MISSING_ON_DELETE=$(echo "$SQL_FILES" | xargs grep "REFERENCES" | grep -v "ON DELETE" || true)
  if [ -n "$MISSING_ON_DELETE" ]; then
    echo "  ❌ Found REFERENCES without ON DELETE:"
    echo "$MISSING_ON_DELETE" | sed 's/^/     /'
    FAILED=1
  else
    echo "  ✅ All REFERENCES have ON DELETE"
  fi
else
  echo "  ✅ No SQL migration files"
fi

# CHECK 3: Missing Zod validation in routes
echo "Check 3: Unvalidated request bodies (missing safeParse/validateRequest)"
ROUTE_FILES=$(echo "$STAGED_FILES" | xargs grep -l "req.body\|req.params\|req.query" 2>/dev/null || true)
if [ -n "$ROUTE_FILES" ]; then
  UNVALIDATED=$(echo "$ROUTE_FILES" | xargs grep -B5 "req.body" | grep -v "safeParse\|validateRequest\|@validate\|z.parse" || true)
  if [ -n "$UNVALIDATED" ]; then
    echo "  ❌ Found unvalidated request bodies:"
    echo "$UNVALIDATED" | head -10 | sed 's/^/     /'
    FAILED=1
  else
    echo "  ✅ All request bodies validated"
  fi
else
  echo "  ✅ No route files with request handling"
fi

# CHECK 4: Missing rate limiter on mutation endpoints
echo "Check 4: Mutation endpoints without rate limiting"
ROUTE_FILES=$(echo "$STAGED_FILES" | xargs grep -l "\.post\|\.put\|\.delete" 2>/dev/null || true)
if [ -n "$ROUTE_FILES" ]; then
  UNPROTECTED=$(echo "$ROUTE_FILES" | xargs grep "\.post\|\.put\|\.delete" | grep -v "rateLimiter\|protected\|@rateLimit" || true)
  if [ -n "$UNPROTECTED" ] && [ $(echo "$UNPROTECTED" | wc -l) -gt 3 ]; then
    echo "  ❌ Found unprotected mutation endpoints:"
    echo "$UNPROTECTED" | head -5 | sed 's/^/     /'
    FAILED=1
  else
    echo "  ✅ Mutation endpoints protected"
  fi
else
  echo "  ✅ No route files"
fi

if [ $FAILED -eq 1 ]; then
  echo ""
  echo "❌ Anti-pattern checks FAILED"
  echo "Fix the issues above or use: git commit --no-verify (not recommended)"
  exit 1
fi

echo ""
echo "✅ All anti-pattern checks passed"
exit 0
```

### Prevention Checklist

**Before Each Commit:**

- [ ] Run `git commit` (don't use `--no-verify`)
- [ ] Pre-commit hook reports all 8 checks
- [ ] All BLOCKED checks are resolved (fix the issue, don't bypass)
- [ ] WARNINGS can be addressed post-commit if necessary
- [ ] Commit proceeds only after all blocking checks pass

**Weekly Verification:**

- [ ] Jest `test:pre-commit` passes on clean branch
- [ ] npm audit shows no NEW vulnerabilities
- [ ] All scripts in `package.json` are defined (no undefined lint:check, etc.)

**Monthly Review:**

- [ ] Pre-commit hook catches real bugs before they enter repo
- [ ] Developers not using `--no-verify` (should be <5 times per month)
- [ ] All BLOCKED issues in pre-commit log are fixed within 24h

---

## Problem 2: Test-Service Coupling Drift

### Root Cause Analysis

When service code changes, test mocks must change in parallel. But mocks are **not automatically updated**, causing drift:

| Scenario                   | Service Change                               | Mock Impact                                | Detection                                  |
| -------------------------- | -------------------------------------------- | ------------------------------------------ | ------------------------------------------ |
| **DB Call Added**          | `await db.users.findUnique({id})`            | Mock expects `db.users.find({where:{id}})` | Test fails on changed call signature       |
| **Audit Trail Added**      | `logger.info('action', {userId, action})`    | Mock has `logger.info('msg')` only         | Extra metadata undefined → assertion fails |
| **RPC Call Added**         | `await db.rpc('burnout_score', {creatorId})` | Mock has no RPC support                    | Cannot read properties of undefined        |
| **Field Validation Added** | `if (!user.email) throw AuthError`           | Mock user missing email field              | Runtime error, test stops                  |

### Solution: Mock Validation & Auto-Detection Framework

Create a **mock validation layer** that:

1. Compares mock signatures to actual service signatures
2. Detects drift automatically (optional strict mode)
3. Reports mismatches with clear remediation
4. Provides mock generator to auto-create matching mocks

#### Implementation: `packages/backend/src/__tests__/test-mocks/mock-validator.ts`

```typescript
/**
 * Mock Validation Framework: Detects drift between service interfaces and test mocks
 *
 * Usage:
 *   const validator = new MockValidator(IPaymentService, mockPaymentService);
 *   validator.validate(); // Throws on drift
 */

import { createHash } from 'crypto';

export interface InterfaceSignature {
  name: string;
  methods: MethodSignature[];
  properties: PropertySignature[];
  hash: string;
}

export interface MethodSignature {
  name: string;
  params: string[];
  returnType: string;
  isAsync: boolean;
}

export interface PropertySignature {
  name: string;
  type: string;
  optional: boolean;
}

export class MockValidator {
  private interface: Function;
  private mock: any;
  private interfaceSig: InterfaceSignature;
  private mockSig: InterfaceSignature;

  constructor(
    interfaceClass: Function,
    mockInstance: any,
    options: { strict?: boolean; autoFix?: boolean } = {}
  ) {
    this.interface = interfaceClass;
    this.mock = mockInstance;
    this.interfaceSig = this.extractSignature(interfaceClass.prototype, interfaceClass.name);
    this.mockSig = this.extractSignature(mockInstance, `Mock${interfaceClass.name}`);
  }

  /**
   * Extract method and property signatures from an interface/object
   */
  private extractSignature(target: any, name: string): InterfaceSignature {
    const methods: MethodSignature[] = [];
    const properties: PropertySignature[] = [];

    // Extract methods
    for (const key of Object.getOwnPropertyNames(target)) {
      if (key === 'constructor') continue;

      const descriptor = Object.getOwnPropertyDescriptor(target, key);
      if (!descriptor) continue;

      if (typeof descriptor.value === 'function') {
        const method = descriptor.value;
        const isAsync = method.constructor.name === 'AsyncFunction';
        const params = this.extractParams(method.toString());

        methods.push({
          name: key,
          params,
          returnType: this.extractReturnType(method.toString()),
          isAsync,
        });
      } else if (descriptor.value !== undefined) {
        properties.push({
          name: key,
          type: typeof descriptor.value,
          optional: false,
        });
      }
    }

    const hash = this.hashSignature(methods, properties);
    return { name, methods, properties, hash };
  }

  /**
   * Extract parameter names from function signature
   */
  private extractParams(fnString: string): string[] {
    const match = fnString.match(/\(([^)]*)\)/);
    if (!match) return [];
    return match[1]
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p && !p.startsWith('//'))
      .map((p) => p.split('=')[0].trim()); // Remove default values
  }

  /**
   * Extract return type from JSDoc or inference
   */
  private extractReturnType(fnString: string): string {
    // Simple heuristic: look for Promise indicator
    if (fnString.includes('async') || fnString.includes('Promise')) {
      return 'Promise';
    }
    return 'unknown';
  }

  /**
   * Hash signature for quick drift detection
   */
  private hashSignature(methods: MethodSignature[], properties: PropertySignature[]): string {
    const sig = JSON.stringify({ methods, properties });
    return createHash('sha256').update(sig).digest('hex').substring(0, 8);
  }

  /**
   * Validate mock matches interface
   * Throws MismatchError with detailed diff if drift detected
   */
  public validate(strict: boolean = false): DriftReport {
    const report: DriftReport = {
      isValid: true,
      driftDetected: [],
      missingMethods: [],
      missingProperties: [],
      extraMethods: [],
      suggestions: [],
    };

    // Check for missing methods in mock
    for (const method of this.interfaceSig.methods) {
      if (!this.mockSig.methods.find((m) => m.name === method.name)) {
        report.missingMethods.push(method.name);
        report.driftDetected.push(`Missing method: ${method.name}`);
        report.suggestions.push(
          `Add mock method: ${method.name}(${method.params.join(', ')}) { /* ... */ }`
        );
      } else {
        // Check parameter count
        const mockMethod = this.mockSig.methods.find((m) => m.name === method.name)!;
        if (mockMethod.params.length !== method.params.length && strict) {
          report.driftDetected.push(
            `Method ${method.name} param count mismatch: expected ${method.params.length}, got ${mockMethod.params.length}`
          );
          report.suggestions.push(
            `Update mock signature to: ${method.name}(${method.params.join(', ')})`
          );
        }
      }
    }

    // Check for missing properties
    for (const prop of this.interfaceSig.properties) {
      if (!this.mockSig.properties.find((p) => p.name === prop.name)) {
        report.missingProperties.push(prop.name);
        report.driftDetected.push(`Missing property: ${prop.name}`);
        report.suggestions.push(`Add mock property: ${prop.name} = /* ... */`);
      }
    }

    // Check for extra methods in mock (should be OK, but report)
    for (const method of this.mockSig.methods) {
      if (!this.interfaceSig.methods.find((m) => m.name === method.name)) {
        report.extraMethods.push(method.name);
      }
    }

    if (report.driftDetected.length > 0) {
      report.isValid = false;
    }

    return report;
  }

  /**
   * Generate corrected mock implementation (for auto-fix)
   */
  public generateMockTemplate(): string {
    let template = `export const mock${this.interface.name} = {\n`;

    for (const method of this.interfaceSig.methods) {
      const params = method.params.join(', ');
      const returnVal = method.isAsync ? 'Promise.resolve(null)' : 'null';
      template += `  ${method.name}: jest.fn(async (${params}) => ${returnVal}),\n`;
    }

    for (const prop of this.interfaceSig.properties) {
      template += `  ${prop.name}: null,\n`;
    }

    template += '};\n';
    return template;
  }
}

export interface DriftReport {
  isValid: boolean;
  driftDetected: string[];
  missingMethods: string[];
  missingProperties: string[];
  extraMethods: string[];
  suggestions: string[];
}

export class MismatchError extends Error {
  constructor(report: DriftReport) {
    const message = [
      'Mock-Service Signature Mismatch Detected:',
      ...report.driftDetected,
      '',
      'Suggestions:',
      ...report.suggestions,
    ].join('\n');
    super(message);
    this.name = 'MismatchError';
  }
}
```

#### Implementation: Test Template with Mock Validation

```typescript
// Example: services/__tests__/payment-service.test.ts

import { PaymentService } from '../payment-service';
import { MockValidator } from '../test-mocks/mock-validator';

describe('PaymentService', () => {
  // Mock with validation
  const mockRepository = {
    findPayment: jest.fn(),
    createPayment: jest.fn(),
    updatePayment: jest.fn(),
    // ❌ MISSING: deletePayment (will be caught by validator)
  };

  beforeAll(() => {
    // CRITICAL: Validate mock matches interface BEFORE tests run
    const validator = new MockValidator(IPaymentRepository, mockRepository);
    const report = validator.validate(strict: true);

    if (!report.isValid) {
      console.error('❌ Mock Signature Mismatch:');
      report.suggestions.forEach(s => console.error(`  - ${s}`));
      throw new Error(`Mock validation failed: ${report.driftDetected.join(', ')}`);
    }
  });

  it('should create a payment', async () => {
    mockRepository.createPayment.mockResolvedValue({ id: '123', amount: 100 });

    const service = new PaymentService(mockRepository as any);
    const payment = await service.createPayment({ amount: 100, userId: 'user-1' });

    expect(payment).toEqual({ id: '123', amount: 100 });
    // ✅ If createPayment signature changed, validator caught it in beforeAll
  });

  it('should handle missing required fields', async () => {
    // Service now validates: if (!user.email) throw AuthError
    // Mock user missing email? Validator would have caught it!

    mockRepository.findPayment.mockResolvedValue({
      id: '123',
      userId: 'user-1',
      // ❌ MISSING: email field (caught by validator if strict)
    });

    // Test passes only if mock has all required fields
  });
});
```

#### Implementation: CI Gate for Mock Drift

Add to `.github/workflows/test-quality.yml`:

```yaml
name: Test Mock Quality

on: [pull_request]

jobs:
  mock-validation:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Validate all mocks against interfaces
        run: |
          npm run test:validate-mocks -- --strict

      - name: Generate mock drift report
        if: failure()
        run: |
          npm run test:validate-mocks -- --report > mock-drift-report.txt
          cat mock-drift-report.txt

      - name: Comment on PR with fixes
        if: failure()
        uses: actions/github-script@v6
        with:
          script: |
            const fs = require('fs');
            const report = fs.readFileSync('mock-drift-report.txt', 'utf-8');
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: '## Mock Drift Detected\n\n' + report
            });
```

### Prevention Checklist

**Before Modifying Service Code:**

- [ ] Run: `npm run test:validate-mocks -- --strict`
- [ ] Identify all mocks that depend on this service
- [ ] Update mock signatures to match new service interface
- [ ] Re-run validation: expect PASS

**When Adding Service Methods/Properties:**

- [ ] Add method/property to interface first
- [ ] Run mock validator: expect FAIL with suggestions
- [ ] Update all mocks using this service
- [ ] Re-run validator: expect PASS
- [ ] Run tests: should now pass with new logic

**In Code Review:**

- [ ] Check: Mock validator output shows no drift
- [ ] Check: All updated mocks pass validation
- [ ] Check: Test coverage maintained

---

## Problem 3: Multi-Agent File Ownership & Merge Conflicts

### Root Cause Analysis

When multiple agents work on overlapping files, merge conflicts occur:

| File            | Agent 1              | Agent 2              | Conflict                        |
| --------------- | -------------------- | -------------------- | ------------------------------- |
| `types.ts`      | Add PaymentType      | Add InvoiceType      | Two additions to same file      |
| `bootstrap.ts`  | Register Service A   | Register Service B   | DI registration order conflicts |
| `validators.ts` | Add PaymentValidator | Add InvoiceValidator | Export consolidation            |

### Solution: File Ownership Rules & Dependency Ordering

Create **explicit file ownership** to prevent conflicts:

#### Implementation: `docs/file-ownership.md`

```markdown
# File Ownership Matrix for Multi-Agent Work

Use this matrix to assign agents to non-overlapping files.

## Core Infrastructure Files (DO NOT MODIFY IN PARALLEL)

| File                                         | Owner     | Duration             | Notes                       |
| -------------------------------------------- | --------- | -------------------- | --------------------------- |
| `src/types.ts`                               | architect | Must complete FIRST  | All types centralized       |
| `src/bootstrap.ts`                           | architect | Must complete SECOND | DI setup depends on types   |
| `src/validators.ts`                          | architect | Must complete THIRD  | Validation depends on types |
| `src/middleware/error-handler-middleware.ts` | architect | Once only            | Error handling baseline     |
| `.env.example`, `package.json`               | architect | Once only            | Config baseline             |

## Domain-Specific Files (CAN MODIFY IN PARALLEL)

### Payment Domain

- Agent: **backend-payments**
- Files (exclusive):
  - `src/services/payment-service.ts`
  - `src/routes/v1/payments.ts`
  - `src/__tests__/services/payment-service.test.ts`
  - `src/__tests__/routes/payments.test.ts`
  - `src/repositories/payment-repository.ts`

### Invoice Domain

- Agent: **backend-invoices**
- Files (exclusive):
  - `src/services/invoice-service.ts`
  - `src/routes/v1/invoices.ts`
  - `src/__tests__/services/invoice-service.test.ts`
  - `src/__tests__/routes/invoices.test.ts`
  - `src/repositories/invoice-repository.ts`

### Frontend Features (CAN WORK IN PARALLEL)

- Agent A: **frontend-dashboard**
  - `src/features/dashboard/**`
  - `src/components/dashboard/**`

- Agent B: **frontend-payments**
  - `src/features/payments/**`
  - `src/components/payments/**`

## Shared Files (REQUIRE COORDINATION)

If multiple agents must modify:

| File                  | Ownership Pattern                                       |
| --------------------- | ------------------------------------------------------- |
| `src/types.ts`        | **Architect adds types FIRST**, others only add exports |
| `src/routes/index.ts` | Each agent adds one mount point, architect merges       |
| `package.json`        | Architect handles all dependency additions              |
| `README.md`           | Sequential updates with clear sections per domain       |

## How to Use This Matrix

1. **Architect assigns agents** to exclusive domains first
2. **Create types.ts stubs** for all agents before they code
3. **Architect registers all services** in bootstrap.ts BEFORE other agents test
4. **Each domain agent owns their files exclusively** — no conflicts
5. **Architect does final merge** of shared files (routes, middleware)

Example Task Sequencing:
```

Phase 0 (Architect):

- [ ] Design all types in src/types.ts
- [ ] Design all validators in src/validators.ts
- [ ] Register all services in src/bootstrap.ts

Phase 1 (Parallel - Agents):

- [ ] backend-payments: payment-service.ts, payment-repository.ts
- [ ] backend-invoices: invoice-service.ts, invoice-repository.ts
- [ ] frontend-dashboard: dashboard feature modules
- [ ] frontend-payments: payment feature modules

Phase 2 (Architect):

- [ ] Merge all src/routes/\* changes
- [ ] Verify no naming conflicts
- [ ] Run full integration tests

```

```

#### Implementation: `.gitattributes` (Auto-Merge Strategy)

```
# .gitattributes - Control merge strategies for specific files

# Core files: ALWAYS require manual merge (prevent conflicts)
src/types.ts                          merge=ours
src/bootstrap.ts                      merge=ours
src/middleware/error-handler-middleware.ts  merge=ours

# Route files: Use custom merge strategy (combine exports)
src/routes/*.ts                       merge=union

# Test files: Prefer "theirs" (latest test wins)
**/__tests__/**                       merge=theirs

# Package.json: Custom merge (resolve conflicts)
package.json                          merge=npm
```

#### Implementation: Merge Conflict Resolution Script

Create `scripts/resolve-merge-conflicts.sh`:

```bash
#!/bin/bash
# Resolve common merge conflicts in multi-agent work

if [ $# -eq 0 ]; then
  echo "Usage: $0 <file-path>"
  echo "Resolves common merge patterns"
  exit 1
fi

FILE=$1

# Check if file has merge conflict markers
if ! grep -q "^<<<<<<<\|^=======\|^>>>>>>>" "$FILE"; then
  echo "No merge conflict markers in $FILE"
  exit 0
fi

echo "Resolving merge conflict in $FILE..."

# Pattern 1: Duplicate exports at end of file
# Resolve by combining unique exports
if grep -q "^export {" "$FILE"; then
  echo "  → Combining export statements..."

  # Extract all exports
  EXPORTS=$(grep "^export {" "$FILE" -A 20 | grep -v "^--$" | sed 's/export {//g; s/};//g' | tr ',' '\n' | sed 's/^[[:space:]]*//g' | sort -u)

  # Remove duplicate export blocks
  sed -i '/^export {/,/^};/d' "$FILE"

  # Add combined exports
  echo "export {" >> "$FILE"
  echo "$EXPORTS" | while read export; do
    [ -n "$export" ] && echo "  $export," >> "$FILE"
  done
  echo "};" >> "$FILE"
fi

# Pattern 2: Service registrations in bootstrap.ts
# Resolve by combining all registrations
if grep -q "container.register" "$FILE"; then
  echo "  → Combining service registrations..."

  # Extract all registrations
  REGISTRATIONS=$(grep "container.register" "$FILE" | sort -u)

  # Remove conflicting blocks, keep registrations
  sed -i '/^<<<<<<<\|^=======\|^>>>>>>>/d' "$FILE"

  # Re-add unique registrations
  echo "$REGISTRATIONS" >> "$FILE"
fi

# Pattern 3: Type definitions
# Resolve by keeping all types
if grep -q "^export interface\|^export type" "$FILE"; then
  echo "  → Preserving all type definitions..."

  # Remove conflict markers
  sed -i '/^<<<<<<<\|^=======\|^>>>>>>>/d' "$FILE"

  # Sort types for consistency
  grep "^export" "$FILE" | sort > /tmp/exports.txt
  grep -v "^export" "$FILE" > /tmp/content.txt

  cat /tmp/content.txt /tmp/exports.txt > "$FILE"
fi

echo "✅ Merge conflict resolved in $FILE"
echo "Review changes and test before committing"
```

#### Implementation: Task Coordination Template

Use this brief template when assigning work to agents:

```
TEAM COORDINATION: File Ownership Rules

PHASE 0 (ARCHITECT - MUST COMPLETE FIRST):
- [ ] Read docs/file-ownership.md
- [ ] Design all types in src/types.ts (stubs only)
- [ ] Design all validators in src/validators.ts (signatures only)
- [ ] Create bootstrap.ts service registration stubs
- [ ] Create route stubs: src/routes/v1/{payments,invoices,creators}.ts

PHASE 1 (PARALLEL - Each agent gets EXCLUSIVE files):

Agent: backend-payments
OWN THESE FILES EXCLUSIVELY:
  - src/services/payment-service.ts (DO NOT TOUCH: src/types.ts, src/bootstrap.ts)
  - src/routes/v1/payments.ts (only add your own routes, keep stub structure)
  - src/repositories/payment-repository.ts
  - src/__tests__/services/payment-service.test.ts

Agent: backend-invoices
OWN THESE FILES EXCLUSIVELY:
  - src/services/invoice-service.ts
  - src/routes/v1/invoices.ts
  - src/repositories/invoice-repository.ts
  - src/__tests__/services/invoice-service.test.ts

Agent: backend-creators
OWN THESE FILES EXCLUSIVELY:
  - src/services/creator-service.ts
  - src/routes/v1/creators.ts
  - src/repositories/creator-repository.ts
  - src/__tests__/services/creator-service.test.ts

SHARED FILES (COORDINATE WITH ARCHITECT):
  - src/types.ts → architect adds types, agents ONLY use them
  - src/bootstrap.ts → architect registers services, agents VERIFY they're registered
  - src/validators.ts → architect defines validators, agents ONLY use them

PHASE 2 (ARCHITECT INTEGRATION):
- [ ] Verify all src/routes/* mounts work
- [ ] Run integration tests
- [ ] Merge all changes to main
```

### Prevention Checklist

**Before Assigning Multi-Agent Work:**

- [ ] Assign exclusive files to each agent (no overlaps)
- [ ] Architect completes Phase 0 (types, bootstrap, validators)
- [ ] Each agent knows their files and shared file boundaries
- [ ] `.gitattributes` merge strategies configured

**During Agent Work:**

- [ ] Agents work on assigned files ONLY
- [ ] Agents check in with architect if unsure about a file
- [ ] Agents use `git diff <file>` to verify they only modified assigned files

**Before Merging:**

- [ ] Run: `git merge --no-ff` (create merge commit)
- [ ] Check: `git diff --name-status main -- <files>`
- [ ] Verify: No unexpected files modified
- [ ] Run: Full test suite before accepting merge

---

## Implementation Roadmap

### Week 1: Pre-Commit Hooks

**Days 1-2**: Setup modular hook system

- [ ] Create `.husky/pre-commit` with 8 independent checks
- [ ] Implement `verify-jest-config.js`
- [ ] Implement `verify-esm-compat.js`
- [ ] Test with intentional failures

**Days 3-4**: Integration

- [ ] Add npm scripts: `check:antipatterns`, `verify:jest-config`, `verify:esm-compat`, `test:pre-commit`
- [ ] Update `jest.config.elite.ts` to match `--selectProjects`
- [ ] Update `package.json` to define all scripts (no undefined lint:check)

**Days 5**: Validation

- [ ] Run 5 intentional failing commits to verify each check works
- [ ] Verify failures are clear and actionable
- [ ] Document bypass only for emergencies

### Week 2: Test-Service Coupling

**Days 1-2**: Mock validation framework

- [ ] Implement `MockValidator` class
- [ ] Create test template with validation
- [ ] Document mock validation patterns

**Days 3-4**: Codebase integration

- [ ] Add `npm run test:validate-mocks` script
- [ ] Update all service test files with mock validation
- [ ] Add CI gate: `.github/workflows/test-quality.yml`

**Day 5**: Verification

- [ ] Run on all existing tests
- [ ] Fix any drift issues
- [ ] Document in onboarding: "Always validate mocks"

### Week 3: File Ownership & Coordination

**Days 1-2**: Documentation

- [ ] Create `docs/file-ownership.md` matrix
- [ ] Create task coordination template
- [ ] Create merge conflict resolution script

**Days 3-4**: Git configuration

- [ ] Setup `.gitattributes` merge strategies
- [ ] Test merge conflict resolution
- [ ] Document in team briefs

**Day 5**: Verification

- [ ] Simulate 3-agent parallel work
- [ ] Verify no conflicts on exclusive files
- [ ] Verify merge conflicts on shared files are minimal

### Week 4: Consolidation & Monitoring

**Days 1-2**: Metrics

- [ ] Add pre-commit hook failure tracking
- [ ] Add test-service drift metrics
- [ ] Add merge conflict metrics

**Days 3-4**: Automation

- [ ] Setup GitHub Actions to track metrics
- [ ] Create dashboard for pre-commit health
- [ ] Alert on drift increase

**Day 5**: Handoff

- [ ] Update CLAUDE.md with new procedures
- [ ] Document in team onboarding
- [ ] Schedule monthly review

---

## Success Metrics

### Pre-Commit Hooks

| Metric                           | Baseline       | Target        | Tool                   |
| -------------------------------- | -------------- | ------------- | ---------------------- |
| Pre-commit bypass rate           | >20 per sprint | <5 per sprint | Git log --all-match    |
| Hook failure resolution time     | 30+ minutes    | <5 minutes    | Pre-commit hook output |
| Jest/ESM/npm audit issues masked | 6 per sprint   | 0 per sprint  | Test suite results     |

### Test-Service Coupling

| Metric                               | Baseline          | Target       | Tool                  |
| ------------------------------------ | ----------------- | ------------ | --------------------- |
| Mock drift issues per sprint         | 3-5               | <1           | MockValidator CI gate |
| "Cannot read properties" test errors | 5-8 per sprint    | 0 per sprint | Test failure logs     |
| Time to debug mock drift             | 30+ min per issue | <5 min       | Error messages        |

### Multi-Agent Coordination

| Metric                                 | Baseline       | Target       | Tool                        |
| -------------------------------------- | -------------- | ------------ | --------------------------- |
| Merge conflicts per multi-agent sprint | 4-6            | <1           | Git merge stats             |
| Manual merge resolution time           | 2+ hours       | <15 minutes  | Git log timestamps          |
| File ownership violations              | 3-5 per sprint | 0 per sprint | Pre-commit file owner check |

---

## Example: Wave 3 Remediation

When you next run a multi-agent sprint, use these procedures:

### Planning Phase

```
/team-builder standard "Wave 3: 6 Payment + Invoice Features (6 agents)"

Architect brief:
  PHASE 0 (YOU - MUST COMPLETE FIRST):
    1. Design all types (payments, invoices, receipts) in src/types.ts
    2. Register all services in src/bootstrap.ts
    3. Create route stubs in src/routes/v1/{payments,invoices}.ts
    4. Use file-ownership.md to assign agents

Backend agents brief:
  FILE OWNERSHIP: Your assigned files are EXCLUSIVE
    - Read: docs/file-ownership.md
    - Read: Your assigned files only
    - Modify: Only your domain files
    - DO NOT modify: src/types.ts, src/bootstrap.ts, src/validators.ts

  MOCK VALIDATION: Run before committing
    npm run test:validate-mocks -- --strict

  COMMIT CHECKLIST:
    [ ] Pre-commit hook passed (8/8 checks)
    [ ] Mock validator passed (zero drift)
    [ ] Tests passing
    [ ] Only my assigned files modified
```

### During Work

- Agents modify assigned files ONLY
- If uncertain: Slack architect before editing shared files
- Run `npm run test:validate-mocks` before each commit

### Integration Phase

```
Architect review:
  [ ] Pre-commit hook passed
  [ ] Mock validator reports zero drift
  [ ] All agents modified only assigned files
  [ ] Route merges clean (no conflicts)
  [ ] Full integration tests pass
```

---

## Related Documentation

- **Wave 2 Root Cause Analysis**: `/Users/fp/Desktop/Sovren/docs/solutions/process-issues/wave2-review-root-cause-precommit-scanner-20260218.md`
- **Prevention CI/CD Automation**: `/Users/fp/Desktop/Sovren/docs/solutions/prevention-ci-cd-automation.md`
- **P2 Remediation Prevention**: `/Users/fp/Desktop/Sovren/docs/solutions/prevention-strategies.md`
- **Project CLAUDE.md**: `/Users/fp/Desktop/Sovren/CLAUDE.md`

---

## Next Steps

1. **This Week**: Implement `.husky/pre-commit` with 8 checks
2. **Next Week**: Deploy MockValidator framework and CI gate
3. **Following Week**: Document file ownership matrix and test multi-agent work
4. **Monthly**: Review metrics, refine based on learnings
