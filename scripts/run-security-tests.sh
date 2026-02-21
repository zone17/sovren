#!/usr/bin/env bash
# Security-Critical Test Runner
# Maps security-sensitive source files to their full test suites.
# Called from pre-commit hook to ensure security tests run during development.

set -euo pipefail

# Security-critical source file → test suite mapping
# Format: "source_pattern:test_file"
SECURITY_MAP=(
  "packages/backend/src/utils/ssrf.ts:packages/backend/src/utils/__tests__/ssrf.test.ts"
  "packages/backend/src/middleware/auth.ts:packages/backend/src/middleware/__tests__/auth.test.ts"
  "packages/backend/src/middleware/csrf.ts:packages/backend/src/__tests__/middleware/csrf.test.ts"
  # env-validation.ts — no test file yet; add mapping when test is created
  # "packages/backend/src/utils/env-validation.ts:packages/backend/src/utils/__tests__/env-validation.test.ts"
  "packages/backend/src/routes/auth.ts:packages/backend/src/middleware/__tests__/auth.test.ts"
)

# Collect staged files
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM 2>/dev/null || true)

if [ -z "$STAGED_FILES" ]; then
  exit 0
fi

# Check staged files against security map
SECURITY_TESTS=""
for mapping in "${SECURITY_MAP[@]}"; do
  source_pattern="${mapping%%:*}"
  test_file="${mapping##*:}"

  if echo "$STAGED_FILES" | grep -q "$source_pattern"; then
    # Verify test file exists before adding
    if [ -f "$test_file" ]; then
      SECURITY_TESTS="$SECURITY_TESTS $test_file"
      echo "Security file changed: $source_pattern"
      echo "  -> Running test suite: $test_file"
    fi
  fi
done

# Also check if test files themselves were changed (run them too)
for mapping in "${SECURITY_MAP[@]}"; do
  test_file="${mapping##*:}"
  if echo "$STAGED_FILES" | grep -q "$test_file"; then
    if [ -f "$test_file" ] && ! echo "$SECURITY_TESTS" | grep -q "$test_file"; then
      SECURITY_TESTS="$SECURITY_TESTS $test_file"
      echo "Security test changed: $test_file"
      echo "  -> Running test suite"
    fi
  fi
done

if [ -z "$SECURITY_TESTS" ]; then
  exit 0
fi

echo ""
echo "Running security-critical test suites..."
npx vitest run --bail 1 $SECURITY_TESTS

echo "Security tests passed."
