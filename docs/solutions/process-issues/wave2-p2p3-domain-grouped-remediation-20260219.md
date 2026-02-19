---
title: 'P2/P3 Domain-Grouped Remediation: 38 Findings Fixed by 6 Parallel Specialists'
date: 2026-02-19
category: process-issues
tags:
  - remediation
  - domain-grouped-agents
  - parallel-execution
  - pre-commit-hooks
  - validation-migration
  - test-drift
  - anti-pattern-scanner
module:
  - backend/routes
  - backend/services
  - backend/infrastructure
  - backend/security
  - frontend
  - testing
severity: P2/P3
symptoms:
  - '38 pending P2/P3 review findings blocking Wave 2 branch merge'
  - 'Pre-commit hook bash bug: integer expression expected from grep -c'
  - 'Missing validate() pattern recognition in anti-pattern scanner'
  - '12 community test failures after validation-to-Zod migration'
root_cause:
  - 'Domain-specific implementation gaps from Wave 2 review'
  - 'Anti-pattern scanner incomplete (bash bug + missing patterns)'
  - 'Test mocks stale after service refactoring (#350, #354, #339)'
status: resolved
commit: 10fa8da
files_changed: 104
lines_added: 4056
lines_removed: 659
---

# P2/P3 Domain-Grouped Remediation Sprint

## Problem

38 pending P2/P3 findings from the Wave 2 review (EPIC-009B, 010, 011) blocked the branch merge. Findings spanned 6 domains: routes, services, infrastructure, security, frontend, and tests.

## Solution: 6 Domain-Grouped Parallel Specialists

Each specialist owned non-overlapping files. Result: **zero merge conflicts**, 104 files changed in a single commit.

| Specialist | Domain         | Todos                                   | Key Changes                                                                                           |
| ---------- | -------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| routes     | API endpoints  | #327,#337,#338,#344                     | CRUD for mentorships, contracts, invoices, taxes, marketplace orders                                  |
| services   | Business logic | (stubs for routes)                      | `updateMentorProfile()`, `deleteExpense()`, `deleteInvoice()`, `deleteContract()`, `deleteTemplate()` |
| infra      | Data layer     | #318,#320,#348,#350,#353,#354           | TTLCache, count queries, bulk inserts, Zod migration                                                  |
| security   | Type safety    | #323,#324,#325,#336,#342,#343           | Eliminated all `as any`, open redirect validation, dead code removal                                  |
| frontend   | UI components  | #329,#330,#331,#332,#333,#334,#335,#356 | ErrorBoundary, outside-click, reply isolation, scoped invalidation                                    |
| tests      | Test alignment | #339,#350,#354                          | 12 test fixes (6 removed, 1 mock fixed, 5 pagination updated)                                         |

## Key Learnings

### 1. Anti-Pattern Scanner Bash Bug

`grep -c` can return multi-line output on some systems, causing `[: integer expression expected`.

```bash
# BROKEN:
HAS_BODY=$(grep -c 'req\.body' "$f" 2>/dev/null || echo 0)
if [ "$HAS_BODY" -gt 0 ]; then  # fails if grep -c returns "0\n0"

# FIXED:
HAS_BODY=$(grep -c 'req\.body' "$f" 2>/dev/null | head -1 || echo 0)
if [ "${HAS_BODY:-0}" -gt 0 ]; then  # safe default + single value
```

### 2. Anti-Pattern Scanner Missing `validate()` Pattern

The scanner checked for `validateRequest|zodValidate|\.safeParse|\.parse(` but NOT for the `validate()` middleware wrapper used throughout the codebase.

```bash
# BEFORE (missed validate middleware):
HAS_VALIDATE=$(grep -cE 'validateRequest|zodValidate|\.safeParse|\.parse\(' "$f")

# AFTER (catches validate middleware):
HAS_VALIDATE=$(grep -cE 'validateRequest|zodValidate|\bvalidate\b|\.safeParse|\.parse\(' "$f")
```

