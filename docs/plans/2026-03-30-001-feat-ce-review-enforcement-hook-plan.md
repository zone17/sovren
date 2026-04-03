---
title: 'feat: CE Review enforcement hook — block merge without review'
type: feat
status: active
date: 2026-03-30
---

# CE Review Enforcement Hook — Block Merge Without Review

## Overview

Build a deterministic hook enforcement layer that makes it impossible to skip CE Review before merge. Uses the same gate-flag pattern as the existing `/watch-ci` enforcement (post-git-actions.sh sets flag → security-gate-bash.sh enforces).

## Problem Frame

PRs #195, #196, #197 were merged without CE Review. The CE workflow (Plan → Work → **Review** → Compound) requires review before merge, but this was enforced by LLM instruction, not by hooks. LLM instructions don't survive context compaction (Pattern #15). Five PRs shipped unreviewed in a sprint that explicitly documented the CE loop.

## Requirements Trace

- R1. `gh pr merge` is blocked unless CE Review has been run on the current branch
- R2. Review status is tracked in a machine-readable gate flag file (not LLM memory)
- R3. The gate follows the existing enforcement pattern (PostToolUse sets flag, PreToolUse enforces)
- R4. Small/trivial PRs can bypass with explicit `--no-review` flag (escape hatch for docs-only, config-only)
- R5. The gate is session-scoped (same as /watch-ci) — each session tracks its own review state

## Scope Boundaries

- **Not** auto-triggering `/ce:review` — just blocking merge until review has run
- **Not** changing the CE Review skill itself
- **Not** enforcing review on main branch commits (only on `gh pr merge`)

## Key Technical Decisions

- **Gate flag pattern**: Reuse the exact same `$HOME/.claude/metrics/.review-pending-${session_id}` pattern as `/watch-ci`. PostToolUse sets it after `git push`, PreToolUse[Bash] checks it before `gh pr merge`.
- **How review clears the gate**: The `ce:review` skill writes artifacts to `.context/compound-engineering/ce-review/<run-id>/`. The PostToolUse hook detects when this directory is created/populated and clears the gate.
- **Bypass mechanism**: If the command contains `--no-review` or the branch name contains `hotfix/` or `docs/`, skip the gate.
- **Integration point**: Extend `security-gate-bash.sh` (which already handles the /watch-ci gate) rather than creating a separate hook — fewer hooks = less latency.

## Implementation Units

- [ ] **Unit 1: Add review gate to post-git-actions.sh**

**Goal:** After `git push` to a feature branch, set a review-pending gate flag

**Requirements:** R2, R3, R5

**Dependencies:** None

**Files:**

- Modify: `~/.claude/hooks/enforcement/post-git-actions.sh`

**Approach:**

- After the existing `git push` detection block (which sets the watch-ci gate), add a second gate flag: `review_gate="$flag_dir/.review-pending-${session_id}"`
- Only set the flag if the branch is not `main`, `hotfix/*`, or `docs/*`
- The flag file contains the branch name for debugging

**Patterns to follow:**

- Existing watch-ci gate flag pattern in the same file (lines 25-35)

**Test scenarios:**

- Happy path: `git push` on feature branch → review gate flag created
- Edge case: `git push` on main → no review gate flag
- Edge case: `git push` on `hotfix/urgent-fix` → no review gate flag
- Edge case: `git push` on `docs/update-readme` → no review gate flag

**Verification:**

- After `git push` on a feature branch, `ls ~/.claude/metrics/.review-pending-*` shows a flag file

---

- [ ] **Unit 2: Add review gate enforcement to security-gate-bash.sh**

**Goal:** Block `gh pr merge` if review gate flag exists and no CE Review artifact is present

**Requirements:** R1, R4

**Dependencies:** Unit 1

**Files:**

- Modify: `~/.claude/hooks/enforcement/security-gate-bash.sh`

**Approach:**

- After the existing watch-ci gate check, add a review gate check
- If `gh pr merge` is detected and review gate flag exists:
  - Check if `.context/compound-engineering/ce-review/` has any run artifacts for the current branch
  - If no artifacts: deny with message "BLOCKED: Run /ce:review before merging. CE Review has not been run on this branch."
  - If artifacts exist: allow (review was completed)
