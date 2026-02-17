---
module: System
date: 2026-02-15
problem_type: workflow_issue
component: development_workflow
symptoms:
  - '5 P1 critical bugs passed Gate 2 structural checks in Phase 7 PR #82'
  - 'Gate 2 verified compiles/lints/endpoints-exist but not behavioral correctness'
  - 'Unmounted routes, non-atomic deletes, TOCTOU races, silent error swallowing all passed'
root_cause: missing_workflow_step
resolution_type: workflow_improvement
severity: critical
tags: [gate-improvement, team-builder, behavioral-checks, p1-prevention, sprint-gates]
---

# Troubleshooting: Structural Sprint Gates Miss Behavioral P1 Defects

## Problem

Team-builder Gate 2 (Implementation Done) had 7 structural checks (compiles, lints, endpoints exist, tests exist, tests pass, migrations, frontend components) that all passed for Phase 7 PR #82, yet 5 P1 critical behavioral bugs were only caught later during `/workflows:review`. The gates verified that code existed and compiled — not that it worked correctly.

## Environment

- Module: team-builder (sprint gate infrastructure)
- Tech Stack: Node.js + TypeScript, Supabase, Express
- Affected Component: `~/.claude/skills/team-builder/gates/gate-2-implementation-done.md` and `~/.claude/skills/team-builder/briefs/backend.md`
- Date: 2026-02-15

## Symptoms

- All 24 Phase 7 endpoints returned 404 (routes not mounted in app.ts) — Gate 2 PASSED
- GDPR delete operation could partially fail leaving orphaned data — Gate 2 PASSED
- Two concurrent alert status updates could corrupt state machine — Gate 2 PASSED
- Work pattern upsert silently replaced daily totals with latest session — Gate 2 PASSED
- BurnoutScoringService returned fake "healthy" scores during DB outage — Gate 2 PASSED

## What Didn't Work

**Prior approach: Structural-only gate checks**

- Gate 2 had 7 checks: compiles, lints, endpoints exist (grep for route definitions), migrations exist, tests exist, tests pass, frontend components exist
- **Why it failed:** All 7 checks verify structure ("does the code exist?") not behavior ("does the code do the right thing?"). An endpoint can have a route handler, compile, lint, and have tests — but if the route file isn't mounted in app.ts, it returns 404.

**Prior approach: Relying on backend brief general guidance**

- Backend brief said "Implement input validation and error handling" and "Proper error responses"
- **Why it failed:** General advice without anti-patterns and concrete rules is insufficient for AI agents processing 90+ files. Agents followed the letter ("add try/catch") but not the spirit ("don't silently swallow errors").

## Solution

Two files edited to add behavioral correctness enforcement:

### 1. Backend Brief (`~/.claude/skills/team-builder/briefs/backend.md`)

Added "Behavioral Correctness Rules (MANDATORY)" section with 6 rules, each with:

- Explanation of WHY it prevents a P1
- Anti-pattern example (what NOT to do)
- Correct pattern example (what TO do)

```markdown
## Behavioral Correctness Rules (MANDATORY)

### 1. Route Mounting — Every route file MUST be imported and mounted

# Anti-pattern: Created routes/v2/wellness.routes.ts but never imported in app.ts

# Correct: Import and app.use('/api/v2/wellness', wellnessRouter) in app.ts

### 2. Error Handling — NEVER silently swallow errors

# Anti-pattern: catch (error) { return { score: 0 }; }

# Correct: catch (error) { logger.error(...); throw new ServiceError(...); }

### 3. Transactions — Multi-table writes MUST be atomic

# Anti-pattern: Sequential .delete() calls without transaction

# Correct: supabase.rpc() or db.transaction() wrapper

### 4. Concurrency — Read-then-write MUST handle races

# Anti-pattern: Read status then update (TOCTOU)

# Correct: Atomic conditional update with .eq('status', expectedStatus)

### 5. Upserts — MUST specify merge behavior explicitly

# Anti-pattern: Upsert replaces entire row (loses historical data)

# Correct: ON CONFLICT DO UPDATE SET total = existing + new

### 6. No persistent state in memory

# Anti-pattern: private settings = new Map<string, Settings>()

# Correct: Database-backed with TTL cache
```

