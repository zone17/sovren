---
title: 'PR #117: CI/CD Pipeline Hardening & Consolidation'
date: '2026-03-01'
category: infrastructure-issues
tags:
  - ci-cd
  - github-actions
  - shell-injection
  - pipeline-consolidation
  - security
  - workflow-management
module: .github/workflows
symptoms:
  - 13 deprecated workflows cluttering .github/workflows/
  - Shell injection risk via ${{ }} in run: blocks
  - No fan-in job — 3 separate required checks block merge on path-filtered skips
  - cancel-in-progress cancels main push deploys
  - Empty JS chunks pass build step undetected
  - Stale workflow references in agent docs cause "no such workflow" errors
related_prs:
  - 117
  - 111
  - 112
  - 113
  - 114
  - 115
  - 116
sprint: '2026-03-01'
effort: medium
---

# PR #117: CI/CD Pipeline Hardening & Consolidation

## Problem Statement

After PRs #111-#116 fixed all CI gates (lint, typecheck, tests, E2E, Vercel), the pipeline was green but had 10 structural gaps that would cause friction as multiple squads begin concurrent development. This was the final hardening pass before multi-squad work begins.

### Symptoms

1. **Path-filtered job skips blocked merge** — 3 separate required checks meant a docs-only PR waited forever for the test job that was correctly skipped
2. **Shell injection risk** — `${{ steps.changed.outputs.files }}` directly in `run:` blocks at 4 locations in `ci.yml` (a malicious filename with shell metacharacters could execute arbitrary commands)
3. **13 deprecated workflows** — all `workflow_dispatch` only, fully superseded by `ci.yml`, cluttering the Actions UI and confusing agents
4. **No Dependabot config** — manual dependency patching
5. **`cancel-in-progress` on main pushes** — could cancel staging deploy mid-flight
6. **No empty chunk detection** — repeat of PR #116 treeshake bug possible
7. **No CodeQL SAST** — no static analysis for XSS, injection
8. **Husky deprecated shim lines** — will break on husky v10
9. **No stale PR automation** — branch/PR accumulation across squads
10. **Stale workflow references in docs** — 3 active files referenced deleted workflow filenames

## Investigation Steps

1. **8-agent parallel review** of PR #117 initial implementation found 47 raw items → 14 unique findings after dedup
2. **Shell injection** identified by security-sentinel: `${{ }}` expressions in `run:` blocks are vulnerable to script injection (GitHub Security Lab documented pattern)
3. **Stale refs** found by pattern-recognition-specialist: grep for 13 deleted workflow filenames across active docs
4. **Review consensus**: 6+ agents agreed on both P2 (shell injection) and P3 (stale refs)

## Root Cause

### Shell Injection (P2)

GitHub Actions expressions (`${{ }}`) in `run:` blocks are evaluated before the shell runs, meaning their content is injected directly into the script. If `steps.changed.outputs.files` contains a filename like `"; rm -rf / #`, it becomes part of the shell command.

### Stale Workflow References (P3)

PR #117 Phase 2 deleted 13 deprecated workflows but didn't update the 3 active agent/doc files that referenced them by name.

## Solution

### Phase 1: Multi-Squad Readiness (ci.yml)

**1. Fan-in job (`CI Complete`)** — Single aggregator with `if: always()` and `needs` array. Branch protection requires only `CI / CI Complete`. Path-filtered skips report as "skipped" (not "failed"), fan-in treats skipped as success.

```yaml
ci-complete:
  name: CI Complete
  runs-on: ubuntu-latest
  needs: [lint, typecheck, security, test-gate, build, e2e]
  if: always()
  steps:
    - name: Evaluate results
      run: |
        for r in "${{ needs.lint.result }}" "${{ needs.typecheck.result }}" \
                 "${{ needs.security.result }}" "${{ needs.test-gate.result }}" \
                 "${{ needs.build.result }}" "${{ needs.e2e.result }}"; do
          if [[ "$r" == "failure" || "$r" == "cancelled" ]]; then
            echo "::error::CI failed — a required job reported: $r"
            exit 1
          fi
        done
```

