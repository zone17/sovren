---
status: pending
priority: p2
issue_id: '555'
tags: [code-review, ci-cd, pr-104]
---

# Branch name check is warning-only — either enforce or remove

## Problem Statement

The branch-name validation job in ci.yml (lines 54-76) emits a `::warning::` but never fails (`exit 1` absent). This means any branch name is accepted. A warning that doesn't block is CI noise — it consumes a runner and enforces nothing. The comment says "will become required after adoption period" but no deadline or tracking issue exists.

Additionally, the regex uses `[A-Za-z]+` for ticket prefixes but the convention expects uppercase (e.g., `SOV-123`). Should be `[A-Z]+`.

## Findings

- **3/3 agents flagged** (security, architecture, simplicity)
- YAGNI: don't ship dead enforcement — add it when ready to enforce

## Proposed Solutions

### Option A: Remove until ready to enforce (Recommended)

- Delete lines 54-76 from ci.yml
- Re-add with `exit 1` when adoption period ends
- **Effort**: Tiny

### Option B: Enforce now with tightened regex

- Change warning to `exit 1`
- Tighten regex: `[A-Z]+-[0-9]+`
- Add to required status checks in ruleset
- **Effort**: Small

## Acceptance Criteria

- [ ] Branch name check either removed or enforced (not warning-only)
- [ ] If enforced: regex uses `[A-Z]+` for ticket prefix
