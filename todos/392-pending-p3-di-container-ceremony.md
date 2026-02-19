---
status: pending
priority: p3
issue_id: 392
tags:
  - code-review
  - architecture
  - dhh
dependencies: []
---

# Excessive DI Container Ceremony for Single-Implementation Services

## Problem Statement

Interface-per-service with Inversify container adds significant ceremony (interface file, TYPES token, binding registration, container.resolve call) for services that have only a single implementation. This is the classic over-abstraction trade-off: testability vs. simplicity. For services unlikely to ever have alternative implementations, the DI overhead may not be justified.

## Findings

**Source agents:** dhh-agent, code-review-agent

**Evidence:**

- File: `packages/backend/src/container/`
- Issue: Every service requires 4 artifacts (interface file, TYPES token, binding registration, container.resolve call) regardless of whether the service will ever have more than one implementation. This adds boilerplate and cognitive overhead. The DHH perspective would argue that most services are effectively singletons with no real need for interface indirection.

## Proposed Solutions

### Option A: Keep DI, acknowledge trade-off (recommended for now)

- **Approach:** Keep the current DI approach for testability benefits. Document the decision in an ADR. Consider consolidating interfaces for services that are clearly single-implementation and unlikely to change.
- **Effort:** Small
- **Risk:** Low

### Option B: Selective DI removal

- **Approach:** Identify services that are pure utility/infrastructure with no realistic alternative implementations. Convert those to direct imports while keeping DI for services with genuine abstraction value (payment providers, notification services, etc.).
- **Effort:** Large
- **Risk:** Medium (reduces testability for converted services)

## Recommended Action

_To be filled during triage_

## Technical Details

**Affected files:**

- `packages/backend/src/container/` (all container files)
- `packages/backend/src/interfaces/` (all interface files)
- `packages/backend/src/services/` (all service files)

## Acceptance Criteria

- [ ] Decision documented (keep DI or selectively remove)
- [ ] If keeping DI: no action needed beyond documentation
- [ ] If selectively removing: identified candidates listed and converted
- [ ] All tests pass after any changes

## Work Log

| Date       | Action  | Notes                      |
| ---------- | ------- | -------------------------- |
| 2026-02-19 | Created | PR #86 code review finding |

## Resources

- PR: https://github.com/zone17/sovren/pull/86
