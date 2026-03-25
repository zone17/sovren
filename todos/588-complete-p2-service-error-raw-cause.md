---
status: pending
priority: p2
issue_id: '588'
tags: [code-review, pr-108, security, backend]
---

# ServiceError passes raw Supabase error as cause — potential info leakage

## Problem Statement

When the Supabase query fails, the raw error is passed as `cause` to ServiceError. The `AppError.toJSON()` method serializes `cause.message` — which can contain table names, column names, and PostgreSQL error codes useful for attacker reconnaissance.

**Flagged by: Security Sentinel**

## Findings

- `discovery.routes.ts:105`: `throw new ServiceError('Discovery search failed', { cause: error });`
- `app-error.ts:89`: `cause: this.cause instanceof Error ? this.cause.message : this.cause`
- Currently `handleAppError` doesn't call `toJSON()` directly, but any logging/serialization change could expose it

## Proposed Solutions

```typescript
if (error) {
  // Log raw error server-side only
  console.error('Discovery search query failed', { supabaseError: error });
  throw new ServiceError('Discovery search failed');
}
```

## Acceptance Criteria

- [ ] Raw Supabase error not passed as cause to ServiceError
- [ ] Error logged server-side for debugging
