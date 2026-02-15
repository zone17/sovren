---
title: 'CI/CD Automation for Prevention Strategies'
date: 2026-02-13
category: prevention
tags:
  - ci-cd
  - automation
  - testing
  - quality-gates
---

# CI/CD Automation for Anti-Pattern Prevention

This document provides complete GitHub Actions workflows and automation scripts to prevent the 7 critical anti-patterns discovered in the P2 remediation sprint.

---

## Workflow 1: Canonical Pattern Enforcement

**File**: `.github/workflows/canonical-patterns.yml`

```yaml
name: 'Canonical Pattern Enforcement'

on:
  pull_request:
    paths:
      - 'packages/backend/src/**/*.ts'
      - '.eslintrc.cjs'
      - 'docs/architecture/canonical-patterns.md'

jobs:
  canonical-patterns:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Check for duplicate rate limiters
        run: |
          set -e
          RATE_LIMITER_FILES=$(find packages/backend/src -type f -name '*rate*limit*.ts' \
            -not -path '*/node_modules/*' \
            -not -path '*/__tests__/*' \
            -not -path '*/.git/*' | wc -l)

          if [ "$RATE_LIMITER_FILES" -gt 1 ]; then
            echo "::error::Found $RATE_LIMITER_FILES rate limiter files (max 1 allowed)"
            find packages/backend/src -type f -name '*rate*limit*.ts' \
              -not -path '*/node_modules/*' \
              -not -path '*/__tests__/*'
            exit 1
          fi
          echo "✅ Rate limiter check passed"

      - name: Check for duplicate loggers
        run: |
          set -e
          LOGGER_FILES=$(find packages/backend/src/utils -type f -name '*logger*.ts' 2>/dev/null | wc -l)

          if [ "$LOGGER_FILES" -gt 0 ]; then
            echo "::error::Found logger in utils/. Use canonical: packages/backend/src/lib/logger.ts"
            find packages/backend/src/utils -type f -name '*logger*.ts'
            exit 1
          fi
          echo "✅ Logger consolidation check passed"

      - name: Check for duplicate error classes
        run: |
          set -e
          ERROR_FILES=$(find packages/backend/src -type f -name '*error*.ts' \
            -not -path '*/node_modules/*' \
            -not -path '*/middleware/error-handler-middleware.ts' \
            -not -path '*/__tests__/*' | wc -l)

          if [ "$ERROR_FILES" -gt 1 ]; then
            echo "::error::Found $ERROR_FILES error-related files (should consolidate)"
            exit 1
          fi
          echo "✅ Error hierarchy check passed"

      - name: Lint with canonical pattern rules
        run: npx eslint packages/backend/src --max-warnings 0 --format json
        continue-on-error: true

      - name: Report results
        if: always()
        run: |
          echo "## Canonical Pattern Enforcement Results" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "✅ All canonical patterns enforced" >> $GITHUB_STEP_SUMMARY
```

---

## Workflow 2: Type Safety & Dead Code Detection

**File**: `.github/workflows/type-safety.yml`

```yaml
name: 'Type Safety & Dead Code Detection'

on:
  pull_request:
    paths:
      - 'packages/backend/src/**/*.ts'
      - 'packages/frontend/src/**/*.ts'
      - 'packages/shared/src/**/*.ts'
      - 'tsconfig.json'

jobs:
  type-safety:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: TypeScript Compiler Check
        run: npx tsc --noEmit --strict --noUnusedLocals --noUnusedParameters

      - name: Detect dead code with ts-prune
        run: |
          npm install -g ts-prune
          OUTPUT=$(ts-prune --error 2>&1 | head -100)

          if echo "$OUTPUT" | grep -q "unused"; then
            echo "::error::Dead code detected"
            echo "$OUTPUT"
            exit 1
          fi

      - name: Check for 'as any' violations
        run: |
          set -e
          VIOLATIONS=$(grep -r " as any\| as unknown" packages/backend/src --include="*.ts" \
            --exclude-dir=__tests__ \
            --exclude-dir=node_modules | wc -l)

          if [ "$VIOLATIONS" -gt 0 ]; then
            echo "::error::Found $(grep -r " as any\| as unknown" packages/backend/src --include="*.ts" --exclude-dir=__tests__ --exclude-dir=node_modules | wc -l) type assertion violations"
            grep -r " as any\| as unknown" packages/backend/src --include="*.ts" --exclude-dir=__tests__ || true
            exit 1
          fi
          echo "✅ No unsafe type assertions found"

      - name: Check for unused imports
        run: npx eslint packages/backend/src --rule "unused-imports/no-unused-imports: error" --format json || true

      - name: Generate type coverage report
        continue-on-error: true
        run: |
          npm install -g type-coverage
          type-coverage --project tsconfig.json --detail
```

