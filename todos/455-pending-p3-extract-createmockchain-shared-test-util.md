---
id: 455
severity: P3
status: pending
title: "Extract createMockChain to shared test utility for Supabase chain mocking"
file: packages/backend/src/services/distribution/__tests__/CrossPostService.test.ts
found_in: PR #92
reviewer: review-typescript
---

# createMockChain should be a shared test utility

## Problem

The `createMockChain()` helper implements common-solutions.md #7 (Supabase chainable mock pattern). This pattern is needed by every service that touches Supabase. Leaving it as a private function in one test file guarantees duplication across other service tests.

## Location

```
packages/backend/src/services/distribution/__tests__/CrossPostService.test.ts  lines 12-24
```

## Fix

Extract to a shared location like `packages/backend/src/test-utils/supabase-mock.ts` so other test files can import it.

## Severity Justification

P3: DRY principle. The utility works correctly in place; extraction prevents future duplication.
