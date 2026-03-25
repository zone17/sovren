---
title: 'chore: Establish CI/CD Governance & Branching Strategy for Concurrent Squads'
type: chore
date: 2026-02-26
priority: P1
scope: infrastructure
squads: [Squad A (backend), Squad B (frontend)]
---

# CI/CD Governance & Branching Strategy

## Overview

Before Sprint 0 kicks off with 2 concurrent squads, establish enforced (not merely documented) CI/CD governance: GitHub Rulesets with merge queue on `main`, CODEOWNERS for squad ownership, aggregator CI pattern for monorepo path-gating, hotfix lane, and a single-source-of-truth branching strategy doc.

## Problem Statement

After 20+ sprints, the repo has strong CI automation (14 workflows) but weak governance:

1. **Branch protection is documented but NOT enforced** — direct pushes to main with `--admin` bypass throughout every sprint
2. **No merge queue** — concurrent PRs collide, causing the merge conflicts we've fought every sprint
3. **No CODEOWNERS** — no enforced reviewer ownership per package
4. **quality-gates.yml has a bug** — `Update PR status` step posts `state: 'success'` unconditionally (lines 517-530), making the gate check illusory
5. **`develop` branch in CI triggers but never used** — creates confusion, wastes CI minutes if accidentally created
6. **No hotfix lane** — no priority path when production breaks while PRs are queued
7. **Contradictory docs** — 3 different files describe 3 different branching models

With 2 squads working concurrently, these gaps will produce daily merge conflicts, blocked PRs, and governance theater.

## Proposed Solution

### Branching Model: Trunk-Based Development with Merge Queue

```
main (protected, merge-queue only)
  ^
  |-- feat/squad-a/TICKET-123-payment-webhooks    (1-3 days)
  |-- feat/squad-b/TICKET-456-feed-pagination      (1-3 days)
  |-- fix/squad-a/TICKET-789-null-session           (< 1 day)
  |-- hotfix/TICKET-999-critical-auth-bypass        (hours)
```

- **No `develop` branch.** Remove from all CI triggers.
- **Feature branches live 1-3 days max.** Large features use stacked PRs (Part 1 → Part 2 → Part 3), each merging independently.
- **All merges to main go through the merge queue.** No direct pushes, no admin bypass, no exceptions except hotfix lane.

### Architecture

```
Developer pushes feat/squad-a/TICKET-123
  → Opens PR targeting main
  → CI runs: ci.yml (merge_group + pull_request triggers)
  → CODEOWNERS assigns reviewer from Squad A
  → 1 reviewer approves
  → Developer clicks "Merge when ready" (enters merge queue)
  → Merge queue creates: gh-readonly-queue/main/pr-123-SHA
  → CI re-runs against main + all queued PRs ahead
  → All checks pass → squash merge to main
  → Head branch auto-deleted
  → Staging auto-deploys
```

## Technical Approach

### Phase 1: Prerequisites (fix before activating governance)

- [x] **Fix quality-gates.yml `Update PR status` bug**
  - File: `.github/workflows/quality-gates.yml` lines 517-530
  - Change: `state: 'success'` → post actual gate result based on `FAILED` variable
  - This is a one-line fix but critical — without it, the required check is illusory

- [x] **Add `merge_group` trigger to all CI workflows**
  - Files: `.github/workflows/ci.yml`, `.github/workflows/quality-gates.yml`
  - Add `merge_group: { types: [checks_requested] }` alongside existing `pull_request` trigger
  - Without this, merge queue entries timeout waiting for checks that never run

- [x] **Create aggregator `test-gate` job in ci.yml**
  - Add `dorny/paths-filter@v3` to detect which packages changed
  - Make `test-backend` and `test-frontend` conditional on path changes
  - Add `test-gate` job with `if: always()` that:
    - Reads `needs.test-backend.result` and `needs.test-frontend.result`
    - Maps `skipped` → `success` (unchanged package = pass)
    - Maps `failure` or `cancelled` → `exit 1`
  - Register ONLY `test-gate` (plus `lint`, `typecheck`) as required status checks
  - This prevents frontend-only PRs from being blocked by "backend tests pending"

- [x] **Remove `develop` from all CI workflow triggers**
  - Files: `ci.yml`, `quality-gates.yml`, `security-scan.yml`, `docker-build-push.yml`, `docker-security-scan.yml`, `database-migrations.yml`, `dependency-audit.yml`
  - Remove `develop` from both `push.branches` and `pull_request.branches` arrays
  - Delete the `develop` branch from remote if it exists: `git push origin :develop`

- [x] **Ensure all open PRs are merged or closed** (verified in pre-sprint cleanup — 0 open PRs)
  - Run: `gh pr list --state open`
  - Merge or close everything before activating Rulesets
  - This is the migration freeze window — communicate to both squads