### 3. Test Drift After Validation-to-Zod Migration (#350)

When service-layer validation moves to Zod at the route layer, service tests become stale.

**Pattern: Remove service validation tests, keep business logic tests.**

```typescript
// REMOVED (now validated by Zod at route layer):
it('throws when niche is empty', ...)
it('throws when content exceeds 5000 characters', ...)

// KEPT (stateful business rule, needs DB):
it('throws when mentor is at maximum capacity', ...)
it('throws when duplicate mentorship exists', ...)
```

### 4. Count-Based Query Mock Update (#354)

When `select('*')` + `.length` becomes `select('id', { count: 'exact', head: true })`, mocks must change shape.

```typescript
// OLD mock (fetch-all-then-count):
makeChain({ data: [{ id: 'ms-1' }, { id: 'ms-2' }], error: null });

// NEW mock (count-based):
makeChain({ count: 2, error: null } as any);
```

### 5. Pagination Return Shape Change (#339)

When `getListings()` adds `.range()` pagination, return type changes from flat array to `{ items, total }`.

```typescript
// OLD test expectation:
expect(result).toEqual(listings);

// NEW test expectation:
expect(result).toEqual({ items: listings, total: 1 });

// Mock chain needs range():
const chain = { ...existingChain, range: jest.fn().mockReturnThis() };
```

### 6. Eliminating `any` Types for Pre-Commit Compliance

```typescript
// BEFORE (fails pre-commit):
const db = container.resolve(TYPES.Database) as any;
const row: any = { creator_id: creatorId, ... };
(c: any) => c.platform === platform

// AFTER (passes pre-commit):
const db = container.resolve(TYPES.Database) as ISupabaseClient;
const row: Record<string, unknown> = { creator_id: creatorId, ... };
(c: { platform: string; status: string; ... }) => c.platform === platform
```

## Process Insights

1. **Domain-grouped agents scale to zero conflicts** -- partition by file ownership, not function type
2. **Budget a lint-fix pass after agent work** -- pre-commit hooks catch formatting/type issues agents miss
3. **Anti-pattern scanners need to match actual middleware patterns** -- test the scanner against real route files
4. **Service validation removal requires test triage** -- count affected tests before starting
5. **One epic per branch** -- Wave 2's 3-epic branch produced 46 findings (10 P1); this is the 3rd remediation sprint

## Cross-References

- [Wave 2 P1 Remediation](wave2-remediation-systemic-gaps-domain-grouped-teams-20260219.md) -- 14 P1 fixes, same domain-grouped approach
- [Wave 2 Root Cause Analysis](wave2-review-root-cause-precommit-scanner-20260218.md) -- Pre-commit scanner design
- [P2 Final Remediation (PR #85)](../code-quality/p2-final-remediation-sprint-22-todos-20260218.md) -- TTLCache pattern, DI fixes
- [P3 Remediation (PR #85)](../code-quality/p3-remediation-sprint-19-todos-20260217.md) -- File-grouped agents, 8 agents zero conflicts
- [Prevention Code Patterns](../PREVENTION_CODE_PATTERNS.md) -- Reusable code patterns
- [R7 Meta-Analysis](../R7_META_ANALYSIS_REVIEW_METHODOLOGY.md) -- Why parallel agents beat sequential reviews

## Metrics

| Metric            | Value                                |
| ----------------- | ------------------------------------ |
| Findings fixed    | 38 (24 P2, 14 P3)                    |
| Specialist agents | 6                                    |
| Merge conflicts   | 0                                    |
| Files changed     | 104                                  |
| Lines added       | +4,056                               |
| Lines removed     | -659                                 |
| Community tests   | 191/191 pass                         |
| Finance tests     | 193/193 pass                         |
| Pre-commit passes | 3rd attempt (2 scanner fixes needed) |
