---
title: 'MVP Quality Remediation: Zero @ts-nocheck via Root Interface Fixes and Two-Squad Parallel Execution'
date: 2026-04-01
category: workflow-issues
module: TypeScript type safety, CI pipeline, dependency management, backend interfaces
problem_type: workflow_issue
component: development_workflow
severity: high
applies_when:
  - Removing @ts-nocheck at scale (10+ files) with deep type mismatches
  - Multiple files share common root cause interface mismatches
  - Running parallel squads on a monorepo with zero file overlap
  - CI jobs skip due to GitHub Actions dependency chain propagation
  - Pre-existing test failures mask CI quality gate effectiveness
tags:
  - ts-nocheck
  - type-safety
  - parallel-squads
  - ci-pipeline
  - root-cause
  - interface-contracts
  - github-actions
  - dependency-upgrades
---

# MVP Quality Remediation: Zero @ts-nocheck via Root Interface Fixes and Two-Squad Parallel Execution

## Context

Sovren had 38 @ts-nocheck files (33 backend, 5 frontend), 20 failing backend tests, and CI jobs that appeared green but were actually skipping backend tests, builds, E2E, and Docker. A quality remediation sprint used two parallel squads to go from 38 to 0 @ts-nocheck, fix all tests, and repair the CI pipeline — in a single session.

## Guidance

### 1. When N files share K root causes, fix the roots first

The first two Squad A runs cleaned 15 of 33 backend files but stalled at 23 remaining. Each had 13-171 errors. The breakthrough: those 23 files shared only 6 root interface mismatches.

**Root causes found and fixed:**

- `ServiceToken` incompatible with inversify `ServiceIdentifier` → fixed ServiceContainer bindings to use `registerSingletonFactory`
- `IEventBus` had `publish()` but all call sites used `emit()` → added `emit()` to interface and implementation
- Missing `IUserAuthenticationService` interface → created it
- Dead inversify decorators on 6 services → removed (custom ServiceContainer doesn't use them)
- `Money` class missing from payment interfaces → added
- DI container types importing from factories instead of canonical interfaces → fixed imports

After fixing these 6 roots, the remaining 23 files became individually tractable (13-163 errors each, solvable file-by-file).

### 2. GitHub Actions skips propagate through transitive `needs` chains

**Problem:** Build, E2E, and Docker jobs were skipping on every main push even though they had no `if` condition. Test-gate (their direct dependency) was succeeding.

**Root cause:** GitHub Actions skips a job when ANY job in its transitive `needs` chain is skipped — even if the direct dependency succeeded via `if: always()`. When path filtering skipped backend tests (no backend changes), the skip propagated: test-backend(skipped) → test-gate(success via always()) → build(skipped because transitive dep was skipped).

**Fix:** Add explicit `if: always() && !cancelled() && needs.{direct-dep}.result == 'success'` to each downstream job. This overrides the transitive skip propagation while still respecting actual failures.

### 3. For InvoiceService-class files (100+ errors), create local row interfaces

When a shared type (e.g., `Invoice`) fundamentally doesn't match what the service code actually uses (different field names, missing fields, wrong types), don't try to fix the shared type — the blast radius is too large.

Instead, create a local `InvoiceInternal` interface at the top of the file that matches the code's actual usage. Cast Supabase responses through it. This isolates the type mismatch to one file without affecting other consumers.

### 4. Pre-existing test failures hide behind CI path filtering

CI showed green on main because backend tests only run when backend files change. The 20 test failures (DatabaseSessionManager column names, ContentSearchService ES v7/v8 mock format) were invisible until a backend-touching PR triggered them.

**Rule:** After any sprint that changes test infrastructure or interfaces, force a full CI run via `workflow_dispatch` to catch hidden failures.

### 5. Two-squad split: backend vs frontend+CI, not feature-based

The cleanest split for quality remediation is by package, not by feature:

- Squad A: `packages/backend/` (all services, routes, containers, factories)
- Squad B: `packages/frontend/`, `.github/`, `packages/shared/` (types only), `docs/`

This achieves zero file overlap without any coordination overhead. Feature-based splits (e.g., "payment squad" and "content squad") create overlap in shared infrastructure files (DI bindings, factories).

### 6. Worktree corruption risk from `rm -rf node_modules`

Running `rm -rf node_modules` in a git worktree can delete the `.git` symlink target metadata directory (`/repo/.git/worktrees/{name}/`). The worktree files survive but git commands fail.

**Recovery:** Recreate the metadata directory with `commondir`, `gitdir`, and `HEAD` files, then `git reset` to rebuild the index.

**Prevention:** Never use `rm -rf` in worktrees. Use `npm ci` instead of delete-and-reinstall.

## Why This Matters

- **Root-cause-first thinking** reduced the problem from "fix 23 files with 464 errors" to "fix 6 interfaces then do mechanical cleanup." Without this, each file looked independently intractable.
- **CI skip propagation** created a false sense of quality — green CI with no backend tests running. This could have shipped broken code to production.
- **The two-squad pattern** with package-based ownership is proven across 9+ sprints with zero merge conflicts.

## When to Apply

- Any @ts-nocheck removal sprint where file-by-file stalls after initial progress
- CI pipelines using GitHub Actions path filtering with multi-stage dependency chains
- Monorepo quality sprints needing parallel execution
- Post-merge CI validation (force full runs after infrastructure changes)

## Examples

**GitHub Actions skip fix — before and after:**

```yaml
# BEFORE: Build skips when transitive deps skip
build:
  needs: [test-gate]
  # No `if` — relies on default behavior, which skips

# AFTER: Build runs when test-gate succeeds
build:
  needs: [test-gate]
  if: always() && !cancelled() && needs.test-gate.result == 'success'
```

**Root interface fix — IEventBus:**

```typescript
// BEFORE: Interface has publish(), code calls emit()
interface IEventBus {
  publish(event: string, data?: unknown): void;
}

// AFTER: Add emit() as method
interface IEventBus {
  publish(event: string, data?: unknown): void;
  emit(event: string, data?: unknown): void;
}
```

**Local row interface for InvoiceService (163 errors → 0):**

```typescript
// At top of InvoiceService.ts — matches actual code usage, not shared type
interface InvoiceInternal {
  id: string;
  number: string;
  userId: string;
  total: number;
  items: Array<{ description: string; amount: number; quantity: number }>;
  billingAddress?: Record<string, unknown>;
  // ... all fields the code actually uses
}
```

## Related

- docs/solutions/workflow-issues/ts-nocheck-bulk-removal-cascade-pattern-20260330.md — file-by-file approach (still valid, this doc extends it with root-cause-first strategy)
- docs/solutions/workflow-issues/quality-sprint-five-learnings-20260331.md — measurement trap, SSRF, cascade patterns
- docs/solutions/workflow-issues/email-signup-auth-integration-learnings-20260401.md — Supabase auth integration
- docs/solutions/process-issues/wave2-remediation-systemic-gaps-domain-grouped-teams-20260219.md — domain-grouped parallel teams
- PRs: #224 (Squad A backend), #225 (Squad B frontend+CI)
