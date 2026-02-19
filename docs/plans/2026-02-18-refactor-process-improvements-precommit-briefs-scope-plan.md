---
title: 'refactor: Process Improvements — Pre-commit Hooks, Domain Briefs, Scope Limits'
type: refactor
date: 2026-02-18
reviewed: 2026-02-18
brainstorm: docs/brainstorms/2026-02-18-wave2-review-root-cause-analysis-brainstorm.md
status: complete
reviewers: [dhh-rails-reviewer, kieran-typescript-reviewer, code-simplicity-reviewer]
---

# refactor: Process Improvements — Pre-commit Scanner + Brief Update + Scope Rule

## Overview

Wave 2's 13-agent review found 46 findings (10 P1) on 140 files across 3 epics. Root cause analysis identified three systemic issues. This plan implements fixes for the first two; the third (scope limit) is a trivial CLAUDE.md edit applied immediately outside this plan.

## Problem Statement

6 of 10 P1 findings were **exact repeats** of issues solved in Phase 7 (atomic-write, write-mutex, idempotency, TOCTOU). The patterns existed in `docs/solutions/` but:

1. No automated check caught anti-patterns at commit time
2. Agent briefs didn't point agents to known patterns before coding
3. The 3-epic branch amplified finding count 3x vs single-epic branches

## Proposed Solution

| Change                                     | Where                                                 | Effort                                      |
| ------------------------------------------ | ----------------------------------------------------- | ------------------------------------------- |
| Anti-pattern pre-commit scanner (4 checks) | `scripts/check-antipatterns.sh` + `.husky/pre-commit` | 1h                                          |
| Pattern pointer in backend brief           | `~/.claude/skills/team-builder/briefs/backend.md`     | 10min                                       |
| 1-epic-per-branch rule                     | Sovren `CLAUDE.md`                                    | Applied immediately (not part of this plan) |

**What was cut (per reviewer feedback):**

- Checks 3 (unbounded SELECT) and 4 (non-atomic writes) — require multi-line semantic analysis that grep can't do reliably. Deferred to future ESLint rule if needed.
- 23-checkbox domain checklist wall — replaced with 3-line pointer to existing `docs/solutions/PREVENTION_CODE_PATTERNS.md`
- QA brief modification — pre-commit hook is the enforcement layer; one guidance document is enough
- Global CLAUDE.md duplication — scope rule lives in project CLAUDE.md only
- File-count thresholds (30-50, 80 max) — "1 epic per branch" is sufficient

---

## Phase 1: Pre-Commit Anti-Pattern Scanner

**What**: A shell script invoked by `.husky/pre-commit` that scans staged source files (excluding tests) for 4 known anti-patterns. Runs FIRST in the hook (before slow operations) for fast feedback. Blocks commit with actionable error.

**Where**: New file `scripts/check-antipatterns.sh`, called from `.husky/pre-commit`.

### 4 Anti-Pattern Checks

| #   | Check                                    | Grep Pattern                                              | What It Catches                                 |
| --- | ---------------------------------------- | --------------------------------------------------------- | ----------------------------------------------- |
| 1   | Unsafe `any` types in source `.ts` files | `(as any\|: any\b\|<any>\|<any\[)`                        | `as any`, `: any`, `Promise<any>`, `Array<any>` |
| 2   | Missing `ON DELETE` on FK columns        | `REFERENCES` without `ON DELETE` in `.sql`                | FK columns with implicit NO ACTION              |
| 3   | Missing Zod validation on route handlers | `req.body` without `validateRequest\|safeParse\|\.parse(` | Routes accepting unvalidated input              |
| 4   | Missing rate limiter on mutation routes  | `.post(\|.put(\|.delete(` without `rateLimiter`           | Mutation endpoints without rate limiting        |

### Implementation

