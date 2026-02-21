---
status: pending
priority: p3
issue_id: 350
tags: [code-review, simplicity]
---

# Service-layer validation redundant with Zod validators

## Problem Statement

Multiple service methods re-validate input data that has already been validated by Zod schemas at the route boundary. This adds approximately 40 lines of redundant code, increases maintenance burden, and risks divergence between route-level and service-level validation rules.

## Findings

- Multiple services perform manual checks (e.g., `if (!field) throw ...`) on fields already guaranteed present by Zod
- Zod schemas at the route layer `.parse()` or `.safeParse()` inputs before they reach services
- Redundant validation creates two sources of truth for what constitutes valid input
- ~40 lines of code across multiple services could be removed

## Proposed Solutions

1. Remove service-layer validation that duplicates Zod schema checks
2. Keep only service-layer validation for business logic rules that depend on database state (e.g., "does this entity exist?")
3. Add a code comment convention to distinguish input validation (Zod's job) from business rule validation (service's job)

## Acceptance Criteria

- [ ] Redundant input validation removed from service methods where Zod already validates
- [ ] Business-rule validation (stateful checks) remains in services
- [ ] No regression in error handling — invalid inputs still produce clear error messages
