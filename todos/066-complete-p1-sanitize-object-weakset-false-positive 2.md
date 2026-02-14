---
status: pending
priority: p1
issue_id: 066
tags: [code-review, data-integrity, bug]
dependencies: []
---

# sanitizeObject WeakSet False Positive on Shared References

## Problem Statement

The `sanitizeObject` function in `packages/backend/src/lib/sensitive-fields.ts` uses a `WeakSet` to detect circular references. However, it incorrectly treats shared (non-circular) object references as circular. If two fields point to the same object (e.g., `{a: sharedObj, b: sharedObj}`), the second reference is skipped, silently dropping data from sanitized output.

## Findings

- **Data Integrity P1 Finding 2**: WeakSet guard marks shared references as circular, causing false positives. Log entries may lose fields when objects share references.
- **Previous P1 Fix #1**: Added WeakSet guard in earlier remediation round — this is a bug in that fix.

## Proposed Solutions

### Option A: Clone-on-visit instead of skip (Recommended)

When a seen object is encountered, return the already-sanitized copy instead of `[Circular]`.
**Pros:** Preserves data, handles both circular and shared correctly
**Cons:** Slightly more complex tracking (Map instead of WeakSet)
**Effort:** Small
**Risk:** Low

### Option B: Use WeakMap to track already-sanitized copies

Replace WeakSet with WeakMap<object, sanitized-copy>. On re-encounter, return the cached sanitized copy.
**Pros:** Efficient, handles both cases correctly
**Cons:** Slightly more memory per sanitize call
**Effort:** Small
**Risk:** Low

## Technical Details

- **Affected files:** `packages/backend/src/lib/sensitive-fields.ts`
- **Components:** Log sanitization
- **Runtime impact:** Silent data loss in sanitized log output

## Acceptance Criteria

- [ ] Shared (non-circular) references are preserved in sanitized output
- [ ] Circular references still detected and replaced with `[Circular]`
- [ ] Test case: `{a: obj, b: obj}` sanitizes both fields correctly
- [ ] Test case: circular `a.self = a` correctly shows `[Circular]`

## Work Log

| Date       | Action                          | Learnings              |
| ---------- | ------------------------------- | ---------------------- |
| 2026-02-13 | Created from full PR #73 review | Bug in previous P1 fix |

## Resources

- PR #73 full review
- Data Integrity agent report
