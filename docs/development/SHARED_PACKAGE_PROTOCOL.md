# Shared Package Protocol

Rules for modifying `packages/shared/` when two squads depend on it.

## The Problem

`packages/shared/` contains types, utilities, and configurations used by both `packages/backend/` (Squad A) and `packages/frontend/` (Squad B). A breaking change here blocks both squads.

## The Rule

**Never combine shared package changes with consumer changes in the same PR.**

## Interface-First PR Pattern

### Step 1: Shared PR

Open a PR that modifies ONLY `packages/shared/`:

```
feat/squad-a/SOV-200-add-payment-event-types
  └── packages/shared/src/types/payment-events.ts  (new types)
```

Both squad leads are auto-requested via CODEOWNERS.

### Step 2: Consumer PRs

After the shared PR merges, each squad opens their own PR:

```
feat/squad-a/SOV-201-backend-payment-events
  └── packages/backend/src/services/payment/events.ts  (uses new types)

feat/squad-b/SOV-202-frontend-payment-feed
  └── packages/frontend/src/features/payments/feed.tsx  (uses new types)
```

These can be developed in parallel and merge independently.

## Breaking Changes

A breaking change modifies existing types/functions in `packages/shared/` that consumers already use.

Before opening a breaking change PR:

1. **Write an ADR** in `docs/decisions/` explaining the why
2. **Coordinate with both squads** — agree on migration timeline
3. **Use a migration pattern** — add new types alongside old, deprecate, then remove in a follow-up PR

## Additive Changes

New exports that don't modify existing code are low-risk:

- New type definitions
- New utility functions
- New constants

These still require both-squad review via CODEOWNERS but can merge quickly.

## CI Behavior

When `packages/shared/` changes, CI runs BOTH backend and frontend tests:

```yaml
# dorny/paths-filter in ci.yml
backend:
  - 'packages/backend/**'
  - 'packages/shared/**' # shared changes trigger backend tests
frontend:
  - 'packages/frontend/**'
  - 'packages/shared/**' # shared changes trigger frontend tests
```

This ensures no shared change breaks either consumer.
