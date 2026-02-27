---
status: pending
priority: p1
issue_id: '553'
tags: [code-review, ci-cd, security, pr-104]
---

# Test gate passes when `changes` job fails — bypasses all tests

## Problem Statement

If the `changes` job (dorny/paths-filter) fails due to network error, checkout failure, or action bug, all three test jobs (`test-backend`, `test-frontend`, `test-integration`) are skipped because their `needs: [changes]` dependency was never satisfied. The `test-gate` aggregator treats all-skipped as passing, allowing a PR to merge with zero tests run.

## Findings

- **2/2 agents flagged** (security-sentinel, architecture-strategist)
- The `test-gate` job's `needs` array does not include `changes`
- No guard clause checks whether change detection itself succeeded
- Real-world failure mode documented in GitHub Actions postmortems

## Proposed Solutions

### Option A: Add `changes` to test-gate needs + guard clause (Recommended)

```yaml
test-gate:
  needs: [changes, test-backend, test-frontend, test-integration]
  if: always()
  steps:
    - name: Verify change detection succeeded
      run: |
        if [[ "${{ needs.changes.result }}" == "failure" ]]; then
          echo "Change detection failed — cannot skip tests safely"
          exit 1
        fi
    - name: Evaluate test results
      # ... existing logic
```

- **Effort**: Tiny (3 lines)
- **Risk**: None

## Acceptance Criteria

- [ ] `changes` added to test-gate `needs` array
- [ ] Guard clause fails test-gate if changes job result is `failure`
