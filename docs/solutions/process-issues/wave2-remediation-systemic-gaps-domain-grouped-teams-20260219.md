---
title: 'Wave 2 P1 Remediation: Domain-Grouped Specialists with Mandatory Compound Doc Reading'
date: '2026-02-19'
category: process-issues
tags:
  - remediation
  - domain-specialization
  - compound-learning
  - multi-epic-scope
  - race-conditions
  - security-definer
  - ssrf
  - api-contracts
module: wave2-epics-009b-010-011
severity: '14 P1 fixed, 2 reclassified P1->P2, 24 P2, 14 P3 outstanding'
symptoms:
  - '54 post-remediation findings from 12-agent parallel review'
  - 'User observed: findings increasing despite compound learning loop'
  - '3 epics on one branch = 3x review surface area'
  - 'Agents not reading existing prevention docs before implementing'
root_cause:
  - 'Multi-epic branch scope violation (3 epics, 140+ files)'
  - 'Agent briefs lacked mandatory compound doc reading requirement'
  - 'Severity inflation: 2 P2 items misclassified as P1'
---

# Wave 2 P1 Remediation: Domain-Grouped Specialists with Mandatory Compound Doc Reading

## Problem Symptom

Post-remediation review of branch `feat/wave2-epics-009b-010-011` (EPIC-009b, 010, 011) using 12 parallel review agents found **54 findings**: 16 P1, 24 P2, 14 P3. The user observed that findings were _increasing_ despite the compound learning loop, questioning whether the process was working.

## Root Cause Analysis

### Finding #1: Multi-Epic Branch Scope Violation

Three epics on one branch produced 3x the review surface area. Prior single-epic sprints averaged 8-12 findings. This branch had 140+ files and 13,347+ lines changed.

**Evidence**: Phase 1 Epics (02-16) used 3 _separate_ enterprise sprints in parallel. This sprint merged all 3 onto one branch, defeating the scope isolation that keeps reviews manageable.

### Finding #2: Agents Not Reading Compound Docs

Existing `PREVENTION_CODE_PATTERNS.md` and `WAVE2_PREVENTION_CHECKLIST.md` contained patterns that would have prevented at least 6 findings (SECURITY DEFINER hardening, useRef guards, decimal IP SSRF, atomic RPC, rate limiting). But agent briefs didn't _mandate_ reading them.

