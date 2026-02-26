---
status: complete
priority: p2
issue_id: '537'
tags: [code-review, typescript, type-safety, pr-100]
dependencies: []
---

# P2: ContentSearchParams tags array silently cast to QueryParams

## Problem Statement

In `apiClient.ts` line 198, `ContentSearchParams` is cast to `QueryParams`:

```typescript
async searchContent(params: ContentSearchParams): Promise<PaginatedResponse<ContentSearchResult>> {
  return this.request('GET', '/api/v1/content/search', undefined, params as QueryParams);
}
```

`ContentSearchParams` has a `tags: string[]` field, but `QueryParams` is `Record<string, string | number | boolean | undefined>`. Arrays are not in the `QueryParams` union — `string[]` silently passes the `as` assertion but `URLSearchParams.append(key, String(value))` would stringify it as `"tag1,tag2"` rather than using repeated params (`tags=tag1&tags=tag2`).

**Agent consensus**: 1/8 (TypeScript Reviewer) — but type-safety class finding

## Findings

### TypeScript Reviewer (Kieran)

- `tags: string[]` in ContentSearchParams doesn't fit `QueryParams` type
- The `as QueryParams` cast suppresses the type error
- Runtime behavior: `String(['tag1', 'tag2'])` → `"tag1,tag2"` — server may not parse this correctly

## Proposed Solutions

### Option A: Serialize tags before passing to request (Recommended)

Pre-process the params: join tags as comma-separated or use repeated params.

```typescript
async searchContent(params: ContentSearchParams): Promise<PaginatedResponse<ContentSearchResult>> {
  const { tags, ...rest } = params;
  const queryParams: QueryParams = { ...rest };
  if (tags?.length) queryParams.tags = tags.join(',');
  return this.request('GET', '/api/v1/content/search', undefined, queryParams);
}
```

**Pros**: Explicit serialization, type-safe, no `as` cast
**Cons**: Need to verify server expects comma-separated tags
**Effort**: Small (10 min)
**Risk**: Low (verify server expectation)

### Option B: Extend QueryParams to support arrays

Change `QueryParams` to `Record<string, string | number | boolean | string[] | undefined>` and update the URL building logic to handle arrays.

**Pros**: General solution for all array params
**Cons**: More changes to the request method
**Effort**: Medium (20 min)
**Risk**: Low

### Option C: Defer — pre-existing

This pattern existed before PR #100. The search feature may not even be active yet.

**Pros**: Zero effort
**Cons**: Silent data corruption when search is used
**Effort**: None
**Risk**: Low (if search is unused)

## Recommended Action

Option A — explicit and minimal.

## Technical Details

**Affected files:**

- `packages/frontend/src/services/api/apiClient.ts` (line 198)

## Acceptance Criteria

- [ ] No `as QueryParams` cast on types containing arrays
- [ ] Array params are explicitly serialized before URL building
- [ ] TypeScript compilation passes without the cast

## Work Log

| Date       | Action                                | Learnings                     |
| ---------- | ------------------------------------- | ----------------------------- |
| 2026-02-26 | Created from PR #100 review (8-agent) | 1/8 but valid type-safety gap |

## Resources

- PR #100: https://github.com/zone17/sovren/pull/100
