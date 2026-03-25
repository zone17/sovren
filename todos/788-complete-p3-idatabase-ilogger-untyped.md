---
status: pending
priority: p3
issue_id: 788
tags: [code-review, typescript, interfaces]
dependencies: []
---

# IDatabase Untyped Index Signature + ILogger Any Params

## Problem Statement

IDatabase has `[key: string]: any` index signature allowing arbitrary property access. ILogger uses `any` for all metadata parameters, making logging calls never type-checked.

## Findings

- **TypeScript Agent**: P1-3, P1-4

## Proposed Solutions

Remove IDatabase index signature. Change ILogger meta to `Record<string, unknown>`.

## Acceptance Criteria

- [ ] IDatabase has no index signature
- [ ] ILogger uses Record<string, unknown>
