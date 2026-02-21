---
status: pending
priority: p3
issue_id: "416"
tags: [code-review, quality, frontend, pr-87]
dependencies: []
---

# formatSats utility missing edge case handling (negative, NaN, Infinity)

## Problem Statement

The new shared `formatSats()` utility handles positive numbers well but doesn't guard against edge cases: negative sats, NaN, or Infinity. These could produce confusing output like "NaN sats", "-1.5K sats", or "InfinityM sats".

## Findings

- `formatSats.ts`: No guard for `NaN`, `Infinity`, or negative values
- `sats.toLocaleString()` on `NaN` returns `"NaN"`, on `Infinity` returns `"Infinity"`
- Negative sats shouldn't occur in normal usage but could appear from calculation bugs
- 8 call sites across the frontend depend on this utility

## Proposed Solutions

### Option 1: Add guards

**Approach:**
```typescript
if (!Number.isFinite(sats) || sats < 0) return '0 sats';
```

**Pros:** Defensive, prevents confusing UI
**Cons:** Silently hides calculation bugs

**Effort:** 5 minutes

**Risk:** Low

---

### Option 2: Accept as-is

**Approach:** The function receives values from API responses which are always valid positive numbers.

**Effort:** 0 minutes

## Recommended Action

Low priority. Add a `Number.isFinite()` guard for defensive programming, or accept as-is.

## Technical Details

**Affected files:**
- `packages/frontend/src/shared/utils/formatSats.ts`

## Acceptance Criteria

- [ ] Decision documented

## Work Log

### 2026-02-20 - Code Review Discovery

**By:** Claude Code (PR #87 review)

## Resources

- **PR:** #87
