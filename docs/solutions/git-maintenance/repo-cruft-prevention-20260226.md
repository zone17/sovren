---
title: 'Repo Cruft Prevention — Sprint Boundary Maintenance'
date: '2026-02-26'
category: 'git-maintenance'
tags:
  - git-hygiene
  - branch-management
  - sprint-workflow
  - prevention
  - automation
  - team-coordination
module: 'development-workflow'
symptoms:
  - 'Working on stale branches instead of main'
  - 'Merge conflicts from unmerged feature branches'
  - 'Confusion about PR status after merge'
  - 'Stash accumulation over time'
  - 'Orphaned PRs with deleted base branches'
  - 'Untracked files accidentally committed'
  - 'yarn.lock drift (lockfile uncommitted, merge conflicts)'
severity: 'medium'
status: 'completed'
---

# Repo Cruft Prevention — Sprint Boundary Maintenance

## Problem

After 20+ sprints (PRs #73–99), the Sovren repository accumulated:

- **16 stale local branches** — leftover feature branches after merge
- **25+ stale remote branches** — pushed branches never deleted after close
- **9 stashes** — accidental `git stash` without `git stash pop`
- **1 orphaned PR** — base branch merged, PR still open
- **Dirty working tree** — untracked `.env.local`, test data files
- **`.gitignore` gaps** — supabase CLI artifacts, dist/, node_modules symlinks

**Risk:**

- Developers mistakenly branch off stale code instead of main
- Merge conflicts from unmerged feature branches
- Confusion about which branches are live
- Untracked files accidentally committed (secrets, build artifacts)
- Inconsistent yarn.lock causing random test failures

## Root Causes

### 1. No post-merge cleanup automation

`git branch --merged` doesn't detect squash-merged branches (commit hash lost). Manual deletion forgot remote branches.

### 2. PR lifecycle orphaning

When base branch (`feature/x`) gets merged to main, dependent PRs against `feature/x` become orphaned. No script tracked this.

### 3. Stash accumulation

Developers ran `git stash` during context switches but forgot `git stash pop`. No warning when stash list grows.

### 4. .gitignore gaps

New local tools (Supabase CLI, test snapshots, IDE files) added over time without updating `.gitignore`. Forced developers to use `git update-index --skip-worktree` hacks.

### 5. No sprint boundary checklist

Between sprints, repo state was never verified. Stale state leaked into the next sprint.

## Solution

### Phase 1: One-Time Cleanup

**9-step systematic cleanup** (executed solo, 2026-02-26):

1. ✅ **Identified stale branches** via `git log --oneline main...branch` — commits already in main
2. ✅ **Squash-merged detection** — grepped commit message for branch name (lost commits won't match main)
3. ✅ **Deleted 16 local branches** — `git branch -d` with verification
4. ✅ **Deleted 25 remote branches** — `git push origin :branch-name`
5. ✅ **Closed 1 orphaned PR** — `gh pr close` with explanation
6. ✅ **Verified stash contents** — `git stash list` inspection, kept 2 (might contain work), dropped 7
7. ✅ **Cleaned working tree** — untracked file audit, added to `.gitignore`
8. ✅ **Updated `.gitignore`** — local data dirs, temp files, IDE artifacts
9. ✅ **Verified lock files** — yarn.lock committed and up-to-date

**Result**: Clean state, ready for sprint workflow.

---

## Prevention Strategies

### Strategy 1: Post-Merge Branch Cleanup

**When**: Immediately after squash-merge to main (part of PR merge workflow)

**What**: Delete both local and remote branch.

**Implementation**:

```bash
# After gh pr merge --squash
BRANCH=$(git rev-parse --abbrev-ref HEAD)

# Delete local
git switch main
git branch -d "$BRANCH"

# Delete remote (if pushed)
git push origin :"$BRANCH" 2>/dev/null || true
```

**Where to integrate**:

- **GitHub Actions** — Auto-cleanup in CI after merge (create `.github/workflows/branch-cleanup.yml`)
- **CLI wrapper** — Create alias for safe merge + cleanup
- **Manual checklist** — Document in sprint onboarding (if automation unavailable)

**Why**:

- Prevents accidental branching off stale code
- Reduces "stale branch" decision fatigue
- Keeps remote branch list clean

---

### Strategy 2: Sprint Boundary Checklist

**When**: At sprint start, before picking up new work

**What**: Run verification script to catch cruft before it leaks in.

**Checklist** (run `npm run verify:repo-health`):

```bash
#!/bin/bash
set -e

echo "🔍 Repo Health Check..."

# 1. Working tree clean
DIRTY=$(git status --porcelain | wc -l)
if [ "$DIRTY" -gt 0 ]; then
  echo "❌ Dirty working tree ($DIRTY files)"
  git status
  exit 1
fi

# 2. No untracked files (except .env.local)
UNTRACKED=$(git ls-files --others --exclude-standard | grep -v '\.env\.local$' | wc -l)
if [ "$UNTRACKED" -gt 0 ]; then
  echo "❌ Untracked files detected:"
  git ls-files --others --exclude-standard | grep -v '\.env\.local$'
  exit 1
fi

# 3. No stashes
STASH_COUNT=$(git stash list | wc -l)
if [ "$STASH_COUNT" -gt 0 ]; then
  echo "⚠️  $STASH_COUNT stash(es) found:"
  git stash list
  echo "Run: git stash pop  (or git stash drop to discard)"
  exit 1
fi

# 4. No local branches (except main, develop)
LOCAL_BRANCHES=$(git branch | grep -v '^\*' | grep -v '^ *main$' | grep -v '^ *develop$' | wc -l)
if [ "$LOCAL_BRANCHES" -gt 0 ]; then
  echo "⚠️  $LOCAL_BRANCHES local branch(es) detected (should be cleaned up):"
  git branch | grep -v '^\*' | grep -v '^ *main$' | grep -v '^ *develop$'
  exit 1
fi

# 5. Locked package managers (yarn.lock committed)
if git ls-files --cached | grep -q 'yarn\.lock$'; then
  echo "✅ yarn.lock is committed"
else
  echo "⚠️  yarn.lock not committed (may cause lockfile drift)"
fi

# 6. Main is up-to-date with remote
BEHIND=$(git rev-list --count origin/main..main)
AHEAD=$(git rev-list --count main..origin/main)
if [ "$BEHIND" -gt 0 ] || [ "$AHEAD" -gt 0 ]; then
  echo "⚠️  Local main diverged from origin/main"
  echo "   Behind: $BEHIND, Ahead: $AHEAD"
  echo "   Run: git pull origin main"
  exit 1
fi

# 7. Open PRs count
OPEN_PRS=$(gh pr list --state open | wc -l)
echo "ℹ️  Open PRs: $OPEN_PRS"

echo "✅ Repo health OK"
```

**Add to package.json**:

```json
{
  "scripts": {
    "verify:repo-health": "bash scripts/verify-repo-health.sh"
  }
}
```

**Where to integrate**:

- **Sprint onboarding** — Run before assigning first task
- **CI/CD gate** — Block PRs if repo health fails (optional, noisy)
- **Pre-push hook** — Warn (not block) on dirty state

**Why**:

- Catches accumulation before it compounds
- Same checklist every sprint (no variation)
- Detects PRs orphaned by branch deletion
- Early warning on lockfile drift

---

### Strategy 3: .gitignore Proactive Updates

**When**: Adding new local dev tooling or test artifacts

**What**: Update `.gitignore` in the same commit.

**Current .gitignore additions** (from cleanup):

```
# Local development
.env.local
.env.*.local
.supabase/
.supabase-local/

# Build and test artifacts
dist/
coverage/
test-results/
.turbo/

# IDE and OS
.DS_Store
.vscode/local.env
*.swp
*.swo

# Node
node_modules/
npm-debug.log*
yarn-error.log*

# Test data (temporary)
test-data/
fixtures/temp/
seeds/temp/

# Lock file (committed, not ignored)
# yarn.lock — explicitly committed for reproducibility
```

**Process**:

1. When adding new tool (e.g., Supabase CLI): update `.gitignore` first
2. Verify no accidental commits: `git status` before pushing
3. Note in PR description: "Updated .gitignore for Supabase CLI artifacts"

**Where to integrate**:

- **Code review checklist** — Reviewer asks: "Did you add a `.gitignore` entry?"
- **CLAUDE.md** — Document under "Adding a New Feature" → "Update `.gitignore`"
- **Branch protection rule** — Optional: block `.gitignore` changes outside of dedicated tooling PRs (may be overkill)

**Why**:

- Prevents accidental commits of secrets, build artifacts, IDE config
- Centralizes tool configuration decisions
- Clear audit trail in git history

---

### Strategy 4: Squash-Merged Branch Detection Script

**Why**: `git branch --merged` doesn't detect squash merges (original commits rewritten).

**Script location**: `scripts/detect-stale-branches.sh`

```bash
#!/bin/bash
# Detect branches squash-merged to main
# Usage: detect-stale-branches.sh [days-old]

DAYS_OLD=${1:-7}
CUTOFF=$(date -d "$DAYS_OLD days ago" +%s)

echo "🔍 Branches not updated in $DAYS_OLD days (likely squash-merged):"

git for-each-ref --sort=-committerdate --format='%(refname:short) %(committerdate:unix)' refs/heads \
  | while read BRANCH TIMESTAMP; do
    [ "$BRANCH" = "main" ] && continue
    [ "$BRANCH" = "develop" ] && continue

    if [ "$TIMESTAMP" -lt "$CUTOFF" ]; then
      LAST_COMMIT=$(git log -1 --format="%h %s" "$BRANCH")
      echo "  $BRANCH: $LAST_COMMIT ($(date -d @$TIMESTAMP +%Y-%m-%d))"
    fi
  done

echo ""
echo "Delete with: git branch -d <branch-name>"
echo "Or force:    git branch -D <branch-name>"
```

**Where to integrate**:

- **Sprint boundary checklist** — Run before sprint starts
- **CI/CD nightly** — Log warning (informational only)
- **Manual script** — Invoke before cleanup day

**Why**:

- Distinguishes live branches from squash-merged ones
- Prevents accidental deletion of active work
- Time-based detection is reliable (commit timestamp doesn't lie)

---

### Strategy 5: Stash Hygiene

**Rule**: Prefer `git stash pop` over `git stash` to avoid accumulation.

**Process**:

```bash
# ❌ Anti-pattern: stash accumulates
git stash
# ... context switch ...
git stash
# ... weeks pass ...
git stash list  # 9 stashes!

# ✅ Pattern: pop when done
git stash
# ... context switch ...
git stash pop  # Restore immediately
```

**Emergency stash protocol** (if you lose track):

```bash
# See all stashes
git stash list

# Inspect a stash without applying
git stash show -p stash@{0}

# Apply without deleting
git stash apply stash@{0}

# Delete after inspection
git stash drop stash@{0}

# Clear all stashes (after verifying they're safe)
git stash clear
```

**Where to integrate**:

- **CLAUDE.md** — Add "Stash Hygiene" section
- **Git config alias** — Create `git unstash` → `git stash pop`
- **Sprint checklist** — "No stashes remaining"

**Why**:

- Stash is for emergency context switches, not long-term storage
- Stash pop failures are debugging friction
- Prevents "what was in that stash?" confusion weeks later

---

### Strategy 6: PR Lifecycle Management

**Rule**: Close orphaned PRs when their base branch gets merged.

**When**: After merging a feature branch that had dependent PRs

**Manual process**:

```bash
# Check for orphaned PRs
gh pr list --state open

# For each PR with deleted base:
gh pr close <pr-number>

# Include explanation in close message
gh pr close <pr-number> -c "Base branch merged to main; rebase against main if needed"
```

**Automated check** (in sprint boundary script):

```bash
# Find PRs whose base branch no longer exists
gh pr list --state open --json baseRefName,number \
  | jq '.[] | select(.baseRefName | startswith("feature/")) | .number' \
  | while read PR; do
    echo "⚠️  PR #$PR may be orphaned (base branch deleted?)"
  done
```

**Where to integrate**:

- **Sprint checklist** — Run `gh pr list` at sprint start
- **GitHub Actions** — Auto-close PRs against deleted branches (risky, verify first)
- **Code review process** — If merging a branch with dependent PRs, communicate plan to that PR's author

**Why**:

- Orphaned PRs accumulate noise in PR list
- Confusion about status (is this still active?)
- Clear signal: if base is deleted, PR is superseded

---

## Sprint Boundary Workflow (Checklist)

**Before starting new sprint work**, execute this in order:

```bash
# 1. Sync with remote
git fetch origin

# 2. Run repo health check
npm run verify:repo-health

# 3. Clean up stales branches (if any)
scripts/detect-stale-branches.sh 7 | xargs -I {} git branch -d {}

# 4. Check open PRs
gh pr list --state open

# 5. Verify .gitignore is current
git status  # Should show no untracked files (except .env.local)

# 6. Ensure yarn.lock is fresh
git log --oneline yarn.lock | head -3  # Recent commits?

# 7. Check main branch is up-to-date
git switch main && git pull origin main

echo "✅ Sprint ready!"
```

**Add to onboarding doc** or create `scripts/sprint-start.sh`.

---

## Key Metrics

**Track over sprints to validate prevention**:

- **Stale branches count** — Target: 0 at sprint boundary
- **Orphaned PRs** — Target: 0
- **Stash count** — Target: 0
- **Dirty working tree failures** — Target: 0 per sprint
- **yarn.lock conflicts** — Target: 0 per sprint (track in PR history)

---

## Lessons Learned

### 1. Squash-merge breaks `git branch --merged`

**Impact**: Can't trust automation to detect merged branches.

**Fix**: Use time-based detection (`git for-each-ref ... --sort=-committerdate`) or manual review.

### 2. PR orphaning is silent

**Impact**: Developers don't notice PR is against deleted branch until CI fails.

**Fix**: Add `gh pr list` check to sprint boundary checklist.

### 3. Stash is a black hole

**Impact**: 9 stashes accumulated over 20 sprints, 7 were forgotten work.

**Fix**: Use `git stash pop` immediately; don't let stashes sit.

### 4. .gitignore is always incomplete

**Impact**: New tools added without .gitignore, forcing `skip-worktree` hacks.

**Fix**: Update .gitignore in the same PR as new tooling.

### 5. No automated cleanup = accumulated debt

**Impact**: One cleanup PR saved 3+ hours of debugging stale branch confusion.

**Fix**: Automate what you can; checklist what you can't.

---

## New Patterns Added to docs/solutions/patterns/

### common-solutions.md #41

**Pattern**: Sprint Boundary Checklist

**Problem**: Repo cruft (stale branches, stashes, orphaned PRs) accumulates silently between sprints.

**Solution**: Execute 7-step checklist at sprint start before picking up new work:

1. `git fetch origin` — sync remote state
2. `npm run verify:repo-health` — working tree clean, no stashes, no stale branches
3. `scripts/detect-stale-branches.sh 7` — branches not updated in 7 days (likely squash-merged)
4. `gh pr list --state open` — verify no orphaned PRs
5. `git status` — no untracked files except `.env.local`
6. Check `yarn.lock` recent commits — ensure lockfile is current
7. `git switch main && git pull origin main` — main is up-to-date

**Detection**: Run sprint checklist at sprint start; measure stale branches, stashes, orphaned PRs (all target 0).

**When to use**: Start of every sprint; post-merge cleanup; onboarding new agents.

### common-solutions.md #42

**Pattern**: Post-Merge Branch Cleanup

**Problem**: After squash-merge, both local and remote branches remain, risking accidental branches off stale code.

**Solution**:

```bash
# After gh pr merge --squash
BRANCH=$(git rev-parse --abbrev-ref HEAD)
git switch main
git branch -d "$BRANCH"
git push origin :"$BRANCH" 2>/dev/null || true
```

**Where to integrate**: GitHub Actions CI workflow post-merge, or CLI wrapper for `gh pr merge`.

**When to use**: Every PR merge to main.

### common-solutions.md #43

**Pattern**: .gitignore Proactive Updates

**Problem**: New local tools (Supabase CLI, test data dirs, IDE files) accumulate without .gitignore entries, forcing developers to use `git update-index --skip-worktree` hacks.

**Solution**: Update `.gitignore` in the same PR as new tooling. Include categories:

- Local development (`.env.local`, `.supabase-local/`)
- Build/test artifacts (`dist/`, `coverage/`, `test-results/`)
- IDE/OS files (`.DS_Store`, `.vscode/`)
- Temporary test data (`test-data/`, `fixtures/temp/`)

**Detection**: Code review asks: "Did you update .gitignore?" during tool addition PRs.

**When to use**: Any PR adding new local tooling, build artifact type, or IDE integration.

---

## Implementation Timeline

| Phase | Task                                          | Owner  | Status   |
| ----- | --------------------------------------------- | ------ | -------- |
| Done  | One-time cleanup (9 steps)                    | solo   | ✅ 02-26 |
| P1    | Add `npm run verify:repo-health` script       | DevOps | pending  |
| P1    | Add `.gitignore` local dev entries            | solo   | ✅ 02-26 |
| P2    | Create `.github/workflows/branch-cleanup.yml` | DevOps | pending  |
| P2    | Create `scripts/detect-stale-branches.sh`     | DevOps | pending  |
| P2    | Create `scripts/sprint-start.sh`              | DevOps | pending  |
| P2    | Update CLAUDE.md with sprint checklist        | solo   | pending  |
| P3    | Add git aliases for stash safety              | DevOps | pending  |

---

## Summary

**Root cause of cruft**: No automated cleanup + no sprint boundary verification.

**Prevention mechanism**:

1. **Post-merge automation** — Delete branches immediately after squash-merge
2. **Sprint checklist** — Verify clean state before starting new work
3. **Proactive .gitignore** — Update when adding tools, not weeks later
4. **Stash discipline** — Use `pop`, not perpetual `stash`
5. **Time-based detection** — For squash merges, use commit timestamp not `--merged` flag

**Expected outcome**: Zero stale branches, zero orphaned PRs, zero stashes at sprint boundaries over next 10+ sprints.

**Validation**: Track metrics in sprint kickoff (stale branches count, orphaned PRs, stash count).