**2. Empty chunk detection** — Post-build verification that JS chunks are non-empty (catches treeshake regressions like PR #116).

```yaml
- name: Verify JS chunks are non-empty
  run: |
    EMPTY=$(find packages/frontend/dist/assets/js -name '*.js' -size -10c | wc -l | tr -d ' ')
    if [ "$EMPTY" -gt 5 ]; then
      echo "::error::$EMPTY JS chunks are nearly empty"
      exit 1
    fi
```

**3. Concurrency safety** — Gate `cancel-in-progress` on event type so main pushes (which trigger deploys) are never cancelled mid-flight.

```yaml
cancel-in-progress: ${{ github.event_name == 'pull_request' || github.event_name == 'merge_group' }}
```

**4. CodeQL SAST** — Added as push-to-main + weekly cron job (not on every PR — too slow for CI feedback loop).

### Phase 2: Hygiene & Automation

**5. Deleted 13 deprecated workflows** — All were `workflow_dispatch` only, fully superseded by `ci.yml`. Git history preserves them.

**6. Dependabot config** — Weekly npm + GitHub Actions updates with grouped PRs (dev vs production deps), major version updates ignored.

**7. Stale PR automation** — Weekly Monday 9am UTC check, 7-day stale warning, 14-day auto-close. `pinned` and `wip` labels exempt.

**8. Husky deprecation fix** — Removed `#!/usr/bin/env sh` and `. "$(dirname -- "$0")/_/husky.sh"` shim lines from all hook files.

### Phase 3: Review Findings Fix (P2 + P3)

**9. Shell injection fix** — 4 locations in `ci.yml` changed from direct `${{ }}` interpolation to `env:` variable indirection:

```yaml
# BEFORE (vulnerable)
run: npx eslint ${{ steps.changed.outputs.files }}

# AFTER (safe — env: evaluated before shell, not interpolated into it)
env:
  FILES: ${{ steps.changed.outputs.files }}
run: npx eslint $FILES
```

Also fixed `grep "$FILE("` → `grep -F "$FILE("` (prevents regex metacharacter interpretation).

**10. Stale workflow reference cleanup** — Updated 4 active files:

- `.claude/agents/project-orchestrator.md` (2 refs)
- `.claude/agents/DEPLOYMENT_INTEGRATION_TEMPLATE.md` (9 refs)
- `docs/development/DEPLOYMENT_INTEGRATION_STANDARDS.md` (17+ refs)
- `CLAUDE.md` (3 refs — bonus beyond plan scope)

All `backend-deployment.yml`, `automated-rollback.yml`, `release.yml`, `quality-gates.yml`, etc. replaced with current equivalents (Vercel auto-deploy, Docker image promotion, `ci.yml` job names).

## Results

- **PR #117 merged** via `gh pr merge --auto --squash` through merge queue
- **Post-merge CI passed** (run 22544281836)
- **Net change**: -4,561 lines (13 workflow deletions), +817 lines (new jobs, configs, doc updates)
- **Pipeline**: 1 active workflow (`ci.yml`) + 2 automation workflows (`stale.yml`, `dependabot.yml`)
- **Review**: 8-agent review → 47 raw items → 14 unique → 12 fixed before merge, 2 deferred → both resolved in follow-up commit

## Prevention Strategies

### 1. GitHub Actions Script Injection

- **Rule**: Never use `${{ }}` expressions directly in `run:` blocks. Always use `env:` indirection.
- **Detection**: `grep -n '\${{.*}}' .github/workflows/*.yml` in `run:` contexts
- **Exception**: `${{ needs.*.result }}` in fan-in evaluation is safe (GitHub-controlled, not user input)

### 2. Fan-In Job for Branch Protection

- **Rule**: Single required check (`CI / CI Complete`) with `if: always()` and `needs` array covering all quality jobs
- **Why**: Path-filtered jobs that skip correctly report as "skipped" — without fan-in, branch protection waits forever for a check that will never run

### 3. Post-Workflow-Deletion Reference Audit

- **Rule**: After deleting workflow files, grep all active docs/agents for the deleted filenames
- **Command**: `grep -rn "deleted-workflow.yml" .claude/ docs/ CLAUDE.md`

### 4. Build Output Verification

- **Rule**: Always verify build output is non-trivial (non-empty chunks, expected file count)
- **Why**: Treeshake regressions produce valid builds with empty files — tests pass because they import from source, not from the build

## Key Patterns

| Pattern                             | Category        | Details                              |
| ----------------------------------- | --------------- | ------------------------------------ |
| `env:` indirection for `${{ }}`     | CI Security     | common-solutions.md #68              |
| Fan-in aggregator job               | CI Architecture | common-solutions.md #69              |
| Event-gated `cancel-in-progress`    | CI Safety       | common-solutions.md #70              |
| Build output non-empty verification | CI Quality      | Already documented in #66 (extended) |

## Files Changed

- `.github/workflows/ci.yml` — fan-in job, CodeQL, chunk detection, concurrency fix, env: indirection
- `.github/dependabot.yml` — new
- `.github/workflows/stale.yml` — new
- `.husky/pre-commit`, `.husky/commit-msg`, `.husky/pre-push` — deprecated shim removal
- `.claude/agents/project-orchestrator.md` — stale ref cleanup
- `.claude/agents/DEPLOYMENT_INTEGRATION_TEMPLATE.md` — stale ref cleanup
- `docs/development/DEPLOYMENT_INTEGRATION_STANDARDS.md` — stale ref cleanup
- `CLAUDE.md` — stale ref cleanup
- 13 deprecated workflow files deleted

## Cross-References

- [PR #111: CI/CD Zero Failures](./pr111-cicd-pipeline-zero-failures-20260228.md) — predecessor that fixed all CI gates
- [PR #112-#116: E2E Pipeline Fix](../build-errors/) — E2E and Vercel fixes preceding this hardening
- [common-solutions.md #62-#67](../patterns/common-solutions.md) — prior CI patterns from the same pipeline work
- [critical-patterns.md #8](../patterns/critical-patterns.md) — test infrastructure CI integration
