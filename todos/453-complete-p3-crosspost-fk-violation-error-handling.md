---
id: 453
severity: P3
status: complete
title: 'CrossPostService: add specific FK violation (23503) error handling for content deletion race'
file: packages/backend/src/services/distribution/CrossPostService.ts
found_in: PR #92
reviewer: review-data-integrity
---

# CrossPostService should handle FK violation from concurrent content deletion

## Problem

If content is deleted between the ownership check and the cross_posts INSERT, the database returns a foreign key violation (error code 23503). The current code does not distinguish this from other DB errors, producing an untyped error message instead of a clear "Content was deleted" message.

The FK constraint with ON DELETE CASCADE prevents data corruption, but the error UX is poor.

## Location

```
packages/backend/src/services/distribution/CrossPostService.ts  lines 95-102
```

## Fix

```typescript
if (error) {
  if (error.code === '23503') {
    throw new ValidationError('Content was deleted before cross-posting could begin');
  }
  throw error;
}
```

## Severity Justification

P3: UX improvement. Data integrity is already protected by FK constraints. This improves the error message quality.
