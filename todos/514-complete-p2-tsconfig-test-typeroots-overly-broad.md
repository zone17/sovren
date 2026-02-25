---
status: pending
priority: p2
issue_id: 514
tags: [code-review, typescript, configuration]
dependencies: []
---

# tsconfig.test.json typeRoots Override is Overly Broad

## Problem Statement

`packages/backend/tsconfig.test.json` adds `"./node_modules"` to `typeRoots`:

```json
"typeRoots": ["./node_modules/@types", "./node_modules"]
```

Adding `"./node_modules"` as a typeRoot exposes ALL packages in `node_modules/` as potential type providers. In a monorepo with hoisted dependencies and workspace symlinks, this can cause subtle type pollution — packages with ambient module declarations may leak types into the compilation context.

## Findings

**TypeScript Reviewer (P2):** The `types` field restricts which packages from `typeRoots` are loaded, but some packages have ambient module declarations that can leak. With npm workspaces and hoisting, the local `node_modules` may contain workspace symlinks that expose unexpected types.

## Proposed Solutions

### Option A: Drop typeRoots override entirely (Recommended)

- Remove `typeRoots` from `tsconfig.test.json`
- Rely on vitest's `globals: true` in `vitest.config.ts` for runtime injection
- If IDE needs types, use `/// <reference types="vitest/globals" />` in a setup file
- **Pros:** Cleanest, no type pollution risk
- **Cons:** May need a `vitest-env.d.ts` reference file
- **Effort:** Small
- **Risk:** Low

### Option B: Narrow to `@types` directories only

```json
"typeRoots": ["./node_modules/@types", "../../node_modules/@types"]
```

- **Pros:** Expands scope to root-hoisted @types without exposing all packages
- **Cons:** Still doesn't resolve `vitest/globals` which isn't under `@types/`
- **Effort:** Small
- **Risk:** Low

### Option C: Keep current but add documentation

- Add comment explaining why `"./node_modules"` is needed
- **Pros:** No code change
- **Cons:** Type pollution risk remains
- **Effort:** Trivial
- **Risk:** Medium (latent issue)

## Technical Details

**Affected file:** `packages/backend/tsconfig.test.json`

## Acceptance Criteria

- [ ] `vitest/globals` types resolve in IDE for test files
- [ ] No `"./node_modules"` in typeRoots (or documented justification)
- [ ] Backend tests still pass: `npm run test`

## Work Log

| Date       | Action                       | Learnings                                                      |
| ---------- | ---------------------------- | -------------------------------------------------------------- |
| 2026-02-25 | Created during PR #98 review | TypeScript reviewer identified; one agent flagged specifically |

## Resources

- PR #98: fix/backend-startup