### Phase 2: GitHub Configuration (activate governance)

- [x] **Enable auto-delete head branches**

  ```bash
  gh repo edit zone17/sovren --delete-branch-on-merge
  ```

- [x] **Disable merge commits and rebase merging (squash-only)**

  ```bash
  gh api -X PATCH /repos/zone17/sovren \
    -f allow_merge_commit=false \
    -f allow_rebase_merge=false \
    -f allow_squash_merge=true \
    -f squash_merge_commit_title="PR_TITLE" \
    -f squash_merge_commit_message="PR_BODY"
  ```

- [x] **Create GitHub Ruleset on `main`**
  - Create `scripts/setup-ruleset.sh` with the `gh api` call
  - Ruleset configuration:

  | Setting                    | Value                                                | Rationale                                                   |
  | -------------------------- | ---------------------------------------------------- | ----------------------------------------------------------- |
  | Required approvals         | 1                                                    | CODEOWNERS ensures it's the right person                    |
  | Dismiss stale reviews      | Yes                                                  | New commits invalidate old approvals                        |
  | Require CODEOWNERS review  | Yes                                                  | Squad ownership enforcement                                 |
  | Require last push approval | Yes                                                  | Prevents self-approval of final commit                      |
  | Required status checks     | `CI / test-gate`, `CI / lint`, `CI / typecheck`      | Aggregator pattern — individual job names can change freely |
  | Strict up-to-date          | No                                                   | Merge queue handles this — enabling both is redundant       |
  | Merge queue                | SQUASH, ALLGREEN, max 5 builds, min 1, timeout 45min | Serial-safe with headroom for slow integration tests        |
  | Linear history             | Yes                                                  | Enforces squash — clean `git bisect` and rollback           |
  | Block force pushes         | Yes, no exceptions                                   | Makes merge queue FIFO guarantee meaningful                 |
  | Block deletions            | Yes                                                  | `main` is indestructible                                    |
  | Bypass actors              | Admin role, pull_request mode only                   | Hotfix lane — still requires PR + passing checks            |

- [x] **Create `.github/CODEOWNERS`**

  ```
  # Default — tech leads review anything unmapped
  *                                   @zone17/tech-leads

  # Squad A: Backend
  /packages/backend/                  @zone17/squad-a
  /packages/shared/                   @zone17/squad-a @zone17/squad-b

  # Squad B: Frontend
  /packages/frontend/                 @zone17/squad-b

  # Testing infra — both squads
  /packages/testing/                  @zone17/squad-a @zone17/squad-b

  # CI/CD and infrastructure — tech leads
  /.github/                           @zone17/tech-leads
  /scripts/                           @zone17/tech-leads
  /docker/                            @zone17/tech-leads
  /supabase/                          @zone17/tech-leads
  Dockerfile*                         @zone17/tech-leads

  # Root config — tech leads
  /package.json                       @zone17/tech-leads
  /package-lock.json                  @zone17/tech-leads
  /tsconfig*.json                     @zone17/tech-leads
  /vitest.config.ts                   @zone17/tech-leads
  /eslint.config.*                    @zone17/tech-leads

  # Security-sensitive — requires tech lead
  /packages/backend/src/middleware/auth*    @zone17/tech-leads
  /packages/backend/src/services/payment/  @zone17/tech-leads
  /packages/backend/src/utils/ssrf*        @zone17/tech-leads
  ```

  **Note:** GitHub teams (`@zone17/squad-a`, `@zone17/squad-b`, `@zone17/tech-leads`) must exist before CODEOWNERS takes effect. If the org doesn't have formal teams yet, use individual usernames as a stopgap.

### Phase 3: Documentation & Conventions

- [x] **Create `docs/development/BRANCHING_STRATEGY.md`** — single source of truth
  - Branch naming: `{type}/{squad}/{ticket}-{slug}`
  - Types: `feat`, `fix`, `hotfix`, `chore`, `refactor`, `docs`
  - Squads: `squad-a`, `squad-b` (or omit squad prefix for solo/infra work)
  - Branch lifetime: 1-3 days max, use stacked PRs for larger work
  - Merge method: squash only, via merge queue
  - Hotfix lane: admin bypass (PR-only mode), still requires 1 review + passing CI
  - Shared package protocol: Interface-First PR pattern
  - Claude Code PRs: always require human reviewer from relevant squad

- [x] **Create `docs/development/SHARED_PACKAGE_PROTOCOL.md`**
  - When modifying `packages/shared/`: open a dedicated PR with ONLY the shared change
  - Do NOT combine shared changes with consumer changes in the same PR
  - Both squad leads are auto-requested via CODEOWNERS
  - Once merged, dependent PRs rebase against new main
  - Breaking changes require an ADR in `docs/decisions/` before the PR

