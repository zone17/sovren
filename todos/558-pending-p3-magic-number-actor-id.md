---
status: pending
priority: p3
issue_id: '558'
tags: [code-review, pr-104]
---

# Add comment for magic number actor_id: 5 in setup-ruleset.sh

## Problem Statement

`actor_id: 5` in the bypass_actors config is undocumented. GitHub RepositoryRole IDs: 1=Read, 2=Triage, 3=Write, 4=Maintain, 5=Admin.

## Proposed Solutions

Add inline comment: `"actor_id": 5,  // 5 = Admin role`

## Acceptance Criteria

- [ ] Comment added explaining the magic number