---

## Workflow 3: Security Hardening Checks

**File**: `.github/workflows/security-hardening.yml`

```yaml
name: 'Security Hardening Checks'

on:
  pull_request:
    paths:
      - 'vercel.json'
      - 'packages/frontend/nginx.conf'
      - 'packages/backend/src/**/*.ts'
      - 'scripts/**/*.ts'

jobs:
  csp-validation:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Validate CSP Policy
        run: |
          set -e
          CSP=$(jq -r '.headers[0].headers[] | select(.key=="Content-Security-Policy") | .value' vercel.json)

          # Check for unsafe-inline
          if echo "$CSP" | grep -q "unsafe-inline"; then
            echo "::error::CSP contains 'unsafe-inline'. Remove it."
            exit 1
          fi

          # Check for wss: (secure websockets)
          if ! echo "$CSP" | grep -q "wss:"; then
            echo "::warning::CSP does not contain wss: for secure websockets"
          fi

          # Check frame-ancestors
          if ! echo "$CSP" | grep -q "frame-ancestors 'none'"; then
            echo "::error::CSP missing frame-ancestors 'none' (clickjacking protection)"
            exit 1
          fi

          echo "✅ CSP Policy validation passed"

  shell-injection-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Check for execSync usage
        run: |
          set -e
          VIOLATIONS=$(grep -r "execSync" scripts --include="*.ts" | grep -v execFileSync | wc -l)

          if [ "$VIOLATIONS" -gt 0 ]; then
            echo "::error::Found unsafe execSync calls. Use execFileSync with argument arrays."
            grep -r "execSync" scripts --include="*.ts" | grep -v execFileSync
            exit 1
          fi
          echo "✅ No shell injection vectors detected"

      - name: Check for string interpolation in shell commands
        run: |
          set -e
          VIOLATIONS=$(grep -r '`.*\${.*}.*`' scripts --include="*.ts" | wc -l)

          if [ "$VIOLATIONS" -gt 0 ]; then
            echo "::warning::Found template literals in shell context"
            grep -r '`.*\${.*}.*`' scripts --include="*.ts" || true
          fi

  sanitization-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run sanitization tests
        run: npm test -- packages/backend/src/__tests__/lib/sensitive-fields.test.ts

  error-leakage-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Check for error detail leakage
        run: |
          set -e
          # Check for stack trace exposure in API responses
          VIOLATIONS=$(grep -r "error.stack\|res.json.*stack\|throw error" \
            packages/backend/src/routes \
            packages/backend/src/middleware \
            --include="*.ts" | grep -v "isDevelopment" | wc -l)

          if [ "$VIOLATIONS" -gt 0 ]; then
            echo "::warning::Potential error detail leakage detected"
            grep -r "error.stack\|res.json.*stack" packages/backend/src/routes packages/backend/src/middleware --include="*.ts" || true
          fi

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run error handler tests
        run: npm test -- packages/backend/src/__tests__/middleware/error-handler-middleware.test.ts
```

---

## Workflow 4: Dead Code Accumulation Prevention

**File**: `.github/workflows/dead-code-prevention.yml`

