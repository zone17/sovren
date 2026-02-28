---
status: complete
priority: p3
issue_id: 601
tags: [code-review, ci, performance]
dependencies: []
---

# Add Docker Image Caching to CI Integration Test Job

## Problem Statement

Every CI run cold-pulls postgres:16-alpine (~80MB) and redis:7-alpine (~15MB). Adding a cache step saves 5-15 seconds per run and protects against Docker Hub rate limits.

## Proposed Solutions

Add before the test step in `.github/workflows/ci.yml`:

```yaml
- name: Pre-pull test container images
  run: docker pull postgres:16-alpine & docker pull redis:7-alpine & wait
```

Or use `ScribeMD/docker-cache` action for proper caching.

- **Effort:** Small (3-5 lines)
- **File:** `.github/workflows/ci.yml`

## Resources

- PR: #110
