---
status: pending
priority: p2
issue_id: '616'
tags: [code-review, security, backend, validation, content-shield]
dependencies: []
---

# P2: nostr_event_id and signature Accept Arbitrary Strings

## Problem Statement

The Zod schema validates `nostr_event_id` as `z.string().min(1).max(255)` and `signature` as `z.string().min(1).max(2048)` with no format constraints. NOSTR event IDs must be 64-char hex, Schnorr signatures must be 128-char hex.

Also, `content_id` is validated as `z.string().min(1)` instead of `z.string().uuid()`.

## Findings

- **Security Sentinel (P2-003, P3-003)**: "Non-hex strings will be accepted by the validator but rejected at the database level"

## Proposed Solutions

Add regex constraints:

```typescript
nostr_event_id: z.string().regex(/^[0-9a-f]{64}$/, 'Must be a 64-char hex string'),
signature: z.string().regex(/^[0-9a-f]{128}$/, 'Must be a 128-char hex Schnorr signature'),
content_id: z.string().uuid(),
```

## Acceptance Criteria

- [ ] Event ID validated as 64-char hex
- [ ] Signature validated as 128-char hex
- [ ] content_id validated as UUID
- [ ] Invalid formats return 400 with descriptive message

## Resources

- PR #132: https://github.com/zone17/sovren/pull/132
