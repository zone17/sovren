#!/bin/bash
# Migrate Jest test files to Vitest
# Replaces jest.* calls with vi.* and updates imports
set -euo pipefail

PROJECT_ROOT="/Users/fp/Desktop/Sovren"

echo "=== Migrating test files from Jest to Vitest ==="

# Find all test files (excluding node_modules and dist)
TEST_FILES=$(find "$PROJECT_ROOT/packages" \
  \( -name "*.test.ts" -o -name "*.test.tsx" -o -name "*.spec.ts" -o -name "*.spec.tsx" \) \
  -not -path "*/node_modules/*" \
  -not -path "*/dist/*")

count=0
for f in $TEST_FILES; do
  count=$((count + 1))
done
echo "Found $count test files to process"

for f in $TEST_FILES; do
  changed=false

  # 1. Replace jest.mock( -> vi.mock(
  if grep -q 'jest\.mock(' "$f" 2>/dev/null; then
    sed -i '' 's/jest\.mock(/vi.mock(/g' "$f"
    changed=true
  fi

  # 2. Replace jest.unmock( -> vi.unmock(
  if grep -q 'jest\.unmock(' "$f" 2>/dev/null; then
    sed -i '' 's/jest\.unmock(/vi.unmock(/g' "$f"
    changed=true
  fi

  # 3. Replace jest.fn( -> vi.fn(
  if grep -q 'jest\.fn(' "$f" 2>/dev/null; then
    sed -i '' 's/jest\.fn(/vi.fn(/g' "$f"
    changed=true
  fi

  # 4. Replace jest.fn() (no args)
  if grep -q 'jest\.fn()' "$f" 2>/dev/null; then
    sed -i '' 's/jest\.fn()/vi.fn()/g' "$f"
    changed=true
  fi

  # 5. Replace jest.spyOn( -> vi.spyOn(
  if grep -q 'jest\.spyOn(' "$f" 2>/dev/null; then
    sed -i '' 's/jest\.spyOn(/vi.spyOn(/g' "$f"
    changed=true
  fi

  # 6. Replace jest.clearAllMocks -> vi.clearAllMocks
  if grep -q 'jest\.clearAllMocks' "$f" 2>/dev/null; then
    sed -i '' 's/jest\.clearAllMocks/vi.clearAllMocks/g' "$f"
    changed=true
  fi

  # 7. Replace jest.resetAllMocks -> vi.resetAllMocks
  if grep -q 'jest\.resetAllMocks' "$f" 2>/dev/null; then
    sed -i '' 's/jest\.resetAllMocks/vi.resetAllMocks/g' "$f"
    changed=true
  fi

  # 8. Replace jest.restoreAllMocks -> vi.restoreAllMocks
  if grep -q 'jest\.restoreAllMocks' "$f" 2>/dev/null; then
    sed -i '' 's/jest\.restoreAllMocks/vi.restoreAllMocks/g' "$f"
    changed=true
  fi

  # 9. Replace jest.useFakeTimers -> vi.useFakeTimers
  if grep -q 'jest\.useFakeTimers' "$f" 2>/dev/null; then
    sed -i '' 's/jest\.useFakeTimers/vi.useFakeTimers/g' "$f"
    changed=true
  fi

  # 10. Replace jest.useRealTimers -> vi.useRealTimers
  if grep -q 'jest\.useRealTimers' "$f" 2>/dev/null; then
    sed -i '' 's/jest\.useRealTimers/vi.useRealTimers/g' "$f"
    changed=true
  fi

  # 11. Replace jest.advanceTimersByTime -> vi.advanceTimersByTime
  if grep -q 'jest\.advanceTimersByTime' "$f" 2>/dev/null; then
    sed -i '' 's/jest\.advanceTimersByTime/vi.advanceTimersByTime/g' "$f"
    changed=true
  fi

  # 12. Replace jest.runAllTimers -> vi.runAllTimers
  if grep -q 'jest\.runAllTimers' "$f" 2>/dev/null; then
    sed -i '' 's/jest\.runAllTimers/vi.runAllTimers/g' "$f"
    changed=true
  fi

  # 13. Replace jest.runOnlyPendingTimers -> vi.runOnlyPendingTimers
  if grep -q 'jest\.runOnlyPendingTimers' "$f" 2>/dev/null; then
    sed -i '' 's/jest\.runOnlyPendingTimers/vi.runOnlyPendingTimers/g' "$f"
    changed=true
  fi

  # 14. Replace jest.setTimeout -> vi.setConfig({testTimeout: ...})
  # This needs special handling - skip for now, rare usage

  # 15. Replace jest.requireActual -> vi.importActual (note: async in vitest)
  if grep -q 'jest\.requireActual' "$f" 2>/dev/null; then
    sed -i '' 's/jest\.requireActual/vi.importActual/g' "$f"
    changed=true
  fi

  # 16. Replace jest.requireMock -> vi.importMock
  if grep -q 'jest\.requireMock' "$f" 2>/dev/null; then
    sed -i '' 's/jest\.requireMock/vi.importMock/g' "$f"
    changed=true
  fi

  # 17. Replace `as jest.Mock` type assertions -> `as any` (vitest compatible)
  if grep -q 'as jest\.Mock' "$f" 2>/dev/null; then
    sed -i '' 's/as jest\.Mock/as any/g' "$f"
    changed=true
  fi

  # 18. Replace jest.Mock type references -> Mock (from vitest)
  if grep -q 'jest\.MockedFunction' "$f" 2>/dev/null; then
    sed -i '' 's/jest\.MockedFunction/vi.MockedFunction/g' "$f"
    changed=true
  fi

  # 19. Replace jest.Mocked -> vi.Mocked
  if grep -q 'jest\.Mocked<' "$f" 2>/dev/null; then
    sed -i '' 's/jest\.Mocked</vi.Mocked</g' "$f"
    changed=true
  fi

  # 20. Replace jest.mocked( -> vi.mocked(
  if grep -q 'jest\.mocked(' "$f" 2>/dev/null; then
    sed -i '' 's/jest\.mocked(/vi.mocked(/g' "$f"
    changed=true
  fi

  # 21. Remove import { ... } from '@jest/globals' lines
  # (vitest globals mode makes these available automatically, and we have the alias)
  if grep -q "from '@jest/globals'" "$f" 2>/dev/null; then
    sed -i '' "s/import { .* } from '@jest\/globals'.*//g" "$f"
    changed=true
  fi

  # 22. Remove import { describe, expect, it } from '@jest/globals' (any combo)
  if grep -q 'from "@jest/globals"' "$f" 2>/dev/null; then
    sed -i '' 's/import { .* } from "@jest\/globals".*//g' "$f"
    changed=true
  fi

  if [ "$changed" = true ]; then
    echo "  Migrated: $(basename "$f")"
  fi
