---
status: pending
priority: p1
issue_id: '023'
tags: [code-review, security, injection, logging]
dependencies: []
---

# Correlation ID Header Injection / Log Injection

## Problem Statement

`correlation-id.ts:51-54` accepts correlation IDs from user-supplied headers without validation. Attackers can inject arbitrary strings (newlines, control chars, very long strings) that propagate to:

1. Response headers (HTTP header injection)
2. All log entries via AsyncLocalStorage (log injection)
3. Nonce map keys in security-headers.ts

## Findings

- **security-sentinel**: HIGH-04

## Proposed Solutions

Validate correlation ID format before accepting:

```typescript
const UUID_REGEX = /^[a-f0-9-]{1,128}$/i;
const rawId =
  (req.headers['x-correlation-id'] as string) || (req.headers['x-request-id'] as string);
const correlationId = rawId && UUID_REGEX.test(rawId) ? rawId : randomUUID();
```

**Effort**: Small | **Risk**: Low

## Acceptance Criteria

- [ ] Correlation IDs from headers are validated against a regex
- [ ] Invalid/oversized IDs are replaced with server-generated UUIDs
