---
status: pending
priority: p2
issue_id: '572'
tags: [code-review, pr-108, testing, frontend]
---

# Add tests for debounce behavior and useDebouncedValue hook

## Problem Statement

The `useDiscovery` hook's debounce behavior and `enabled` guard (queries with <2 chars don't fire) are untested. The new shared `useDebouncedValue` hook has zero tests. CLAUDE.md requires 95%+ coverage for new code.

**Consensus: 3/9 agents (Kieran TS, Git History, Pattern Recognition)**

## Findings

- `useDiscovery.test.tsx`: 4 tests, none test debounce or enabled guard
- `useDebouncedValue.ts`: new shared hook in `src/hooks/`, zero tests
- `enabled: !debouncedQuery || debouncedQuery.length >= 2` — untested

## Proposed Solutions

1. Add `useDebouncedValue.test.ts` with: debounce delay, cleanup on unmount, immediate value
2. Add to `useDiscovery.test.tsx`: 1-char query doesn't fetch, debounce prevents rapid fetches
3. Add `staleTime: 0` to test QueryClient defaults

## Acceptance Criteria

- [ ] useDebouncedValue has dedicated unit tests
- [ ] useDiscovery tests cover 1-char query disabled behavior
- [ ] Test QueryClient configured with staleTime: 0
