---
status: pending
priority: p2
issue_id: '048'
tags: [code-review, architecture, rate-limiting, duplication]
dependencies: []
---

# Three Duplicate Rate Limiter Implementations

## Problem Statement

Three separate rate limiting implementations exist in the codebase, creating maintenance burden, inconsistent behavior, and potential security gaps. Additionally, a custom in-memory rate limiter in webhooks code has unbounded Map growth leading to memory leaks.

## Findings

**Location**:

- `middleware/rate-limit-middleware.ts` (290 lines)
- `middleware/rateLimit.ts` (214 lines)
- `middleware/advanced-rate-limiting.ts` (1237 lines)
- `routes/webhooks-race-condition-hardened.ts:57-113`

**Implementation 1: rate-limit-middleware.ts**:

- 290 lines
- Wrapper around express-rate-limit
- Used by app.ts and v1 routes
- PascalCase naming
- Multiple preset configurations

**Implementation 2: rateLimit.ts**:

- 214 lines
- camelCase naming convention
- Used ONLY by ai-recommendations.ts
- Duplicate functionality of implementation 1

**Implementation 3: advanced-rate-limiting.ts**:

- 1237 lines - God object
- 8 separate classes
- Used ONLY by unified-nostr-auth.ts
- Includes bypass detection, penalty system, distributed attack detection
- Most complex but least reused

**Implementation 4: Custom webhook limiter**:

- In-memory Map with no expiration
- Unbounded growth - memory leak
- No cleanup mechanism
- Reinvents existing solutions

## Proposed Solutions

1. **Consolidate to Single Implementation** (Recommended):

   - Choose rate-limit-middleware.ts as canonical (most widely used)
   - Extract advanced features from advanced-rate-limiting.ts as plugins
   - Migrate ai-recommendations.ts to use consolidated middleware
   - Migrate webhook rate limiting to use consolidated middleware
   - Delete rateLimit.ts and advanced-rate-limiting.ts
   - Extract bypass detection, penalty system as optional middleware

2. **Keep Advanced, Deprecate Others**:

   - Migrate all routes to advanced-rate-limiting.ts
   - Add simple preset configurations
   - Delete other implementations
   - Higher complexity cost

3. **Clear Separation by Use Case**:
   - Document when to use which implementation
   - Rename for clarity (basic-rate-limit, advanced-rate-limit)
   - Still maintains duplication

## Technical Details

**Current Usage**:

```
rate-limit-middleware.ts → app.ts, v1 routes (10+ consumers)
rateLimit.ts → ai-recommendations.ts (1 consumer)
advanced-rate-limiting.ts → unified-nostr-auth.ts (1 consumer)
webhooks custom → webhooks-race-condition-hardened.ts (1 consumer)
```

**Migration Path**:

1. Audit all rate-limit call sites
2. Create unified configuration schema
3. Implement plugin system for advanced features
4. Migrate low-complexity consumers first
5. Migrate advanced consumers with feature parity verification
6. Remove deprecated implementations

**Files Requiring Changes**:

- All 4 rate limiter implementations
- `routes/ai-recommendations.ts`
- `routes/unified-nostr-auth.ts`
- `routes/webhooks-race-condition-hardened.ts`
- Any other files importing rate limiters

## Acceptance Criteria

- [ ] Single canonical rate limiter implementation exists
- [ ] All routes migrated to use consolidated implementation
- [ ] Advanced features (bypass detection, penalties) available as plugins
- [ ] Webhook rate limiting uses consolidated implementation with TTL
- [ ] No unbounded Map growth in rate limiting code
- [ ] Performance benchmarks show no regression
- [ ] Unit tests cover all migrated use cases
- [ ] Integration tests verify rate limiting behavior unchanged
- [ ] Old implementations deleted
- [ ] Documentation updated with usage guidelines
- [ ] Memory leak tests confirm no unbounded growth

## Work Log

Created: 2026-02-12

## Resources

- PR #73 post-remediation review
- express-rate-limit documentation
- Rate limiting best practices