- [x] **Create `docs/development/HOTFIX_PROCEDURE.md`**
  - Step 1: Create `hotfix/TICKET-{id}-{slug}` branch from `main`
  - Step 2: Open PR targeting `main`, add label `hotfix`
  - Step 3: Admin approves and merges via bypass (skips merge queue, still requires review + CI)
  - Step 4: All queued PRs auto-rebase against new main HEAD
  - Step 5: Post-mortem within 24 hours if production impact

- [x] **Update `CLAUDE.md` — replace branching section**
  - Remove current "Branch Scope" section (3 lines)
  - Add reference to `docs/development/BRANCHING_STRATEGY.md`
  - Add: "All merges to main go through the merge queue. No `--admin` bypass except hotfix lane."
  - Add: "Branch naming: `{type}/{squad}/{ticket}-{slug}`"
  - Update PR merge command: `gh pr merge --auto --squash` (auto-merge enters queue)
  - Remove any references to `develop` branch

- [x] **Update agent briefs template in CLAUDE.md**
  - Add to CONTEXT TO LOAD section: `Read docs/development/BRANCHING_STRATEGY.md`
  - Add to QUALITY STANDARDS: "PR must pass merge queue — no --admin bypass"

### Phase 4: Automation

- [x] **Create `.github/workflows/branch-cleanup.yml`**
  - Schedule: Sundays at 02:00 UTC
  - Deletes remote branches merged to main (via GitHub API `merged` state, not `git branch --merged`)
  - Excludes `main` and any `hotfix/*` branches less than 7 days old
  - Posts summary to PR or Slack

- [x] **Add branch naming check to CI**
  - In `ci.yml`, add a `branch-name` job on `pull_request` events
  - Validates `github.head_ref` matches regex: `^(feat|fix|hotfix|chore|refactor|docs)/(squad-[ab]/)?[A-Z]+-\d+-[a-z0-9-]+$`
  - Warning (not blocking) for first 2 weeks, then required
  - Exclude Dependabot branches (`dependabot/**`) from the check

### Phase 5: Verification

- [ ] **Test the full merge queue flow**
  - Create 2 test PRs from different "squads"
  - Verify both enter the queue and merge serially
  - Verify the second PR's CI runs against main + first PR's changes
  - Verify head branches are auto-deleted after merge

- [ ] **Test the hotfix bypass**
  - With 1 PR in the queue, create a hotfix PR
  - Verify admin can bypass the queue (merge directly via PR)
  - Verify the queued PR rebases against the new main HEAD

- [ ] **Test CODEOWNERS enforcement**
  - PR touching `packages/backend/` → must be approved by squad-a member
  - PR touching `packages/shared/` → must be approved by both squads
  - PR touching `.github/` → must be approved by tech-leads

- [ ] **Test path-gated CI**
  - PR touching only `packages/frontend/` → backend tests skipped, `test-gate` passes
  - PR touching `packages/shared/` → both backend and frontend tests run

- [ ] **Verify no direct push to main**
  - Attempt `git push origin main` → should be rejected
  - Attempt `git push --force origin main` → should be rejected

## Decisions Made

| Question                         | Decision                                      | Rationale                                                         |
| -------------------------------- | --------------------------------------------- | ----------------------------------------------------------------- |
| Required status checks           | `test-gate`, `lint`, `typecheck` only         | Aggregator pattern — individual job names can change freely       |
| Hotfix bypass scope              | Merge queue only (still requires review + CI) | Security — unverified code should never land in main              |
| `develop` branch                 | Remove from all triggers                      | Never used, contradicts actual workflow, wastes CI minutes        |
| Merge queue timeout              | 45 minutes                                    | `test-integration` can take 30min; 45min provides headroom        |
| Merge queue batching             | Max 5 builds simultaneously, min 1 to merge   | Serial-safe start; can increase after monitoring queue throughput |
| Branch naming enforcement        | CI check (warning → required after 2 weeks)   | Gives teams time to adopt; enforced before it drifts              |
| CODEOWNERS for root configs      | Tech leads                                    | Root configs affect all squads; tech leads arbitrate              |
| CODEOWNERS for `packages/shared` | Both squads                                   | Shared code = shared responsibility                               |
| Claude Code PRs                  | Always require human reviewer                 | Bot cannot self-approve; CODEOWNERS ensures domain expert reviews |
| Blue-green deployment stubs      | OUT OF SCOPE                                  | Separate prerequisite; governance doc will note it explicitly     |
| Documentation gate               | Advisory, not required                        | Auto-generated commits (deps, agents) shouldn't need CHANGELOG    |

## Acceptance Criteria

### Functional Requirements

