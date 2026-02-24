---
module: NOSTR Auth Service
date: 2026-02-24
problem_type: logic_error
component: nostr_auth
symptoms:
  - 'isValidSignature() always returns false'
  - 'verifyEvent() rejects events with empty id field'
  - 'NOSTR signature verification silently fails'
root_cause: incomplete_fix
severity: critical
tags: [nostr, verifyEvent, getEventHash, incomplete-fix, dead-code-path]
related_issues:
  - 'PR #85 originally fixed verifySignature() but missed isValidSignature()'
  - 'Todo #488 — P1 finding from 10-agent parallel review'
sprint: 'PR #96 post-review compound'
---

# NOSTR verifyEvent() Requires Computed Event ID

## Symptom

`isValidSignature()` (standalone exported utility at `packages/backend/src/services/nostr-auth.ts:476-502`) always returned `false` regardless of input. The class method `verifySignature()` in the same file worked correctly after a prior fix.

## Investigation Steps

1. **10-agent parallel review** of commit `68a92d3` flagged this independently across 9/10 agents — strongest consensus signal in project history
2. Compared the working `verifySignature()` method (lines 174-185) against the broken `isValidSignature()` utility (lines 485-496)
3. Key difference: `verifySignature()` used `getEventHash(eventData)` for the `id` field; `isValidSignature()` used `id: ''`

## Root Cause

**`nostr-tools/pure` `verifyEvent()` does NOT auto-compute the event ID.** It validates that the `id` field matches the SHA-256 hash of the serialized event contents `[0, pubkey, created_at, kind, tags, content]`. Passing `id: ''` means the hash check always fails, so `verifyEvent()` returns `false`.

This bug existed since the file's creation (Oct 2025) and survived:

- 2 nostr-tools migrations (v1 → v2, CommonJS → ESM)
- 139 review findings across 7 sprints
- Multiple security reviews

It was only caught when 10 parallel review agents examined the full file (not just diffs).

## Solution

Replace the broken pattern with the correct `UnsignedEvent` + `getEventHash` pattern already used in the class method:

```typescript
// BEFORE (broken — always returns false):
const event: NostrEvent = {
  kind: 1,
  pubkey,
  created_at: Math.floor(Date.now() / 1000),
  tags: [],
  content: messageHash,
  id: '', // verifyEvent checks this against computed hash — always mismatches
  sig: signature,
};

// AFTER (fixed):
const eventData: UnsignedEvent = {
  kind: 1,
  pubkey,
  created_at: Math.floor(Date.now() / 1000),
  tags: [],
  content: messageHash,
};
const event: NostrEvent = {
  ...eventData,
  id: getEventHash(eventData), // Compute correct event ID
  sig: signature,
};
```

**Commit:** `88b401d` — pushed to main.

## Prevention

1. **When fixing a bug in a class method, grep the same file for identical patterns in standalone exports.** This file had the pattern twice — the class method was fixed but the utility wasn't.
2. **`verifyEvent()` from nostr-tools NEVER auto-computes IDs.** Always use `getEventHash(UnsignedEvent)` to set the `id` field.
3. **Full-file reviews catch what diff reviews miss.** This bug survived 5 diff-based review rounds but was caught on the first full-file review.
4. **Agent consensus ≥ 6 = confirmed true positive.** 9/10 agents flagging the same issue is the strongest signal possible.

## Cross-References

- `docs/solutions/patterns/critical-patterns.md` — Section 9 (added with this compound)
- `docs/solutions/patterns/common-solutions.md` — Section 28 (added with this compound)
- `docs/solutions/security-issues/pr91-ssrf-ipv4compat-dns-toctou-20260221.md` — Prior NOSTR/security sprint
- `todos/488-pending-p1-isvalidsignature-broken-event-id.md` — Original P1 finding
