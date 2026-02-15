---
status: pending
priority: p2
issue_id: 075
tags: [code-review, dead-code, simplicity]
dependencies: []
---

# 3,280 Lines Dead Middleware Code (3 Files)

## Problem Statement

Three middleware files totaling ~3,280 lines have zero or near-zero external imports:

1. `advanced-rate-limiting.ts` (~1,232 lines) - Only `RequestRateLimiter` imported externally
2. `content-sanitization.ts` (~1,100 lines) - Zero external imports
3. `input-validation.ts` (~547 lines) - Only imported by content-sanitization.ts (also dead)

## Findings

- **Code Simplicity P1-001/002/003**: Three large files with no consumers.
- **Pattern Recognition P2**: ~1,885 lines of dead code identified across middleware.

## Proposed Solutions

### Option A: Delete all three files (Recommended)

Remove the files entirely. If `RequestRateLimiter` from advanced-rate-limiting.ts is used, extract just that class (~50 lines) to a separate file.
**Pros:** Removes 3,280 lines of dead code, reduces maintenance burden
**Cons:** Need to verify no runtime dynamic imports
**Effort:** Small | **Risk:** Low (verify with grep first)

## Acceptance Criteria

- [ ] All three files deleted or their dead code removed
- [ ] No broken imports across the codebase
- [ ] If RequestRateLimiter is needed, extracted to focused file
- [ ] Tests still pass