done

echo ""
echo "=== Migration complete ==="
echo ""

# Also migrate setup files in test-utils/
echo "=== Migrating test-utils setup files ==="
for f in "$PROJECT_ROOT/test-utils/elite-env-setup.ts" \
         "$PROJECT_ROOT/test-utils/elite-frontend-setup.ts" \
         "$PROJECT_ROOT/test-utils/elite-backend-setup.ts" \
         "$PROJECT_ROOT/test-utils/elite-custom-matchers.ts"; do
  if [ -f "$f" ]; then
    if grep -q 'jest\.' "$f" 2>/dev/null; then
      # Replace all jest.* with vi.* in setup files
      sed -i '' 's/jest\.fn/vi.fn/g' "$f"
      sed -i '' 's/jest\.mock/vi.mock/g' "$f"
      sed -i '' 's/jest\.spyOn/vi.spyOn/g' "$f"
      sed -i '' 's/jest\.clearAllMocks/vi.clearAllMocks/g' "$f"
      sed -i '' 's/jest\.resetAllMocks/vi.resetAllMocks/g' "$f"
      sed -i '' 's/jest\.restoreAllMocks/vi.restoreAllMocks/g' "$f"
      sed -i '' 's/jest\.requireActual/vi.importActual/g' "$f"
      sed -i '' "s/import { .* } from '@jest\/globals'.*//g" "$f"
      echo "  Migrated: $(basename "$f")"
    fi
  fi
done

echo ""
echo "=== Setup file migration complete ==="
