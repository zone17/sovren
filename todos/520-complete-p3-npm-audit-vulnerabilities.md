---
status: pending
priority: p3
issue_id: 520
tags: [code-review, security, dependencies]
dependencies: []
---

# Address 54 Pre-existing npm Audit Vulnerabilities

## Problem Statement

`npm audit` reports 54 vulnerabilities (1 critical, 33 high) across the monorepo. Key issues:

- `express` <=4.21.2 (body-parser DoS, qs DoS)
- `ws` 8.0.0-8.17.0 (DoS with many HTTP headers)
- `form-data` 4.0.0-4.0.3 (critical)
- `path-to-regexp` <=0.1.11 (ReDoS)

## Findings

**2 security agents flagged.** All pre-existing, none introduced by PR #98.

## Proposed Solutions

- Upgrade `express` to >=4.22.0
- Upgrade `ws` to >=8.17.1
- Run `npm audit fix` for non-breaking updates
- Evaluate `path-to-regexp` upgrade (Express built-in)

**Effort:** Medium (dependency upgrades may have breaking changes)

## Acceptance Criteria

- [ ] `npm audit` shows 0 critical, 0 high
- [ ] All tests pass after upgrades
- [ ] No breaking API changes

## Work Log

| Date       | Action                       | Learnings                               |
| ---------- | ---------------------------- | --------------------------------------- |
| 2026-02-25 | Created during PR #98 review | Pre-existing; 2 security agents flagged |
