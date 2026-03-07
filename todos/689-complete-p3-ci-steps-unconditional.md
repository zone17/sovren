---
status: pending
priority: p3
issue_id: 689
tags: [code-review, ci, performance]
dependencies: []
---

# CI E2E typecheck + ratchet steps run unconditionally

## Problem Statement

The E2E type check and @ts-nocheck ratchet steps in ci.yml have no `if:` condition, running on every PR even when no TS files changed. Adds ~15-30s per PR.

**Consensus: 3/8 agents noted.**

## Recommended Action

Gate E2E typecheck with `if: steps.changed.outputs.count != '0'`. Ratchet is arguably correct to run always (counts all files). Add comment explaining the choice.

## Work Log

| Date       | Action                                    | Learnings                        |
| ---------- | ----------------------------------------- | -------------------------------- |
| 2026-03-07 | Created from /workflows:review of PR #146 | Ratchet always-run is defensible |
