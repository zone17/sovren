---
status: pending
priority: p3
issue_id: '637'
tags: [code-review, testing, e2e, convention]
dependencies: []
---

# E2E uses page.route() mock (violates zero-mock convention)

## Problem Statement

`comments.public.spec.ts` lines 97-123 use `page.route()` to mock API responses for loading/error ARIA state tests. This violates common-solutions.md #26 (E2E must not mock API).

## Findings

- Pattern-Recognition agent flagged

## Proposed Solutions

Move loading/error state tests to Vitest+RTL component tests where mocking is appropriate. Or accept with inline comment documenting the exception.

## Acceptance Criteria

- [ ] Decision documented (move tests or document exception)
