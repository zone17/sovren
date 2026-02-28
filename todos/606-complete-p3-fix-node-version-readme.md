---
status: complete
priority: p3
issue_id: 606
tags: [code-review, documentation]
dependencies: []
---

# Fix Node Version in Backend README (18 -> 20)

## Problem Statement

`packages/backend/README.md` says "Node.js 18+" but `.nvmrc` specifies Node 20 and `package.json` requires `>=20.0.0`. Agents and developers reading the README would install the wrong version.

## Proposed Solutions

Update README prerequisite to "Node.js 20+".

- **Effort:** Small (1 line)
- **File:** `packages/backend/README.md`

## Resources

- PR: #110