```bash
#!/bin/bash
# scripts/check-antipatterns.sh
# Anti-pattern scanner for Sovren pre-commit hook
# Scans STAGED source files only (excludes tests). Runs in <1 second.

set -e

STAGED_TS=$(git diff --cached --name-only --diff-filter=ACM | grep '\.ts$' || true)
STAGED_SQL=$(git diff --cached --name-only --diff-filter=ACM | grep '\.sql$' || true)

# Exclude test files from TypeScript checks (legitimate as any usage in mocks)
STAGED_TS_SRC=$(echo "$STAGED_TS" | grep -v '__tests__\|\.test\.ts\|\.spec\.ts' || true)

ROUTE_FILES=$(echo "$STAGED_TS_SRC" | grep -E 'routes/' || true)
ERRORS=0

# Check 1: Unsafe `any` types in source TypeScript files
# Catches: as any, : any, Promise<any>, Promise<any[]>, Array<any>
if [ -n "$STAGED_TS_SRC" ]; then
  MATCHES=$(echo "$STAGED_TS_SRC" | xargs grep -HnE '(\bas\s+any\b|:\s*any\b|<any>|<any\[)' 2>/dev/null \
    | grep -v '^\s*//' || true)
  if [ -n "$MATCHES" ]; then
    echo "⚠️  Unsafe 'any' type detected (use proper types):"
    echo "$MATCHES"
    ERRORS=$((ERRORS + 1))
  fi
fi

# Check 2: FK references without ON DELETE clause
if [ -n "$STAGED_SQL" ]; then
  MATCHES=$(echo "$STAGED_SQL" | xargs grep -Hn 'REFERENCES' 2>/dev/null \
    | grep -v 'ON DELETE' || true)
  if [ -n "$MATCHES" ]; then
    echo "⚠️  FK without ON DELETE clause (add RESTRICT or CASCADE):"
    echo "$MATCHES"
    ERRORS=$((ERRORS + 1))
  fi
fi

# Check 3: Route files using req.body without Zod validation
if [ -n "$ROUTE_FILES" ]; then
  for f in $ROUTE_FILES; do
    HAS_BODY=$(grep -c 'req\.body' "$f" 2>/dev/null || echo 0)
    HAS_VALIDATE=$(grep -cE 'validateRequest|zodValidate|\.safeParse|\.parse\(' "$f" 2>/dev/null || echo 0)
    if [ "$HAS_BODY" -gt 0 ] && [ "$HAS_VALIDATE" -eq 0 ]; then
      echo "⚠️  $f: Uses req.body without Zod validation"
      ERRORS=$((ERRORS + 1))
    fi
  done
fi

# Check 4: Mutation routes without rate limiter
if [ -n "$ROUTE_FILES" ]; then
  for f in $ROUTE_FILES; do
    HAS_MUTATION=$(grep -cE '\.(post|put|delete)\(' "$f" 2>/dev/null || echo 0)
    HAS_LIMITER=$(grep -cE 'rateLimiter|RateLimiter' "$f" 2>/dev/null || echo 0)
    if [ "$HAS_MUTATION" -gt 0 ] && [ "$HAS_LIMITER" -eq 0 ]; then
      echo "⚠️  $f: Mutation routes without rate limiter"
      ERRORS=$((ERRORS + 1))
    fi
  done
fi

if [ "$ERRORS" -gt 0 ]; then
  echo ""
  echo "Found $ERRORS anti-pattern(s). Fix before committing."
  echo "Patterns: docs/solutions/PREVENTION_CODE_PATTERNS.md"
  echo "Bypass (emergencies only): git commit --no-verify"
  exit 1
fi
```

### Integration with Existing Pre-Commit Hook

Add the scanner call as the **FIRST** operation in `.husky/pre-commit`, before lint-staged and tests. This ensures fast feedback — if the scanner fails, developers don't wait for the slow operations.

```bash
# ADD AT TOP (before lint-staged)
bash scripts/check-antipatterns.sh

# ... existing lint-staged, tests, etc.
```

### Files to Create/Modify

- [x] Create `scripts/check-antipatterns.sh` (new, ~50 lines)
- [x] `chmod +x scripts/check-antipatterns.sh`
- [x] Modify `.husky/pre-commit` (add 1 line at top)

---

## Phase 2: Pattern Pointer in Backend Brief

**What**: Add a short section to the backend.md brief template pointing agents to `docs/solutions/PREVENTION_CODE_PATTERNS.md` before they write code. Not a 23-checkbox wall — a 3-line pointer to the single source of truth.

