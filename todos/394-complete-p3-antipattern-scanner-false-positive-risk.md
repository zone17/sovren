---
status: complete
priority: p3
issue_id: "411"
tags: [code-review, infra, quality, pr-87]
dependencies: []
---

# Anti-pattern scanner TODO/FIXME check may produce false positives

## Problem Statement

The new check 1c in `check-antipatterns.sh` detects `TODO|FIXME|HACK|XXX` comments in staged source files. However, the grep pattern (`grep -v '^\s*//'`) only excludes lines that START with `//`, not inline comments after code. More importantly, the TODO check does not exclude the `todos/` directory or documentation files, and it will flag legitimate tracking TODOs in code comments.

Additionally, the check uses `-v '^\s*//'` which doesn't work for single-line comments that appear after code (e.g., `const x = 1; // TODO: refactor`), since the line doesn't start with `//`.

## Findings

- `check-antipatterns.sh` check 1c: Flags any line containing TODO/FIXME/HACK/XXX
- The exclusion `grep -v '^\s*//'` only removes lines where `//` is the first non-whitespace -- most TODO comments are inline after code
- The check operates on `$STAGED_TS_SRC` which is limited to staged TypeScript source files (not docs/todos)
- The existing codebase contains intentional TODO comments (e.g., `PremiumContentPaywall.tsx:3` has `// TODO: US-E4-010`)
- This could block commits when developers add TODOs for tracked work items

## Proposed Solutions

### Option 1: Scope the TODO check to only new/changed lines

**Approach:** Use `git diff --cached` to check only newly-added lines, not pre-existing TODOs.

**Pros:**
- Won't block on pre-existing TODOs
- Only flags new TODOs being added

**Cons:**
- More complex grep pipeline

**Effort:** 30 minutes

**Risk:** Low

---

### Option 2: Make it a warning, not an error

**Approach:** Print the warning but don't increment `$ERRORS`.

**Pros:**
- Informational, non-blocking
- Simple change

**Cons:**
- Developers may ignore

**Effort:** 5 minutes

**Risk:** Low

## Recommended Action

Option 1: scope to newly-added lines only. This prevents false positives on pre-existing TODOs while still catching new ones.

## Technical Details

**Affected files:**
- `scripts/check-antipatterns.sh` (check 1c)

## Acceptance Criteria

- [ ] TODO check does not false-positive on pre-existing code
- [ ] New TODO comments are flagged appropriately

## Work Log

### 2026-02-20 - Code Review Discovery

**By:** Claude Code (PR #87 review)

## Resources

- **PR:** #87
