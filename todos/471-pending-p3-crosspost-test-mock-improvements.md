---
status: pending
priority: p3
issue_id: '471'
tags: [code-review, tests, quality]
dependencies: []
---

# CrossPostService test and mock improvements (omnibus)

## Problem Statement

Multiple minor P3 improvements identified during PR #96 review. None are blocking but collectively improve test reliability and mock completeness.

## Findings

1. **cancel() count-guard not tested** — `cancel()` throws when `count === 0` but no test covers this path (CrossPostService.test.ts line 255)
2. **supabase-mock missing `rpc` method** — `ISupabaseClient` includes `rpc()` but `createMockChain` doesn't stub it; services calling `.rpc()` must add it manually each time
3. **supabase-mock missing count-exact `select` override** — `select('id', { count: 'exact', head: true })` returns `count: undefined` instead of computed count
4. **Set vs Array for `enqueuedIds`** — `includes()` on array is O(n) vs `has()` on Set; harmless at MAX_CROSS_POST_TARGETS=10 but idiomatic improvement
5. **Test imports use direct paths instead of barrel** — `../../../test-utils/supabase-mock` could use `../../../test-utils`

## Effort

30 minutes total for all items

## Acceptance Criteria

- [ ] cancel() has test for count=0 throwing ValidationError
- [ ] createMockChain includes `rpc` stub
- [ ] createMockChain select handles `count: 'exact'` option
- [ ] Tests pass

## Resources

- **PR:** #96
- **Pattern:** common-solutions.md #7 (mock chain builder)
