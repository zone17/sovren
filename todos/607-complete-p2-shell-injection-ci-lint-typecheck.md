---
status: complete
priority: p2
issue_id: 607
tags: [code-review, security, ci]
dependencies: []
---

# Shell Injection via Unquoted `${{ steps.changed.outputs.files }}` in CI

## Problem Statement

The `lint` and `typecheck` jobs in `.github/workflows/ci.yml` interpolate step outputs directly into `run:` shell commands using `${{ }}` syntax. This is a textbook GitHub Actions script injection pattern — a malicious filename containing shell metacharacters could execute arbitrary commands on the runner.

Pre-existing from PR #111. Affects 4 locations: ESLint (line 86), Prettier (line 90), tsc CHANGED var (line 131), and grep `$FILE` (line 143).

## Findings

- **Security sentinel**: P1 — documented as GitHub's script injection anti-pattern
- **Pattern recognition**: P2 — confirmed in ESLint and Prettier commands
- **Consensus**: 2/8 agents flagged independently

## Proposed Solutions

### Option A: Use `env:` variables (Recommended)

Assign `${{ steps.changed.outputs.files }}` to an `env:` variable and reference it as `$FILES` in the shell script. This prevents GitHub Actions from interpolating the value as shell syntax.

```yaml
- name: ESLint (changed files)
  if: steps.changed.outputs.count != '0'
  env:
    FILES: ${{ steps.changed.outputs.files }}
  run: npx eslint $FILES --no-error-on-unmatched-pattern
```

Apply to all 4 locations.

**Pros**: Standard fix, minimal change, well-documented by GitHub
**Cons**: None
**Effort**: Small (4 edits)
**Risk**: Low

## Acceptance Criteria

- [ ] All `${{ steps.changed.outputs.* }}` in `run:` blocks use `env:` indirection
- [ ] grep `$FILE` in typecheck uses fixed-string matching (`grep -F`) or proper quoting
- [ ] No direct `${{ }}` interpolation remains in any `run:` block

## Work Log

| Date       | Action                                 | Learnings                 |
| ---------- | -------------------------------------- | ------------------------- |
| 2026-03-01 | Created from 8-agent review of PR #117 | Pre-existing from PR #111 |
