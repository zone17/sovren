---
status: pending
priority: p3
issue_id: "697"
tags: [code-review, quality, slice-8]
dependencies: []
---

# Code quality: JSDoc, imports, types, misc

## Items

1. Add JSDoc to all `followApi.ts` methods (match `commentsApi.ts` pattern)
2. Combine duplicate import lines in `INotificationPersistenceService.ts:9-10`
3. Remove `React` namespace import from `FollowButton.tsx` (automatic JSX transform)
4. Fix `followApi.ts` type cast `params as Record<string, number | undefined>`
5. Replace inline pagination parsing in routes with `PaginationSchema.safeParse`
6. Simplify event ID generation in `FollowService` (use `crypto.randomUUID()` directly)
7. Update `types.ts` header comment (stale "Total Services: 39")
8. Update API info endpoint at `index.ts` with missing routes
9. Add vitest import/reference directive to new test files
10. Add `markRead`/`delete` mutation count guard (NotificationPersistenceService)
11. Add `getCirclePosts()` pagination
