---
status: pending
priority: p2
issue_id: '047'
tags: [code-review, security, sanitization]
dependencies: []
---

# sanitizeObject Non-Recursive Regex Mutation

## Problem Statement

Three critical issues exist in sensitive field sanitization code: (1) `sanitizeObject` only checks top-level keys, allowing nested sensitive data like `{user: {password: "secret"}}` to pass through unsanitized; (2) `SENSITIVE_REGEX` matches substrings, incorrectly flagging benign fields like "tokenCount" and "passwordResetRequested"; (3) Sentry `beforeSend` hook mutates event.request.data in-place instead of cloning, potentially affecting error reporting.

## Findings

**Location**:

- `lib/sensitive-fields.ts:22,28-36`
- `lib/sentry.ts:46-53`
- `lib/logger.ts:38-50`

**Issue 1: Non-Recursive Sanitization**:

- `sanitizeObject` only iterates top-level Object.keys()
- Nested objects bypass sanitization completely
- Logger has separate recursive implementation, creating inconsistency
- Different sanitization behavior across logging vs error reporting

**Issue 2: Substring Regex Matching**:

```typescript
// Current pattern matches substrings
SENSITIVE_REGEX = /password|token|secret|key|auth/i;

// Matches: "password", "passwordResetRequested", "resetPassword"
// Matches: "token", "tokenCount", "tokenExpiry"
```

**Issue 3: In-Place Mutation**:

- Sentry beforeSend modifies event.request.data directly
- No defensive copy made before sanitization
- Potential side effects on error context

## Proposed Solutions

1. **Make sanitizeObject Recursive** (Recommended):

   - Implement deep object traversal
   - Handle nested objects, arrays, and mixed structures
   - Consolidate with logger's recursive implementation
   - Apply same logic across all sanitization call sites

2. **Fix Regex to Word Boundaries**:

   ```typescript
   // Match whole words only
   SENSITIVE_REGEX = /\b(password|token|secret|key|auth|api[_-]?key|private[_-]?key)\b/i;
   ```

3. **Clone Before Sanitize**:
   ```typescript
   beforeSend(event) {
     const clonedEvent = JSON.parse(JSON.stringify(event));
     // sanitize clonedEvent
     return clonedEvent;
   }
   ```

## Technical Details

**Test Cases for Recursive Sanitization**:

```typescript
// Should sanitize
{
  user: {
    password: 'secret';
  }
}
{
  users: [{ token: 'abc' }];
}
{
  config: {
    db: {
      apiKey: 'xyz';
    }
  }
}

// Should NOT sanitize
{
  passwordResetRequested: true;
}
{
  tokenCount: 5;
}
{
  authenticated: true;
}
```

**Affected Code Paths**:

- Logger calls in all service files
- Sentry error reporting
- Debug output
- API response sanitization

**Files Requiring Changes**:

- `lib/sensitive-fields.ts` - Core sanitization logic
- `lib/sentry.ts` - beforeSend hook
- `lib/logger.ts` - Remove duplicate recursive logic, use shared implementation
- Unit tests for all sanitization scenarios

## Acceptance Criteria

- [ ] `sanitizeObject` recursively traverses nested objects and arrays
- [ ] Regex matches whole words only (word boundaries)
- [ ] Benign fields like "tokenCount" not sanitized
- [ ] Nested sensitive fields correctly sanitized
- [ ] Sentry beforeSend clones before sanitizing
- [ ] Logger and Sentry use same sanitization implementation
- [ ] Unit tests cover:
  - [ ] Nested objects (3+ levels deep)
  - [ ] Arrays of objects with sensitive fields
  - [ ] Mixed structures (arrays in objects in arrays)
  - [ ] Substring false positives (tokenCount, etc)
  - [ ] Word boundary cases
- [ ] Integration tests verify logs don't leak secrets
- [ ] Code review confirms no mutation side effects

## Work Log

Created: 2026-02-12

## Resources

- PR #73 post-remediation review
- OWASP Logging Cheat Sheet
- Sentry beforeSend documentation
