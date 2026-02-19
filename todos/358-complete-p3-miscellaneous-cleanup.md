---
status: pending
priority: p3
issue_id: 358
tags: [code-review, cleanup]
---

# Miscellaneous cleanup — constructor pattern inconsistency, lazy service duplication, bracket notation, unnamed constraints, missing columns, duplicate constraints, duplicate columns, string instead of unions

## Problem Statement

A collection of minor style, quality, and consistency issues across the codebase that individually do not warrant dedicated tickets but collectively affect code quality and maintainability.

## Findings

- **Constructor pattern inconsistency**: Some services use constructor injection, others use property initialization
- **Lazy service duplication**: Multiple services implement their own lazy initialization pattern instead of sharing one
- **Bracket notation `apiClient['request']`**: Private member access via bracket notation instead of proper encapsulation
- **Unnamed CHECK constraint**: At least one CHECK constraint in migrations lacks an explicit name, making it hard to reference in future migrations
- **No `updated_at` on `business_invoices`**: Table missing standard audit column
- **Duplicate unique constraints**: Some tables have redundant unique constraints on the same column(s)
- **`platform_connections.instance_url` added twice**: Column appears in multiple migrations, relying on `IF NOT EXISTS` to avoid errors
- **Interface params using `string` instead of unions**: Method parameters typed as `string` where a union type (e.g., `'buyer' | 'seller'`) would be more precise

## Proposed Solutions

1. Address each item individually during future sprints as part of code cleanup
2. Prioritize items that affect correctness (unnamed constraints, missing `updated_at`) over pure style issues
3. Use this ticket as a tracking umbrella — create sub-tasks if any item grows in scope

## Acceptance Criteria

- [ ] Constructor injection pattern is consistent across new services
- [ ] Lazy initialization uses a shared utility or decorator
- [ ] Bracket notation replaced with proper public/protected methods or friend patterns
- [ ] CHECK constraints have explicit names
- [ ] `business_invoices` has `updated_at` column with trigger
- [ ] Duplicate unique constraints removed
- [ ] Duplicate `instance_url` migration consolidated
- [ ] String params replaced with union types where applicable