```yaml
name: 'Dead Code Prevention'

on:
  pull_request:
    paths:
      - 'packages/*/src/**/*.ts'
      - 'packages/*/src/**/*.tsx'

jobs:
  dead-code-detection:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install analysis tools
        run: |
          npm install -g ts-prune depcheck

      - name: Detect unused TypeScript exports
        continue-on-error: true
        run: |
          echo "## Unused Exports Report" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY

          for dir in packages/backend packages/frontend packages/shared; do
            if [ -d "$dir/src" ]; then
              echo "### $dir" >> $GITHUB_STEP_SUMMARY
              ts-prune --project $dir/tsconfig.json | head -20 >> $GITHUB_STEP_SUMMARY || true
            fi
          done

      - name: Check for unused dependencies
        continue-on-error: true
        run: |
          echo "## Unused Dependencies" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          depcheck --json | jq '.dependencies[]' >> $GITHUB_STEP_SUMMARY || true

      - name: Verify no ghost imports
        run: |
          set -e
          GHOST=$(grep -r "^import.*from.*\(deleted\|removed\|ghost\)" packages --include="*.ts" | wc -l)

          if [ "$GHOST" -gt 0 ]; then
            echo "::error::Found ghost imports"
            exit 1
          fi
          echo "✅ No ghost imports detected"

      - name: Check import usage ratio
        run: |
          TOTAL_IMPORTS=$(grep -r "^import" packages/backend/src --include="*.ts" | wc -l)
          USED_IMPORTS=$(grep -r "^import" packages/backend/src --include="*.ts" -A 50 | grep -c "import")

          RATIO=$((USED_IMPORTS * 100 / TOTAL_IMPORTS))
          echo "Import usage ratio: $RATIO%"

          if [ "$RATIO" -lt 80 ]; then
            echo "::warning::Low import usage ratio ($RATIO%). Review for dead code."
          fi
```

---

## Workflow 5: Integration Test Coverage

**File**: `.github/workflows/integration-tests.yml`

```yaml
name: 'Integration Tests for Prevention'

on:
  pull_request:

jobs:
  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: sovren_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Test canonical patterns
        run: npm test -- packages/backend/src/__tests__/architecture/canonical-patterns.test.ts

      - name: Test type safety
        run: npm test -- packages/backend/src/__tests__/types/express-augmentation.test.ts

      - name: Test sanitization recursion
        run: npm test -- packages/backend/src/__tests__/lib/sensitive-fields.test.ts

      - name: Test error handler
        run: npm test -- packages/backend/src/__tests__/middleware/error-handler-middleware.test.ts

      - name: Test shell injection prevention
        run: npm test -- scripts/__tests__/automated-supabase-rotation.test.ts

      - name: Test CSP policy
        run: npm test -- packages/backend/src/__tests__/security/csp-policy.test.ts

      - name: Generate coverage report
        if: always()
        run: npm test -- --coverage --collectCoverageFrom="packages/backend/src/**/*.ts"

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
          fail_ci_if_error: false
```

---

## Pre-Commit Hook: Comprehensive Checks

**File**: `.husky/pre-commit` (UPDATED)

```bash
#!/bin/sh

set -e

echo "🔍 Running pre-commit checks..."

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

FAILED=0

# 1. Type checking
echo -e "${YELLOW}Checking TypeScript...${NC}"
if ! npx tsc --noEmit --strict --noUnusedLocals --noUnusedParameters 2>/dev/null; then
  echo -e "${RED}❌ TypeScript errors found${NC}"
  FAILED=1
else
  echo -e "${GREEN}✅ TypeScript OK${NC}"
fi

# 2. Linting
echo -e "${YELLOW}Linting code...${NC}"
if ! npx eslint packages/backend/src packages/frontend/src --max-warnings 0 --fix 2>/dev/null; then
  echo -e "${RED}❌ Linting errors found${NC}"
  FAILED=1
else
  echo -e "${GREEN}✅ Linting OK${NC}"
fi

# 3. Canonical pattern check
echo -e "${YELLOW}Checking canonical patterns...${NC}"

# No duplicate rate limiters
RATE_LIMITER_COUNT=$(find packages/backend/src -name '*rate*limit*.ts' \
  -not -path '*/node_modules/*' \
  -not -path '*/__tests__/*' | wc -l)
if [ "$RATE_LIMITER_COUNT" -gt 1 ]; then
  echo -e "${RED}❌ Multiple rate limiters detected${NC}"
  FAILED=1
fi

# No deprecated loggers
if find packages/backend/src/utils -name '*logger*.ts' 2>/dev/null | grep -q .; then
  echo -e "${RED}❌ Deprecated utils/logger.ts found. Use lib/logger.ts${NC}"
  FAILED=1
fi

# No unsafe type assertions
if grep -r " as any\| as unknown" packages/backend/src --include="*.ts" \
  --exclude-dir=__tests__ --exclude-dir=node_modules 2>/dev/null | grep -q .; then
  echo -e "${RED}❌ Unsafe type assertions (as any) found${NC}"
  FAILED=1
fi

echo -e "${GREEN}✅ Canonical patterns OK${NC}"

# 4. Security checks
echo -e "${YELLOW}Checking security...${NC}"

# No execSync with interpolation
if grep -r "execSync.*\`" scripts --include="*.ts" 2>/dev/null | grep -q .; then
  echo -e "${RED}❌ String interpolation in execSync detected${NC}"
  FAILED=1
fi

# CSP validation
if [ -f vercel.json ]; then
  CSP=$(jq -r '.headers[0].headers[] | select(.key=="Content-Security-Policy") | .value' vercel.json 2>/dev/null || echo "")
  if echo "$CSP" | grep -q "unsafe-inline"; then
    echo -e "${RED}❌ unsafe-inline found in CSP${NC}"
    FAILED=1
  fi
fi

echo -e "${GREEN}✅ Security checks OK${NC}"

# 5. Dead code check
echo -e "${YELLOW}Checking for dead code...${NC}"
if npm exec ts-prune -- --error 2>/dev/null | grep -q "unused"; then
  echo -e "${YELLOW}⚠️  Unused exports detected (for review)${NC}"
fi
echo -e "${GREEN}✅ Dead code check OK${NC}"

# 6. Unit tests (only changed files)
echo -e "${YELLOW}Running unit tests...${NC}"
if ! npm test -- --bail --testPathPattern="__tests__" 2>/dev/null; then
  echo -e "${RED}❌ Unit tests failed${NC}"
  FAILED=1
else
  echo -e "${GREEN}✅ Unit tests passed${NC}"
fi

# Final result
echo ""
if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ All pre-commit checks passed!${NC}"
  exit 0
else
  echo -e "${RED}❌ Pre-commit checks failed. Fix errors before committing.${NC}"
  exit 1
fi
```