- [ ] GitHub Ruleset active on `main` with merge queue enabled
- [ ] Direct push to `main` is rejected (including admin)
- [ ] Force push to `main` is rejected (including admin)
- [ ] PRs require 1 CODEOWNERS-compliant approval
- [ ] Merge queue serializes concurrent PRs (no more merge conflicts on main)
- [ ] Path-gated CI: frontend-only PRs don't wait for backend tests
- [ ] Head branches auto-deleted after squash merge
- [ ] Hotfix lane works: admin can bypass queue via PR with review + CI

### Documentation Requirements

- [ ] `docs/development/BRANCHING_STRATEGY.md` exists and is the single source of truth
- [ ] `docs/development/SHARED_PACKAGE_PROTOCOL.md` exists
- [ ] `docs/development/HOTFIX_PROCEDURE.md` exists
- [ ] `CLAUDE.md` updated with new branching conventions
- [ ] `.github/CODEOWNERS` covers 100% of the file tree

### Quality Gates

- [ ] `quality-gates.yml` bug fixed (no unconditional `state: 'success'`)
- [ ] `develop` removed from all CI workflow triggers
- [ ] `merge_group` trigger present on all required-check workflows
- [ ] `test-gate` aggregator job works correctly for path-gated tests

## Dependencies & Risks

| Risk                                | Likelihood | Impact                      | Mitigation                                                      |
| ----------------------------------- | ---------- | --------------------------- | --------------------------------------------------------------- |
| GitHub teams don't exist yet        | High       | Blocks CODEOWNERS           | Create teams as Step 1, or use usernames as stopgap             |
| Required check name mismatch        | Medium     | Hard blocks all PRs         | Test exact job names in CI output before registering in Ruleset |
| Merge queue timeout too short       | Medium     | PRs ejected frequently      | Start at 45min, monitor, adjust                                 |
| In-flight PRs blocked by activation | High       | Disrupts both squads        | Coordinate 1-day freeze window; merge/close all PRs first       |
| Flaky tests cause ejection loops    | Medium     | Developer frustration       | Monitor ejection rate; invest in test stability separately      |
| CODEOWNERS too strict for solo work | Low        | Blocks single-person squads | Admin bypass exists for PRs; add cross-squad backup reviewers   |

## Files Changed

| File                                          | Action | Description                                                                              |
| --------------------------------------------- | ------ | ---------------------------------------------------------------------------------------- |
| `.github/workflows/ci.yml`                    | Edit   | Add `merge_group` trigger, add path-filter, add `test-gate` aggregator, remove `develop` |
| `.github/workflows/quality-gates.yml`         | Edit   | Fix `Update PR status` bug, add `merge_group` trigger, remove `develop`                  |
| `.github/workflows/security-scan.yml`         | Edit   | Remove `develop` from triggers                                                           |
| `.github/workflows/docker-build-push.yml`     | Edit   | Remove `develop` from triggers                                                           |
| `.github/workflows/docker-security-scan.yml`  | Edit   | Remove `develop` from triggers                                                           |
| `.github/workflows/database-migrations.yml`   | Edit   | Remove `develop` from triggers                                                           |
| `.github/workflows/dependency-audit.yml`      | Edit   | Remove `develop` from triggers                                                           |
| `.github/workflows/branch-cleanup.yml`        | Create | Scheduled stale branch deletion                                                          |
| `.github/CODEOWNERS`                          | Create | Squad ownership mapping                                                                  |
| `scripts/setup-ruleset.sh`                    | Create | Idempotent Ruleset configuration script                                                  |
| `docs/development/BRANCHING_STRATEGY.md`      | Create | Single source of truth                                                                   |
| `docs/development/SHARED_PACKAGE_PROTOCOL.md` | Create | Shared package change protocol                                                           |
| `docs/development/HOTFIX_PROCEDURE.md`        | Create | Hotfix lane documentation                                                                |
| `CLAUDE.md`                                   | Edit   | Update branching section, remove develop references                                      |

## References

### Internal

- `docs/solutions/patterns/common-solutions.md` #47-49 (branch cleanup patterns)
- `docs/solutions/infrastructure-issues/pr90-hook-migration-security-test-enforcement-20260221.md` (hook migration lessons)
- `docs/solutions/process-issues/p2-remediation-r5-hook-disaster-domain-agents-20260220.md` (hook quality gate anti-pattern)
- `docs/solutions/infrastructure-issues/quality-pipeline-vitest-migration-20260220.md` (CI pipeline failure case study)

### External

- [GitHub Docs — Managing a merge queue](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue)
- [GitHub Docs — Available rules for rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)
- [GitHub Docs — About CODEOWNERS](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners)
- [DevOps Directive — Required checks for conditional jobs in monorepos](https://devopsdirective.com/posts/2025/08/github-actions-required-checks-for-conditional-jobs/)
- [Trunk Based Development](https://trunkbaseddevelopment.com/)
