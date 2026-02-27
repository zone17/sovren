---
status: pending
priority: p2
issue_id: '557'
tags: [code-review, security, pr-104]
---

# strict_required_status_checks_policy should be true

## Problem Statement

`setup-ruleset.sh` sets `strict_required_status_checks_policy: false`, meaning PRs don't need to be up-to-date with main before status checks are considered valid. The merge queue mitigates this (re-runs CI in queue context), but during hotfix bypass the gap is real.

## Findings

- Security sentinel flagged (1 agent)
- Merge queue mitigates for normal flow, but hotfix lane bypasses queue

## Proposed Solutions

Change to `true` in setup-ruleset.sh. Since merge queue already re-runs CI, the additional cost is negligible.

## Acceptance Criteria

- [ ] `strict_required_status_checks_policy: true` in setup-ruleset.sh
