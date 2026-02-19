---
title: 'Wave 2 Review Root Cause Analysis & Pre-Commit Scanner'
category: process-issues
tags: [pre-commit, code-review, pattern-enforcement, scope-management, agent-briefs]
module: infrastructure
severity: p1
symptoms:
  - 46 review findings on single branch
  - 10 P1 critical findings blocking merge
  - 6 of 10 P1s were repeats of Phase 7 patterns
  - Known patterns not applied by agents
date_solved: 2026-02-18
sprint: wave2-process-improvements
---

# Wave 2 Review Root Cause Analysis & Pre-Commit Scanner

## Problem

Wave 2 branch (`feat/wave2-epics-009b-010-011`) shipped 3 epics as 140 files / +24K lines. The 13-agent parallel review found **46 findings (10 P1)**. Root cause analysis revealed 6 of 10 P1s were exact repeats of issues solved in Phase 7 — the patterns existed in `docs/solutions/` but weren't enforced.

### Symptoms

- 10 P1 critical findings on a single branch (highest ever)
- Known patterns (atomic-write, write-mutex, idempotency) not used by implementing agents
- 3-epic branch scope amplified finding count 3x vs single-epic branches
- Domain-specific knowledge didn't flow from `docs/solutions/` to agent briefs

## Root Causes (3)

### 1. No Per-Commit Anti-Pattern Scanning

Plan was reviewed twice (spec-level), but the 140-file implementation had zero code-level review until post-implementation `/workflows:review`. Common anti-patterns went undetected through the entire build.

### 2. Agent Briefs Didn't Reference Known Patterns

Team-builder briefs (`backend.md`) had behavioral correctness rules but no pointer to `docs/solutions/PREVENTION_CODE_PATTERNS.md`. Agents didn't know about atomic-write, write-mutex, or idempotency patterns.

### 3. Branch Scope Too Large (3 Epics = 140 Files)

Finding count scales roughly linearly with file count. 3 epics in one branch = 3x the findings, 3x the triage time, and cross-epic inconsistencies (different validation patterns per epic).

## Solution

### Pre-Commit Anti-Pattern Scanner (`scripts/check-antipatterns.sh`)

4 grep-based checks on staged files, runs FIRST in `.husky/pre-commit` for fast feedback:

| Check                     | Pattern                                              | What It Catches                               |
| ------------------------- | ---------------------------------------------------- | --------------------------------------------- |
| 1. Unsafe `any` types     | `as any`, `: any`, `Promise<any>`                    | Type safety regressions (excludes test files) |
| 2. Missing ON DELETE      | `REFERENCES` without `ON DELETE` in SQL              | FK columns with implicit NO ACTION            |
| 3. Missing Zod validation | `req.body` without `safeParse`/`validateRequest`     | Routes accepting unvalidated input            |
| 4. Missing rate limiter   | `.post()`/`.put()`/`.delete()` without `rateLimiter` | Unprotected mutation endpoints                |

**Key design decisions (from 3-reviewer feedback):**

- **4 checks, not 6**: Dropped unbounded SELECT and non-atomic write checks — grep can't reliably detect multi-line semantic patterns. Deferred to future ESLint rules.
- **Exclude test files**: Test files legitimately use `as any` for mocks (379 occurrences in existing tests).
- **Run FIRST in pre-commit**: Before lint-staged and tests for fast feedback. If scanner fails, no point running slow operations.
- **Staged files only**: `git diff --cached` avoids false positives from existing codebase.

### Backend Brief Pattern Pointer

Replaced a proposed 23-checkbox domain checklist wall with a 3-line pointer:

```markdown
## Domain Patterns (REQUIRED READING)

- **Patterns reference**: docs/solutions/PREVENTION_CODE_PATTERNS.md
- **Payment patterns**: atomic-write, write-mutex, idempotency, persist-then-mutate
- **Response format**: Always use createApiResponse() helper, next(error) for errors
```

**Why pointer, not checklist**: DHH reviewer and simplicity reviewer both flagged that 23 checkboxes = checklist fatigue = ignored. 3-line pointer to single source of truth is more effective.

### 1-Epic-Per-Branch Scope Rule

Added to Sovren CLAUDE.md under Git Workflow:

- One epic per branch
- Pre-flight shared infrastructure goes to main first
- Each branch gets its own `/workflows:review` cycle

## Prevention Strategies

### For Future Epics

1. **Pre-commit scanner catches 4 anti-pattern classes automatically** — no agent action needed
2. **Backend brief points agents to PREVENTION_CODE_PATTERNS.md** — agents read patterns before coding
3. **1-epic-per-branch** — keeps review scope manageable (~30-50 files)

### For Process Improvement

4. **When `/workflows:compound` documents a new pattern** → update `PREVENTION_CODE_PATTERNS.md` (single source of truth)
5. **Don't duplicate patterns across briefs** — pointer to docs/ beats copy-paste
6. **Behavioral checks that need AST analysis** → build as ESLint rules, not grep scripts

## Key Learnings

| Learning                                                         | Evidence                                                                                           |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **Pointer > checklist wall**                                     | 3 reviewers independently flagged 23-checkbox fatigue; 3-line pointer approved unanimously         |
| **Grep works for single-line patterns, fails for semantic ones** | Check 1 (as any) and Check 2 (ON DELETE) work perfectly; unbounded SELECT needs multi-line context |
| **Exclude test files from type safety checks**                   | 379 existing `as any` in test mocks would cause immediate `--no-verify` bypass                     |
| **Scanner must run FIRST**                                       | Existing pre-commit takes minutes (build + audit + tests); fast scanner first = fast feedback      |
| **6/10 P1s were pattern repeats**                                | Compound docs work — patterns were documented — but agents need to be pointed to them              |
| **3 epics in 1 branch = 3x findings**                            | Finding count scales linearly with scope; 1-epic limit is simple and effective                     |

## Files Changed

- `scripts/check-antipatterns.sh` (new, 62 lines)
- `.husky/pre-commit` (+3 lines, scanner call at top)
- `~/.claude/skills/team-builder/briefs/backend.md` (+5 lines, DOMAIN PATTERNS section)
- `CLAUDE.md` (+5 lines, Branch Scope section)

## Related Documentation

- Brainstorm: `docs/brainstorms/2026-02-18-wave2-review-root-cause-analysis-brainstorm.md`
- Plan: `docs/plans/2026-02-18-refactor-process-improvements-precommit-briefs-scope-plan.md`
- Prevention patterns: `docs/solutions/PREVENTION_CODE_PATTERNS.md`
- Phase 7 P1 patterns: `docs/solutions/security-issues/p1-critical-fixes-pr73-round6-payment-persistence.md`
- Review methodology: `docs/solutions/R7_META_ANALYSIS_REVIEW_METHODOLOGY.md`
