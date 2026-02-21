# Why Wave 2 Produced 46 Findings (10 P1) — Root Cause Analysis

**Date:** 2026-02-18
**Participants:** User + Claude Code
**Context:** Post-review retrospective on branch `feat/wave2-epics-009b-010-011`

## What Happened

Wave 2 shipped EPIC-009B (Unified Inbox), EPIC-010 (Creator Network), and EPIC-011 (Business Manager) as a single branch: 140 files, +24,173 lines, 14 new DB tables, 10 new services, 30+ routes. The 13-agent parallel review found **46 findings**: 10 P1 (blocks merge), 22 P2, 14 P3.

For comparison, prior sprints at similar review depth found ~20-30 findings per epic. Wave 2's 3-epic branch amplified that by ~3x, as expected — but the P1 count (10) is higher than the 2-4 P1s typical of single-epic branches.

## Root Causes Identified

### 1. No Interim Code Reviews During Build

The plan document was reviewed twice (caught 17 spec-level issues). But the 140-file implementation shipped as two commits with zero code-level review until the post-implementation `/workflows:review`.

**Impact:** Issues compounded across epics. A pattern missed in EPIC-010 (no Zod validation) repeated in all 4 route files. A schema decision in EPIC-009B (TEXT vs UUID) wasn't caught until 14 tables later.

**Evidence:** Phase 1 started with similar finding rates but caught them across 6 incremental review rounds. Wave 2 accumulated all findings into round 1.

### 2. Known Patterns Not Enforced

Phase 7 sprint learnings documented 4 reusable payment patterns:

- **atomic-write**: Multi-table inserts via Supabase RPC
- **write-mutex**: Prevent double-payout races
- **cache-fallback**: Graceful degradation on external API failure
- **persist-then-mutate**: Write to DB before mutating state

Wave 2's financial services didn't use them. 6 of 10 P1s are exact repeats of issues Phase 7 solved:

- #262 (double-payout race) → write-mutex pattern
- #264 (non-atomic writes) → atomic-write pattern
- #267 (double-order idempotency) → write-mutex pattern
- #274 (TOCTOU in joinCircle) → atomic-write pattern

The patterns existed in `docs/solutions/` but agents building Wave 2 weren't briefed to check them.

### 3. Scope Amplification (3 Epics in 1 Branch)

| Metric                | 1-Epic Branch (typical) | Wave 2 (3 Epics) |
| --------------------- | ----------------------- | ---------------- |
| Files changed         | 30-50                   | 140              |
| New tables            | 3-5                     | 14               |
| New services          | 2-4                     | 10               |
| Finding count         | 15-25                   | 46               |
| P1 count              | 2-4                     | 10               |
| Review cognitive load | Manageable              | High             |

The finding _ratio_ is similar, but the absolute count makes triage and remediation significantly harder. More importantly, cross-epic issues (inconsistent validation patterns, duplicate types, schema drift) only emerge when epics share a branch.

## Decisions Made

### Decision 1: Per-Commit Automated Review

Every commit gets an automated scan checking for known anti-patterns. Full `/workflows:review` still runs at epic completion.

**What the scan checks:**

- `as any` casts (TypeScript)
- Missing `ON DELETE` on FK columns (SQL migrations)
- Unbounded `SELECT *` without `LIMIT` (Supabase queries)
- Non-atomic multi-table writes (service methods)
- Missing Zod validation on route handlers
- Missing rate limiting on mutation routes

**Implementation:** Pre-commit hook or CI check that runs pattern-matching rules against changed files.

### Decision 2: Both Pre-Commit Hooks AND Agent Brief Checklists

**Defense in depth:**

**Layer 1 — Agent briefs** teach patterns upfront:

- Financial services brief includes: "MUST use atomic-write pattern for multi-table inserts, write-mutex for payment operations, idempotency keys generated on intent not on click"
- Community services brief includes: "MUST use TOCTOU-safe patterns for limit checks (SELECT FOR UPDATE or unique constraints)"
- Migration brief includes: "MUST include ON DELETE clause on all FKs, IF NOT EXISTS on all CREATE TABLE, updated_at trigger on all tables with updated_at column"

**Layer 2 — Pre-commit hooks** catch violations that slip through:

- Scan for anti-patterns in staged files
- Block commit with actionable error message pointing to the correct pattern in `docs/solutions/`

### Decision 3: 1 Epic Per Branch

Going forward, every epic gets its own branch and PR. Benefits:

- Smaller blast radius (~30-50 files vs 140)
- Faster review cycles (review one domain at a time)
- Independent merge timeline (don't block EPIC-010 fixes on EPIC-011)
- Cleaner git history

Related epics that need coordination (e.g., shared types) use a pre-flight commit on main first, then branch per epic.

### Decision 4: Fix Current Branch, Enforce Going Forward

- Resolve the 46 findings on the current `feat/wave2-epics-009b-010-011` branch
- Merge to main when all P1s and triaged P2s are fixed
- Implement new hooks/briefs/scope limits before the next epic begins
- First epic under new process becomes the validation test

## Open Questions

1. **Hook complexity**: How sophisticated should the pre-commit pattern checks be? Simple regex vs AST-level analysis?
2. **Brief maintenance**: Who updates the domain-specific checklists when new patterns are discovered? Auto-append from `/workflows:compound`?
3. **Per-commit review cost**: Will automated scans on every commit slow down development velocity? Need to measure.

## Next Steps

1. **Immediate**: Triage + resolve 46 findings on current branch (P1s first)
2. **Before next epic**: Implement pre-commit hooks for top 6 anti-patterns
3. **Before next epic**: Update team-builder briefs with domain checklists
4. **Before next epic**: Enforce 1-epic-per-branch rule in CLAUDE.md
5. **After first new-process epic**: Retrospective to validate improvements
