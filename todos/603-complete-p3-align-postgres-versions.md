---
status: complete
priority: p3
issue_id: 603
tags: [code-review, testing, ci]
dependencies: []
---

# Align PostgreSQL Versions Across CI and Testcontainers

## Problem Statement

CI backend unit tests use postgres:15-alpine (service container). Testcontainers integration tests use postgres:16-alpine. Docker Compose also uses 15-alpine. Version skew could cause behavior differences.

## Proposed Solutions

Either upgrade all to 16-alpine or document the intentional difference.

- **Effort:** Small
- **Files:** `.github/workflows/ci.yml`, `docker-compose.yml`, `docker-compose.dev.yml`

## Resources

- PR: #110
- 2/7 agents flagged (pattern-recognition P2, architecture P3)