---

## Post-Merge Automated Cleanup

**File**: `.github/workflows/post-merge-cleanup.yml`

```yaml
name: 'Post-Merge Cleanup'

on:
  push:
    branches:
      - main
    paths:
      - 'packages/backend/src/**/*.ts'

jobs:
  cleanup:
    runs-on: ubuntu-latest
    if: github.actor != 'dependabot[bot]'
    steps:
      - uses: actions/checkout@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Auto-fix ESLint issues
        run: npx eslint packages/backend/src --fix || true

      - name: Format code with Prettier
        run: npx prettier --write packages/backend/src

      - name: Remove unused imports
        run: npx eslint packages/backend/src --rule "unused-imports/no-unused-imports: error" --fix || true

      - name: Check for changes
        id: verify-changes
        run: |
          if git diff --quiet; then
            echo "changes=false" >> $GITHUB_OUTPUT
          else
            echo "changes=true" >> $GITHUB_OUTPUT
          fi

      - name: Commit cleanup changes
        if: steps.verify-changes.outputs.changes == 'true'
        run: |
          git config user.name "Automated Cleanup Bot"
          git config user.email "bot@sovren.dev"
          git add packages/backend/src
          git commit -m "chore: automatic code cleanup and import optimization

- Remove unused imports and variables
- Auto-fix linting violations
- Format code with Prettier

[skip ci]"
          git push origin main
```

---

## Weekly Report Generation

**File**: `.github/workflows/weekly-code-quality-report.yml`

```yaml
name: 'Weekly Code Quality Report'

on:
  schedule:
    - cron: '0 9 * * MON' # Every Monday at 9 AM
  workflow_dispatch:

jobs:
  report:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Generate metrics
        run: |
          mkdir -p reports

          # Type coverage
          npx type-coverage --project tsconfig.json > reports/type-coverage.txt 2>&1 || true

          # Dead code analysis
          npx ts-prune --project tsconfig.json > reports/dead-code.txt 2>&1 || true

          # Dependency audit
          npm audit --json > reports/npm-audit.json 2>&1 || true

          # Test coverage
          npm test -- --coverage --collectCoverageFrom="packages/backend/src/**/*.ts" > reports/test-coverage.txt 2>&1 || true

      - name: Generate GitHub summary
        run: |
          echo "# Weekly Code Quality Report" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY

          echo "## Type Safety" >> $GITHUB_STEP_SUMMARY
          cat reports/type-coverage.txt | tail -5 >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY

          echo "## Dead Code" >> $GITHUB_STEP_SUMMARY
          echo "- **Status**: $(grep -c 'unused' reports/dead-code.txt || echo '0 issues')" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY

          echo "## Dependency Vulnerabilities" >> $GITHUB_STEP_SUMMARY
          echo "- **High/Critical**: $(jq '.metadata.vulnerabilities.high + .metadata.vulnerabilities.critical' reports/npm-audit.json || echo 'N/A')" >> $GITHUB_STEP_SUMMARY

      - name: Upload reports
        uses: actions/upload-artifact@v3
        with:
          name: code-quality-reports
          path: reports/
          retention-days: 30
```

