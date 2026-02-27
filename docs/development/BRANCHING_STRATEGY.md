# Branching Strategy

Single source of truth for how code flows through the Sovren repository. All agents and squad members read this before starting work.

## Model: Trunk-Based Development with Merge Queue

```
main (protected, merge-queue only)
  ^
  |-- feat/squad-a/TICKET-123-payment-webhooks    (1-3 days)
  |-- feat/squad-b/TICKET-456-feed-pagination      (1-3 days)
  |-- fix/squad-a/TICKET-789-null-session           (< 1 day)
  |-- hotfix/TICKET-999-critical-auth-bypass        (hours)
```

- **One branch: `main`.** No `develop`, no `release/*`, no `staging`.
- **Feature branches live 1-3 days max.** Large features use stacked PRs.
- **All merges go through the merge queue.** No direct push, no admin bypass except hotfix lane.

## Branch Naming

```
{type}/{squad}/{ticket}-{slug}
```

| Segment | Values                                               | Required                                |
| ------- | ---------------------------------------------------- | --------------------------------------- |
| type    | `feat`, `fix`, `hotfix`, `chore`, `refactor`, `docs` | Yes                                     |
| squad   | `squad-a`, `squad-b`                                 | Yes for squad work, omit for solo/infra |
| ticket  | Uppercase ticket ID (e.g., `SOV-123`)                | Yes                                     |
| slug    | Lowercase kebab-case description                     | Yes                                     |

Examples:

- `feat/squad-a/SOV-123-payment-webhooks`
- `fix/squad-b/SOV-456-feed-scroll-position`
- `hotfix/SOV-999-auth-bypass`
- `chore/SOV-100-update-dependencies`

CI validates this pattern on PRs. Dependabot branches (`dependabot/**`) are exempt.

## Merge Flow

```
1. Developer creates branch from main
2. Opens PR targeting main
3. CI runs (lint, typecheck, test-gate)
4. CODEOWNERS auto-assigns reviewer from squad
5. 1 reviewer approves
6. Developer clicks "Merge when ready" → enters merge queue
7. Merge queue creates temporary branch, re-runs CI against main + queued PRs
8. All checks pass → squash merge to main
9. Head branch auto-deleted
```

## Squads & Ownership

| Package                                      | Owner      | CODEOWNERS Team                   |
| -------------------------------------------- | ---------- | --------------------------------- |
| `packages/backend/`                          | Squad A    | `@zone17/squad-a`                 |
| `packages/frontend/`                         | Squad B    | `@zone17/squad-b`                 |
| `packages/shared/`                           | Both       | `@zone17/squad-a @zone17/squad-b` |
| `packages/testing/`                          | Both       | `@zone17/squad-a @zone17/squad-b` |
| `.github/`, `scripts/`, root config          | Tech Leads | `@zone17/tech-leads`              |
| Auth middleware, payment service, SSRF utils | Tech Leads | `@zone17/tech-leads`              |

## Shared Package Changes

Changes to `packages/shared/` affect both squads. Follow the **Interface-First PR** pattern:

1. Open a small PR with ONLY the shared type/interface changes
2. Both squad leads are auto-requested via CODEOWNERS
3. Once merged, dependent PRs rebase against new `main`
4. Breaking changes require an ADR in `docs/decisions/` before the PR

See: [SHARED_PACKAGE_PROTOCOL.md](./SHARED_PACKAGE_PROTOCOL.md)

## Hotfix Lane

For production-critical fixes that cannot wait for the merge queue:

1. Create `hotfix/TICKET-{id}-{slug}` branch from `main`
2. Open PR, add `hotfix` label
3. Admin approves and merges via bypass (skips merge queue, still requires review + CI)
4. Queued PRs auto-rebase against new `main` HEAD

See: [HOTFIX_PROCEDURE.md](./HOTFIX_PROCEDURE.md)

## Claude Code PRs

PRs authored by Claude Code (or any AI tool):

- Always require a human reviewer from the relevant squad
- CODEOWNERS enforcement handles this automatically
- No self-approval of the final commit (`require_last_push_approval: true`)

## Required Status Checks

| Check      | Job Name          | Purpose                                                            |
| ---------- | ----------------- | ------------------------------------------------------------------ |
| Test Gate  | `CI / Test Gate`  | Aggregates backend + frontend + integration tests (skipped = pass) |
| Lint       | `CI / Lint`       | ESLint + Prettier                                                  |
| Type Check | `CI / Type Check` | TypeScript compilation                                             |

Only these 3 are registered as required. Individual test jobs are path-gated and may be skipped — the aggregator handles this correctly.

## Rules Summary

| Rule                        | Setting                               |
| --------------------------- | ------------------------------------- |
| Merge method                | Squash only                           |
| Required approvals          | 1 (CODEOWNERS-compliant)              |
| Stale review dismissal      | Yes                                   |
| Last push approval required | Yes                                   |
| Linear history              | Yes                                   |
| Force push                  | Blocked (no exceptions)               |
| Branch deletion             | Blocked on `main`                     |
| Auto-delete head branches   | Yes                                   |
| Merge queue                 | ALLGREEN, max 5 builds, 45min timeout |
| Direct push to main         | Blocked                               |

## Stacked PRs (for large features)

When a feature takes more than 3 days:

1. Break into independent, mergeable parts
2. Each part is its own PR: `feat/squad-a/SOV-123-part-1-models`
3. Parts merge independently to `main`
4. Each part passes review + CI on its own
5. No PR depends on another unmergeable PR
