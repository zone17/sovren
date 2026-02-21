---
id: 449
severity: P2
status: complete
title: "CrossPostService: ValidationError used instead of AuthorizationError for ownership check"
file: packages/backend/src/services/distribution/CrossPostService.ts
found_in: PR #92
reviewer: review-security, review-architecture
---

# CrossPostService uses wrong error type for authorization failure

## Problem

When a user attempts to cross-post content they don't own, the service throws `ValidationError` (HTTP 400) instead of `AuthorizationError` (HTTP 403):

```typescript
if (content.creator_id !== creatorId) {
  throw new ValidationError('Not authorized to cross-post this content');
}
```

This is semantically incorrect — this is an authorization failure, not a validation error. The `AuthorizationError` class already exists in `packages/backend/src/utils/errors.ts` and correctly maps to HTTP 403.

## Location

```
packages/backend/src/services/distribution/CrossPostService.ts  line 75
```

## Fix

One-line change — import and use `AuthorizationError`:

```typescript
import { ValidationError, AuthorizationError } from '../../utils/errors';

// line 75:
if (content.creator_id !== creatorId) {
  throw new AuthorizationError('Not authorized to cross-post this content');
}
```

Also update the test expectation in `CrossPostService.test.ts` from `ValidationError` to `AuthorizationError`.

## Severity Justification

P2: Security monitoring and audit trail accuracy. Authorization failures returning 400 instead of 403 affects security monitoring tools that filter by HTTP status, and audit logs that categorize by error type would classify this as validation rather than access control.
