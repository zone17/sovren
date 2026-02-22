---
status: pending
priority: p3
issue_id: 466
tags: [code-review, infrastructure]
dependencies: []
---

# P3: Anti-pattern scanner uses BRE alternation that may not be portable

## Problem Statement

Line 12 of `check-antipatterns.sh` uses `\|` for alternation in `grep -v`, which is BRE (GNU extension) syntax. On macOS BSD grep, `\|` in BRE mode may be treated differently. The correct portable approach is `grep -vE` (extended regex) with `|` for alternation.

## Findings

- `grep -v '__tests__\|\.test\.ts\|\.spec\.ts\|test-utils/\|vitest.*setup'` on line 12
- Similar `\|` patterns may exist in ROUTE_FILES and SERVICE_FILES filters
- Development platform is macOS (Darwin 25.2.0)
- CI may run on Linux with GNU grep, masking the issue locally

Source: Architecture strategist (PR #93)

## Proposed Solutions

### Option A: Use grep -vE with pipe alternation

Replace all `grep -v 'a\|b'` with `grep -vE 'a|b'` throughout the scanner.

- Effort: Small
- Risk: Low

## Technical Details

- **Affected files**: `scripts/check-antipatterns.sh`

## Acceptance Criteria

- [ ] All grep alternation uses `-E` flag with `|` operator
- [ ] Scanner works correctly on both macOS and Linux

## Work Log

| Date       | Action                     | Learnings                                                 |
| ---------- | -------------------------- | --------------------------------------------------------- |
| 2026-02-21 | Created from PR #93 review | Already fixed one BRE bug in this sprint (grep -vF '+++') |