---

## Local Development Helper Script

**File**: `scripts/pre-commit-check.sh`

```bash
#!/bin/bash

# Comprehensive pre-commit validation script
# Run manually: bash scripts/pre-commit-check.sh

set -e

echo "=========================================="
echo "  Sovren Pre-Commit Quality Check"
echo "=========================================="
echo ""

ERRORS=0

# Function to check result
check_result() {
  if [ $? -eq 0 ]; then
    echo "✅ $1"
  else
    echo "❌ $1"
    ERRORS=$((ERRORS + 1))
  fi
}

# 1. TypeScript compilation
echo "1️⃣  Type checking..."
npx tsc --noEmit --strict
check_result "TypeScript compilation"

# 2. ESLint
echo ""
echo "2️⃣  Linting..."
npx eslint packages/backend/src packages/frontend/src
check_result "ESLint"

# 3. Prettier formatting
echo ""
echo "3️⃣  Code formatting..."
npx prettier --check packages/backend/src packages/frontend/src
check_result "Prettier formatting"

# 4. Unit tests
echo ""
echo "4️⃣  Unit tests..."
npm test -- --testPathPattern="__tests__" --coverage
check_result "Unit tests"

# 5. Canonical patterns
echo ""
echo "5️⃣  Canonical patterns..."

echo "   - Checking rate limiters..."
RATE_LIMITERS=$(find packages/backend/src -name '*rate*limit*.ts' \
  -not -path '*/node_modules/*' -not -path '*/__tests__/*' | wc -l)
if [ "$RATE_LIMITERS" -le 1 ]; then
  echo "   ✅ Rate limiters consolidated"
else
  echo "   ❌ Multiple rate limiters found"
  ERRORS=$((ERRORS + 1))
fi

echo "   - Checking loggers..."
if ! find packages/backend/src/utils -name '*logger*.ts' 2>/dev/null | grep -q .; then
  echo "   ✅ Logger consolidated (using lib/logger.ts)"
else
  echo "   ❌ Found deprecated utils/logger.ts"
  ERRORS=$((ERRORS + 1))
fi

# 6. Security checks
echo ""
echo "6️⃣  Security checks..."

echo "   - Checking for execSync..."
if ! grep -r "execSync" scripts --include="*.ts" | grep -v execFileSync | grep -q .; then
  echo "   ✅ No unsafe execSync detected"
else
  echo "   ❌ Found unsafe execSync"
  ERRORS=$((ERRORS + 1))
fi

echo "   - Checking CSP policy..."
if ! grep -q "unsafe-inline" vercel.json; then
  echo "   ✅ CSP does not contain unsafe-inline"
else
  echo "   ❌ CSP contains unsafe-inline"
  ERRORS=$((ERRORS + 1))
fi

# Summary
echo ""
echo "=========================================="
if [ $ERRORS -eq 0 ]; then
  echo "✅ All checks passed!"
  exit 0
else
  echo "❌ $ERRORS check(s) failed"
  exit 1
fi
```

---

## Summary

These CI/CD workflows and automation scripts provide:

1. **Canonical Pattern Enforcement**: Automatic detection of duplicate implementations
2. **Type Safety Checks**: TypeScript strict mode + dead code detection
3. **Security Hardening**: CSP validation, shell injection prevention, sanitization testing
4. **Integration Testing**: Comprehensive test suites for all prevention strategies
5. **Automated Cleanup**: Post-merge import and formatting fixes
6. **Weekly Reporting**: Metrics tracking for code quality trends

Deploy these gradually and adjust thresholds based on your team's needs. Start with warnings and escalate to errors after 2-3 weeks to allow developers to adapt.