- Allow through if command contains `--no-review` (explicit bypass)
- Allow through for `hotfix/` and `docs/` branches

**Patterns to follow:**

- Existing watch-ci gate enforcement in security-gate-bash.sh (the `gate_flag` check block)

**Test scenarios:**

- Happy path: `gh pr merge` without review → blocked with clear message
- Happy path: `gh pr merge` after `/ce:review` ran → allowed
- Edge case: `gh pr merge --no-review` → allowed (explicit bypass)
- Edge case: `gh pr merge` on hotfix branch → allowed
- Error path: `.context/` directory doesn't exist → treated as no review (blocked)

**Verification:**

- `gh pr merge` on a feature branch without review → exit 2 with deny message
- After running `/ce:review`, `gh pr merge` → exit 0 (allowed)

---

- [ ] **Unit 3: Clear review gate when CE Review completes**

**Goal:** Detect CE Review completion and clear the gate flag

**Requirements:** R2

**Dependencies:** Unit 1

**Files:**

- Modify: `~/.claude/hooks/enforcement/post-git-actions.sh` (or create a new PostToolUse hook if cleaner)

**Approach:**

- In the PostToolUse handler, detect when the `ce:review` skill has run by checking for new files in `.context/compound-engineering/ce-review/`
- Alternatively: detect the `/ce:review` skill invocation via the tool output (the skill writes artifacts and reports findings)
- When detected: `rm -f "$review_gate"` to clear the flag
- Simplest approach: add to the existing command classification — if the command output contains "ce-review" or the Skill tool was called with "ce-review", clear the gate

**Patterns to follow:**

- Watch-ci gate clearing pattern (detects `gh run watch/view/list` commands)

**Test scenarios:**

- Happy path: `/ce:review` runs → gate flag cleared
- Edge case: Gate flag doesn't exist → no error on clear attempt
- Integration: Push → gate set → review → gate cleared → merge allowed

**Verification:**

- After `/ce:review` completes, `ls ~/.claude/metrics/.review-pending-*` returns empty

---

- [ ] **Unit 4: Register hooks and update CLAUDE.md**

**Goal:** Ensure hooks are registered in settings.json and document the enforcement

**Requirements:** R1, R3

**Dependencies:** Units 1-3

**Files:**

- Verify: `~/.claude/settings.json` (hooks already registered — post-git-actions and security-gate-bash are both active)
- Modify: `~/.claude/CLAUDE.md` (add CE Review gate to the enforcement hooks table)

**Approach:**

- No new hook registration needed — we're extending existing hooks
- Update the enforcement hooks table in CLAUDE.md to document the review gate
- Add to the "Hard block" table: `security-gate-bash.sh` blocks `gh pr merge` without CE Review

**Test scenarios:**

- Happy path: Full flow — push → gate set → try merge (blocked) → review → gate cleared → merge (allowed)

**Verification:**

- CLAUDE.md enforcement table includes the review gate
- End-to-end flow works

## System-Wide Impact

- **Interaction graph:** Extends two existing hooks (post-git-actions.sh, security-gate-bash.sh). No new hook registrations.
- **Error propagation:** Gate uses exit 2 (deny) — same as all other hard blocks. Never blocks non-merge commands.
- **Unchanged invariants:** Watch-ci gate, branch discipline, security gates — all unchanged. Review gate is additive.

## Risks & Dependencies

| Risk                                       | Mitigation                                               |
| ------------------------------------------ | -------------------------------------------------------- |
| Hook adds latency to every Bash command    | Review gate check is a simple file existence test (<1ms) |
| False positive blocks on legitimate merges | `--no-review` bypass + hotfix/docs branch exemption      |
| CE Review artifacts not detected correctly | Use file existence in `.context/` — simple and reliable  |

## Sources & References

- Existing pattern: `~/.claude/hooks/enforcement/post-git-actions.sh` (watch-ci gate)
- Existing pattern: `~/.claude/hooks/enforcement/security-gate-bash.sh` (gate enforcement)
- Pattern #15: "Deterministic hooks replace LLM instructions"
- This session: PRs #195-197 merged without review
