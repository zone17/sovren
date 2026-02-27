---
status: complete
priority: p1
issue_id: '552'
tags: [code-review, ci-cd, architecture, pr-104]
---

# quality-gates.yml fully duplicates ci.yml — doubles CI cost

## Problem Statement

`quality-gates.yml` and `ci.yml` both trigger on `pull_request` and `merge_group`, running duplicate lint, typecheck, tests, build, Docker, and E2E jobs. Every PR runs ~250 lines of identical checks twice, doubling CI minutes with zero additional value. The ruleset only requires `CI / *` status checks — quality-gates results are advisory and unblocking.

Additionally, quality-gates.yml doesn't use the composite `setup-node` action (7 inline setups risk Node version drift), uses `upload-artifact@v3` (deprecated), and has unconditional `cancel-in-progress: true`.

## Findings

- **4/4 review agents flagged** (security, architecture, patterns, simplicity)
- quality-gates.yml: 540 lines, ~250 duplicated with ci.yml
- Not in required status checks — purely advisory
- Doesn't use composite action — risks Node version drift from `.nvmrc`
- Postgres image inconsistency: `15-alpine` (ci.yml) vs `15` (quality-gates.yml)
- `continue-on-error: false` repeated 6x (it's the default)
- quality-gate aggregator has dead default assignment bug (line 479)

## Proposed Solutions

### Option A: Delete quality-gates.yml entirely (Recommended)

- ci.yml already covers all required checks
- Move any unique checks (Snyk, CodeQL, Lighthouse, doc validation) to ci.yml as optional jobs
- **Pros**: Eliminates all duplication, halves CI cost
- **Effort**: Small
- **Risk**: Low — no required checks depend on quality-gates.yml

### Option B: Make quality-gates.yml workflow_call-only

- Remove `pull_request` and `merge_group` triggers
- Keep `workflow_dispatch` and `workflow_call` for on-demand audits
- **Pros**: Preserves the workflow for manual use
- **Effort**: Small
- **Risk**: Low

## Acceptance Criteria

- [ ] No duplicate lint/typecheck/test/build runs per PR
- [ ] All unique quality-gates checks preserved (moved or kept as on-demand)
- [ ] CI minutes per PR reduced by ~50%