### 2. Gate 2 (`~/.claude/skills/team-builder/gates/gate-2-implementation-done.md`)

Added 6 new behavioral checks (8-13), each with Tool, Why, Check procedure, Pass condition, and On failure instructions:

```markdown
### Check 8: Route Mounting Verification

# Grep entry point for imports AND app.use() of every new route file

### Check 9: Error Handling Patterns

# Grep for catch blocks that return defaults without logging/re-throwing

### Check 10: Transaction Usage for Multi-Table Operations

# Grep for functions with 2+ table writes, verify transaction usage

### Check 11: No Silent Data Loss Patterns

# Grep for private Map/Set declarations in service files

### Check 12: Concurrency Safety (Read-Then-Write)

# Grep for .select() followed by .update() on same table in same function

### Check 13: Type Safety (No `as any`)

# Grep for `as any` in new/modified files
```

### Mapping: Each P1 Type → Brief Rule + Gate Check

| P1 (Todo)                    | Brief Rule             | Gate Check                                    |
| ---------------------------- | ---------------------- | --------------------------------------------- |
| 147: V2 routes unmounted     | Rule 1: Route Mounting | Check 8                                       |
| 148: Non-atomic delete       | Rule 3: Transactions   | Check 10                                      |
| 149: TOCTOU race             | Rule 4: Concurrency    | Check 12                                      |
| 150: Upsert overwrites       | Rule 5: Upserts        | (caught by Check 9 if error handling correct) |
| 151: Silent error swallowing | Rule 2: Error Handling | Check 9                                       |

## Why This Works

1. **Brief rules prevent defects at creation time.** Agents read the brief before writing code. Concrete anti-patterns with "this will FAIL Gate 2" warnings give agents clear boundaries. General advice ("handle errors properly") is too vague for 90-file sprints.

2. **Gate checks catch defects at verification time.** Even if an agent ignores or misinterprets a brief rule, the automated grep-based gate checks will detect the violation before Phase 3. The gate sends the agent specific fix instructions ("Catch block in {file}:{line} swallows the error").

3. **Defense in depth.** Brief rules are the first line (preventive). Gate checks are the second line (detective). This mirrors the three-layer access control pattern already used in the Sovren backend (middleware auth + service scoping + database RLS).

4. **Each check is specific and automated.** Not "review code quality" but "grep for `catch` blocks that `return` defaults." Specific patterns can be verified by grep without human judgment.

## Prevention

- **When adding new gate checks:** Each check must have a Tool (Grep/Read/Bash), a specific pattern to search for, a Pass condition, and an On failure message with fix instructions. Vague checks ("code looks right") are useless.
- **When adding new brief rules:** Each rule must have a WHY (what P1 it prevents), an anti-pattern example, and a correct example. Rules without examples are ignored by agents.
- **After every feature sprint:** Run the review gap analysis — compare findings from `/workflows:review` against what Gate 2 should have caught. Add new checks for any P1 that slipped through.
- **90+ file sprints need behavioral gates:** Structural checks are necessary but insufficient. The larger the sprint, the more behavioral checks matter.

## Related Issues

- See also: [Phase 7 Review Gap Analysis](../process-issues/phase7-review-gap-analysis-5-p1s-in-90-files.md) — the analysis that identified the 5 root causes
- See also: [Phase 7 Creator Safety Net Sprint](../feature-implementation/phase7-creator-safety-net-sprint.md) — the sprint that produced PR #82
- See also: [Infrastructure Sprint Software Factory First](../infrastructure-issues/infrastructure-sprint-software-factory-first.md) — first sprint using team-builder gates
