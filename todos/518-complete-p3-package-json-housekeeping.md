---
status: pending
priority: p3
issue_id: 518
tags: [code-review, dependencies, housekeeping]
dependencies: []
---

# Backend package.json Housekeeping

## Problem Statement

Multiple pre-existing dependency hygiene issues in `packages/backend/package.json`:

1. **10 `@types/*` packages in `dependencies`** instead of `devDependencies` (lines 52-61) — inflates production Docker images
2. **`supertest` in `dependencies`** (line 87) — test-only library shipped to production
3. **Duplicate `@types/supertest`** — `^6.0.3` in dependencies (line 60) AND `^6.0.2` in devDependencies (line 109)
4. **Dependencies not alphabetically sorted** — new deps appended at end instead of interleaved
5. **`joi` + `zod` coexistence** — joi used in 1 file, zod is project standard

## Findings

**4+ agents flagged:** Pattern Recognition, Architecture, Simplicity, TypeScript. All noted as pre-existing.

## Proposed Solutions

Run a single cleanup pass:

- Move 10 `@types/*` from dependencies to devDependencies
- Move `supertest` to devDependencies
- Remove duplicate `@types/supertest` from dependencies
- Alphabetically sort both sections (or use `npx sort-package-json`)

**Effort:** Small (mechanical, no code changes)

## Acceptance Criteria

- [ ] Zero `@types/*` packages in `dependencies`
- [ ] `supertest` in `devDependencies` only
- [ ] No duplicate entries
- [ ] `npm install` succeeds after changes

## Work Log

| Date       | Action                       | Learnings                       |
| ---------- | ---------------------------- | ------------------------------- |
| 2026-02-25 | Created during PR #98 review | Pre-existing; 4+ agents flagged |
