---
status: pending
priority: p2
issue_id: '521'
tags: [code-review, security, crypto]
dependencies: []
---

# Math.random() in Cryptographic Password Shuffle

## Problem Statement

`BackupEncryptionService.generateSecurePassword()` uses `crypto.getRandomValues()` to select characters (correct), but then shuffles them with `Math.random()` (incorrect). `Math.random()` is not cryptographically secure and introduces bias via comparison sort, weakening password entropy.

## Findings

- **security-sentinel** + **pattern-recognition-specialist** (2/8 agents flagged)
- File: `packages/frontend/src/services/nostr/BackupEncryptionService.ts`, line 306
- Pre-existing issue, not introduced by PR #98

```typescript
// Current (bad):
return password
  .split('')
  .sort(() => Math.random() - 0.5)
  .join('');
```

## Proposed Solutions

### Option A: Fisher-Yates shuffle with crypto.getRandomValues() (Recommended)

- Replace Math.random shuffle with proper Fisher-Yates using secure random
- Effort: Small (15 min)
- Risk: None

## Technical Details

- Affected files: `packages/frontend/src/services/nostr/BackupEncryptionService.ts`

## Acceptance Criteria

- [ ] Password shuffle uses `crypto.getRandomValues()` not `Math.random()`
- [ ] Fisher-Yates algorithm used instead of comparison sort

## Work Log

| Date       | Action                                        | Learnings                        |
| ---------- | --------------------------------------------- | -------------------------------- |
| 2026-02-25 | Created from PR #98 review (8-agent parallel) | 2/8 agents flagged independently |
