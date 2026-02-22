---
id: 436
severity: P3
status: complete
title: 'test-environment.ts: hardcoded test API keys look like real credentials'
file: packages/frontend/src/test-utils/test-environment.ts
found_in: PR #89
reviewer: review-security
---

# Test environment has credential-looking strings that trigger secret scanners

## Problem

The `TEST_ENVIRONMENT` object contains values that pattern-match as real credentials:

```typescript
SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-anon-key',
SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-service-role-key',
OPENAI_API_KEY: 'sk-test-key-for-testing-purposes-only',
```

These will:

1. Trigger GitHub secret scanning alerts
2. Trigger the anti-pattern scanner's credential check (though test-utils is now excluded)
3. Confuse new developers who might think these are real

Note: The anti-pattern scanner fix in this PR excludes `test-utils/` from credential checks (line 69-70 of `check-antipatterns.sh`), which is the correct local fix. But external tools (GitHub, Snyk, GitGuardian) will still flag these.

## Location

```
packages/frontend/src/test-utils/test-environment.ts  lines 88-112
```

## Fix

Use obviously-fake values that don't pattern-match real credentials:

```typescript
SUPABASE_ANON_KEY: 'test-only-not-a-real-key-000000000000000000000000',
OPENAI_API_KEY: 'test-only-not-real-00000000000000000000000000000000',
```

Or prefix all test values with `FAKE_` or `TEST_ONLY_`:

```typescript
OPENAI_API_KEY: 'TEST_ONLY_not_a_real_api_key',
```

## Severity Justification

P3: Developer experience. Won't cause production issues but will generate noise in secret scanning tools.
