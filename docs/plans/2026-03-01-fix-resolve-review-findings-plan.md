---
title: 'fix: Resolve PR #117 Review Findings'
type: fix
date: 2026-03-01
---

# fix: Resolve PR #117 Review Findings

## Overview

Two deferred findings from the 8-agent review of PR #117 (CI/CD Pipeline Hardening). Both are well-specified with clear fixes.

## Finding 1: Shell Injection in CI (P2 — Todo #607)

### Problem

Lines 86, 90, 131, and 143 of `.github/workflows/ci.yml` interpolate `${{ steps.changed.outputs.files }}` directly into `run:` shell blocks. A malicious filename containing shell metacharacters could execute arbitrary commands on the runner.

### Fix

Use `env:` variable indirection at all 4 locations. Also fix grep on line 143 to use `-F` (fixed-string matching).

**Location 1 — ESLint (line 84-86):**

```yaml
- name: ESLint (changed files)
  if: steps.changed.outputs.count != '0'
  env:
    FILES: ${{ steps.changed.outputs.files }}
  run: npx eslint $FILES --no-error-on-unmatched-pattern
```

**Location 2 — Prettier (line 88-90):**

```yaml
- name: Prettier (changed files)
  if: steps.changed.outputs.count != '0'
  env:
    FILES: ${{ steps.changed.outputs.files }}
  run: npx prettier --check $FILES --no-error-on-unmatched-pattern
```

**Location 3 — TypeScript CHANGED var (line 131):**

```yaml
env:
  CHANGED: ${{ steps.changed.outputs.files }}
run: |
  ERRORS=0
  ...
```

**Location 4 — grep $FILE (line 143):**

```bash
FILE_ERRORS=$(echo "$TSC_OUTPUT" | grep -F "$FILE(" || true)
```

### Acceptance Criteria

- [x] No `${{ steps.changed.outputs.* }}` remains in any `run:` block
- [x] grep uses `-F` for fixed-string matching
- [ ] CI passes on the branch

## Finding 2: Stale Workflow References (P3 — Todo #608)

### Problem

PR #117 deleted 13 deprecated workflow files. Three active files still reference them by name. Agents following these docs would get "no such workflow" errors.

### Fix

Replace deleted workflow names with current `ci.yml` equivalents. For deployment commands (`gh workflow run`), note that these operations are now handled by:

- **CI quality gates**: `ci.yml` (automatic on PR/push)
- **Frontend deploy**: Vercel auto-deploy (no workflow needed)
- **Backend deploy**: Not yet consolidated (manual Docker deploy)
- **Rollback**: Manual process (no automated rollback workflow exists currently)

#### File A: `.claude/agents/project-orchestrator.md`

2 references to fix:

- Line 217: `gh workflow run backend-deployment.yml -f environment=production` → Add note that this workflow was removed; deployments use Vercel auto-deploy (frontend) and Docker (backend)
- Line 235: `gh workflow run automated-rollback.yml -f environment=production` → Note: automated rollback workflow removed; rollback requires manual Docker image revert

#### File B: `.claude/agents/DEPLOYMENT_INTEGRATION_TEMPLATE.md`

8+ references to fix:

- Lines 51, 57-58, 73: `backend-deployment.yml` → Update to note CI checks via `ci.yml`; deployment is via Vercel/Docker, not workflow
- Line 76: `automated-rollback.yml` → Manual rollback process
- Line 145: `release.yml` → Removed; Vercel auto-deploys frontend
- Lines 236, 279-280: Various deployment workflow references → Update to current state

#### File C: `docs/development/DEPLOYMENT_INTEGRATION_STANDARDS.md`

15+ references to fix:

- Line 78: `quality-gates.yml` → Now handled by `lint` + `typecheck` + `security` jobs in `ci.yml`
- Line 93: `security-scan.yml` → Now `security` job in `ci.yml`
- Lines 95-96: `docker-build-push.yml` → Now `docker` job in `ci.yml`
- Line 109: `backend-deployment.yml` → Vercel auto-deploys frontend; backend via Docker
- Line 117: `deploy-blue-green.yml` → Removed
- Line 135, 222, 394: `backend-deployment.yml` → Update
- Lines 279, 411, 414: `automated-rollback.yml` → Manual process
- Line 439: `promote-environment.yml` → Removed

### Acceptance Criteria

- [x] `project-orchestrator.md` references only existing workflows (`ci.yml`, `stale.yml`)
- [x] `DEPLOYMENT_INTEGRATION_TEMPLATE.md` updated to current CI/deployment structure
- [x] `DEPLOYMENT_INTEGRATION_STANDARDS.md` updated
- [x] Historical/archive docs left as-is
- [x] No grep hits for deleted workflow filenames in the 3 updated files

## Implementation Order

1. Fix shell injection in `ci.yml` (P2 — higher priority, smaller change)
2. Update stale refs in 3 doc files (P3 — larger but lower risk)
3. Commit together as single PR commit on existing branch `ci/squad-a/ci-hardening-multi-squad`

## Effort

Small-Medium (~30 minutes). Both fixes are mechanical — no design decisions needed.
