---
status: complete
priority: p2
issue_id: 594
tags: [code-review, dead-code, cleanup]
dependencies: []
---

# Delete Dead Route Files (creator-recommendations.ts + creator-recommendations-simple.ts)

## Problem Statement

Two route files totaling 1,086 LOC are dead code (not imported by `app.ts` or any module) but received lazy singleton refactoring in this PR. This is wasted maintenance burden and contains a hardcoded `user_123` auth placeholder.

**Why it matters:** Dead code increases cognitive load, creates confusion about canonical implementations, and the hardcoded auth placeholder is a security risk if the file is ever re-imported.

## Findings

- **3/7 agents flagged** (pattern-recognition P2, simplicity main finding, agent-native)
- `creator-recommendations.ts` (591 lines) — uses `express-validator`, has hardcoded `req.user = { id: 'user_123' }`
- `creator-recommendations-simple.ts` (495 lines) — near-duplicate without validation
- Neither file is imported by `app.ts` or any other module (verified by grep)
- Both received unnecessary lazy singleton refactoring in this PR

## Proposed Solutions

### Solution A: Delete Both Files (Recommended)

- **Pros:** Removes 1,086 LOC, eliminates security risk, consistent with Phase 1 deletion philosophy
- **Cons:** None — they are dead code
- **Effort:** Small (2 file deletions)
- **Risk:** None — zero imports verified

## Recommended Action

Delete both files.

## Technical Details

- **Affected files:**
  - `packages/backend/src/routes/creator-recommendations.ts`
  - `packages/backend/src/routes/creator-recommendations-simple.ts`

## Acceptance Criteria

- [ ] Both files deleted
- [ ] `grep -r "creator-recommendations" packages/backend/src/` confirms zero remaining imports
- [ ] Tests pass

## Work Log

| Date       | Action                      | Learnings                                                       |
| ---------- | --------------------------- | --------------------------------------------------------------- |
| 2026-02-28 | Created from PR #110 review | Dead code received refactoring — verify imports before patching |

## Resources

- PR: #110