**Evidence**: 13 of 16 P1s were pre-existing in the original implementation (missed by first review). Only 3 were introduced by the remediation itself (#305, #306, #307 in the RPC migration).

### Finding #3: Severity Inflation

Two items (#318 unbounded query, #320 constructor side effect) were classified P1 but were actually P2 — they degrade performance but don't cause data loss or security breaks. This wasted remediation capacity.

## Solution: Domain-Grouped Specialist Teams

### Approach

Instead of a general-purpose team, we created 4 domain specialists with:

- **Non-overlapping file ownership** = zero merge conflicts
- **Mandatory compound doc reading** in every brief
- **Severity triage before work** to reclassify inflated items

### Team Composition

| Specialist               | Domain                        | Findings Fixed                     | Files Touched                     |
| ------------------------ | ----------------------------- | ---------------------------------- | --------------------------------- |
| sql-specialist           | SQL migrations, RPC functions | #305, #306, #307, #308, #309, #317 | 4 migration files, 1 shared types |
| frontend-api-specialist  | API contracts, hooks          | #310, #311, #312, #313             | 5 frontend files                  |
| security-specialist      | SSRF, rate limiting           | #314, #319                         | 5 backend files                   |
| frontend-race-specialist | Financial mutation guards     | #315, #316                         | 2 frontend components             |

### Results

- **14 P1 findings fixed**, 2 reclassified to P2
- **Zero merge conflicts** (non-overlapping domains)
- **All 197 tests pass** (including 3 test fixes for RPC migration)
- **Pre-commit hooks** caught test failures from API changes before commit

## Key Code Patterns

### 1. SECURITY DEFINER RPC Hardening

Every `SECURITY DEFINER` function must include:

```sql
CREATE OR REPLACE FUNCTION my_function(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '' AS $$  -- Prevents search_path injection
BEGIN
  IF p_id != auth.uid() THEN  -- Auth verification
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  UPDATE public.my_table SET ...;  -- Explicit public. prefix
END;
$$;
REVOKE ALL ON FUNCTION my_function(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION my_function(UUID) TO authenticated;
```

### 2. Decimal Integer IP SSRF Bypass

Attackers encode `127.0.0.1` as `2130706433` to bypass string-based hostname checks:

```typescript
function isDecimalIntegerIp(value: string): boolean {
  if (!/^\d+$/.test(value)) return false;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0 || num > 0xffffffff) return false;
  // Check private/reserved ranges
  const a = (num >>> 24) & 0xff;
  if (a === 127 || a === 10) return true; // loopback, 10.x
  if (a === 172 && ((num >>> 16) & 0xff) >= 16 && ((num >>> 16) & 0xff) <= 31) return true;
  if (a === 192 && ((num >>> 16) & 0xff) === 168) return true;
  return a === 0; // 0.0.0.0/8
}
```

Apply in both `validateSsrfUrl` (async) and `validateSsrfUrlSync` (sync) paths.

### 3. Atomic RPC Replaces Non-Atomic Loops

```typescript
// WRONG: Loop of individual updates (race window between rows)
for (const split of splits) {
  await this.db.from('content_collaborators').update({ bps: split.bps }).eq('id', split.id);
}

// RIGHT: Single atomic RPC call
await this.db.rpc('update_revenue_split_atomic', {
  p_content_id: contentId,
  p_splits: splits.map((s) => ({ creator_id: s.creatorId, bps: s.bps })),
});
```

### 4. useRef Synchronous Guard for Financial Mutations

React Query's `isPending` is async (state update). `useRef` is synchronous — catches rapid double-clicks:

```typescript
const pendingRef = useRef<string | null>(null);
const handleMarkPaid = (invoiceId: string) => {
  if (pendingRef.current === invoiceId || isPending) return;
  pendingRef.current = invoiceId;
  markPaid(invoiceId, {
    onSettled: () => {
      pendingRef.current = null;
    },
  });
};
```

### 5. useRef Mutual Exclusion Across Multiple Mutations

For pages with multiple financial actions (pay, refund, dispute, cancel):

```typescript
const actionInFlightRef = useRef(false);
// Each mutation checks and sets the shared ref
onMutate: () => {
  if (actionInFlightRef.current) return;
  actionInFlightRef.current = true;
};
onSettled: () => {
  actionInFlightRef.current = false;
};
```

### 6. Mutation Rate Limiter on Business Routes

```typescript
import { mutationRateLimiter } from '../middleware/rateLimiters';
router.post('/:id/mark-paid', authenticate, mutationRateLimiter, handler);
router.put('/:id/status', authenticate, mutationRateLimiter, handler);
```

## Prevention Strategies

### Process Rules

1. **One epic per branch** — multi-epic branches produce 3x more findings. Each epic gets its own branch and `/workflows:review` cycle.
2. **Severity pre-triage** — Architect + Product Owner triage before assigning work. P1 = crash/data loss/security. P2 = quality/performance. Reduces wasted effort.
3. **Mandatory compound doc reading** — Every agent brief must list specific compound docs to read before coding.

### Brief Engineering

Every agent brief must include:

```markdown
## COMPOUND DOCS TO READ (NON-NEGOTIABLE)

Before writing ANY code, read these:

1. PREVENTION_CODE_PATTERNS.md — SECURITY DEFINER, useRef guards, decimal IP, atomic RPC
2. WAVE2_PREVENTION_CHECKLIST.md — pre-commit hooks, mock validation, file ownership
3. Your domain's solution docs in docs/solutions/
```

### Technical Checks

| Check                                       | When             | What               |
| ------------------------------------------- | ---------------- | ------------------ |
| SECURITY DEFINER has `SET search_path = ''` | SQL file staged  | Pre-commit hook    |
| Financial mutations have useRef guard       | Component review | Pattern check      |
| Multi-row updates use RPC not loops         | Service review   | Architecture check |
| Business POST/PUT routes have rate limiter  | Route review     | Security check     |
| API field names match shared Zod schemas    | Frontend review  | Contract check     |

## What Worked Well

1. **Domain-grouped specialists** — Zero merge conflicts, each agent is an expert in their area
2. **Mandatory compound doc reading** — Specialists applied patterns from prior sprints correctly
3. **Severity triage before work** — Reclassifying 2 items saved effort and focused on real P1s
4. **Pre-commit hooks** — Caught test failures from RPC migration before commit (3 test mocks needed updating)
5. **Non-overlapping file ownership** — 4 agents worked in parallel with zero coordination overhead

## Cross-References

- [Wave 2 Root Cause Analysis (brainstorm)](../process-issues/wave2-review-root-cause-precommit-scanner-20260218.md) — Original brainstorm identifying the 3 systemic gaps
- [PREVENTION_CODE_PATTERNS.md](../PREVENTION_CODE_PATTERNS.md) — Code patterns that agents should have read
- [WAVE2_PREVENTION_CHECKLIST.md](../WAVE2_PREVENTION_CHECKLIST.md) — Implementation checklist for prevention strategies
- [PR #85 Remediation (25 findings)](../security-issues/pr85-review-remediation-25-findings-20260217.md) — Prior remediation sprint using dependency-ordered phases
- [P2 Final Remediation (22 todos)](../code-quality/p2-final-remediation-sprint-22-todos-20260218.md) — Domain-grouped agents pattern first used here
- [R7 Meta-Analysis](../R7_META_ANALYSIS_REVIEW_METHODOLOGY.md) — Why parallel 13+ agents beats sequential reviews
- [Phase 1 Epics (3 parallel sprints)](../feature-implementation/phase1-epics-3-parallel-sprints-20260216.md) — The original multi-epic implementation
- [P1 Payment Persistence Patterns](../security-issues/p1-critical-fixes-pr73-round6-payment-persistence.md) — Reusable payment patterns (atomic-write, write-mutex)

## Metrics

| Metric                | This Sprint                     | Prior Sprint (P2 Final) |
| --------------------- | ------------------------------- | ----------------------- |
| Findings fixed        | 14 P1                           | 22 (1 P1, 21 P2)        |
| Agents                | 4 domain specialists            | 6 domain-grouped        |
| Merge conflicts       | 0                               | 0                       |
| Tests passing         | 197/197                         | All                     |
| Test fixes needed     | 3 (RPC mock updates)            | Pre-commit lint fixes   |
| Severity reclassified | 2 (P1->P2)                      | 0                       |
| Net learning          | Mandatory doc reading in briefs | Domain grouping works   |