**Where**: `~/.claude/skills/team-builder/briefs/backend.md`

### Content to Append

```markdown
## DOMAIN PATTERNS (REQUIRED READING)

Before writing financial, community, or migration code, read the relevant section:

- **Patterns reference**: `docs/solutions/PREVENTION_CODE_PATTERNS.md`
- **Payment patterns**: atomic-write, write-mutex, idempotency, persist-then-mutate
- **Response format**: Always use `createApiResponse()` helper, `next(error)` for errors
```

### Files to Modify

- [x] Edit `~/.claude/skills/team-builder/briefs/backend.md` (append 6 lines)

---

## Scope Rule (Applied Immediately — Not Part of This Plan)

Add to `/Users/fp/Desktop/Sovren/CLAUDE.md` under Git Workflow:

```markdown
### Branch Scope

- **One epic per branch.** Multi-epic branches produce 3x more review findings.
- Pre-flight shared infrastructure (types, DI tokens, route stubs) goes to main first.
- Each branch gets its own `/workflows:review` cycle.
```

---

## Acceptance Criteria

- [x] `scripts/check-antipatterns.sh` exists and is executable
- [x] `.husky/pre-commit` calls the scanner FIRST (before lint-staged)
- [x] Check 1 catches `as any`, `: any`, `Promise<any>`, `<any[]>` but NOT in test files
- [x] Check 2 catches REFERENCES without ON DELETE in .sql files
- [x] Check 3 catches req.body usage without Zod validation (including .safeParse)
- [x] Check 4 catches mutation routes without rate limiter
- [x] Scanner exits non-zero when anti-patterns found
- [x] Scanner only checks staged files (not full codebase)
- [x] `backend.md` brief template includes DOMAIN PATTERNS pointer
- [x] `--no-verify` bypass works for emergencies
- [x] Sovren CLAUDE.md has Branch Scope section

## Dependencies & Risks

| Risk                                        | Mitigation                                                                      |
| ------------------------------------------- | ------------------------------------------------------------------------------- |
| Check 1 false positives in strings/comments | Exclude comment lines with `grep -v '^\s*//'`; accept minor FP risk vs AST cost |
| Existing pre-commit is slow                 | Scanner runs FIRST for fast feedback; slow operations come after                |
| Agents skip pattern reading                 | Pre-commit hook is enforcement layer; brief is guidance                         |
| Existing code triggers scanner              | Only staged files via `git diff --cached`                                       |

## Deferred Items (May Add Later)

| Item                               | Why Deferred                                               | When to Add                                   |
| ---------------------------------- | ---------------------------------------------------------- | --------------------------------------------- |
| Unbounded SELECT check             | Multi-line analysis, high false-positive risk with grep    | When ESLint custom rule infrastructure exists |
| Non-atomic write detection         | Cannot reliably determine transaction scope with grep      | When ESLint custom rule infrastructure exists |
| QA brief domain checklist          | Pre-commit hook is enforcement; one guidance doc is enough | If QA agents consistently miss patterns       |
| Full 23-checkbox domain checklists | Checklist fatigue — agents ignore walls of checkboxes      | Never; keep pointer to single source of truth |

## References

### Internal

- Brainstorm: `docs/brainstorms/2026-02-18-wave2-review-root-cause-analysis-brainstorm.md`
- Payment patterns: `docs/solutions/security-issues/p1-critical-fixes-pr73-round6-payment-persistence.md`
- Prevention patterns: `docs/solutions/PREVENTION_CODE_PATTERNS.md`
- Existing pre-commit: `.husky/pre-commit`
- Team-builder briefs: `~/.claude/skills/team-builder/briefs/backend.md`

### Reviewer Feedback Applied

- **DHH**: Cut checks 3/4, trim checklist to essentials, scanner runs FIRST, write scope rule once
- **Kieran**: Exclude test files from Check 1, broaden `any` pattern, fix Zod grep for `.safeParse`, move `createApiResponse()` to general
- **Simplicity**: Remove Phase 3 from plan (apply directly), 3 checks not 6, pointer not checklist wall, drop QA brief mod
