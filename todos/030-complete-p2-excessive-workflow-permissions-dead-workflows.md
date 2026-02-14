---
status: pending
priority: p2
issue_id: '030'
tags: [code-review, security, ci-cd, simplicity]
dependencies: []
---

# Excessive GH Actions Permissions + Dead Workflow Files

## Problem Statement

Two issues:

1. **Excessive permissions**: `credential-rotation-vault.yml:44-48` grants `actions: write` allowing workflow modification. This enables privilege escalation if the rotation script is compromised.

2. **Dead workflow files** (~3,500 lines): 8 workflows with no working integrations:
   - `ai-enhanced-ci.yml` (767 lines) - Requires OpenAI, no integration exists
   - `autonomous-cicd.yml` (690 lines) - "Self-optimizing" pipeline, aspirational
   - `ai-dependency-management.yml` (647 lines) - Dependabot does this in 20 lines
   - `ai-performance-optimization.yml` (289 lines) - No AI integration
   - `credential-rotation-vault.yml` (388 lines) - No Vault in use
   - `credential-rotation.yml` (284 lines) - References non-existent AWS
   - `deploy-blue-green.yml` (315 lines) - No deployment target
   - `validate-secrets.yml` (453 lines) - 10-line shell check suffices

## Findings

- **security-sentinel**: HIGH-03 - excessive permissions
- **code-simplicity-reviewer**: ~3,500 lines removable across 8 workflows

## Proposed Solutions

1. Remove `actions: write` from credential rotation workflow
2. Delete the 8 non-functional workflow files
3. Keep: ci.yml, docker-build-push.yml, backend-deployment.yml, security-scan.yml, release.yml, automated-rollback.yml

**Effort**: Small | **Risk**: None (workflows are non-functional)

## Acceptance Criteria

- [ ] No workflow has `actions: write` permission
- [ ] Dead workflow files removed
- [ ] Remaining workflows all reference real, configured services
