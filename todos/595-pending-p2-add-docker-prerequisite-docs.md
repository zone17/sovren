---
status: pending
priority: p2
issue_id: 595
tags: [code-review, documentation, agent-native]
dependencies: []
---

# Add Docker Prerequisite Documentation to CLAUDE.md

## Problem Statement

The `npm run test:integration` command requires Docker daemon running (testcontainers pulls postgres:16-alpine and redis:7-alpine). CLAUDE.md documents the command with zero prerequisite information, causing agents and developers to hit cryptic Docker connection errors.

**Why it matters:** Agent-native blocker — any agent attempting integration tests will fail without this context.

## Findings

- **agent-native reviewer** flagged as "Must Fix" (highest priority finding)
- CLAUDE.md line 54: `npm run test:integration` listed without prereqs
- First run downloads ~150MB of container images

## Proposed Solutions

### Solution A: Add Prerequisites to CLAUDE.md Testing Section (Recommended)

Add after the test commands:

```markdown
### Prerequisites

- Docker Desktop (or Docker Engine) must be running for `test:integration`
  - testcontainers auto-pulls postgres:16-alpine and redis:7-alpine
  - First run downloads ~150MB of container images
```

Update the integration test line:

```markdown
# Run integration tests (requires Docker running — uses testcontainers)

npm run test:integration
```

- **Effort:** Small (5 lines)
- **Risk:** None

## Acceptance Criteria

- [ ] CLAUDE.md Testing section includes Docker prerequisite
- [ ] `test:integration` command has inline note about Docker requirement

## Work Log

| Date       | Action                      | Learnings                                        |
| ---------- | --------------------------- | ------------------------------------------------ |
| 2026-02-28 | Created from PR #110 review | Agent-native: document all external dependencies |

## Resources

- PR: #110
