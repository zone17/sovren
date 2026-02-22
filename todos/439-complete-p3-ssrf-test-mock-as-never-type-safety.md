---
id: 439
severity: P3
status: complete
title: "SSRF tests: mockLookup uses 'as never' to suppress type errors"
file: packages/backend/src/utils/__tests__/ssrf.test.ts
found_in: PR #89
reviewer: review-testing
---

# SSRF test mocks use 'as never' type assertion to bypass type checking

## Problem

Throughout the SSRF test suite, the DNS lookup mock uses `as never` to suppress type errors:

```typescript
mockLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }] as never);
```

The `as never` assertion defeats TypeScript's ability to catch mock shape mismatches. If the `lookup` function signature changes (e.g., adds a required field to the return type), the tests will continue to compile but produce incorrect mock data.

This appears in 10+ locations in the test file.

## Location

```
packages/backend/src/utils/__tests__/ssrf.test.ts  lines 28, 355, 361, 368, 375, 382, 389, 396-404
```

## Fix

Use proper typing for the mock:

```typescript
import type { LookupAddress } from 'dns';

const mockResult: LookupAddress[] = [{ address: '93.184.216.34', family: 4 }];
mockLookup.mockResolvedValue(mockResult);
```

Or use `vi.mocked` with proper generic types to ensure the mock matches the real function signature.

## Severity Justification

P3: Type safety in tests. Won't cause production issues but reduces confidence that tests accurately represent the real DNS lookup behavior.
