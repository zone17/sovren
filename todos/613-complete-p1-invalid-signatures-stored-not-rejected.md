---
status: pending
priority: p1
issue_id: '613'
tags: [code-review, security, backend, content-shield, nostr]
dependencies: ['609']
---

# P1: Invalid NOSTR Signatures Stored Instead of Rejected

## Problem Statement

When `verifyEvent()` returns `false` (invalid signature), `ProvenanceService.signContent()` stores the record with `verification_status: 'unverified'` and returns 201 success. It does NOT reject the request.

An authenticated user can submit garbage signatures and create fraudulent provenance records. The `upsert` with `onConflict: 'content_id'` means a fraudulent record **replaces** a legitimate one.

## Findings

- **Security Sentinel (P1-001)**: "An attacker who has a valid JWT session can submit an arbitrary signature value... the service will store the record anyway"
- **Consensus**: 2/6 agents (Security + Kieran — both read backend code)

## Evidence

```typescript
// ProvenanceService.ts:138-139
const isValid = verifyEvent(event);
const verificationStatus: VerificationStatus = isValid ? 'verified' : 'unverified';
// ... proceeds to upsert regardless of isValid
```

## Proposed Solutions

### Option A: Reject on invalid signature (Recommended)

Add `if (!isValid) throw new AuthorizationError('Invalid NOSTR signature');` after `verifyEvent()`.

- Effort: Small (2 lines)
- Risk: Low
- Note: Must fix #609 (event mismatch) FIRST or this will reject ALL requests

## Acceptance Criteria

- [ ] Invalid signatures return 403, not 201
- [ ] Valid signatures still succeed with `verification_status: 'verified'`
- [ ] Unit test covers both paths

## Resources

- PR #132: https://github.com/zone17/sovren/pull/132
- Depends on #609 (event mismatch fix must land first)
