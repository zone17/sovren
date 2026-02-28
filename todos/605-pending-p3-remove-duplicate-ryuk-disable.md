---
status: pending
priority: p3
issue_id: 605
tags: [code-review, cleanup]
dependencies: []
---

# Remove Duplicate TESTCONTAINERS_RYUK_DISABLED Setting

## Problem Statement

Ryuk is disabled in both the global setup code (line 9) and CI env var (ci.yml line 265). The code-level disable is sufficient for both local and CI. Having both is redundant.

## Proposed Solutions

Keep the code-level disable in `testcontainers-global-setup.ts`, remove from CI env.

- **Effort:** Small (1 line removal)
- **Files:** `.github/workflows/ci.yml`

## Resources

- PR: #110
