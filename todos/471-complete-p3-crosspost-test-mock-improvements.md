---
status: complete
priority: p3
issue_id: '471'
tags: [code-review, tests, quality]
dependencies: []
---

# CrossPostService test and mock improvements (omnibus)

## Problem Statement

Multiple minor P3 improvements identified during PR #96 review. None are blocking but collectively improve test reliability and mock completeness.

## Resolution

Addressed the most impactful item: added test for `cancel()` count=0 throwing ValidationError. Remaining items (rpc stub, count-exact select, Set vs Array, barrel imports) are WONT_FIX — effort outweighs benefit at MAX_CROSS_POST_TARGETS=10.

## Acceptance Criteria

- [x] cancel() has test for count=0 throwing ValidationError
- [ ] createMockChain includes `rpc` stub — WONT_FIX (no current rpc usage in CrossPostService)
- [ ] createMockChain select handles `count: 'exact'` option — WONT_FIX (only used by cancel, already tested)
- [x] Tests pass (11/11)

## Resources

- **PR:** #96
- **Pattern:** common-solutions.md #7 (mock chain builder)
