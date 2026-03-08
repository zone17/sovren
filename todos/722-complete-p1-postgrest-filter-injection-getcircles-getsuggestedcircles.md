---
status: pending
priority: p1
issue_id: '722'
tags: [code-review, slice-8, backend, security, injection, community]
dependencies: []
---

# PostgREST filter injection in getCircles/getSuggestedCircles

## Problem Statement

The `getCircles()` and `getSuggestedCircles()` methods in `CreatorCircleService.ts` construct `.or()` filter strings using direct string interpolation of the user-supplied `niche` parameter. This violates critical-patterns.md #11 (PostgREST filter escape) and allows an attacker to inject arbitrary PostgREST filter expressions, potentially bypassing RLS policies or exfiltrating data from other rows.

**Agent consensus: 4/9**

## Findings

In `services/community/CreatorCircleService.ts`, methods `getCircles()` and `getSuggestedCircles()` contain code similar to:

```typescript
// VULNERABLE — niche is user input interpolated directly into filter string
.or(`niche.eq.${niche},name.ilike.%${niche}%`)
```

PostgREST `.or()` and `.filter()` calls that include unescaped user input allow injection of PostgREST metacharacters: `\`, `%`, `_`, `:`, `"`. An attacker can craft a `niche` value that terminates the expected filter and appends additional filter clauses.

## Proposed Solutions

Apply the PostgREST filter escape pattern from critical-patterns.md #11. Escape order is critical — `\` must be escaped first:

```typescript
function escapePostgRestFilter(value: string): string {
  return value
    .replace(/\\/g, '\\\\') // 1. backslash first
    .replace(/%/g, '\\%') // 2. percent
    .replace(/_/g, '\\_') // 3. underscore
    .replace(/:/g, '\\:') // 4. colon
    .replace(/"/g, '\\"'); // 5. double-quote
}

// Usage in getCircles / getSuggestedCircles:
const safeNiche = escapePostgRestFilter(niche);
query = query.or(`niche.eq.${safeNiche},name.ilike.%${safeNiche}%`);
```

Alternatively, use separate `.eq()` and `.ilike()` chained calls instead of `.or()` with a string, which avoids constructing filter strings from user input entirely.

## Technical Details

- Affected file: `packages/backend/src/services/community/CreatorCircleService.ts`
- Affected methods: `getCircles()`, `getSuggestedCircles()`
- `niche` parameter originates from query string (`req.query.niche`) passed through to the service
- The `escapePostgRestFilter` utility may already exist from prior PostgREST injection fixes (search codebase before creating a new one)
- critical-patterns.md #11 has the canonical implementation and explains the ordering requirement

## Acceptance Criteria

- [ ] All `.or()` and `.filter()` calls in `CreatorCircleService.ts` that incorporate user input use the escape function
- [ ] Escape order matches critical-patterns.md #11: `\` → `%` → `_` → `:` → `"`
- [ ] Unit tests cover injection payloads: `\`, `%`, `_`, `:`, `"`, and a combined payload
- [ ] No new string-interpolated PostgREST filter strings introduced
- [ ] Existing `escapePostgRestFilter` utility reused if present; new one added to shared utils if absent
